import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/driver-earnings — list earnings with filters
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'earnings.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)
  const driverId = searchParams.get('driverId') || ''
  const month = searchParams.get('month') || ''
  const status = searchParams.get('status') || ''

  const where: any = {}
  if (driverId) where.driverId = driverId
  if (month) where.month = month
  if (status) where.status = status

  const [earnings, total, totalsAgg] = await Promise.all([
    db.driverEarning.findMany({
      where,
      include: { driver: { select: { id: true, name: true, mobile: true, city: true, driverScore: true, status: true } } },
      orderBy: [{ month: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.driverEarning.count({ where }),
    db.driverEarning.aggregate({
      where,
      _sum: { baseAmount: true, revenueShare: true, uptimeBonus: true, campaignBonus: true, complianceBonus: true, servicePenalty: true, totalAmount: true },
      _avg: { screenUptimePct: true },
    }),
  ])

  // Active rule (for transparency in UI — configurable earning engine)
  const rule = await db.earningRule.findFirst({ where: { isActive: true } }) || await db.earningRule.findFirst()

  // Drivers list for filter
  const drivers = await db.driver.findMany({
    where: { driverEarnings: { some: {} } },
    select: { id: true, name: true, mobile: true },
    orderBy: { name: 'asc' },
  })

  // Distinct months
  const monthsRaw = await db.driverEarning.findMany({ where, select: { month: true }, distinct: ['month'], orderBy: { month: 'desc' } })

  return NextResponse.json({
    earnings: earnings.map((e) => ({
      id: e.id,
      driverId: e.driverId,
      driverName: e.driver?.name || '—',
      driverMobile: e.driver?.mobile,
      driverCity: e.driver?.city,
      driverScore: e.driver?.driverScore,
      driverStatus: e.driver?.status,
      month: e.month,
      baseAmount: e.baseAmount,
      revenueShare: e.revenueShare,
      uptimeBonus: e.uptimeBonus,
      campaignBonus: e.campaignBonus,
      complianceBonus: e.complianceBonus,
      servicePenalty: e.servicePenalty,
      totalAmount: e.totalAmount,
      activeDays: e.activeDays,
      screenUptimePct: e.screenUptimePct,
      status: e.status,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })),
    total, page, pageSize,
    totals: {
      baseAmount: totalsAgg._sum.baseAmount || 0,
      revenueShare: totalsAgg._sum.revenueShare || 0,
      uptimeBonus: totalsAgg._sum.uptimeBonus || 0,
      campaignBonus: totalsAgg._sum.campaignBonus || 0,
      complianceBonus: totalsAgg._sum.complianceBonus || 0,
      servicePenalty: totalsAgg._sum.servicePenalty || 0,
      totalAmount: totalsAgg._sum.totalAmount || 0,
      avgUptime: totalsAgg._avg.screenUptimePct ? parseFloat(totalsAgg._avg.screenUptimePct.toFixed(1)) : 0,
    },
    rule: rule ? {
      id: rule.id,
      name: rule.name,
      platformShare: rule.platformShare,
      ownerShare: rule.ownerShare,
      driverShare: rule.driverShare,
      baseParticipation: rule.baseParticipation,
      uptimeBonus: rule.uptimeBonus,
      campaignBonus: rule.campaignBonus,
      complianceBonus: rule.complianceBonus,
      servicePenalty: rule.servicePenalty,
      isActive: rule.isActive,
    } : null,
    filters: {
      drivers: drivers.map((d) => ({ id: d.id, name: d.name, mobile: d.mobile })),
      months: monthsRaw.map((m) => m.month),
    },
  })
}

// POST /api/driver-earnings — recalculate earnings for a driver/month using the active rule
// body: { driverId, month }
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'earnings.edit')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { driverId, month } = body
  if (!driverId || !month) {
    return NextResponse.json({ error: 'driverId and month are required' }, { status: 400 })
  }

  // Always fetch the active rule — NEVER hardcode earning amounts
  const rule = await db.earningRule.findFirst({ where: { isActive: true } })
  if (!rule) {
    return NextResponse.json({ error: 'No active earning rule configured' }, { status: 400 })
  }

  // Compute active days & uptime from playback events & heartbeats in that month
  const [y, m] = month.split('-').map(Number)
  const mStart = new Date(y, m - 1, 1)
  const mEnd = new Date(y, m, 1)

  // Verify driver's vehicle/device
  const driver = await db.driver.findUnique({
    where: { id: driverId },
    include: { vehicles: { include: { device: { select: { id: true, uptimeSeconds: true, status: true } } } } },
  })
  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  const device = driver.vehicles.flatMap((v) => v.device ? [v.device] : [])[0]
  // Active days: distinct days with playback events
  const plays = await db.playbackEvent.findMany({
    where: { device: { vehicle: { driverId } }, timestamp: { gte: mStart, lt: mEnd } },
    select: { timestamp: true, status: true },
  })
  const activeDaysSet = new Set<string>()
  let verifiedCount = 0
  let failedCount = 0
  plays.forEach((p) => {
    const day = new Date(p.timestamp).toDateString()
    activeDaysSet.add(day)
    if (p.status === 'completed') verifiedCount++
    if (p.status === 'failed') failedCount++
  })
  const activeDays = activeDaysSet.size

  // Approximate screen uptime % (use device uptimeSeconds / total possible seconds in month)
  const totalSeconds = (mEnd.getTime() - mStart.getTime()) / 1000
  const screenUptimePct = device?.uptimeSeconds ? Math.min((device.uptimeSeconds / totalSeconds) * 100, 100) : 0

  // Compute earnings using the configurable rule
  // Revenue share: driverShare% of verified play value (approximate using a per-play value)
  // For demo simplicity we use a per-play contribution: each verified play contributes ₹1
  const perPlayValue = 1
  const grossRevenue = verifiedCount * perPlayValue
  const revenueShare = (grossRevenue * rule.driverShare) / 100
  const baseAmount = rule.baseParticipation
  const uptimeBonus = screenUptimePct >= 80 ? rule.uptimeBonus : 0
  const campaignBonus = verifiedCount >= 100 ? rule.campaignBonus : 0
  const complianceBonus = failedCount === 0 && verifiedCount > 0 ? rule.complianceBonus : 0
  const servicePenalty = failedCount >= 10 ? rule.servicePenalty : 0
  const totalAmount = baseAmount + revenueShare + uptimeBonus + campaignBonus + complianceBonus - servicePenalty

  // Upsert the earning record
  const existing = await db.driverEarning.findFirst({ where: { driverId, month } })
  let earning
  if (existing) {
    earning = await db.driverEarning.update({
      where: { id: existing.id },
      data: {
        baseAmount, revenueShare, uptimeBonus, campaignBonus, complianceBonus, servicePenalty,
        totalAmount, activeDays, screenUptimePct,
      },
    })
  } else {
    earning = await db.driverEarning.create({
      data: {
        driverId, month, baseAmount, revenueShare, uptimeBonus, campaignBonus, complianceBonus, servicePenalty,
        totalAmount, activeDays, screenUptimePct, status: 'pending',
      },
    })
  }

  await auditLog({
    user,
    action: 'earning_recalculate',
    entity: 'driver_earning',
    entityId: earning.id,
    details: `Driver ${driver.name} · ${month} · ₹${totalAmount.toFixed(2)} (${activeDays} days, ${verifiedCount} verified plays)`,
  })

  return NextResponse.json({ earning })
}
