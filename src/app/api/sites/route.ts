import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth, logActivity } from '@/lib/api'

export async function GET(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result
  const q = new URL(req.url).searchParams

  try {
    const where: any = {}
    if (q.get('search')) {
      const s = q.get('search')!
      where.OR = [
        { siteCode: { contains: s } }, { siteName: { contains: s } },
        { district: { contains: s } }, { region: { contains: s } }, { vendor: { contains: s } },
      ]
    }
    if (q.get('district')) where.district = q.get('district')
    if (q.get('region')) where.region = q.get('region')
    if (q.get('vendor')) where.vendor = q.get('vendor')

    const page = parseInt(q.get('page') || '1')
    const limit = parseInt(q.get('limit') || '20')

    const [sites, total] = await Promise.all([
      db.site.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { siteCode: 'asc' }, include: { _count: { select: { schedules: true } } } }),
      db.site.count({ where }),
    ])
    return NextResponse.json({ sites, total, pages: Math.ceil(total / limit) })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load sites' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result

  try {
    const body = await req.json()
    const site = await db.site.create({
      data: { siteCode: body.siteCode, siteName: body.siteName, address: body.address, district: body.district, region: body.region, vendor: body.vendor, latitude: body.latitude, longitude: body.longitude, googleLink: body.googleLink },
    })
    await logActivity({ userId: user.userId, role: user.role, action: 'CREATE_SITE', entity: 'Site', entityId: site.id, newValue: JSON.stringify(body) })
    return NextResponse.json(site, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create site' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result

  try {
    const body = await req.json()
    const updateData: any = { lastUpdatedBy: user.engineerCode, lastUpdatedAt: new Date() }
    if (body.siteName) updateData.siteName = body.siteName
    if (body.address !== undefined) updateData.address = body.address
    if (body.district) updateData.district = body.district
    if (body.region) updateData.region = body.region
    if (body.vendor) updateData.vendor = body.vendor
    if (body.latitude !== undefined) updateData.latitude = body.latitude
    if (body.longitude !== undefined) updateData.longitude = body.longitude
    if (body.googleLink !== undefined) updateData.googleLink = body.googleLink

    const site = await db.site.update({ where: { id: body.id }, data: updateData })
    await logActivity({ userId: user.userId, role: user.role, action: 'UPDATE_SITE', entity: 'Site', entityId: body.id, newValue: JSON.stringify(updateData) })
    return NextResponse.json(site)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update site' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  await db.site.delete({ where: { id } })
  await logActivity({ userId: user.userId, role: user.role, action: 'DELETE_SITE', entity: 'Site', entityId: id })
  return NextResponse.json({ success: true })
}