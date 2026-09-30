import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hashPassword, verifyPassword } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

// POST /api/profile/password — change current user's password
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { currentPassword, newPassword } = await request.json()
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
  }

  const dbUser = await db.user.findUnique({ where: { id: user.id } })
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const valid = await verifyPassword(currentPassword, dbUser.passwordHash)
  if (!valid) {
    await auditLog({ user, action: 'password_change_failed', entity: 'user', entityId: user.id })
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
  }

  const newHash = await hashPassword(newPassword)
  await db.user.update({ where: { id: user.id }, data: { passwordHash: newHash } })
  await auditLog({ user, action: 'password_change', entity: 'user', entityId: user.id, details: 'User changed their password' })

  return NextResponse.json({ success: true, message: 'Password updated successfully' })
}
