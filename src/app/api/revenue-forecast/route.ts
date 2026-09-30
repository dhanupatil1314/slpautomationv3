import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// GET /api/revenue-forecast — revenue forecasting and cohort analysis
// Uses historical payment data to project future revenue with growth rate extrapolation.
// Returns: historical trend (12 months), forecast (3 months), growth rate, cohort breakdown by advertiser

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'revenue.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date()

  // Historical revenue — last 12 months
  const historical: { month: string; revenue: number; label: string }[] = []
  for (let i = 11; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const rev = await db.payment.aggregate({
      where: { status: 'success', createdAt: { gte: mStart, lt: mEnd } },
      _sum: { amount: true },
    })
    historical.push({
      month: mStart.toISOString().slice(0, 7),
      label: mStart.toLocaleDateString('en-IN', { month: 'short' }),
      revenue: rev._sum.amount || 0,
    })
  }

  // Calculate growth rate (last 3 months vs previous 3 months)
  const last3 = historical.slice(-3).reduce((s, m) => s + m.revenue, 0)
  const prev3 = historical.slice(-6, -3).reduce((s, m) => s + m.revenue, 0)
  const growthRate = prev3 > 0 ? (last3 - prev3) / prev3 : 0
  const growthPercent = parseFloat((growthRate * 100).toFixed(1))

  // Forecast next 3 months using growth rate
  const lastMonthRevenue = historical[historical.length - 1]?.revenue || 0
  const avgLast3 = last3 / 3
  const forecast: { month: string; revenue: number; label: string; isForecast: boolean }[] = []
  let projectedRevenue = avgLast3
  for (let i = 1; i <= 3; i++) {
    projectedRevenue = projectedRevenue * (1 + growthRate)
    const mStart = new Date(now.getFullYear(), now.getMonth() + i, 1)
    forecast.push({
      month: mStart.toISOString().slice(0, 7),
      label: mStart.toLocaleDateString('en-IN', { month: 'short' }),
      revenue: Math.round(projectedRevenue),
      isForecast: true,
    })
  }

  // Cohort analysis — revenue by advertiser (top 5)
  const advertiserRevenue = await db.payment.findMany({
    where: { status: 'success', createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } },
    include: { invoice: { include: { advertiser: { include: { organization: { select: { name: true } } } } } } },
    take: 500,
  })

  const cohortMap = new Map<string, { total: number; months: Set<string> }>()
  for (const p of advertiserRevenue) {
    const name = p.invoice?.advertiser?.organization?.name || 'Unknown'
    if (!cohortMap.has(name)) cohortMap.set(name, { total: 0, months: new Set() })
    const c = cohortMap.get(name)!
    c.total += p.amount
    c.months.add(p.createdAt.toISOString().slice(0, 7))
  }

  const cohorts = Array.from(cohortMap.entries())
    .map(([advertiser, data]) => ({
      advertiser,
      revenue: data.total,
      activeMonths: data.months.size,
      avgMonthly: parseFloat((data.total / Math.max(1, data.months.size)).toFixed(2)),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  // Summary stats
  const totalHistorical = historical.reduce((s, m) => s + m.revenue, 0)
  const totalForecast = forecast.reduce((s, m) => s + m.revenue, 0)
  const avgMonthly = historical.length > 0 ? totalHistorical / historical.length : 0

  // Revenue by source (platform share vs driver/owner share)
  const revenueTransactions = await db.revenueTransaction.aggregate({
    where: { recordedAt: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } },
    _sum: { grossRevenue: true, platformShare: true, ownerShare: true, driverShare: true, netRevenue: true },
  })

  return NextResponse.json({
    historical,
    forecast,
    summary: {
      totalHistorical: parseFloat(totalHistorical.toFixed(2)),
      totalForecast: parseFloat(totalForecast.toFixed(2)),
      avgMonthly: parseFloat(avgMonthly.toFixed(2)),
      growthRate: growthPercent,
      projectedNextMonth: forecast[0]?.revenue || 0,
      projectedQuarter: totalForecast,
    },
    cohorts,
    revenueSplit: {
      gross: revenueTransactions._sum.grossRevenue || 0,
      platform: revenueTransactions._sum.platformShare || 0,
      owner: revenueTransactions._sum.ownerShare || 0,
      driver: revenueTransactions._sum.driverShare || 0,
      net: revenueTransactions._sum.netRevenue || 0,
    },
  })
}
