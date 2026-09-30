import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// GET /api/playback-monitor — real-time playback monitoring
// Shows: today's playback stats, hourly trend, active campaigns right now,
// top performing devices, failure rate, completion distribution

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'playback.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const lastHour = new Date(now.getTime() - 3600000)
  const last24h = new Date(now.getTime() - 86400000)

  // Today's stats
  const [todayTotal, todayCompleted, todayPartial, todayFailed, last24hTotal, lastHourTotal] = await Promise.all([
    db.playbackEvent.count({ where: { timestamp: { gte: todayStart } } }),
    db.playbackEvent.count({ where: { timestamp: { gte: todayStart }, status: 'completed' } }),
    db.playbackEvent.count({ where: { timestamp: { gte: todayStart }, status: 'partial' } }),
    db.playbackEvent.count({ where: { timestamp: { gte: todayStart }, status: 'failed' } }),
    db.playbackEvent.count({ where: { timestamp: { gte: last24h } } }),
    db.playbackEvent.count({ where: { timestamp: { gte: lastHour } } }),
  ])

  const completionRate = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0
  const failureRate = todayTotal > 0 ? Math.round((todayFailed / todayTotal) * 100) : 0

  // Hourly trend (last 24 hours, grouped by hour)
  const hourlyData: { hour: string; plays: number; failures: number }[] = []
  for (let h = 23; h >= 0; h--) {
    const hStart = new Date(now.getTime() - h * 3600000)
    const hEnd = new Date(now.getTime() - (h - 1) * 3600000)
    const [plays, failures] = await Promise.all([
      db.playbackEvent.count({ where: { timestamp: { gte: hStart, lt: hEnd } } }),
      db.playbackEvent.count({ where: { timestamp: { gte: hStart, lt: hEnd }, status: 'failed' } }),
    ])
    hourlyData.push({
      hour: hStart.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      plays,
      failures,
    })
  }

  // Active campaigns right now (with live status)
  const activeCampaigns = await db.campaign.findMany({
    where: { status: 'live' },
    include: {
      advertiser: { include: { organization: { select: { name: true } } } },
      _count: { select: { playbackEvents: true, devices: true } },
    },
    take: 10,
  })

  const campaignsLive = await Promise.all(activeCampaigns.map(async (c) => {
    const todayPlays = await db.playbackEvent.count({
      where: { campaignId: c.id, timestamp: { gte: todayStart } },
    })
    const lastHourPlays = await db.playbackEvent.count({
      where: { campaignId: c.id, timestamp: { gte: lastHour } },
    })
    return {
      id: c.id,
      name: c.name,
      advertiser: c.advertiser?.organization?.name || '—',
      todayPlays,
      lastHourPlays,
      totalPlays: c._count.playbackEvents,
      deviceCount: c._count.devices,
      status: c.status,
    }
  }))

  // Top performing devices today
  const topDevicesRaw = await db.playbackEvent.groupBy({
    by: ['deviceId'],
    where: { timestamp: { gte: todayStart } },
    _count: true,
    orderBy: { _count: { deviceId: 'desc' } },
    take: 5,
  })
  const deviceIds = topDevicesRaw.map((d) => d.deviceId).filter(Boolean) as string[]
  const devices = await db.device.findMany({
    where: { id: { in: deviceIds } },
    select: { id: true, deviceId: true, city: { select: { name: true } }, vehicle: { select: { registrationNo: true } }, status: true },
  })
  const deviceMap = new Map(devices.map((d) => [d.id, d]))
  const topDevices = topDevicesRaw.map((d) => {
    const dev = deviceMap.get(d.deviceId || '')
    return {
      deviceId: dev?.deviceId || '—',
      city: dev?.city?.name || '—',
      vehicleReg: dev?.vehicle?.registrationNo || '—',
      status: dev?.status || '—',
      plays: d._count,
    }
  })

  // Status distribution pie
  const statusDistribution = [
    { name: 'Completed', value: todayCompleted, fill: '#22c55e' },
    { name: 'Partial', value: todayPartial, fill: '#f59e0b' },
    { name: 'Failed', value: todayFailed, fill: '#ef4444' },
  ].filter((s) => s.value > 0)

  return NextResponse.json({
    summary: {
      todayTotal,
      todayCompleted,
      todayPartial,
      todayFailed,
      last24hTotal,
      lastHourTotal,
      completionRate,
      failureRate,
      avgPerHour: last24hTotal > 0 ? Math.round(last24hTotal / 24) : 0,
    },
    hourlyData,
    activeCampaigns: campaignsLive.sort((a, b) => b.lastHourPlays - a.lastHourPlays),
    topDevices,
    statusDistribution,
  })
}
