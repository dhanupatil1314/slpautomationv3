import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// GET /api/dashboard — executive KPIs, charts, and activity feed
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const last7Days = new Date(now.getTime() - 7 * 86400000)

  const [deviceStatuses, activeCampaigns, activeAdvertisers, activeVehicles, activeDrivers,
    todayPlays, monthRevenue, pendingPayouts, openTickets] = await Promise.all([
    db.device.groupBy({ by: ['status'], _count: true }),
    db.campaign.count({ where: { status: 'live' } }),
    db.advertiser.count({ where: { status: 'active' } }),
    db.vehicle.count({ where: { status: 'active' } }),
    db.driver.count({ where: { status: 'active' } }),
    db.playbackEvent.count({ where: { timestamp: { gte: todayStart } } }),
    db.payment.aggregate({ where: { status: 'success', createdAt: { gte: monthStart } }, _sum: { amount: true } }),
    db.payout.count({ where: { status: { in: ['pending', 'under_review'] } } }),
    db.serviceTicket.count({ where: { status: { in: ['open', 'assigned', 'in_progress'] } } }),
  ])

  const statusMap: Record<string, number> = {}
  deviceStatuses.forEach((s) => (statusMap[s.status] = s._count))
  const totalDevices = Object.values(statusMap).reduce((a, b) => a + b, 0)
  const onlineDevices = statusMap['online'] || 0
  const warningDevices = statusMap['warning'] || 0
  const offlineCount = statusMap['offline'] || 0

  // Revenue chart — last 6 months
  const revenueByMonth: { month: string; revenue: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const rev = await db.payment.aggregate({
      where: { status: 'success', createdAt: { gte: mStart, lt: mEnd } },
      _sum: { amount: true },
    })
    revenueByMonth.push({
      month: mStart.toLocaleDateString('en-IN', { month: 'short' }),
      revenue: rev._sum.amount || 0,
    })
  }

  // Campaign performance — top 5 by playback
  const topCampaignsRaw = await db.playbackEvent.groupBy({
    by: ['campaignId'],
    where: { timestamp: { gte: last7Days }, status: 'completed' },
    _count: true,
    orderBy: { _count: { campaignId: 'desc' } },
    take: 5,
  })
  const campaignIds = topCampaignsRaw.map((c) => c.campaignId).filter(Boolean) as string[]
  const campaigns = await db.campaign.findMany({ where: { id: { in: campaignIds } }, select: { id: true, name: true } })
  const campaignMap = new Map(campaigns.map((c) => [c.id, c.name]))
  const topCampaigns = topCampaignsRaw.map((c) => ({
    name: campaignMap.get(c.campaignId || '') || 'Unknown',
    plays: c._count,
  }))

  // Ad playback — hourly today
  const hourlyPlays: { hour: string; plays: number }[] = []
  for (let h = 0; h < 24; h += 2) {
    const hStart = new Date(todayStart.getTime() + h * 3600000)
    const hEnd = new Date(todayStart.getTime() + (h + 2) * 3600000)
    const count = await db.playbackEvent.count({
      where: { timestamp: { gte: hStart, lt: hEnd > now ? now : hEnd } },
    })
    hourlyPlays.push({ hour: `${String(h).padStart(2, '0')}:00`, plays: count })
  }

  // Offline device list (recent)
  const offlineList = await db.device.findMany({
    where: { status: { in: ['offline', 'warning'] } },
    take: 8,
    orderBy: { lastHeartbeat: 'desc' },
    include: { city: true, vehicle: true },
  })

  // Critical alerts
  const criticalAlerts = await db.alert.findMany({
    where: { severity: 'critical', acknowledged: false },
    take: 6,
    orderBy: { createdAt: 'desc' },
    include: { device: { select: { deviceId: true } } },
  })

  // Recent activity (audit logs)
  const recentActivity = await db.auditLog.findMany({
    take: 8,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, role: true } } },
  })

  // City-wise device distribution for map
  const cityDevices = await db.device.findMany({
    where: { status: { in: ['online', 'offline', 'warning'] } },
    select: { id: true, deviceId: true, latitude: true, longitude: true, status: true, cityId: true, lastHeartbeat: true, signalStrength: true, city: { select: { name: true } } },
  })

  return NextResponse.json({
    kpis: {
      totalDevices, onlineDevices, offlineDevices: offlineCount, warningDevices,
      activeCampaigns, activeAdvertisers, activeVehicles, activeDrivers, todayPlays,
      monthlyRevenue: monthRevenue._sum.amount || 0, pendingPayouts, openServiceTickets: openTickets,
    },
    deviceStatus: {
      online: onlineDevices, offline: offlineCount, warning: warningDevices,
      maintenance: statusMap['maintenance'] || 0, suspended: statusMap['suspended'] || 0,
    },
    revenueByMonth, topCampaigns, hourlyPlays,
    offlineList: offlineList.map((d) => ({
      id: d.id, deviceId: d.deviceId, status: d.status, city: d.city?.name || '—',
      lastHeartbeat: d.lastHeartbeat, vehicleReg: d.vehicle?.registrationNo || '—', signal: d.signalStrength,
    })),
    criticalAlerts: criticalAlerts.map((a) => ({
      id: a.id, type: a.type, message: a.message, severity: a.severity,
      deviceId: a.device?.deviceId, createdAt: a.createdAt,
    })),
    recentActivity: recentActivity.map((l) => ({
      id: l.id, action: l.action, entity: l.entity, details: l.details,
      user: l.user?.name || 'System', role: l.user?.role, createdAt: l.createdAt,
    })),
    mapDevices: cityDevices,
  })
}
