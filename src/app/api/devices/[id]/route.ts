import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/devices/[id] — device detail with full relations
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'devices.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const device = await db.device.findUnique({
    where: { id },
    include: {
      city: true,
      vehicle: { include: { driver: true, owner: true, screen: true } },
      sim: true,
      heartbeats: { take: 20, orderBy: { timestamp: 'desc' } },
      commands: { take: 10, orderBy: { createdAt: 'desc' }, include: { issuedBy: { select: { name: true } } } },
      playbackEvents: { take: 10, orderBy: { timestamp: 'desc' }, include: { campaign: { select: { name: true } }, media: { select: { name: true } } } },
      alerts: { take: 5, orderBy: { createdAt: 'desc' } },
      serviceTickets: { take: 5, orderBy: { createdAt: 'desc' } },
    },
  })

  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 })

  return NextResponse.json({ device })
}

// PATCH /api/devices/[id] — update device
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'devices.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { status, zone, cityId, model } = body

  const device = await db.device.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(zone !== undefined && { zone }),
      ...(cityId !== undefined && { cityId }),
      ...(model && { model }),
    },
  })

  await auditLog({ user, action: 'device_update', entity: 'device', entityId: id, details: `Updated device ${device.deviceId}` })
  return NextResponse.json({ device })
}

// POST /api/devices/[id]/command — issue remote command to device
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'devices.command')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { command, payload } = await request.json()

  const validCommands = ['restart', 'shutdown', 'sync', 'screenshot', 'update', 'brightness', 'volume', 'refresh', 'lock']
  if (!validCommands.includes(command)) {
    return NextResponse.json({ error: 'Invalid command' }, { status: 400 })
  }

  const device = await db.device.findUnique({ where: { id } })
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 })

  const cmd = await db.deviceCommand.create({
    data: {
      deviceId: id, command, payload: payload ? JSON.stringify(payload) : null,
      status: 'queued', issuedById: user.id,
    },
  })

  await auditLog({ user, action: `device_${command}`, entity: 'device', entityId: id, details: `Command: ${command} on ${device.deviceId}` })

  // Simulate command completion for demo (in production this would go via MQTT)
  setTimeout(async () => {
    try {
      await db.deviceCommand.update({
        where: { id: cmd.id },
        data: {
          status: 'completed',
          result: `Command ${command} executed successfully (simulated)`,
          completedAt: new Date(),
        },
      })
      if (command === 'restart') {
        await db.device.update({ where: { id }, data: { lastHeartbeat: new Date(), status: 'online' } })
      }
    } catch (e) {
      console.error('Command simulation failed:', e)
    }
  }, 2000)

  return NextResponse.json({ command: cmd, message: `Command "${command}" queued for device ${device.deviceId}` })
}
