import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/locations — list cities with zone + device counts (or single city with zones)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'locations.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const cityId = searchParams.get('cityId')

  if (cityId) {
    // Return zones for a specific city with device counts
    const city = await db.city.findUnique({
      where: { id: cityId },
      include: {
        zones: { orderBy: { name: 'asc' } },
        _count: { select: { devices: true, vehicles: true } },
      },
    })
    if (!city) return NextResponse.json({ error: 'City not found' }, { status: 404 })

    // Device counts per zone — devices reference city + zone string
    const zoneDeviceCounts = await db.device.groupBy({
      by: ['zone'],
      where: { cityId, zone: { not: null } },
      _count: { _all: true },
    })
    const zoneCountMap = new Map<string, number>()
    for (const row of zoneDeviceCounts) {
      if (row.zone) zoneCountMap.set(row.zone, row._count._all)
    }

    return NextResponse.json({
      city: {
        id: city.id,
        name: city.name,
        state: city.state,
        status: city.status,
        latitude: city.latitude,
        longitude: city.longitude,
        deviceCount: city._count.devices,
        vehicleCount: city._count.vehicles,
        zones: city.zones.map((z) => ({
          id: z.id,
          name: z.name,
          radiusKm: z.radiusKm,
          deviceCount: zoneCountMap.get(z.name) || 0,
        })),
      },
    })
  }

  // Full list of cities with aggregate counts
  const cities = await db.city.findMany({
    include: {
      _count: { select: { zones: true, devices: true, vehicles: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({
    cities: cities.map((c) => ({
      id: c.id,
      name: c.name,
      state: c.state,
      status: c.status,
      latitude: c.latitude,
      longitude: c.longitude,
      zoneCount: c._count.zones,
      deviceCount: c._count.devices,
      vehicleCount: c._count.vehicles,
    })),
  })
}

// POST /api/locations — create a new city or zone
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'locations.create')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { type } = body // 'city' | 'zone'

  if (type === 'city') {
    const { name, state, latitude, longitude } = body
    if (!name || !state) {
      return NextResponse.json({ error: 'City name and state are required' }, { status: 400 })
    }
    const existing = await db.city.findUnique({ where: { name } })
    if (existing) return NextResponse.json({ error: 'City already exists' }, { status: 409 })

    const city = await db.city.create({
      data: {
        name,
        state,
        latitude: latitude !== undefined ? Number(latitude) : null,
        longitude: longitude !== undefined ? Number(longitude) : null,
        status: 'active',
      },
    })

    await auditLog({
      user,
      action: 'city_create',
      entity: 'city',
      entityId: city.id,
      details: `Created city ${name}, ${state}`,
    })

    return NextResponse.json({ city }, { status: 201 })
  }

  if (type === 'zone') {
    const { cityId, name, radiusKm, latitude, longitude } = body
    if (!cityId || !name) {
      return NextResponse.json({ error: 'City and zone name are required' }, { status: 400 })
    }
    const city = await db.city.findUnique({ where: { id: cityId } })
    if (!city) return NextResponse.json({ error: 'City not found' }, { status: 404 })

    const zone = await db.zone.create({
      data: {
        cityId,
        name,
        radiusKm: radiusKm !== undefined ? Number(radiusKm) : 3,
        latitude: latitude !== undefined ? Number(latitude) : null,
        longitude: longitude !== undefined ? Number(longitude) : null,
      },
    })

    await auditLog({
      user,
      action: 'zone_create',
      entity: 'zone',
      entityId: zone.id,
      details: `Created zone ${name} in ${city.name}`,
    })

    return NextResponse.json({ zone }, { status: 201 })
  }

  return NextResponse.json({ error: 'Invalid type — must be "city" or "zone"' }, { status: 400 })
}
