import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// GET /api/budget-tracking — campaign budget tracking with burn rate analysis
// Shows budget utilization, spend velocity, projected overshoot/underspend, and alerts

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'campaigns.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date()

  // Fetch active/recent campaigns with budget > 0
  const campaigns = await db.campaign.findMany({
    where: {
      budget: { gt: 0 },
      status: { in: ['live', 'scheduled', 'paused', 'completed', 'approved'] },
    },
    include: {
      advertiser: { include: { organization: { select: { name: true } } } },
      _count: { select: { playbackEvents: true, devices: true } },
    },
    orderBy: { budget: 'desc' },
    take: 50,
  })

  const tracked = await Promise.all(campaigns.map(async (c) => {
    // Calculate spend from revenue transactions
    const spend = await db.revenueTransaction.aggregate({
      where: { campaignId: c.id },
      _sum: { grossRevenue: true },
    })
    const amountSpent = spend._sum.grossRevenue || 0

    // Calculate time progress
    let daysElapsed = 0
    let daysTotal = 0
    let daysRemaining = 0
    if (c.startDate && c.endDate) {
      const start = c.startDate.getTime()
      const end = c.endDate.getTime()
      daysTotal = Math.max(1, Math.ceil((end - start) / 86400000))
      daysElapsed = Math.min(daysTotal, Math.max(0, Math.ceil((now.getTime() - start) / 86400000)))
      daysRemaining = Math.max(0, daysTotal - daysElapsed)
    }

    // Burn rate calculations
    const budgetUtilizationPct = c.budget > 0 ? (amountSpent / c.budget) * 100 : 0
    const timeProgressPct = daysTotal > 0 ? (daysElapsed / daysTotal) * 100 : 0
    const dailyBurnRate = daysElapsed > 0 ? amountSpent / daysElapsed : 0
    const projectedTotalSpend = dailyBurnRate * daysTotal
    const projectedOvershoot = projectedTotalSpend - c.budget
    const projectedOvershootPct = c.budget > 0 ? (projectedOvershoot / c.budget) * 100 : 0

    // Status determination
    let budgetStatus: 'on_track' | 'over_budget' | 'under_spending' | 'completed' | 'not_started' = 'on_track'
    if (c.status === 'completed') budgetStatus = 'completed'
    else if (daysElapsed === 0) budgetStatus = 'not_started'
    else if (budgetUtilizationPct > timeProgressPct + 10) budgetStatus = 'over_budget'
    else if (budgetUtilizationPct < timeProgressPct - 20) budgetStatus = 'under_spending'

    // Remaining budget
    const budgetRemaining = Math.max(0, c.budget - amountSpent)

    // Daily budget allowance
    const dailyBudgetAllowance = daysTotal > 0 ? c.budget / daysTotal : 0

    return {
      id: c.id,
      name: c.name,
      advertiser: c.advertiser?.organization?.name || '—',
      status: c.status,
      budget: c.budget,
      amountPaid: c.amountPaid,
      amountSpent: parseFloat(amountSpent.toFixed(2)),
      budgetRemaining: parseFloat(budgetRemaining.toFixed(2)),
      budgetUtilizationPct: parseFloat(budgetUtilizationPct.toFixed(1)),
      timeProgressPct: parseFloat(timeProgressPct.toFixed(1)),
      daysElapsed,
      daysTotal,
      daysRemaining,
      dailyBurnRate: parseFloat(dailyBurnRate.toFixed(2)),
      dailyBudgetAllowance: parseFloat(dailyBudgetAllowance.toFixed(2)),
      projectedTotalSpend: parseFloat(projectedTotalSpend.toFixed(2)),
      projectedOvershoot: parseFloat(projectedOvershoot.toFixed(2)),
      projectedOvershootPct: parseFloat(projectedOvershootPct.toFixed(1)),
      budgetStatus,
      playbackEvents: c._count.playbackEvents,
      deviceCount: c._count.devices,
      startDate: c.startDate,
      endDate: c.endDate,
    }
  }))

  // Summary stats
  const totalBudget = tracked.reduce((s, c) => s + c.budget, 0)
  const totalSpent = tracked.reduce((s, c) => s + c.amountSpent, 0)
  const totalRemaining = tracked.reduce((s, c) => s + c.budgetRemaining, 0)
  const overBudgetCount = tracked.filter((c) => c.budgetStatus === 'over_budget').length
  const underSpendingCount = tracked.filter((c) => c.budgetStatus === 'under_spending').length
  const onTrackCount = tracked.filter((c) => c.budgetStatus === 'on_track').length

  // Top overspenders (highest projected overshoot)
  const topOverspenders = [...tracked]
    .filter((c) => c.projectedOvershoot > 0)
    .sort((a, b) => b.projectedOvershoot - a.projectedOvershoot)
    .slice(0, 5)

  // Top underspenders (most budget remaining relative to time elapsed)
  const topUnderspenders = [...tracked]
    .filter((c) => c.budgetStatus === 'under_spending')
    .sort((a, b) => (b.timeProgressPct - b.budgetUtilizationPct) - (a.timeProgressPct - a.budgetUtilizationPct))
    .slice(0, 5)

  return NextResponse.json({
    campaigns: tracked,
    summary: {
      totalBudget: parseFloat(totalBudget.toFixed(2)),
      totalSpent: parseFloat(totalSpent.toFixed(2)),
      totalRemaining: parseFloat(totalRemaining.toFixed(2)),
      overallUtilizationPct: totalBudget > 0 ? parseFloat(((totalSpent / totalBudget) * 100).toFixed(1)) : 0,
      overBudgetCount,
      underSpendingCount,
      onTrackCount,
      totalCampaigns: tracked.length,
    },
    topOverspenders,
    topUnderspenders,
  })
}
