import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth, logActivity } from '@/lib/api'
import ExcelJS from 'exceljs'

export async function POST(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result

  try {
    const body = await req.json()
    const format = body.format || 'XLSX'
    const filters = body.filters || {}

    const where: any = {}
    if (user.role === 'ENGINEER') where.engineerId = user.userId
    if (user.role === 'MANAGER') {
      const teamIds = (await db.user.findMany({ where: { managerId: user.userId }, select: { id: true } })).map(e => e.id)
      where.engineerId = { in: [...teamIds, user.userId] }
    }
    if (filters.date) where.date = filters.date
    if (filters.dateFrom) where.date = { ...where.date, gte: filters.dateFrom }
    if (filters.dateTo) where.date = { ...where.date, lte: filters.dateTo }
    if (filters.status) where.status = filters.status
    if (filters.engineerId) where.engineerId = filters.engineerId

    const schedules = await db.schedule.findMany({
      where, orderBy: { date: 'desc' },
      include: { engineer: { select: { name: true, engineerCode: true } }, site: true, store: true, visits: { orderBy: { visitNumber: 'desc' }, take: 1 } },
    })

    // Count stats
    const completed = schedules.filter(s => s.status === 'COMPLETED').length
    const pending = schedules.filter(s => s.status === 'PENDING').length
    const total = schedules.length

    if (format === 'CSV') {
      const headers = ['Date', 'Engineer Code', 'Engineer Name', 'Site Code', 'Site Name', 'Store Code', 'Store Name', 'Vendor', 'Activity', 'Status', 'Remarks']
      const csvRows = [headers.join(',')]
      for (const s of schedules) {
        csvRows.push([s.date, s.engineer.engineerCode, s.engineer.name, s.site?.siteCode, s.site?.siteName, s.store?.storeCode, s.store?.storeName, s.vendor, s.activity, s.status, s.remarks].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','))
      }
      const csv = csvRows.join('\n')

      await db.exportHistory.create({ data: { exportedBy: user.userId, format, filters: JSON.stringify(filters), recordCount: total } })
      await logActivity({ userId: user.userId, role: user.role, action: 'EXPORT_SCHEDULE', entity: 'Export', newValue: JSON.stringify({ format, recordCount: total }) })

      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${user.engineerCode}_Schedule_${new Date().toISOString().split('T')[0]}.csv"` } })
    }

    // XLSX
    const workbook = new ExcelJS.Workbook()

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary')
    summarySheet.columns = [{ header: 'Field', key: 'field', width: 25 }, { header: 'Value', key: 'value', width: 40 }]
    summarySheet.addRow({ field: 'Engineer Name', value: user.name })
    summarySheet.addRow({ field: 'Engineer Code', value: user.engineerCode })
    summarySheet.addRow({ field: 'Export Date', value: new Date().toISOString().split('T')[0] })
    summarySheet.addRow({ field: 'Date Range', value: `${filters.dateFrom || 'All'} to ${filters.dateTo || 'All'}` })
    summarySheet.addRow({ field: 'Total Sites', value: total })
    summarySheet.addRow({ field: 'Completed', value: completed })
    summarySheet.addRow({ field: 'Pending', value: pending })
    summarySheet.addRow({ field: 'Completion %', value: total > 0 ? `${((completed / total) * 100).toFixed(1)}%` : '0%' })

    // Schedule Details sheet
    const detailSheet = workbook.addWorksheet('Schedule Details')
    detailSheet.columns = [
      { header: 'Date', key: 'date', width: 12 }, { header: 'Engineer', key: 'engineer', width: 18 },
      { header: 'Site Code', key: 'siteCode', width: 12 }, { header: 'Site Name', key: 'siteName', width: 25 },
      { header: 'Store Code', key: 'storeCode', width: 12 }, { header: 'Store Name', key: 'storeName', width: 25 },
      { header: 'Vendor', key: 'vendor', width: 15 }, { header: 'Activity', key: 'activity', width: 15 },
      { header: 'Status', key: 'status', width: 12 }, { header: 'Remarks', key: 'remarks', width: 30 },
    ]
    for (const s of schedules) {
      detailSheet.addRow({ date: s.date, engineer: s.engineer.name, siteCode: s.site?.siteCode, siteName: s.site?.siteName, storeCode: s.store?.storeCode, storeName: s.store?.storeName, vendor: s.vendor, activity: s.activity, status: s.status, remarks: s.remarks })
    }

    // Visit History sheet
    const visitSheet = workbook.addWorksheet('Visit History')
    visitSheet.columns = [
      { header: 'Date', key: 'date', width: 12 }, { header: 'Engineer', key: 'engineer', width: 18 },
      { header: 'Site', key: 'site', width: 25 }, { header: 'Visit #', key: 'visitNum', width: 8 },
      { header: 'Check-In', key: 'checkIn', width: 20 }, { header: 'Check-Out', key: 'checkOut', width: 20 },
      { header: 'Status', key: 'status', width: 12 }, { header: 'Remarks', key: 'remarks', width: 30 },
    ]
    const allVisits = await db.visit.findMany({
      where: { scheduleId: { in: schedules.map(s => s.id) } }, orderBy: { checkInTime: 'desc' },
      include: { engineer: { select: { name: true } }, schedule: { include: { site: true } } },
    })
    for (const v of allVisits) {
      visitSheet.addRow({ date: v.checkInTime.toISOString().split('T')[0], engineer: v.engineer.name, site: v.schedule.site?.siteName, visitNum: v.visitNumber, checkIn: v.checkInTime.toISOString(), checkOut: v.checkOutTime?.toISOString() || '', status: v.status, remarks: v.remarks })
    }

    // Locations sheet
    const locSheet = workbook.addWorksheet('Locations')
    locSheet.columns = [
      { header: 'Type', key: 'type', width: 8 }, { header: 'Code', key: 'code', width: 12 },
      { header: 'Name', key: 'name', width: 25 }, { header: 'Address', key: 'address', width: 30 },
      { header: 'District', key: 'district', width: 15 }, { header: 'Region', key: 'region', width: 12 },
      { header: 'Latitude', key: 'lat', width: 12 }, { header: 'Longitude', key: 'lng', width: 12 },
      { header: 'Google Maps Link', key: 'link', width: 40 },
    ]
    for (const s of schedules) {
      if (s.site) locSheet.addRow({ type: 'Site', code: s.site.siteCode, name: s.site.siteName, address: s.site.address || '', district: s.site.district || '', region: s.site.region || '', lat: s.site.latitude || '', lng: s.site.longitude || '', link: s.site.googleLink || '' })
      if (s.store) locSheet.addRow({ type: 'Store', code: s.store.storeCode, name: s.store.storeName, address: s.store.address || '', district: s.store.district || '', region: s.store.region || '', lat: s.store.latitude || '', lng: s.store.longitude || '', link: s.store.googleLink || '' })
    }

    const buffer = await workbook.xlsx.writeBuffer()

    await db.exportHistory.create({ data: { exportedBy: user.userId, format, filters: JSON.stringify(filters), recordCount: total } })
    await logActivity({ userId: user.userId, role: user.role, action: 'EXPORT_SCHEDULE', entity: 'Export', newValue: JSON.stringify({ format, recordCount: total }) })

    return new NextResponse(buffer, {
      headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${user.engineerCode}_Daily_Schedule_${new Date().toISOString().split('T')[0]}.xlsx"` },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Export failed' }, { status: 500 })
  }
}
