import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/iot — list SIM cards with filters + KPI summary
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'iot.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const operator = searchParams.get('operator') || ''
  const status = searchParams.get('status') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)

  const where: any = {}
  if (search) where.iccid = { contains: search }
  if (operator) where.operator = operator
  if (status) where.status = status

  const [sims, total] = await Promise.all([
    db.simCard.findMany({
      where,
      include: { device: { select: { deviceId: true, city: { select: { name: true } } } } },
      orderBy: { activationDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.simCard.count({ where }),
  ])

  // KPI summary
  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000)
  const allSims = await db.simCard.findMany({
    select: { status: true, currentUsageMb: true, monthlyAllowanceMb: true, renewalDate: true },
  })
  const activeCount = allSims.filter((s) => s.status === 'active').length
  const suspendedCount = allSims.filter((s) => s.status === 'suspended').length
  const offlineCount = allSims.filter((s) => s.status === 'offline').length
  const expiringSoon = allSims.filter(
    (s) => s.renewalDate && s.renewalDate <= sevenDaysFromNow && s.renewalDate >= now
  ).length
  const highUsage = allSims.filter(
    (s) => s.monthlyAllowanceMb > 0 && (s.currentUsageMb / s.monthlyAllowanceMb) * 100 >= 80
  ).length

  return NextResponse.json({
    sims: sims.map((s) => ({
      id: s.id,
      iccid: s.iccid,
      imei: s.imei,
      operator: s.operator,
      network: s.network,
      dataPlan: s.dataPlan,
      monthlyAllowanceMb: s.monthlyAllowanceMb,
      currentUsageMb: s.currentUsageMb,
      usagePct: s.monthlyAllowanceMb > 0 ? Math.round((s.currentUsageMb / s.monthlyAllowanceMb) * 100) : 0,
      activationDate: s.activationDate,
      renewalDate: s.renewalDate,
      status: s.status,
      device: s.device
        ? { deviceId: s.device.deviceId, city: s.device.city?.name || '—' }
        : null,
    })),
    total,
    page,
    pageSize,
    kpis: { activeCount, suspendedCount, offlineCount, expiringSoon, highUsage, total: allSims.length },
  })
}

// POST /api/iot — register a new SIM
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'iot.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { iccid, imei, operator, network, dataPlan, monthlyAllowanceMb, activationDate, renewalDate } = body

  if (!iccid || !operator) {
    return NextResponse.json({ error: 'ICCID and operator are required' }, { status: 400 })
  }

  const existing = await db.simCard.findUnique({ where: { iccid } })
  if (existing) return NextResponse.json({ error: 'SIM with this ICCID already exists' }, { status: 409 })

  const sim = await db.simCard.create({
    data: {
      iccid,
      imei: imei || null,
      operator,
      network: network || '4G',
      dataPlan: dataPlan || '1GB/day',
      monthlyAllowanceMb: parseInt(monthlyAllowanceMb) || 1024,
      currentUsageMb: 0,
      activationDate: activationDate ? new Date(activationDate) : new Date(),
      renewalDate: renewalDate ? new Date(renewalDate) : null,
      status: 'active',
    },
  })

  await auditLog({ user, action: 'sim_create', entity: 'sim', entityId: sim.id, details: `Registered SIM ${iccid} (${operator})` })
  return NextResponse.json({ sim }, { status: 201 })
}
