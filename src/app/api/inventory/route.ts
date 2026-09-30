import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// GET /api/inventory — aggregate device availability
// Filters: city, zone, vehicleType, availability (available|reserved|maintenance|offline)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'inventory.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const city = searchParams.get('city') || ''
  const zone = searchParams.get('zone') || ''
  const availability = searchParams.get('availability') || ''

  const where: any = {}
  if (city) where.city = { name: city }
  if (zone) where.zone = zone

  // Base device list with joins
  const devices = await db.device.findMany({
    where,
    include: {
      city: { select: { name: true } },
      vehicle: { select: { vehicleType: true, registrationNo: true } },
      campaignDevices: {
        where: { campaign: { status: { in: ['live', 'scheduled', 'paused', 'approved'] } } },
        select: { id: true, campaignId: true, campaign: { select: { id: true, name: true, status: true } } },
      },
    },
  })

  // Filter by availability after join (since availability is computed)
  const enriched = devices.map((d) => {
    const activeCampaign = d.campaignDevices[0]?.campaign
    let availabilityState: 'available' | 'reserved' | 'maintenance' | 'offline' = 'available'
    if (d.status === 'offline') availabilityState = 'offline'
    else if (d.status === 'maintenance' || d.status === 'suspended') availabilityState = 'maintenance'
    else if (activeCampaign) availabilityState = 'reserved'
    else if (d.status === 'warning') availabilityState = 'available' // warning but available
    return {
      id: d.id,
      deviceId: d.deviceId,
      status: d.status,
      city: d.city?.name || '—',
      zone: d.zone || '—',
      vehicleType: d.vehicle?.vehicleType || '—',
      registrationNo: d.vehicle?.registrationNo || '—',
      availabilityState,
      activeCampaign: activeCampaign ? { id: activeCampaign.id, name: activeCampaign.name, status: activeCampaign.status } : null,
    }
  })

  const filtered = availability ? enriched.filter((d) => d.availabilityState === availability) : enriched

  // Top-level KPIs
  const total = filtered.length
  const available = filtered.filter((d) => d.availabilityState === 'available').length
  const reserved = filtered.filter((d) => d.availabilityState === 'reserved').length
  const maintenance = filtered.filter((d) => d.availabilityState === 'maintenance').length
  const offline = filtered.filter((d) => d.availabilityState === 'offline').length

  // Per-city breakdown
  const cityMap = new Map<string, { total: number; available: number; reserved: number; maintenance: number; offline: number }>()
  for (const d of filtered) {
    const key = d.city
    if (!cityMap.has(key)) cityMap.set(key, { total: 0, available: 0, reserved: 0, maintenance: 0, offline: 0 })
    const m = cityMap.get(key)!
    m.total++
    m[d.availabilityState]++
  }
  const byCity = Array.from(cityMap.entries()).map(([city, c]) => ({ city, ...c }))

  // Per-zone breakdown (only when a city is selected)
  const zoneMap = new Map<string, { total: number; available: number; reserved: number; maintenance: number; offline: number }>()
  for (const d of filtered) {
    const key = d.zone === '—' ? 'Unzoned' : d.zone
    if (!zoneMap.has(key)) zoneMap.set(key, { total: 0, available: 0, reserved: 0, maintenance: 0, offline: 0 })
    const m = zoneMap.get(key)!
    m.total++
    m[d.availabilityState]++
  }
  const byZone = Array.from(zoneMap.entries()).map(([zone, c]) => ({ zone, ...c }))

  // Per-vehicle-type breakdown
  const typeMap = new Map<string, number>()
  for (const d of filtered) typeMap.set(d.vehicleType, (typeMap.get(d.vehicleType) || 0) + 1)
  const byVehicleType = Array.from(typeMap.entries()).map(([type, count]) => ({ type, count }))

  return NextResponse.json({
    summary: { total, available, reserved, maintenance, offline },
    byCity,
    byZone,
    byVehicleType,
    devices: filtered,
  })
}
