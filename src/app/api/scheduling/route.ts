import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// GET /api/scheduling — list scheduled/live/approved campaigns within a date range
// Query: start (YYYY-MM-DD), end (YYYY-MM-DD), advertiserId, city
// Defaults to current week (Mon–Sun)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'scheduling.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const startStr = searchParams.get('start')
  const endStr = searchParams.get('end')
  const advertiserId = searchParams.get('advertiserId') || ''
  const city = searchParams.get('city') || ''

  // Default to current week — Monday as start
  const now = new Date()
  const dayIdx = (now.getDay() + 6) % 7 // Mon=0, Sun=6
  const start = startStr ? new Date(startStr) : new Date(now)
  if (!startStr) start.setDate(now.getDate() - dayIdx)
  start.setHours(0, 0, 0, 0)

  const end = endStr ? new Date(endStr) : new Date(start)
  if (!endStr) end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  // Pull all campaigns that overlap the window AND have a schedule (live/scheduled/approved/paused/completed)
  const where: any = {
    status: { in: ['live', 'scheduled', 'approved', 'paused', 'completed'] },
    OR: [
      { AND: [{ startDate: { lte: end } }, { endDate: { gte: start } }] },
      { startDate: null, endDate: null }, // ongoing campaigns with no fixed dates
    ],
  }
  if (advertiserId) where.advertiserId = advertiserId
  if (city) where.targetCities = { contains: city }

  const campaigns = await db.campaign.findMany({
    where,
    include: {
      advertiser: { select: { contactName: true, organization: { select: { name: true } } } },
      playlist: { select: { name: true } },
      devices: { select: { id: true, deviceId: true } },
      schedules: true,
    },
    orderBy: { startDate: 'asc' },
  })

  // Project schedule into a per-week shape
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d.toISOString().slice(0, 10))
  }

  return NextResponse.json({
    range: { start: start.toISOString(), end: end.toISOString(), days },
    campaigns: campaigns.map((c) => {
      const startDate = c.startDate ? new Date(c.startDate) : null
      const endDate = c.endDate ? new Date(c.endDate) : null
      // Which of the 7 days does this campaign overlap?
      const dayFlags = days.map((dStr) => {
        const d = new Date(dStr + 'T12:00:00')
        if (startDate && endDate) return d >= new Date(startDate.toDateString()) && d <= new Date(endDate.toDateString())
        return true // ongoing campaign → on every day
      })
      return {
        id: c.id,
        name: c.name,
        advertiserId: c.advertiserId,
        advertiserName: c.advertiser?.organization?.name || c.advertiser?.contactName || '—',
        status: c.status,
        priority: c.priority,
        startDate: c.startDate,
        endDate: c.endDate,
        startTime: c.startTime,
        endTime: c.endTime,
        daysOfWeek: c.daysOfWeek,
        targetCities: c.targetCities,
        targetZones: c.targetZones,
        playlistName: c.playlist?.name || '—',
        deviceCount: c.devices.length,
        scheduleCount: c.schedules.length,
        dayFlags,
      }
    }),
  })
}
