import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/api'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'

export async function GET(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result

  try {
    const today = format(new Date(), 'yyyy-MM-dd')
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')

    // All schedules this month
    const where: any = { date: { gte: monthStart, lte: monthEnd } }
    if (user.role === 'ENGINEER') where.engineerId = user.userId
    if (user.role === 'MANAGER') {
      const teamIds = (await db.user.findMany({ where: { managerId: user.userId }, select: { id: true } })).map(e => e.id)
      where.engineerId = { in: [...teamIds, user.userId] }
    }

    const schedules = await db.schedule.findMany({
      where, include: { engineer: { select: { name: true, engineerCode: true, managerId: true } }, site: true, store: true, visits: true },
    })

    // Engineer performance
    const engMap = new Map<string, { name: string; code: string; assigned: number; completed: number; pending: number; visits: number }>()
    for (const s of schedules) {
      const key = s.engineerId
      if (!engMap.has(key)) engMap.set(key, { name: s.engineer.name, code: s.engineer.engineerCode, assigned: 0, completed: 0, pending: 0, visits: 0 })
      const e = engMap.get(key)!
      e.assigned++
      if (s.status === 'COMPLETED') e.completed++
      if (s.status === 'PENDING' || s.status === 'ASSIGNED') e.pending++
      e.visits += s.visits.length
    }
    const engineerPerformance = Array.from(engMap.values()).map(e => ({ ...e, completionRate: e.assigned > 0 ? Math.round((e.completed / e.assigned) * 100) : 0 }))

    // District performance
    const distMap = new Map<string, { total: number; completed: number }>()
    for (const s of schedules) {
      const d = s.site?.district || 'Unknown'
      if (!distMap.has(d)) distMap.set(d, { total: 0, completed: 0 })
      const entry = distMap.get(d)!
      entry.total++
      if (s.status === 'COMPLETED') entry.completed++
    }
    const districtPerformance = Array.from(distMap.entries()).map(([district, data]) => ({ district, ...data, rate: Math.round((data.completed / data.total) * 100) }))

    // Vendor performance
    const vendorMap = new Map<string, { total: number; completed: number }>()
    for (const s of schedules) {
      const v = s.vendor || 'Unknown'
      if (!vendorMap.has(v)) vendorMap.set(v, { total: 0, completed: 0 })
      const entry = vendorMap.get(v)!
      entry.total++
      if (s.status === 'COMPLETED') entry.completed++
    }
    const vendorPerformance = Array.from(vendorMap.entries()).map(([vendor, data]) => ({ vendor, ...data, rate: Math.round((data.completed / data.total) * 100) }))

    // Daily trend (last 30 days)
    const dailyTrend: Array<{ date: string; completed: number; total: number }> = []
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
      const daySchedules = schedules.filter(s => s.date === d)
      dailyTrend.push({ date: d, total: daySchedules.length, completed: daySchedules.filter(s => s.status === 'COMPLETED').length })
    }

    // Store performance
    const storeMap = new Map<string, { name: string; code: string; total: number; completed: number }>()
    for (const s of schedules) {
      if (!s.store) continue
      const key = s.store.id
      if (!storeMap.has(key)) storeMap.set(key, { name: s.store.storeName, code: s.store.storeCode, total: 0, completed: 0 })
      const entry = storeMap.get(key)!
      entry.total++
      if (s.status === 'COMPLETED') entry.completed++
    }
    const storePerformance = Array.from(storeMap.values()).map(s => ({ ...s, rate: Math.round((s.completed / s.total) * 100) }))

    // Summary stats
    const total = schedules.length
    const completed = schedules.filter(s => s.status === 'COMPLETED').length
    const pending = schedules.filter(s => s.status === 'PENDING').length
    const hold = schedules.filter(s => s.status === 'HOLD').length
    const cancelled = schedules.filter(s => s.status === 'CANCELLED').length
    const rescheduled = schedules.filter(s => s.status === 'RESCHEDULED').length

    return NextResponse.json({
      summary: { total, completed, pending, hold, cancelled, rescheduled, completionRate: total > 0 ? Math.round((completed / total) * 100) : 0 },
      engineerPerformance, districtPerformance, vendorPerformance, storePerformance, dailyTrend,
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 })
  }
}
