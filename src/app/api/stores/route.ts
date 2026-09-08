import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth, logActivity } from '@/lib/api'

export async function GET(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const q = new URL(req.url).searchParams

  try {
    const where: any = {}
    if (q.get('search')) {
      const s = q.get('search')!
      where.OR = [
        { storeCode: { contains: s } }, { storeName: { contains: s } },
        { district: { contains: s } }, { region: { contains: s } },
      ]
    }
    if (q.get('district')) where.district = q.get('district')
    if (q.get('region')) where.region = q.get('region')

    const page = parseInt(q.get('page') || '1')
    const limit = parseInt(q.get('limit') || '20')

    const [stores, total] = await Promise.all([
      db.store.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { storeCode: 'asc' }, include: { _count: { select: { schedules: true } } } }),
      db.store.count({ where }),
    ])
    return NextResponse.json({ stores, total, pages: Math.ceil(total / limit) })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load stores' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result

  try {
    const body = await req.json()
    const store = await db.store.create({
      data: { storeCode: body.storeCode, storeName: body.storeName, storeFormat: body.storeFormat, address: body.address, district: body.district, region: body.region, latitude: body.latitude, longitude: body.longitude, googleLink: body.googleLink, contactNumber: body.contactNumber },
    })
    await logActivity({ userId: user.userId, role: user.role, action: 'CREATE_STORE', entity: 'Store', entityId: store.id, newValue: JSON.stringify(body) })
    return NextResponse.json(store, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create store' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result

  try {
    const body = await req.json()
    const updateData: any = {}
    if (body.storeName) updateData.storeName = body.storeName
    if (body.storeFormat !== undefined) updateData.storeFormat = body.storeFormat
    if (body.address !== undefined) updateData.address = body.address
    if (body.district) updateData.district = body.district
    if (body.region) updateData.region = body.region
    if (body.latitude !== undefined) updateData.latitude = body.latitude
    if (body.longitude !== undefined) updateData.longitude = body.longitude
    if (body.googleLink !== undefined) updateData.googleLink = body.googleLink
    if (body.contactNumber !== undefined) updateData.contactNumber = body.contactNumber

    const store = await db.store.update({ where: { id: body.id }, data: updateData })
    await logActivity({ userId: user.userId, role: user.role, action: 'UPDATE_STORE', entity: 'Store', entityId: body.id, newValue: JSON.stringify(updateData) })
    return NextResponse.json(store)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update store' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  await db.store.delete({ where: { id } })
  await logActivity({ userId: user.userId, role: user.role, action: 'DELETE_STORE', entity: 'Store', entityId: id })
  return NextResponse.json({ success: true })
}