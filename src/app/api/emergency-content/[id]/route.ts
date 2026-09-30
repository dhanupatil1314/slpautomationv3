import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// PATCH /api/emergency-content/[id] — cancel or expire emergency content
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'campaigns.publish'))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { status } = await request.json()

  const content = await db.emergencyContent.update({
    where: { id },
    data: { status: status || 'cancelled' },
  })

  await auditLog({
    user,
    action: `emergency_content_${status}`,
    entity: 'emergency_content',
    entityId: id,
    details: `Emergency content "${content.title}" → ${status}`,
  })

  return NextResponse.json({ content })
}
