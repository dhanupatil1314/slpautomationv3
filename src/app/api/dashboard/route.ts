import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/api'
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns'

const safeEngineer = { id: true, engineerCode: true, name: true, role: true, phone: true, status: true, managerId: true }
const safeSite = { id: true, siteCode: true, siteName: true, address: true, district: true, region: true, vendor: true, latitude: true, longitude: true, googleLink: true }
const safeStore = { id: true, storeCode: true, storeName: true, address: true, district: true, region: true, latitude: true, longitude: true, googleLink: true, contactNumber: true }

export async function GET(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result

  const today = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

  try {
    if (user.role === 'ADMIN') {
      const [totalEngineers, totalManagers, totalSites, totalStores, todaySchedules, allSchedules] = await Promise.all([
        db.user.count({ where: { role: 'ENGINEER', status: 'ACTIVE' } }),
        db.user.count({ where: { role: 'MANAGER', status: 'ACTIVE' } }),
        db.site.count(),
        db.store.count(),
        db.schedule.findMany({ where: { date: today }, include: { engineer: { select: safeEngineer }, site: { select: safeSite }, store: { select: safeStore } } }),
        db.schedule.findMany({ include: { engineer: { select: safeEngineer }, site: { select: safeSite }, store: { select: safeStore } }, take: 500, orderBy: { date: 'desc' } }),
      ])

      const completed = todaySchedules.filter(s => s.status === 'COMPLETED').length
      const pending = todaySchedules.filter(s => s.status === 'PENDING').length
      const hold = todaySchedules.filter(s => s.status === 'HOLD').length
      const cancelled = todaySchedules.filter(s => s.status === 'CANCELLED').length

      const weekSchedules = allSchedules.filter(s => s.date >= weekStart && s.date <= weekEnd)
      const weekByDate = new Map<string, { completed: number; total: number }>()
      for (const s of weekSchedules) {
        const d = s.date
        const entry = weekByDate.get(d) || { completed: 0, total: 0 }
        entry.total++
        if (s.status === 'COMPLETED') entry.completed++
        weekByDate.set(d, entry)
      }
      const dailyCompletion = Array.from(weekByDate.entries()).map(([date, data]) => ({ date, ...data }))

      const engPerformance = await db.user.findMany({
        where: { role: 'ENGINEER', status: 'ACTIVE' },
        include: { _count: { select: { schedules: { where: { status: 'COMPLETED' } } } } },
      })
      const engineerPerformance = engPerformance.map(e => ({
        name: e.name, code: e.engineerCode,
        completed: e._count.schedules,
      }))

      const districtStats: Record<string, { total: number; completed: number }> = {}
      for (const s of allSchedules) {
        const d = s.site?.district || 'Unknown'
        if (!districtStats[d]) districtStats[d] = { total: 0, completed: 0 }
        districtStats[d].total++
        if (s.status === 'COMPLETED') districtStats[d].completed++
      }
      const districtPerformance = Object.entries(districtStats).map(([district, data]) => ({ district, ...data }))

      const recentImports = await db.importHistory.findMany({ take: 5, orderBy: { createdAt: 'desc' }, include: { uploader: { select: { name: true } } } })

      return NextResponse.json({
        cards: { totalEngineers, totalManagers, totalSites, totalStores, today: { total: todaySchedules.length, completed, pending, hold, cancelled } },
        charts: { dailyCompletion, engineerPerformance, districtPerformance },
        recentImports,
      })
    }

    if (user.role === 'MANAGER') {
      const engineers = await db.user.findMany({ where: { managerId: user.userId, role: 'ENGINEER', status: 'ACTIVE' } })
      const engineerIds = engineers.map(e => e.id)

      const [todaySchedules, weekSchedules, totalStores, totalSites] = await Promise.all([
        db.schedule.findMany({ where: { date: today, engineerId: { in: engineerIds } }, include: { engineer: { select: safeEngineer }, site: { select: safeSite }, store: { select: safeStore } } }),
        db.schedule.findMany({ where: { date: { gte: weekStart, lte: weekEnd }, engineerId: { in: engineerIds } }, include: { engineer: { select: safeEngineer }, site: { select: safeSite } } }),
        db.store.count(),
        db.site.count(),
      ])

      const completed = todaySchedules.filter(s => s.status === 'COMPLETED').length
      const pending = todaySchedules.filter(s => s.status === 'PENDING' || s.status === 'ASSIGNED').length
      const activeEngineers = engineers.length

      return NextResponse.json({
        cards: { assignedEngineers: engineers.length, todayJobs: todaySchedules.length, completed, pending, activeEngineers, totalStores, totalSites },
        engineers: engineers.map(e => ({ id: e.id, name: e.name, code: e.engineerCode })),
        todaySchedules,
      })
    }

    // ENGINEER
    const [todaySchedules, allVisits, pendingSites, completedSites] = await Promise.all([
      db.schedule.findMany({ where: { date: today, engineerId: user.userId }, include: { site: { select: safeSite }, store: { select: safeStore } } }),
      db.visit.count({ where: { engineerId: user.userId } }),
      db.schedule.count({ where: { date: today, engineerId: user.userId, status: { in: ['PENDING', 'ASSIGNED', 'HOLD', 'RESCHEDULED'] } } }),
      db.schedule.count({ where: { date: today, engineerId: user.userId, status: 'COMPLETED' } }),
    ])

    const nearestSite = todaySchedules.find(s => s.status !== 'COMPLETED')?.site
    const nearestStore = todaySchedules.find(s => s.status !== 'COMPLETED')?.store

    return NextResponse.json({
      cards: { todaySchedule: todaySchedules.length, pendingSites, completedSites, totalVisits: allVisits },
      nearestSite, nearestStore, todaySchedules,
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}
