import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// GET /api/qr/stats — QR scan analytics summary
// Returns total scans, scans by media, scans by day (last 14 days)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'analytics.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const mediaId = searchParams.get('mediaId') || ''
  const days = parseInt(searchParams.get('days') || '14')

  const startDate = new Date(Date.now() - days * 86400000)

  const where: any = { timestamp: { gte: startDate } }
  if (mediaId) where.mediaId = mediaId

  const [totalScans, byMedia, recent] = await Promise.all([
    db.qrScanEvent.count({ where }),
    db.qrScanEvent.groupBy({
      by: ['mediaId'],
      where,
      _count: true,
      orderBy: { _count: { mediaId: 'desc' } },
      take: 10,
    }),
    db.qrScanEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 20,
      include: { media: { select: { name: true } } },
    }),
  ])

  // Build daily trend from recent events (fetch more for trend)
  const allScans = await db.qrScanEvent.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: 1000,
    select: { timestamp: true },
  })
  const dayMap = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const key = d.toISOString().slice(0, 10)
    dayMap.set(key, 0)
  }
  allScans.forEach((s) => {
    const key = new Date(s.timestamp).toISOString().slice(0, 10)
    dayMap.set(key, (dayMap.get(key) || 0) + 1)
  })
  const dailyTrend = Array.from(dayMap.entries()).map(([date, scans]) => ({ date, scans }))

  // Fetch media names for top scanned
  const mediaIds = byMedia.map((m) => m.mediaId).filter(Boolean) as string[]
  const mediaRecords = await db.media.findMany({ where: { id: { in: mediaIds } }, select: { id: true, name: true } })
  const mediaMap = new Map(mediaRecords.map((m) => [m.id, m.name]))

  return NextResponse.json({
    totalScans,
    byMedia: byMedia.map((m) => ({ mediaId: m.mediaId, name: mediaMap.get(m.mediaId || '') || 'Unknown', scans: m._count })),
    dailyTrend,
    recent: recent.map((s) => ({
      id: s.id,
      url: s.url,
      mediaName: s.media?.name || '—',
      timestamp: s.timestamp,
      ipAddress: s.ipAddress,
    })),
  })
}
