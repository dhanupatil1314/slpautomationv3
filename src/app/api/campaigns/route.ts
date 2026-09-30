import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/campaigns — paginated, filterable campaign list
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'campaigns.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const advertiserId = searchParams.get('advertiserId') || ''
  const city = searchParams.get('city') || ''

  const where: any = {}
  if (search) where.name = { contains: search }
  if (status) where.status = status
  if (advertiserId) where.advertiserId = advertiserId
  if (city) where.targetCities = { contains: city }

  const [campaigns, total] = await Promise.all([
    db.campaign.findMany({
      where,
      include: {
        advertiser: { select: { id: true, contactName: true, organization: { select: { name: true } } } },
        playlist: { select: { id: true, name: true } },
        _count: { select: { devices: true, playbackEvents: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.campaign.count({ where }),
  ])

  return NextResponse.json({
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      advertiserId: c.advertiserId,
      advertiserName: c.advertiser?.organization?.name || c.advertiser?.contactName || '—',
      playlistId: c.playlistId,
      playlistName: c.playlist?.name || '—',
      status: c.status,
      priority: c.priority,
      startDate: c.startDate,
      endDate: c.endDate,
      startTime: c.startTime,
      endTime: c.endTime,
      daysOfWeek: c.daysOfWeek,
      frequencyPerHour: c.frequencyPerHour,
      budget: c.budget,
      priceQuoted: c.priceQuoted,
      amountPaid: c.amountPaid,
      targetCities: c.targetCities,
      targetZones: c.targetZones,
      deviceCount: c._count.devices,
      targetDeviceCount: c.targetDeviceCount,
      createdAt: c.createdAt,
    })),
    total, page, pageSize,
  })
}

// POST /api/campaigns — create campaign
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'campaigns.create')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const {
    name, advertiserId, playlistId, priority, status,
    startDate, endDate, startTime, endTime, daysOfWeek,
    frequencyPerHour, budget, priceQuoted, amountPaid,
    targetCities, targetZones, targetDeviceCount, deviceIds,
  } = body

  if (!name || !advertiserId) {
    return NextResponse.json({ error: 'Campaign name and advertiser are required' }, { status: 400 })
  }

  const advertiser = await db.advertiser.findUnique({ where: { id: advertiserId } })
  if (!advertiser) return NextResponse.json({ error: 'Advertiser not found' }, { status: 404 })

  const campaign = await db.campaign.create({
    data: {
      name,
      advertiserId,
      organizationId: advertiser.organizationId,
      playlistId: playlistId || null,
      priority: Number(priority) || 4,
      status: status || 'draft',
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      startTime: startTime || null,
      endTime: endTime || null,
      daysOfWeek: daysOfWeek || null,
      frequencyPerHour: Number(frequencyPerHour) || 4,
      budget: Number(budget) || 0,
      priceQuoted: Number(priceQuoted) || 0,
      amountPaid: Number(amountPaid) || 0,
      targetCities: targetCities || null,
      targetZones: targetZones || null,
      targetDeviceCount: Number(targetDeviceCount) || (Array.isArray(deviceIds) ? deviceIds.length : 0),
    },
  })

  // Optionally link devices
  if (Array.isArray(deviceIds) && deviceIds.length > 0) {
    await db.campaignDevice.createMany({
      data: deviceIds.map((deviceId: string) => ({ campaignId: campaign.id, deviceId, status: 'selected' })),
      skipDuplicates: true,
    })
  }

  // Initial approval history entry
  await db.campaignApprovalHistory.create({
    data: {
      campaignId: campaign.id,
      action: status === 'submitted' ? 'submitted' : 'created',
      byUserId: user.id,
      note: status === 'submitted' ? 'Campaign submitted for approval' : 'Campaign created as draft',
    },
  })

  await auditLog({
    user,
    action: 'campaign_create',
    entity: 'campaign',
    entityId: campaign.id,
    details: `Created campaign "${name}" for advertiser ${advertiser.contactName} (status: ${campaign.status})`,
  })

  return NextResponse.json({ campaign }, { status: 201 })
}
