import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth, logActivity } from '@/lib/api'
import { hashPassword, verifyPassword } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result

  try {
    const { currentPassword, newPassword } = await req.json()
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const dbUser = await db.user.findUnique({ where: { id: user.userId } })
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const valid = await verifyPassword(currentPassword, dbUser.password)
    if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })

    const hashed = await hashPassword(newPassword)
    await db.user.update({
      where: { id: user.userId },
      data: { password: hashed, mustChangePassword: false },
    })

    await logActivity({
      userId: user.userId, role: user.role,
      action: 'CHANGE_PASSWORD', entity: 'User', entityId: user.userId,
      newValue: 'Password changed',
    })

    return NextResponse.json({ success: true, message: 'Password changed successfully' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to change password' }, { status: 500 })
  }
}
