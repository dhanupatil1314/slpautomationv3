import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'

// LakhirAd Device API — POST /api/device/heartbeat
// Receives telemetry from IoT-connected media players.
// In production this would be authenticated via device token / MTLS.
// Accepts: { deviceId, timestamp, gps: {lat,lng}, signalStrength, network, temperature, storage, ram, uptime, screenStatus, appStatus, currentCampaign }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      deviceId, gps, signalStrength, network, temperature, storage, ram,
      uptime, screenStatus, appStatus, currentCampaign,
    } = body

    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId is required' }, { status: 400 })
    }

    // Find device by deviceId (not the cuid PK)
    const device = await db.device.findUnique({ where: { deviceId } })
    if (!device) {
      return NextResponse.json({ error: 'Device not registered' }, { status: 404 })
    }

    const now = body.timestamp ? new Date(body.timestamp) : new Date()

    // Create heartbeat record
    const heartbeat = await db.deviceHeartbeat.create({
      data: {
        deviceId: device.id,
        timestamp: now,
        latitude: gps?.lat ?? device.latitude,
        longitude: gps?.lng ?? device.longitude,
        signalStrength: signalStrength ?? device.signalStrength,
        networkType: network ?? device.networkType,
        temperature: temperature ?? device.temperature,
        storageUsage: storage ?? device.storageUsage,
        ramUsage: ram ?? device.ramUsage,
        uptimeSeconds: uptime ?? device.uptimeSeconds,
        screenStatus: screenStatus || 'on',
        appStatus: appStatus || 'running',
        currentCampaignId: currentCampaign || null,
      },
    })

    // Update device live status
    const updated = await db.device.update({
      where: { id: device.id },
      data: {
        lastHeartbeat: now,
        status: 'online',
        latitude: gps?.lat ?? device.latitude,
        longitude: gps?.lng ?? device.longitude,
        signalStrength: signalStrength ?? device.signalStrength,
        networkType: network ?? device.networkType,
        temperature: temperature ?? device.temperature,
        storageUsage: storage ?? device.storageUsage,
        ramUsage: ram ?? device.ramUsage,
        uptimeSeconds: uptime ?? device.uptimeSeconds,
        currentCampaignId: currentCampaign || null,
      },
    })

    // Auto-generate alerts based on thresholds
    const alerts: string[] = []
    if (temperature && temperature > 55) {
      alerts.push('high_temperature')
      await db.alert.upsert({
        where: { id: `${device.id}_temp` },
        update: { message: `Device ${deviceId} temperature critical: ${temperature}°C`, createdAt: now, acknowledged: false },
        create: { id: `${device.id}_temp`, deviceId: device.id, type: 'high_temperature', severity: 'critical', message: `Device ${deviceId} temperature critical: ${temperature}°C` },
      })
    }
    if (storage && storage > 85) {
      alerts.push('low_storage')
      await db.alert.upsert({
        where: { id: `${device.id}_storage` },
        update: { message: `Device ${deviceId} storage low: ${storage}%`, createdAt: now, acknowledged: false },
        create: { id: `${device.id}_storage`, deviceId: device.id, type: 'low_storage', severity: 'warning', message: `Device ${deviceId} storage low: ${storage}%` },
      })
    }

    return NextResponse.json({
      ok: true,
      heartbeatId: heartbeat.id,
      deviceStatus: updated.status,
      alerts,
      timestamp: now.toISOString(),
    })
  } catch (e: any) {
    console.error('Heartbeat error:', e)
    return NextResponse.json({ error: 'Heartbeat processing failed', details: e.message }, { status: 500 })
  }
}

// GET /api/device/heartbeat?deviceId=LKD-0001 — get latest heartbeat for a device
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const deviceId = searchParams.get('deviceId')
  if (!deviceId) return NextResponse.json({ error: 'deviceId required' }, { status: 400 })

  const device = await db.device.findUnique({
    where: { deviceId },
    include: { heartbeats: { take: 1, orderBy: { timestamp: 'desc' } } },
  })
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 })

  return NextResponse.json({
    deviceId: device.deviceId,
    status: device.status,
    lastHeartbeat: device.lastHeartbeat,
    latest: device.heartbeats[0] || null,
  })
}
