import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// GET /api/devices/map — all devices with lat/lng + status for map rendering
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'devices.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const city = searchParams.get('city') || ''
  const zone = searchParams.get('zone') || ''
  const status = searchParams.get('status') || ''
  const search = searchParams.get('search') || ''

  const where: any = {}
  if (city) where.city = { name: city }
  if (zone) where.zone = { contains: zone }
  if (status) where.status = status
  if (search) {
    where.OR = [
      { deviceId: { contains: search } },
      { serialNumber: { contains: search } },
    ]
  }

  const devices = await db.device.findMany({
    where,
    include: {
      city: { select: { name: true, latitude: true, longitude: true } },
      vehicle: { select: { registrationNo: true, driver: { select: { name: true } } } },
    },
    orderBy: { status: 'asc' },
    take: 500,
  })

  // If devices lack lat/lng, use their city's coordinates with small jitter
  const enriched = devices.map((d) => {
    let lat = d.latitude
    let lng = d.longitude
    if (lat == null || lng == null) {
      const cityLat = d.city?.latitude ?? 22.3
      const cityLng = d.city?.longitude ?? 70.8
      // Deterministic jitter based on deviceId hash so the same device is always in the same spot
      const hash = simpleHash(d.deviceId)
      lat = cityLat + ((hash % 100) / 100 - 0.5) * 0.15
      lng = cityLng + (((hash >> 8) % 100) / 100 - 0.5) * 0.15
    }
    return {
      id: d.id,
      deviceId: d.deviceId,
      status: d.status,
      city: d.city?.name || '—',
      zone: d.zone,
      latitude: lat,
      longitude: lng,
      vehicleReg: d.vehicle?.registrationNo || '—',
      driverName: d.vehicle?.driver?.name || '—',
      networkType: d.networkType,
      signalStrength: d.signalStrength,
      lastHeartbeat: d.lastHeartbeat,
      currentCampaignId: d.currentCampaignId,
      temperature: d.temperature,
    }
  })

  // Compute bounding box for normalization
  const lats = enriched.map((d) => d.latitude).filter((l): l is number => l != null)
  const lngs = enriched.map((d) => d.longitude).filter((l): l is number => l != null)
  const bounds = lats.length > 0
    ? {
        minLat: Math.min(...lats), maxLat: Math.max(...lats),
        minLng: Math.min(...lngs), maxLng: Math.max(...lngs),
      }
    : { minLat: 18, maxLat: 26, minLng: 68, maxLng: 78 }

  // City list for filter
  const cities = await db.city.findMany({ select: { name: true }, orderBy: { name: 'asc' } })

  return NextResponse.json({
    devices: enriched,
    bounds,
    cities: cities.map((c) => c.name),
    summary: {
      total: enriched.length,
      online: enriched.filter((d) => d.status === 'online').length,
      offline: enriched.filter((d) => d.status === 'offline').length,
      warning: enriched.filter((d) => d.status === 'warning').length,
      maintenance: enriched.filter((d) => d.status === 'maintenance').length,
      suspended: enriched.filter((d) => d.status === 'suspended').length,
    },
  })
}

function simpleHash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}
