import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/cities — list all cities for dropdowns
export async function GET() {
  const cities = await db.city.findMany({ orderBy: { name: 'asc' }, include: { zones: true } })
  return NextResponse.json({ cities: cities.map((c) => ({ id: c.id, name: c.name, state: c.state, zones: c.zones.map((z) => z.name) })) })
}
