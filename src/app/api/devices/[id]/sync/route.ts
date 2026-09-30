import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// POST /api/devices/[id]/sync — trigger content sync on a device
// In production this would publish an MQTT command to the device.
// Here we simulate the sync process: pending → syncing → synced
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'devices.command')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const device = await db.device.findUnique({ where: { id } })
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 })

  // Set to syncing
  await db.device.update({
    where: { id },
    data: { contentSyncStatus: 'syncing' },
  })

  await auditLog({ user, action: 'device_sync_triggered', entity: 'device', entityId: id, details: `Content sync triggered for ${device.deviceId}` })

  // Simulate sync completion after 3 seconds
  setTimeout(async () => {
    try {
      const success = Math.random() > 0.15 // 85% success rate
      await db.device.update({
        where: { id },
        data: {
          contentSyncStatus: success ? 'synced' : 'failed',
          contentSyncedAt: new Date(),
          contentVersion: `v${Date.now()}`,
        },
      })
    } catch (e) {
      console.error('Sync simulation failed:', e)
    }
  }, 3000)

  return NextResponse.json({ message: `Content sync initiated for ${device.deviceId}`, status: 'syncing' })
}
