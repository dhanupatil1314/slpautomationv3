import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/api'

export async function GET(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result

  try {
    const where: any = {}
    if (user.role === 'ENGINEER') where.engineerId = user.userId
    if (user.role === 'MANAGER') {
      const teamIds = (await db.user.findMany({ where: { managerId: user.userId }, select: { id: true } })).map(e => e.id)
      where.engineerId = { in: [...teamIds, user.userId] }
    }

    const [engineers, districts, regions, vendors, activities] = await Promise.all([
      db.schedule.groupBy({ by: ['engineerId'], where, _count: true }).then(r => r.map(g => g.engineerId)),
      db.schedule.findMany({ where, distinct: ['date'], select: { id: true } }).then(() => []),
      db.site.findMany({ select: { district: true } }).then(sites => [...new Set(sites.map(s => s.district).filter(Boolean))]),
      db.schedule.findMany({ where, distinct: ['vendor'], select: { vendor: true } }).then(r => r.map(s => s.vendor).filter(Boolean)),
      db.schedule.findMany({ where, distinct: ['activity'], select: { activity: true } }).then(r => r.map(s => s.activity).filter(Boolean)),
    ])

    const engineerData = engineers.length > 0
      ? await db.user.findMany({ where: { id: { in: engineers } }, select: { id: true, name: true, engineerCode: true }, orderBy: { name: 'asc' } })
      : []

    const siteRegions = await db.site.findMany({ select: { region: true } })
    const regionList = [...new Set(siteRegions.map(s => s.region).filter(Boolean))]

    return NextResponse.json({ engineers: engineerData, districts: districts.length ? districts : [...new Set((await db.site.findMany({ select: { district: true } })).map(s => s.district).filter(Boolean))], regions: regionList, vendors, activities })
  } catch (error) {
    return NextResponse.json({ engineers: [], districts: [], regions: [], vendors: [], activities: [] })
  }
}
