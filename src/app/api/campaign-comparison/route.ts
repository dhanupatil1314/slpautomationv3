import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// GET /api/campaign-comparison?ids=id1,id2,id3
// Returns side-by-side comparison of campaign performance metrics
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'analytics.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const ids = (searchParams.get('ids') || '').split(',').filter(Boolean)

  if (ids.length === 0) {
    // Return list of campaigns with playback for selection
    const campaigns = await db.campaign.findMany({
      where: { playbackEvents: { some: {} } },
      select: {
        id: true, name: true, status: true, advertiserId: true,
        startDate: true, endDate: true, budget: true,
        advertiser: { select: { organization: { select: { name: true } } } },
        _count: { select: { playbackEvents: true, devices: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return NextResponse.json({
      campaigns: campaigns.map((c) => ({
        id: c.id, name: c.name, status: c.status,
        advertiser: c.advertiser?.organization?.name || '—',
        startDate: c.startDate, endDate: c.endDate,
        budget: c.budget, deviceCount: c._count.devices,
        playCount: c._count.playbackEvents,
      })),
    })
  }

  // Fetch detailed comparison data for selected campaigns
  const campaigns = await db.campaign.findMany({
    where: { id: { in: ids } },
    include: {
      advertiser: { select: { organization: { select: { name: true } } } },
      playlist: { select: { name: true, _count: { select: { items: true } } } },
      _count: { select: { devices: true } },
    },
  })

  // Get playback stats for each campaign
  const comparison = await Promise.all(campaigns.map(async (c) => {
    const [completed, partial, failed, totalDuration, uniqueDevices] = await Promise.all([
      db.playbackEvent.count({ where: { campaignId: c.id, status: 'completed' } }),
      db.playbackEvent.count({ where: { campaignId: c.id, status: 'partial' } }),
      db.playbackEvent.count({ where: { campaignId: c.id, status: 'failed' } }),
      db.playbackEvent.aggregate({ where: { campaignId: c.id }, _sum: { durationSec: true } }),
      db.playbackEvent.findMany({ where: { campaignId: c.id }, distinct: ['deviceId'], select: { deviceId: true } }),
    ])

    const total = completed + partial + failed
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
    const successRate = total > 0 ? Math.round(((completed + partial) / total) * 100) : 0
    const daysActive = c.startDate && c.endDate
      ? Math.max(1, Math.ceil((c.endDate.getTime() - c.startDate.getTime()) / 86400000))
      : 0
    const avgPlaysPerDay = daysActive > 0 ? Math.round(total / daysActive) : 0
    const costPerPlay = total > 0 && c.budget > 0 ? c.budget / total : 0
    const totalPlaytimeHours = (uniqueDevices.length > 0 ? (totalDuration._sum.durationSec || 0) : 0) / 3600

    return {
      id: c.id,
      name: c.name,
      status: c.status,
      advertiser: c.advertiser?.organization?.name || '—',
      playlist: c.playlist?.name || '—',
      playlistItems: c.playlist?._count.items || 0,
      startDate: c.startDate,
      endDate: c.endDate,
      budget: c.budget,
      deviceCount: c._count.devices,
      activeDevices: uniqueDevices.length,
      metrics: {
        totalPlays: total,
        completed,
        partial,
        failed,
        completionRate,
        successRate,
        avgPlaysPerDay,
        costPerPlay: parseFloat(costPerPlay.toFixed(2)),
        totalPlaytimeHours: parseFloat(totalPlaytimeHours.toFixed(1)),
        daysActive,
      },
    }
  }))

  return NextResponse.json({ comparison })
}
