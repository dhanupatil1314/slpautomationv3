import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// GET /api/export/devices?status=&city=&search=
// Returns CSV file with all matching devices (server-side, full dataset)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'devices.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const city = searchParams.get('city') || ''

  const where: any = {}
  if (search) {
    where.OR = [
      { deviceId: { contains: search } },
      { serialNumber: { contains: search } },
      { imei: { contains: search } },
    ]
  }
  if (status) where.status = status
  if (city) where.city = { name: city }

  const devices = await db.device.findMany({
    where,
    include: {
      city: { select: { name: true } },
      vehicle: { select: { registrationNo: true, driver: { select: { name: true } }, owner: { select: { name: true } } } },
      sim: { select: { operator: true } },
    },
    orderBy: { lastHeartbeat: 'desc' },
    take: 5000, // safety cap
  })

  const rows = devices.map((d) => ({
    DeviceID: d.deviceId,
    SerialNumber: d.serialNumber,
    IMEI: d.imei,
    Model: d.model || '',
    PlayerVersion: d.playerVersion || '',
    AndroidVersion: d.androidVersion || '',
    Status: d.status,
    City: d.city?.name || '',
    Zone: d.zone || '',
    VehicleReg: d.vehicle?.registrationNo || '',
    Driver: d.vehicle?.driver?.name || '',
    Owner: d.vehicle?.owner?.name || '',
    NetworkType: d.networkType || '',
    SignalStrength: d.signalStrength ?? '',
    Temperature: d.temperature ?? '',
    StorageUsage: d.storageUsage ?? '',
    RamUsage: d.ramUsage ?? '',
    UptimeSeconds: d.uptimeSeconds,
    LastHeartbeat: d.lastHeartbeat ? new Date(d.lastHeartbeat).toISOString() : '',
    SIMOperator: d.sim?.operator || '',
    InstallationDate: new Date(d.installationDate).toISOString(),
  }))

  const headers = Object.keys(rows[0] || { DeviceID: '' }).map((k) => ({ key: k, label: k }))
  const csv = toCsv(rows, headers)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="lakhirad-devices-${new Date().toISOString().slice(0, 10)}.csv"`,
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
