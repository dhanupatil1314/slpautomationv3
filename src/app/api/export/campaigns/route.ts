import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// GET /api/export/campaigns?status=&advertiserId=
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'campaigns.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || ''
  const advertiserId = searchParams.get('advertiserId') || ''

  const where: any = {}
  if (status) where.status = status
  if (advertiserId) where.advertiserId = advertiserId

  const campaigns = await db.campaign.findMany({
    where,
    include: {
      advertiser: { include: { organization: { select: { name: true } } } },
      playlist: { select: { name: true } },
      _count: { select: { devices: true, playbackEvents: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  })

  const rows = campaigns.map((c) => ({
    Name: c.name,
    Advertiser: c.advertiser?.organization?.name || '',
    Playlist: c.playlist?.name || '',
    Status: c.status,
    Priority: c.priority,
    StartDate: c.startDate ? new Date(c.startDate).toISOString().slice(0, 10) : '',
    EndDate: c.endDate ? new Date(c.endDate).toISOString().slice(0, 10) : '',
    StartTime: c.startTime || '',
    EndTime: c.endTime || '',
    DaysOfWeek: c.daysOfWeek || '',
    FrequencyPerHour: c.frequencyPerHour,
    Budget: c.budget,
    PriceQuoted: c.priceQuoted,
    AmountPaid: c.amountPaid,
    TargetCities: c.targetCities || '',
    TargetZones: c.targetZones || '',
    TargetDeviceCount: c.targetDeviceCount,
    AssignedDevices: c._count.devices,
    TotalPlaybackEvents: c._count.playbackEvents,
    CreatedAt: new Date(c.createdAt).toISOString(),
  }))

  const headers = Object.keys(rows[0] || { Name: '' }).map((k) => ({ key: k, label: k }))
  const csv = toCsv(rows, headers)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="lakhirad-campaigns-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}

function toCsv(rows: Record<string, any>[], headers: { key: string; label: string }[]): string {
  if (rows.length === 0) return headers.map((h) => h.label).join(',')
  const headerRow = headers.map((h) => escape(h.label)).join(',')
  const dataRows = rows.map((row) => headers.map((h) => escape(row[h.key] ?? '')).join(','))
  return [headerRow, ...dataRows].join('\r\n')
}

function escape(value: any): string {
  const str = String(value ?? '')
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}
