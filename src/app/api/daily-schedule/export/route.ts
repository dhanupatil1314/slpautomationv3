import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth, logActivity } from '@/lib/api'
import ExcelJS from 'exceljs'

/**
 * Daily Schedule Export API
 *
 * Produces an Excel workbook in the exact format the customer provided as
 * reference (Dhanu_report_engineer_*.xlsx). Every authenticated user can
 * export the complete daily schedule data for ALL engineers using the
 * supplied filters (date range, engineer, status, vertical, visit type,
 * district, region, store format, etc.).
 *
 * Reference columns:
 *  Sr No | Engineer Name | Engineer Code | Schedule Date | Vertical | Category |
 *  Project Manager | Call Number | Store Code | Store Name | City | State |
 *  Store Format | Visit Type | (empty) | Problem | Status | Comment |
 *  Schedule Date | Call Date | (empty) | SM Name | Zone
 */
export async function POST(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result

  try {
    const body = await req.json()
    const filters = body.filters || {}
    const groupByEngineer = body.groupByEngineer === true

    const where: any = {}
    // NO role-based filtering — every authenticated user exports ALL engineers.

    if (filters.dateFrom || filters.dateTo) {
      where.date = {}
      if (filters.dateFrom) where.date.gte = filters.dateFrom
      if (filters.dateTo) where.date.lte = filters.dateTo
    }
    if (filters.date) where.date = filters.date
    if (filters.status) where.status = filters.status
    if (filters.engineerId) where.engineerId = filters.engineerId
    if (filters.vertical) where.vertical = filters.vertical
    if (filters.visitType) where.visitType = filters.visitType
    if (filters.zone) where.zone = filters.zone
    if (filters.vendor) where.vendor = filters.vendor
    if (filters.activity) where.activity = filters.activity

    if (filters.district) {
      where.OR = [
        { site: { district: filters.district } },
        { store: { district: filters.district } },
      ]
    }
    if (filters.region) {
      where.OR = [
        ...(where.OR || []),
        { site: { region: filters.region } },
        { store: { region: filters.region } },
      ]
    }
    if (filters.storeFormat) where.store = { storeFormat: filters.storeFormat }

    if (filters.search) {
      const search = filters.search as string
      where.OR = [
        { engineer: { name: { contains: search } } },
        { engineer: { engineerCode: { contains: search } } },
        { site: { siteName: { contains: search } } },
        { site: { siteCode: { contains: search } } },
        { store: { storeName: { contains: search } } },
        { store: { storeCode: { contains: search } } },
        { vendor: { contains: search } },
        { activity: { contains: search } },
        { callNumber: { contains: search } },
        { problem: { contains: search } },
        { remarks: { contains: search } },
      ]
    }

    const schedules = await db.schedule.findMany({
      where, orderBy: [{ date: 'desc' }, { engineer: { name: 'asc' } }],
      include: {
        engineer: { select: { id: true, name: true, engineerCode: true, vertical: true, zone: true, smName: true, projectManager: true, manager: { select: { name: true } } } },
        site: true,
        store: true,
      },
    })

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'SLP Automation'
    workbook.created = new Date()

    const buildSheet = (sheetName: string, rows: any[], engineerLabel: string) => {
      const sheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] })

      // Header row — exact column order from the reference Excel
      sheet.columns = [
        { header: 'Sr No', key: 'srNo', width: 6 },
        { header: 'Engineer Name', key: 'engineerName', width: 18 },
        { header: 'Engineer Code', key: 'engineerCode', width: 14 },
        { header: 'Schedule Date', key: 'scheduleDate', width: 14 },
        { header: 'Vertical', key: 'vertical', width: 10 },
        { header: 'Category', key: 'category', width: 22 },
        { header: 'Project Manager', key: 'projectManager', width: 22 },
        { header: 'Call Number', key: 'callNumber', width: 15 },
        { header: 'Store Code', key: 'storeCode', width: 12 },
        { header: 'Store Name', key: 'storeName', width: 20 },
        { header: 'City', key: 'city', width: 16 },
        { header: 'State', key: 'state', width: 12 },
        { header: 'Store Format', key: 'storeFormat', width: 16 },
        { header: 'Visit Type', key: 'visitType', width: 12 },
        { header: '', key: 'spacer1', width: 3 }, // empty col O
        { header: 'Problem', key: 'problem', width: 36 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Comment', key: 'comment', width: 30 },
        { header: 'Schedule Date', key: 'scheduleDate2', width: 14 },
        { header: 'Call Date', key: 'callDate', width: 14 },
        { header: '', key: 'spacer2', width: 3 }, // empty col U
        { header: 'SM Name', key: 'smName', width: 16 },
        { header: 'Zone', key: 'zone', width: 10 },
      ]

      // Style header row
      const headerRow = sheet.getRow(1)
      headerRow.height = 22
      headerRow.font = { name: 'Calibri', bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } } // slate-800
      headerRow.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
      headerRow.border = {
        top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      }

      // Status color map for data rows
      const statusFill: Record<string, string> = {
        COMPLETED: 'FFD1FAE5', // emerald-100
        PENDING: 'FFFED7AA',   // orange-200
        ASSIGNED: 'FFDBEAFE',  // blue-100
        HOLD: 'FFFEF3C7',      // amber-100
        CANCELLED: 'FFFECACA', // red-200
        RESCHEDULED: 'FFE9D5FF', // purple-200
      }
      const statusFont: Record<string, string> = {
        COMPLETED: 'FF065F46',
        PENDING: 'FF9A3412',
        ASSIGNED: 'FF1E40AF',
        HOLD: 'FF92400E',
        CANCELLED: 'FF991B1B',
        RESCHEDULED: 'FF6B21A8',
      }

      // Populate rows
      rows.forEach((s, idx) => {
        const engineer = s.engineer
        const projectManager = engineer?.projectManager || engineer?.manager?.name || ''
        const smName = engineer?.smName || ''
        const zone = s.zone || engineer?.zone || ''
        const vertical = s.vertical || engineer?.vertical || ''
        // City/State fall back to store then site
        const city = s.store?.district || s.site?.district || ''
        const state = s.store?.region || s.site?.region || ''
        const row = sheet.addRow({
          srNo: idx + 1,
          engineerName: engineer?.name || '',
          engineerCode: engineer?.engineerCode || '',
          scheduleDate: s.date || '',
          vertical,
          category: s.activity || '',
          projectManager,
          callNumber: s.callNumber || '',
          storeCode: s.store?.storeCode || s.site?.siteCode || '',
          storeName: s.store?.storeName || s.site?.siteName || '',
          city,
          state,
          storeFormat: s.store?.storeFormat || '',
          visitType: s.visitType || '',
          spacer1: '',
          problem: s.problem || '',
          status: s.status || '',
          comment: s.remarks || '',
          scheduleDate2: s.date || '',
          callDate: s.callDate || '',
          spacer2: '',
          smName,
          zone,
        })
        row.font = { name: 'Calibri', size: 11 }
        row.alignment = { vertical: 'top', wrapText: true }
        row.border = {
          top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        }
        // Color the status cell
        const statusCell = row.getCell('status')
        if (statusFill[s.status]) {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusFill[s.status] } }
          statusCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: statusFont[s.status] } }
        }
      })

      // Enable auto-filter on the header row so the customer can filter inside Excel
      sheet.autoFilter = { from: 'A1', to: 'W1' }

      return sheet
    }

    if (groupByEngineer && schedules.length > 0) {
      // Group rows by engineer — one sheet per engineer (mirrors reference file naming)
      const grouped = new Map<string, any[]>()
      for (const s of schedules) {
        const key = s.engineer?.engineerCode || 'UNKNOWN'
        if (!grouped.has(key)) grouped.set(key, [])
        grouped.get(key)!.push(s)
      }
      for (const [code, rows] of grouped) {
        const engineerName = rows[0]?.engineer?.name || code
        // Excel sheet names: max 31 chars, no special chars
        const safeName = `${engineerName}_${code}`.replace(/[\\/?*[\]:]/g, '').slice(0, 28)
        buildSheet(safeName, rows, engineerName)
      }
    } else {
      buildSheet('Report', schedules, 'All Engineers')
    }

    const buffer = await workbook.xlsx.writeBuffer()

    await db.exportHistory.create({ data: { exportedBy: user.userId, format: 'XLSX', filters: JSON.stringify(filters), recordCount: schedules.length } })
    await logActivity({ userId: user.userId, role: user.role, action: 'EXPORT_DAILY_SCHEDULE', entity: 'Export', newValue: JSON.stringify({ format: 'XLSX', recordCount: schedules.length, filters }) })

    const dateLabel = filters.dateFrom || filters.dateTo ? `${filters.dateFrom || 'start'}_to_${filters.dateTo || 'end'}` : new Date().toISOString().split('T')[0]
    const fileName = `Daily_Schedule_Report_${dateLabel}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error: any) {
    console.error('Daily schedule export error:', error)
    return NextResponse.json({ error: error.message || 'Export failed' }, { status: 500 })
  }
}
