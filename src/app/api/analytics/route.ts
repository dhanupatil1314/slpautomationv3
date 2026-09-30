import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// GET /api/analytics — aggregated analytics for campaigns, devices, network
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'analytics.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const range = searchParams.get('range') || '7d' // today, 7d, 30d

  const now = new Date()
  let from: Date
  if (range === 'today') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  } else if (range === '30d') {
    from = new Date(now.getTime() - 30 * 86400000)
  } else {
    from = new Date(now.getTime() - 7 * 86400000)
  }
  const where = { timestamp: { gte: from, lte: now } }

  // ---------- CAMPAIGN ANALYTICS ----------
  // Top campaigns by scheduled vs verified vs failed
  const campaignAgg = await db.playbackEvent.groupBy({
    by: ['campaignId', 'status'],
    where,
    _count: true,
  })
  const campaignIds = [...new Set(campaignAgg.map((c) => c.campaignId).filter(Boolean))] as string[]
  const campaigns = await db.campaign.findMany({
    where: { id: { in: campaignIds } },
    select: {
      id: true, name: true, budget: true, priceQuoted: true, amountPaid: true,
      startDate: true, endDate: true, status: true,
    },
  })
  const campaignMap = new Map(campaigns.map((c) => [c.id, c]))

  // Devices per campaign
  const deviceCounts = await db.playbackEvent.groupBy({
    by: ['campaignId'],
    where,
    _count: { deviceId: true },
  })

  const campaignAnalytics = campaignIds.map((cid) => {
    const c = campaignMap.get(cid)
    const rows = campaignAgg.filter((a) => a.campaignId === cid)
    const completed = rows.find((r) => r.status === 'completed')?._count || 0
    const partial = rows.find((r) => r.status === 'partial')?._count || 0
    const failed = rows.find((r) => r.status === 'failed')?._count || 0
    const verified = completed + partial
    const scheduled = verified + failed
    const completionRate = scheduled > 0 ? (verified / scheduled) * 100 : 0
    return {
      id: cid,
      name: c?.name || 'Unknown',
      scheduled,
      verified,
      failed,
      completionRate: parseFloat(completionRate.toFixed(1)),
      activeDevices: deviceCounts.find((d) => d.campaignId === cid)?._count.deviceId || 0,
      spend: c?.amountPaid || 0,
      status: c?.status || '—',
    }
  }).sort((a, b) => b.verified - a.verified).slice(0, 8)

  // ---------- DEVICE ANALYTICS ----------
  const totalDevices = await db.device.count()
  const deviceStatuses = await db.device.groupBy({ by: ['status'], _count: true })
  const statusMap: Record<string, number> = {}
  deviceStatuses.forEach((s) => (statusMap[s.status] = s._count))
  const onlineDevices = statusMap['online'] || 0
  const offlineDevices = statusMap['offline'] || 0
  const warningDevices = statusMap['warning'] || 0
  const maintenanceDevices = statusMap['maintenance'] || 0

  // Aggregate device health metrics (current snapshot)
  const deviceHealth = await db.device.aggregate({
    _avg: {
      signalStrength: true, temperature: true, storageUsage: true, ramUsage: true,
    },
    _sum: { uptimeSeconds: true },
  })

  // Uptime vs downtime approximation using last 7d heartbeats
  // (Simple heuristic: ratio of devices online now vs total)
  const onlineRate = totalDevices > 0 ? (onlineDevices / totalDevices) * 100 : 0
  const downtimeRate = 100 - onlineRate

  // Per-device top issues (devices with most failed plays)
  const devicePlayAgg = await db.playbackEvent.groupBy({
    by: ['deviceId', 'status'],
    where,
    _count: true,
  })
  const deviceIds = [...new Set(devicePlayAgg.map((d) => d.deviceId))]
  const deviceRecords = await db.device.findMany({
    where: { id: { in: deviceIds } },
    select: { id: true, deviceId: true, status: true, city: { select: { name: true } } },
  })
  const deviceIdMap = new Map(deviceRecords.map((d) => [d.id, d]))

  const deviceAnalytics = deviceIds.map((did) => {
    const rec = deviceIdMap.get(did)
    const rows = devicePlayAgg.filter((a) => a.deviceId === did)
    const completed = rows.find((r) => r.status === 'completed')?._count || 0
    const failed = rows.find((r) => r.status === 'failed')?._count || 0
    const total = rows.reduce((sum, r) => sum + r._count, 0)
    const healthPct = total > 0 ? ((completed / total) * 100) : 0
    return {
      id: did,
      code: rec?.deviceId || '—',
      city: rec?.city?.name || '—',
      status: rec?.status || '—',
      completed,
      failed,
      total,
      healthPct: parseFloat(healthPct.toFixed(1)),
    }
  }).sort((a, b) => b.total - a.total).slice(0, 8)

  // ---------- NETWORK ANALYTICS ----------
  const totalPlays = await db.playbackEvent.count({ where })

  // City-wise performance
  const cityAgg = await db.playbackEvent.findMany({
    where,
    select: { device: { select: { city: { select: { name: true } } } }, status: true },
  })
  const cityMap: Record<string, { city: string; plays: number; completed: number; failed: number }> = {}
  cityAgg.forEach((p) => {
    const city = p.device?.city?.name || 'Unknown'
    if (!cityMap[city]) cityMap[city] = { city, plays: 0, completed: 0, failed: 0 }
    cityMap[city].plays++
    if (p.status === 'completed') cityMap[city].completed++
    if (p.status === 'failed') cityMap[city].failed++
  })
  const cityPerformance = Object.values(cityMap).sort((a, b) => b.plays - a.plays).slice(0, 10)

  // Network trend (daily plays over range)
  const days = range === 'today' ? 1 : range === '30d' ? 30 : 7
  const trend: { date: string; plays: number; verified: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const dStart = new Date(now.getTime() - i * 86400000)
    dStart.setHours(0, 0, 0, 0)
    const dEnd = new Date(dStart.getTime() + 86400000)
    const [plays, verified] = await Promise.all([
      db.playbackEvent.count({ where: { timestamp: { gte: dStart, lt: dEnd } } }),
      db.playbackEvent.count({ where: { timestamp: { gte: dStart, lt: dEnd }, status: 'completed' } }),
    ])
    trend.push({
      date: dStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      plays,
      verified,
    })
  }

  return NextResponse.json({
    range,
    campaignAnalytics,
    deviceAnalytics: {
      devices: deviceAnalytics,
      summary: {
        totalDevices,
        onlineDevices,
        offlineDevices,
        warningDevices,
        maintenanceDevices,
        onlineRate: parseFloat(onlineRate.toFixed(1)),
        downtimeRate: parseFloat(downtimeRate.toFixed(1)),
        avgSignal: deviceHealth._avg.signalStrength ? parseFloat(deviceHealth._avg.signalStrength.toFixed(1)) : 0,
        avgTemperature: deviceHealth._avg.temperature ? parseFloat(deviceHealth._avg.temperature.toFixed(1)) : 0,
        avgStorage: deviceHealth._avg.storageUsage ? parseFloat(deviceHealth._avg.storageUsage.toFixed(1)) : 0,
        avgRam: deviceHealth._avg.ramUsage ? parseFloat(deviceHealth._avg.ramUsage.toFixed(1)) : 0,
        totalUptimeSeconds: deviceHealth._sum.uptimeSeconds || 0,
      },
    },
    network: {
      totalDevices,
      onlineRate: parseFloat(onlineRate.toFixed(1)),
      totalPlays,
      avgUptimeSeconds: totalDevices > 0 ? Math.round((deviceHealth._sum.uptimeSeconds || 0) / totalDevices) : 0,
      cityPerformance,
      trend,
    },
  })
}
