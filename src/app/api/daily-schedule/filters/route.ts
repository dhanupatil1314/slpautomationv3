import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/api'

/**
 * Returns the distinct filter values available for the Daily Schedule Task view.
 * Aggregated across ALL engineers (no role filtering) so every user sees the
 * complete filter set.
 */
export async function GET(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result

  try {
    const [engineers, districts, regions, vendors, activities, verticals, visitTypes, zones, storeFormats] = await Promise.all([
      db.user.findMany({ where: { role: { in: ['ENGINEER', 'MANAGER'] } }, select: { id: true, name: true, engineerCode: true }, orderBy: { name: 'asc' } }),
      db.site.findMany({ select: { district: true } }).then(s => [...new Set(s.map(x => x.district).filter(Boolean))] as string[]),
      db.site.findMany({ select: { region: true } }).then(s => [...new Set(s.map(x => x.region).filter(Boolean))] as string[]),
      db.schedule.findMany({ select: { vendor: true } }).then(s => [...new Set(s.map(x => x.vendor).filter(Boolean))] as string[]),
      db.schedule.findMany({ select: { activity: true } }).then(s => [...new Set(s.map(x => x.activity).filter(Boolean))] as string[]),
      db.schedule.findMany({ select: { vertical: true } }).then(s => [...new Set(s.map(x => x.vertical).filter(Boolean))] as string[]),
      db.schedule.findMany({ select: { visitType: true } }).then(s => [...new Set(s.map(x => x.visitType).filter(Boolean))] as string[]),
      db.user.findMany({ select: { zone: true } }).then(s => [...new Set(s.map(x => x.zone).filter(Boolean))] as string[]),
      db.store.findMany({ select: { storeFormat: true } }).then(s => [...new Set(s.map(x => x.storeFormat).filter(Boolean))] as string[]),
    ])

    return NextResponse.json({
      engineers,
      districts,
      regions,
      vendors,
      activities,
      verticals,
      visitTypes,
      zones,
      storeFormats,
    })
  } catch (error) {
    console.error('Daily schedule filters error:', error)
    return NextResponse.json({ engineers: [], districts: [], regions: [], vendors: [], activities: [], verticals: [], visitTypes: [], zones: [], storeFormats: [] })
  }
}
