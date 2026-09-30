import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// GET /api/leaderboard — advertiser performance leaderboard
// Ranks advertisers by: total spend, campaign count, playback reach, active campaigns

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'advertisers.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const advertisers = await db.advertiser.findMany({
    where: { status: 'active' },
    include: {
      organization: { select: { name: true } },
      _count: { select: { campaigns: true, media: true, invoices: true } },
    },
    take: 50,
  })

  const ranked = await Promise.all(advertisers.map(async (a) => {
    const [campaignStats, totalSpend, totalPlays, activeCampaigns] = await Promise.all([
      db.campaign.aggregate({
        where: { advertiserId: a.id },
        _sum: { budget: true, amountPaid: true },
      }),
      db.payment.aggregate({
        where: { invoice: { advertiserId: a.id }, status: 'success' },
        _sum: { amount: true },
      }),
      db.playbackEvent.count({
        where: { campaign: { advertiserId: a.id } },
      }),
      db.campaign.count({
        where: { advertiserId: a.id, status: 'live' },
      }),
    ])

    const totalBudget = campaignStats._sum.budget || 0
    const totalPaid = campaignStats._sum.amountPaid || 0
    const actualSpend = totalSpend._sum.amount || 0
    const campaignCount = a._count.campaigns
    const mediaCount = a._count.media

    // Performance score: weighted combination
    // - Spend (40 pts, normalized to max)
    // - Campaign count (20 pts)
    // - Total plays (25 pts)
    // - Active campaigns (15 pts)
    return {
      id: a.id,
      name: a.organization?.name || a.contactName,
      contactName: a.contactName,
      category: a.category || '—',
      totalSpend: actualSpend,
      totalBudget,
      totalPaid,
      campaignCount,
      activeCampaigns,
      mediaCount,
      totalPlays,
      avgSpendPerCampaign: campaignCount > 0 ? actualSpend / campaignCount : 0,
    }
  }))

  // Find max values for normalization
  const maxSpend = Math.max(...ranked.map((r) => r.totalSpend), 1)
  const maxPlays = Math.max(...ranked.map((r) => r.totalPlays), 1)
  const maxCampaigns = Math.max(...ranked.map((r) => r.campaignCount), 1)

  // Compute performance scores
  const scored = ranked.map((r) => ({
    ...r,
    performanceScore: Math.round(
      (r.totalSpend / maxSpend) * 40 +
      (r.campaignCount / maxCampaigns) * 20 +
      (r.totalPlays / maxPlays) * 25 +
      r.activeCampaigns * 5
    ),
  }))

  // Sort by performance score
  scored.sort((a, b) => b.performanceScore - a.performanceScore)

  // Assign ranks
  const leaderboard = scored.map((r, i) => ({
    ...r,
    rank: i + 1,
    tier: i < 3 ? 'platinum' : i < 6 ? 'gold' : i < 10 ? 'silver' : 'bronze',
  }))

  // Summary
  const summary = {
    totalAdvertisers: leaderboard.length,
    totalSpend: leaderboard.reduce((s, r) => s + r.totalSpend, 0),
    totalCampaigns: leaderboard.reduce((s, r) => s + r.campaignCount, 0),
    totalPlays: leaderboard.reduce((s, r) => s + r.totalPlays, 0),
    avgPerformanceScore: leaderboard.length > 0 ? Math.round(leaderboard.reduce((s, r) => s + r.performanceScore, 0) / leaderboard.length) : 0,
  }

  // Category breakdown
  const categoryMap = new Map<string, { count: number; spend: number }>()
  for (const r of leaderboard) {
    if (!categoryMap.has(r.category)) categoryMap.set(r.category, { count: 0, spend: 0 })
    const c = categoryMap.get(r.category)!
    c.count++
    c.spend += r.totalSpend
  }
  const byCategory = Array.from(categoryMap.entries())
    .map(([category, data]) => ({ category, ...data, avgSpend: data.spend / data.count }))
    .sort((a, b) => b.spend - a.spend)

  return NextResponse.json({
    leaderboard: leaderboard.slice(0, 20),
    summary,
    byCategory,
  })
}
