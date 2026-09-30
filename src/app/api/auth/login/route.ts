import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSession, setSessionCookie } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

// POST /api/auth/login — email/password authentication
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim(), deletedAt: null },
    })

    if (!user) {
      await auditLog({ action: 'login_failed', entity: 'user', details: `email=${email}` })
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    if (user.status !== 'active') {
      return NextResponse.json({ error: 'Account is suspended. Contact administrator.' }, { status: 403 })
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      await auditLog({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, action: 'login_failed' })
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    await db.loginActivity.create({ data: { userId: user.id, ip, userAgent: request.headers.get('user-agent'), success: true } })
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), lastLoginIp: ip } })

    const token = await createSession(user.id)
    await setSessionCookie(token)
    await auditLog({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, action: 'login', ipAddress: ip })

    return NextResponse.json({
      user: {
        id: user.id, email: user.email, name: user.name, role: user.role,
        organizationId: user.organizationId, avatarUrl: user.avatarUrl,
      },
    })
  } catch (e) {
    console.error('Login error:', e)
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 })
  }
}
