import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// GET /api/device-health — device health monitoring grid with filters
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'health.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || ''
  const city = searchParams.get('city') || ''
  const issue = searchParams.get('issue') || ''

  const where: any = {}
  if (status) where.status = status
  if (city) where.city = { name: city }

  const devices = await db.device.findMany({
    where,
    include: {
      city: { select: { name: true } },
      vehicle: { select: { registrationNo: true, driver: { select: { name: true } } } },
      heartbeats: { take: 1, orderBy: { timestamp: 'desc' } },
    },
    orderBy: { status: 'asc' },
    take: 100,
  })

  // Compute issues for each device based on thresholds
  const THRESHOLDS = {
    offlineMinutes: 5,
    criticalOfflineMinutes: 15,
    tempWarning: 50,
    tempCritical: 60,
    storageWarning: 80,
    storageCritical: 90,
    ramWarning: 80,
    ramCritical: 90,
    signalWarning: 30,
  }

  const enriched = devices.map((d) => {
    const lastHb = d.heartbeats[0]
    const minutesAgo = d.lastHeartbeat
      ? Math.floor((Date.now() - new Date(d.lastHeartbeat).getTime()) / 60000)
      : null
    const issues: string[] = []
    if (d.status === 'offline' || (minutesAgo != null && minutesAgo > THRESHOLDS.offlineMinutes)) {
      if (minutesAgo != null && minutesAgo > THRESHOLDS.criticalOfflineMinutes) issues.push('critical_offline')
      else issues.push('no_heartbeat')
    }
    if (d.temperature != null && d.temperature >= THRESHOLDS.tempCritical) issues.push('high_temperature')
    else if (d.temperature != null && d.temperature >= THRESHOLDS.tempWarning) issues.push('temp_warning')
    if (d.storageUsage != null && d.storageUsage >= THRESHOLDS.storageCritical) issues.push('low_storage')
    else if (d.storageUsage != null && d.storageUsage >= THRESHOLDS.storageWarning) issues.push('storage_warning')
    if (d.ramUsage != null && d.ramUsage >= THRESHOLDS.ramCritical) issues.push('ram_critical')
    if (d.signalStrength != null && d.signalStrength < THRESHOLDS.signalWarning) issues.push('weak_signal')

    return {
      id: d.id,
      deviceId: d.deviceId,
      status: d.status,
      city: d.city?.name || '—',
      zone: d.zone,
      vehicleReg: d.vehicle?.registrationNo || '—',
      driverName: d.vehicle?.driver?.name || '—',
      signalStrength: d.signalStrength,
      temperature: d.temperature,
      storageUsage: d.storageUsage,
      ramUsage: d.ramUsage,
      uptimeSeconds: d.uptimeSeconds,
      networkType: d.networkType,
      lastHeartbeat: d.lastHeartbeat,
      minutesAgo,
      screenStatus: lastHb?.screenStatus || (d.status === 'online' ? 'on' : 'off'),
      appStatus: lastHb?.appStatus || (d.status === 'online' ? 'running' : 'stopped'),
      gpsFix: !!d.latitude && !!d.longitude,
      issues,
      healthScore: computeHealthScore(d, issues),
    }
  })

  const filtered = issue ? enriched.filter((d) => d.issues.includes(issue)) : enriched

  // Summary
  const summary = {
    total: devices.length,
    online: enriched.filter((d) => d.status === 'online' && d.issues.length === 0).length,
    warning: enriched.filter((d) => d.issues.length > 0 && !d.issues.some((i) => ['critical_offline', 'high_temperature', 'low_storage', 'ram_critical'].includes(i))).length,
    critical: enriched.filter((d) => d.issues.some((i) => ['critical_offline', 'high_temperature', 'low_storage', 'ram_critical'].includes(i))).length,
    offline: enriched.filter((d) => d.status === 'offline').length,
    avgTemp: avg(enriched.map((d) => d.temperature).filter((t): t is number => t != null)),
    avgSignal: avg(enriched.map((d) => d.signalStrength).filter((t): t is number => t != null)),
    avgStorage: avg(enriched.map((d) => d.storageUsage).filter((t): t is number => t != null)),
  }

  return NextResponse.json({ devices: filtered, summary, thresholds: THRESHOLDS })
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

function computeHealthScore(d: any, issues: string[]): number {
  let score = 100
  for (const issue of issues) {
    if (issue === 'critical_offline') score -= 40
    else if (issue === 'no_heartbeat') score -= 25
    else if (issue === 'high_temperature') score -= 20
    else if (issue === 'low_storage') score -= 15
    else if (issue === 'ram_critical') score -= 15
    else if (issue === 'temp_warning') score -= 10
    else if (issue === 'storage_warning') score -= 8
    else if (issue === 'weak_signal') score -= 5
  }
  return Math.max(0, score)
}
