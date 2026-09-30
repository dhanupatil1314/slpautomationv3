import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// GET /api/proof-of-play — verified playback events with filters & summary
// IMPORTANT: These are "Verified Playback" events from devices, not guaranteed human impressions.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'proof_of_play.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)
  const campaignId = searchParams.get('campaignId') || ''
  const deviceId = searchParams.get('deviceId') || ''
  const status = searchParams.get('status') || ''
  const range = searchParams.get('range') || '7d' // today, 7d, 30d, custom
  const fromStr = searchParams.get('from') || ''
  const toStr = searchParams.get('to') || ''

  // Compute date filter
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
  } else if (range === 'custom' && fromStr && toStr) {
    from = new Date(fromStr)
    to = new Date(toStr)
    to.setHours(23, 59, 59, 999)
  }

  const where: any = {}
  if (campaignId) where.campaignId = campaignId
  if (deviceId) where.deviceId = deviceId
  if (status) where.status = status
  if (from || to) {
    where.timestamp = {}
    if (from) where.timestamp.gte = from
    if (to) where.timestamp.lte = to
  }

  const [events, total, summaryRaw, activeDevices] = await Promise.all([
    db.playbackEvent.findMany({
      where,
      include: {
        campaign: { select: { id: true, name: true } },
        media: { select: { id: true, name: true, type: true, thumbnailUrl: true } },
        device: { select: { id: true, deviceId: true } },
        vehicle: { select: { id: true, registrationNo: true } },
      },
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.playbackEvent.count({ where }),
    db.playbackEvent.groupBy({ by: ['status'], where, _count: true }),
    db.playbackEvent.findMany({
      where,
      select: { deviceId: true },
      distinct: ['deviceId'],
    }),
  ])

  const statusCounts: Record<string, number> = {}
  summaryRaw.forEach((s) => (statusCounts[s.status] = s._count))
  const totalEvents = Object.values(statusCounts).reduce((a, b) => a + b, 0)
  const completed = statusCounts['completed'] || 0
  const failed = statusCounts['failed'] || 0
  const partial = statusCounts['partial'] || 0
  const completionRate = totalEvents > 0 ? ((completed / totalEvents) * 100) : 0

  // Lookup lists for filters
  const [campaigns, devices] = await Promise.all([
    db.campaign.findMany({
      where: { playbackEvents: { some: {} } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.device.findMany({
      where: { playbackEvents: { some: {} } },
      select: { id: true, deviceId: true },
      orderBy: { deviceId: 'asc' },
    }),
  ])

  return NextResponse.json({
    events: events.map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      campaignId: e.campaignId,
      campaignName: e.campaign?.name || '—',
      creativeId: e.creativeId,
      creativeName: e.media?.name || '—',
      creativeType: e.media?.type || '—',
      creativeThumb: e.media?.thumbnailUrl || null,
      deviceId: e.deviceId,
      deviceCode: e.device?.deviceId || '—',
      vehicleId: e.vehicleId,
      vehicleReg: e.vehicle?.registrationNo || '—',
      scheduledPlay: e.scheduledPlay,
      actualPlay: e.actualPlay,
      durationSec: e.durationSec,
      completionPct: e.completionPct,
      status: e.status,
    })),
    total,
    page,
    pageSize,
    summary: {
      totalVerifiedPlays: totalEvents,
      completed,
      partial,
      failed,
      completionRate: parseFloat(completionRate.toFixed(2)),
      activeDevices: activeDevices.length,
    },
    filters: {
      campaigns: campaigns.map((c) => ({ id: c.id, name: c.name })),
      devices: devices.map((d) => ({ id: d.id, code: d.deviceId })),
    },
  })
}
