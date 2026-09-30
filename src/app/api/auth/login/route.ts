import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, generateAccessToken, generateRefreshToken } from '@/lib/auth'
import { hashSync } from 'bcryptjs'

const DEFAULT_PASSWORD = 'slp@1234'

export async function POST(req: NextRequest) {
  try {
    const { engineerCode, password } = await req.json()
    if (!engineerCode || !password) {
      return NextResponse.json({ error: 'Engineer code and password are required' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { engineerCode } })
    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const valid = await verifyPassword(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = await generateAccessToken({ userId: user.id, engineerCode: user.engineerCode, name: user.name, role: user.role as any, managerId: user.managerId })
    const refreshToken = await generateRefreshToken({ userId: user.id })

    await db.activityLog.create({
      data: { userId: user.id, role: user.role, action: 'LOGIN', entity: 'User', entityId: user.id, ipAddress: req.headers.get('x-forwarded-for') || '', device: req.headers.get('user-agent')?.substring(0, 200) || '' },
    })

    return NextResponse.json({
      token, refreshToken,
      mustChangePassword: user.mustChangePassword,
      user: { id: user.id, engineerCode: user.engineerCode, name: user.name, role: user.role, phone: user.phone, status: user.status, managerId: user.managerId },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
