import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// GET /api/marketplace — browse available advertising inventory
// Shows available screens with pricing estimates, filterable by city/zone/price-range
// Advertisers can browse and see what inventory is available for booking
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const city = searchParams.get('city') || ''
  const zone = searchParams.get('zone') || ''
  const minPrice = parseInt(searchParams.get('minPrice') || '0')
  const maxPrice = parseInt(searchParams.get('maxPrice') || '100000')
  const sortBy = searchParams.get('sortBy') || 'value'

  // Get all online/warning devices with their availability
  const devices = await db.device.findMany({
    where: {
      status: { in: ['online', 'warning'] },
      ...(city && { city: { name: city } }),
      ...(zone && { zone }),
    },
    include: {
      city: { select: { name: true } },
      vehicle: { select: { registrationNo: true, vehicleType: true, driver: { select: { name: true } } } },
      campaignDevices: {
        where: { campaign: { status: { in: ['live', 'scheduled', 'paused', 'approved'] } } },
        select: { campaignId: true, campaign: { select: { name: true, endDate: true } } },
      },
    },
    take: 200,
  })

  // Compute availability and estimated value
  const inventory = devices.map((d) => {
    const isReserved = d.campaignDevices.length > 0
    const activeCampaign = d.campaignDevices[0]?.campaign
    // Estimated daily value: ₹2/play × 4 plays/hr × 12 hrs = ₹96/day base
    const cityMultiplier = ['Ahmedabad', 'Pune', 'Surat'].includes(d.city?.name || '') ? 1.3 : 1.0
    const dailyValue = Math.round(96 * cityMultiplier)
    const weeklyValue = dailyValue * 7 * 0.95 // 5% weekly discount
    const monthlyValue = dailyValue * 30 * 0.85 // 15% monthly discount

    return {
      id: d.id,
      deviceId: d.deviceId,
      status: d.status,
      city: d.city?.name || '—',
      zone: d.zone || '—',
      vehicleReg: d.vehicle?.registrationNo || '—',
      vehicleType: d.vehicle?.vehicleType || 'auto_rickshaw',
      driverName: d.vehicle?.driver?.name || '—',
      signal: d.signalStrength,
      availability: isReserved ? 'reserved' : 'available',
      activeCampaign: activeCampaign ? { name: activeCampaign.name, endDate: activeCampaign.endDate } : null,
      pricing: {
        daily: dailyValue,
        weekly: weeklyValue,
        monthly: monthlyValue,
      },
    }
  })

  // Filter by price range (using weekly price)
  const filtered = inventory.filter((i) => i.pricing.weekly >= minPrice && i.pricing.weekly <= maxPrice)

  // Sort
  if (sortBy === 'value') filtered.sort((a, b) => b.pricing.weekly - a.pricing.weekly)
  else if (sortBy === 'city') filtered.sort((a, b) => a.city.localeCompare(b.city))
  else if (sortBy === 'availability') filtered.sort((a, b) => a.availability.localeCompare(b.availability))

  // Summary stats
  const summary = {
    totalScreens: filtered.length,
    available: filtered.filter((i) => i.availability === 'available').length,
    reserved: filtered.filter((i) => i.availability === 'reserved').length,
    avgWeeklyPrice: filtered.length > 0 ? Math.round(filtered.reduce((s, i) => s + i.pricing.weekly, 0) / filtered.length) : 0,
    cities: Array.from(new Set(filtered.map((i) => i.city))),
  }

  return NextResponse.json({ inventory: filtered, summary })
}
