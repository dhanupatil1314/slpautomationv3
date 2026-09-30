import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// GET /api/pricing?city=&zone=&deviceCount=&days=&frequencyPerHour=&peakHours=&festivalMultiplier=
// Dynamic pricing engine — calculates campaign price based on:
// - Base rate per play (₹2)
// - City tier multiplier (metro vs tier-2)
// - Device count (bulk discount)
// - Duration (longer = cheaper per day)
// - Peak hours premium (9am-9pm)
// - Festival/seasonal multiplier
// - Screen quality (resolution, size)

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'inventory.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const city = searchParams.get('city') || ''
  const zone = searchParams.get('zone') || ''
  const deviceCount = parseInt(searchParams.get('deviceCount') || '10')
  const days = parseInt(searchParams.get('days') || '7')
  const frequencyPerHour = parseInt(searchParams.get('frequencyPerHour') || '4')
  const peakHours = searchParams.get('peakHours') === 'true'
  const festivalMultiplier = parseFloat(searchParams.get('festivalMultiplier') || '1')

  // Base rate: ₹2 per play
  const BASE_RATE_PER_PLAY = 2

  // City tier multiplier
  const metroCities = ['Ahmedabad', 'Pune', 'Surat']
  const cityMultiplier = metroCities.includes(city) ? 1.3 : 1.0

  // Bulk discount: more devices = lower per-play rate
  let bulkDiscount = 1.0
  if (deviceCount >= 100) bulkDiscount = 0.65
  else if (deviceCount >= 50) bulkDiscount = 0.75
  else if (deviceCount >= 20) bulkDiscount = 0.85
  else if (deviceCount >= 10) bulkDiscount = 0.92

  // Duration discount: longer campaigns = cheaper per day
  let durationDiscount = 1.0
  if (days >= 30) durationDiscount = 0.85
  else if (days >= 14) durationDiscount = 0.90
  else if (days >= 7) durationDiscount = 0.95

  // Peak hours premium (9am-9pm = 12 hours)
  const peakMultiplier = peakHours ? 1.25 : 1.0

  // Hours per day (assuming 12-hour active window)
  const hoursPerDay = 12
  const totalPlays = deviceCount * days * frequencyPerHour * hoursPerDay

  // Effective rate per play
  const effectiveRate = BASE_RATE_PER_PLAY * cityMultiplier * bulkDiscount * durationDiscount * peakMultiplier * festivalMultiplier

  // Calculate price breakdown
  const basePrice = totalPlays * BASE_RATE_PER_PLAY
  const cityAdjustment = totalPlays * BASE_RATE_PER_PLAY * (cityMultiplier - 1)
  const bulkSavings = totalPlays * BASE_RATE_PER_PLAY * (1 - bulkDiscount)
  const durationSavings = totalPlays * BASE_RATE_PER_PLAY * (1 - durationDiscount)
  const peakPremium = totalPlays * BASE_RATE_PER_PLAY * (peakMultiplier - 1)
  const festivalAdjustment = totalPlays * BASE_RATE_PER_PLAY * (festivalMultiplier - 1)
  const finalPrice = totalPlays * effectiveRate

  // GST 18%
  const gst = finalPrice * 0.18
  const totalWithGst = finalPrice + gst

  return NextResponse.json({
    inputs: { city, zone, deviceCount, days, frequencyPerHour, peakHours, festivalMultiplier },
    calculation: {
      baseRatePerPlay: BASE_RATE_PER_PLAY,
      cityMultiplier,
      bulkDiscount,
      durationDiscount,
      peakMultiplier,
      festivalMultiplier,
      effectiveRatePerPlay: parseFloat(effectiveRate.toFixed(2)),
      totalPlays,
    },
    breakdown: {
      basePrice: parseFloat(basePrice.toFixed(2)),
      cityAdjustment: parseFloat(cityAdjustment.toFixed(2)),
      bulkSavings: parseFloat(bulkSavings.toFixed(2)),
      durationSavings: parseFloat(durationSavings.toFixed(2)),
      peakPremium: parseFloat(peakPremium.toFixed(2)),
      festivalAdjustment: parseFloat(festivalAdjustment.toFixed(2)),
      finalPrice: parseFloat(finalPrice.toFixed(2)),
      gst: parseFloat(gst.toFixed(2)),
      totalWithGst: parseFloat(totalWithGst.toFixed(2)),
    },
    summary: {
      pricePerPlay: parseFloat(effectiveRate.toFixed(2)),
      pricePerDay: parseFloat((finalPrice / days).toFixed(2)),
      pricePerDevice: parseFloat((finalPrice / deviceCount).toFixed(2)),
      totalPlays,
      effectiveSavings: parseFloat((bulkSavings + durationSavings).toFixed(2)),
    },
  })
}
