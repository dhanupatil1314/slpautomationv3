import { db } from '@/lib/db'
import type { SessionUser } from '@/lib/auth'

// LakhirAd audit log helper — records sensitive actions immutably
export async function auditLog(params: {
  user?: SessionUser | null
  action: string
  entity?: string
  entityId?: string
  details?: string
  ipAddress?: string
}) {
  try {
    await db.auditLog.create({
      data: {
        userId: params.user?.id || null,
        action: params.action,
        entity: params.entity || null,
        entityId: params.entityId || null,
        details: params.details || null,
        ipAddress: params.ipAddress || null,
      },
    })
  } catch (e) {
    // Audit logging should never break the main flow
    console.error('Audit log failed:', e)
  }
}
