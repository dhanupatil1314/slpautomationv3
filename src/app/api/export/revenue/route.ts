import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// GET /api/export/revenue?days=30
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'revenue.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '30')
  const startDate = new Date(Date.now() - days * 86400000)

  const transactions = await db.revenueTransaction.findMany({
    where: { recordedAt: { gte: startDate } },
    include: { campaign: { select: { name: true, advertiser: { include: { organization: { select: { name: true } } } } } } },
    orderBy: { recordedAt: 'desc' },
    take: 5000,
  })

  const rows = transactions.map((t) => ({
    Date: new Date(t.recordedAt).toISOString(),
    Campaign: t.campaign?.name || '',
    Advertiser: t.campaign?.advertiser?.organization?.name || '',
    GrossRevenue: t.grossRevenue,
    PlatformShare: t.platformShare,
    OwnerShare: t.ownerShare,
    DriverShare: t.driverShare,
    IoTCost: t.iotCost,
    CloudCost: t.cloudCost,
    PaymentFee: t.paymentFee,
    NetRevenue: t.netRevenue,
    City: t.city || '',
  }))

  const headers = Object.keys(rows[0] || { Date: '' }).map((k) => ({ key: k, label: k }))
  const csv = toCsv(rows, headers)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="lakhirad-revenue-${new Date().toISOString().slice(0, 10)}.csv"`,
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
