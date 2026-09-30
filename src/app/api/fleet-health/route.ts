import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// GET /api/fleet-health — device fleet health scoring
// Computes a health score (0-100) for each device based on:
// - Heartbeat freshness (40 pts): online + recent heartbeat
// - Signal strength (20 pts): >60% = full, >30% = partial
// - Temperature (15 pts): <45°C = full, <55°C = partial, >55°C = zero
// - Storage health (10 pts): <70% = full, <85% = partial
// - RAM health (5 pts): <70% = full, <85% = partial
// - Content sync (10 pts): synced = full, syncing = partial, others = zero
//
// Returns: per-device scores, fleet summary, distribution, worst offenders

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'health.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const devices = await db.device.findMany({
    include: {
      city: { select: { name: true } },
      vehicle: { select: { registrationNo: true } },
    },
    take: 500,
  })

  const now = Date.now()
  const scored = devices.map((d) => {
    // Heartbeat score (40 pts)
    let heartbeatScore = 0
    if (d.lastHeartbeat) {
      const ageMin = (now - d.lastHeartbeat.getTime()) / 60000
      if (ageMin < 5) heartbeatScore = 40
      else if (ageMin < 15) heartbeatScore = 30
      else if (ageMin < 60) heartbeatScore = 15
      else heartbeatScore = 5
    }

    // Signal score (20 pts)
    let signalScore = 0
    if (d.signalStrength != null) {
      if (d.signalStrength >= 60) signalScore = 20
      else if (d.signalStrength >= 30) signalScore = 12
      else if (d.signalStrength > 0) signalScore = 6
    }

    // Temperature score (15 pts)
    let tempScore = 0
    if (d.temperature != null) {
      if (d.temperature < 45) tempScore = 15
      else if (d.temperature < 55) tempScore = 8
      else tempScore = 0
    }

    // Storage score (10 pts)
    let storageScore = 0
    if (d.storageUsage != null) {
      if (d.storageUsage < 70) storageScore = 10
      else if (d.storageUsage < 85) storageScore = 5
    }

    // RAM score (5 pts)
    let ramScore = 0
    if (d.ramUsage != null) {
      if (d.ramUsage < 70) ramScore = 5
      else if (d.ramUsage < 85) ramScore = 3
    }

    // Content sync score (10 pts)
    let syncScore = 0
    if (d.contentSyncStatus === 'synced') syncScore = 10
    else if (d.contentSyncStatus === 'syncing') syncScore = 5

    const totalScore = heartbeatScore + signalScore + tempScore + storageScore + ramScore + syncScore

    return {
      id: d.id,
      deviceId: d.deviceId,
      status: d.status,
      city: d.city?.name || '—',
      vehicleReg: d.vehicle?.registrationNo || '—',
      lastHeartbeat: d.lastHeartbeat,
      signal: d.signalStrength,
      temperature: d.temperature,
      storage: d.storageUsage,
      ram: d.ramUsage,
      contentSync: d.contentSyncStatus,
      score: totalScore,
      grade: totalScore >= 90 ? 'A' : totalScore >= 75 ? 'B' : totalScore >= 60 ? 'C' : totalScore >= 40 ? 'D' : 'F',
      breakdown: {
        heartbeat: heartbeatScore,
        signal: signalScore,
        temperature: tempScore,
        storage: storageScore,
        ram: ramScore,
        sync: syncScore,
      },
    }
  })

  // Fleet summary
  const avgScore = scored.length > 0 ? Math.round(scored.reduce((s, d) => s + d.score, 0) / scored.length) : 0
  const gradeDistribution = scored.reduce((acc, d) => { acc[d.grade] = (acc[d.grade] || 0) + 1; return acc }, {} as Record<string, number>)

  // Worst offenders (bottom 5)
  const worstOffenders = [...scored].sort((a, b) => a.score - b.score).slice(0, 5)

  // Top performers (top 5)
  const topPerformers = [...scored].sort((a, b) => b.score - a.score).slice(0, 5)

  // City-wise health
  const cityMap = new Map<string, { total: number; scoreSum: number; count: number }>()
  for (const d of scored) {
    if (!cityMap.has(d.city)) cityMap.set(d.city, { total: 0, scoreSum: 0, count: 0 })
    const m = cityMap.get(d.city)!
    m.total++
    m.scoreSum += d.score
    m.count++
  }
  const byCity = Array.from(cityMap.entries()).map(([city, m]) => ({
    city,
    avgScore: Math.round(m.scoreSum / m.count),
    deviceCount: m.total,
  })).sort((a, b) => b.avgScore - a.avgScore)

  return NextResponse.json({
    devices: scored.sort((a, b) => b.score - a.score),
    summary: {
      totalDevices: scored.length,
      avgScore,
      grade: avgScore >= 90 ? 'A' : avgScore >= 75 ? 'B' : avgScore >= 60 ? 'C' : avgScore >= 40 ? 'D' : 'F',
      gradeDistribution,
    },
    worstOffenders,
    topPerformers,
    byCity,
  })
}
