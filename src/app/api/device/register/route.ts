import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/device/register — register a new device (called by the player on first boot)
// In production: authenticated via installer token / device provisioning code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceId, serialNumber, imei, model, androidVersion } = body

    if (!deviceId || !serialNumber || !imei) {
      return NextResponse.json({ error: 'deviceId, serialNumber, imei are required' }, { status: 400 })
    }

    const existing = await db.device.findFirst({
      where: { OR: [{ deviceId }, { serialNumber }, { imei }] },
    })
    if (existing) {
      return NextResponse.json({ error: 'Device already registered', deviceId: existing.deviceId }, { status: 409 })
    }

    const device = await db.device.create({
      data: {
        deviceId, serialNumber, imei,
        model: model || 'LakhirAd Player Pro',
        playerVersion: '2.4.1',
        androidVersion: androidVersion || '11',
        status: 'offline',
        installationDate: new Date(),
      },
    })

    return NextResponse.json({ ok: true, deviceId: device.deviceId, id: device.id }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
