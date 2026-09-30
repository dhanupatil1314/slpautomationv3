import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth, logActivity } from '@/lib/api'
import { hashPassword } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result
  if (user.role === 'ENGINEER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const q = new URL(req.url).searchParams

  try {
    const where: any = {}
    if (q.get('role')) where.role = q.get('role')
    if (q.get('status')) where.status = q.get('status')
    if (q.get('search')) {
      const s = q.get('search')!
      where.OR = [
        { name: { contains: s } }, { engineerCode: { contains: s } }, { phone: { contains: s } },
      ]
    }
    if (q.get('managerId')) where.managerId = q.get('managerId')

    // Managers see their engineers
    if (user.role === 'MANAGER') {
      where.managerId = user.userId
    }

    const page = parseInt(q.get('page') || '1')
    const limit = parseInt(q.get('limit') || '20')

    const [users, total] = await Promise.all([
      db.user.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        select: { id: true, engineerCode: true, name: true, role: true, phone: true, status: true, managerId: true, createdAt: true, manager: { select: { id: true, name: true, engineerCode: true } }, _count: { select: { schedules: true } } },
      }),
      db.user.count({ where }),
    ])
    return NextResponse.json({ users, total, pages: Math.ceil(total / limit) })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const password = await hashPassword(body.password || 'slp@1234')
    const newUser = await db.user.create({
      data: { engineerCode: body.engineerCode, name: body.name, password, role: body.role, phone: body.phone, status: body.status || 'ACTIVE', managerId: body.managerId || null, mustChangePassword: true },
    })
    await logActivity({ userId: user.userId, role: user.role, action: 'CREATE_USER', entity: 'User', entityId: newUser.id, newValue: JSON.stringify({ ...body, password: '[REDACTED]' }) })
    return NextResponse.json({ id: newUser.id, engineerCode: newUser.engineerCode, name: newUser.name, role: newUser.role, status: newUser.status }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create user' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const existing = await db.user.findUnique({ where: { id: body.id } })
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const updateData: any = {}
    if (body.name) updateData.name = body.name
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.role) updateData.role = body.role
    if (body.status) updateData.status = body.status
    if (body.managerId !== undefined) updateData.managerId = body.managerId || null
    if (body.newPassword) {
      updateData.password = await hashPassword(body.newPassword)
      updateData.mustChangePassword = false
    }

    await db.user.update({ where: { id: body.id }, data: updateData })
    await logActivity({ userId: user.userId, role: user.role, action: 'UPDATE_USER', entity: 'User', entityId: body.id, previousValue: JSON.stringify({ name: existing.name, role: existing.role }), newValue: JSON.stringify(updateData) })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update user' }, { status: 500 })
  }
}
