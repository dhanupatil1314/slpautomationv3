import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// GET /api/revenue — revenue transactions + aggregated totals + charts
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'revenue.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)
  const range = searchParams.get('range') || '30d'
  const city = searchParams.get('city') || ''
  const campaignId = searchParams.get('campaignId') || ''
  const fromStr = searchParams.get('from') || ''
  const toStr = searchParams.get('to') || ''

  const now = new Date()
  let from: Date | null = null
  let to: Date | null = null
  if (range === 'today') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    to = now
  } else if (range === '7d') {
    from = new Date(now.getTime() - 7 * 86400000)
    to = now
  } else if (range === '30d') {
    from = new Date(now.getTime() - 30 * 86400000)
    to = now
  } else if (range === 'ytd') {
    from = new Date(now.getFullYear(), 0, 1)
    to = now
  } else if (range === 'custom' && fromStr && toStr) {
    from = new Date(fromStr)
    to = new Date(toStr)
    to.setHours(23, 59, 59, 999)
  }

  const where: any = {}
  if (from || to) {
    where.recordedAt = {}
    if (from) where.recordedAt.gte = from
    if (to) where.recordedAt.lte = to
  }
  if (city) where.city = city
  if (campaignId) where.campaignId = campaignId

  const [transactions, total, totalsAgg] = await Promise.all([
    db.revenueTransaction.findMany({
      where,
      include: {
        campaign: { select: { id: true, name: true, advertiser: { select: { id: true, organization: { select: { name: true } } } } } },
      },
      orderBy: { recordedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.revenueTransaction.count({ where }),
    db.revenueTransaction.aggregate({
      where,
      _sum: {
        grossRevenue: true, platformShare: true, ownerShare: true, driverShare: true,
        iotCost: true, cloudCost: true, paymentFee: true, netRevenue: true,
      },
    }),
  ])

  // Trend chart (last 6 months regardless of range filter for trend context)
  const trend: { month: string; gross: number; platform: number; owner: number; driver: number; net: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const agg = await db.revenueTransaction.aggregate({
      where: { recordedAt: { gte: mStart, lt: mEnd } },
      _sum: { grossRevenue: true, platformShare: true, ownerShare: true, driverShare: true, netRevenue: true },
    })
    trend.push({
      month: mStart.toLocaleDateString('en-IN', { month: 'short' }),
      gross: agg._sum.grossRevenue || 0,
      platform: agg._sum.platformShare || 0,
      owner: agg._sum.ownerShare || 0,
      driver: agg._sum.driverShare || 0,
      net: agg._sum.netRevenue || 0,
    })
  }

  // City-wise revenue
  const cityAgg = await db.revenueTransaction.groupBy({
    by: ['city'],
    where,
    _sum: { grossRevenue: true, netRevenue: true },
    orderBy: { _sum: { grossRevenue: 'desc' } },
    take: 10,
  })

  // Lookup lists for filters
  const [cities, campaigns] = await Promise.all([
    db.city.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.campaign.findMany({
      where: { revenueTransactions: { some: {} } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const sums = totalsAgg._sum
  const maintenanceCost = (sums.iotCost || 0) + (sums.cloudCost || 0)

  return NextResponse.json({
    transactions: transactions.map((t) => ({
      id: t.id,
      recordedAt: t.recordedAt,
      campaignId: t.campaignId,
      campaignName: t.campaign?.name || '—',
      advertiserName: t.campaign?.advertiser?.organization?.name || '—',
      grossRevenue: t.grossRevenue,
      platformShare: t.platformShare,
      ownerShare: t.ownerShare,
      driverShare: t.driverShare,
      iotCost: t.iotCost,
      cloudCost: t.cloudCost,
      paymentFee: t.paymentFee,
      netRevenue: t.netRevenue,
      city: t.city || '—',
    })),
    total, page, pageSize,
    totals: {
      grossRevenue: sums.grossRevenue || 0,
      platformShare: sums.platformShare || 0,
      ownerShare: sums.ownerShare || 0,
      driverShare: sums.driverShare || 0,
      iotCost: sums.iotCost || 0,
      cloudCost: sums.cloudCost || 0,
      maintenanceCost,
      paymentFee: sums.paymentFee || 0,
      netRevenue: sums.netRevenue || 0,
    },
    trend,
    cityBreakdown: cityAgg.map((c) => ({
      city: c.city || 'Unknown',
      gross: c._sum.grossRevenue || 0,
      net: c._sum.netRevenue || 0,
    })),
    filters: {
      cities: cities.map((c) => ({ id: c.id, name: c.name })),
      campaigns: campaigns.map((c) => ({ id: c.id, name: c.name })),
    },
  })
}
