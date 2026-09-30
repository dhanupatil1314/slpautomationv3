import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth, logActivity } from '@/lib/api'
import ExcelJS from 'exceljs'
import { hashSync } from 'bcryptjs'

export async function GET(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result
  if (user.role === 'ENGINEER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const imports = await db.importHistory.findMany({
      orderBy: { createdAt: 'desc' }, take: 50,
      include: { uploader: { select: { name: true, engineerCode: true } } },
    })
    return NextResponse.json({ imports })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load import history' }, { status: 500 })
  }
}

// Flexible column header matching: each logical field maps to multiple possible header names
const COLUMN_ALIASES: Record<string, string[]> = {
  date:        ['date', 'schedule date', 'visit date', 'open time', 'opentime'],
  engineerName: ['engineer name', 'engineername', 'fe name', 'field engineer', 'technician name', 'emp name'],
  engineerCode: ['engineer code', 'engineercode', 'engineer ppr', 'pprr no', 'pprrno', 'engineer ppr no', 'eng code', 'emp code', 'fe code', 'engineer pprs no', 'assignee name', 'assigneename'],
  siteCode:    ['site code', 'sitecode', 'call no', 'call no.', 'call number', 'ticket no', 'ticket no.', 'complaint no', 'complaint no.'],
  storeCode:   ['store code', 'storecode'],
  storeName:   ['store name', 'storename', 'site name', 'sitename'],
  storeFormat: ['store format', 'storeformat'],
  vendor:      ['vendor', 'client', 'client name', 'assignment group', 'assignmentgroup'],
  activity:    ['activity', 'field visit type', 'visit type', 'work type', 'task type', 'category', 'service type', 'sd category', 'sdcategory', 'subcategory'],
  status:      ['status', 'task status', 'schedule status', 'visit status', 'open', 'close', 'closed', 'resolved'],
  remarks:     ['remarks', 'remark', 'problem description', 'description', 'problem', 'issue', 'comment', 'comments', 'notes', 'work details'],
  city:        ['city', 'city3', 'district', 'location', 'store city', 'storecity'],
  state:       ['state', 'state2', 'region', 'store state', 'storestate'],
  business:    ['business', 'business type', 'vertical', 'segment'],
  manager:     ['project manager', 'manager', 'pm name', 'reporting manager'],
  // New extended fields for the Daily Schedule Report
  vertical:    ['vertical', 'business', 'business type', 'segment'],
  callNumber:  ['call number', 'callnumber', 'call no', 'call no.', 'ticket no', 'ticket no.', 'complaint no', 'complaint no.', 'sd number', 'incident'],
  visitType:   ['visit type', 'visittype', 'field visit type', 'visit kind', 'task type'],
  problem:     ['problem', 'problemdescription', 'problem description', 'issue', 'issue description', 'fault', 'fault details'],
  callDate:    ['call date', 'calldate', 'ticket date', 'open date', 'openedon', 'opened on', 'logged date'],
  zone:        ['zone', 'region zone', 'territory'],
  smName:      ['sm name', 'smname', 'senior manager', 'senior manager name', 'sm'],
}

function normalize(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '').trim()
}

function buildColumnMap(headerRow: ExcelJS.Row): Record<string, number> {
  const colMap: Record<string, number> = {}
  headerRow.eachCell((cell, colNum) => {
    if (!cell.value) return
    const normalized = normalize(cell.value.toString())
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (colMap[field]) continue // already mapped
      for (const alias of aliases) {
        const normAlias = normalize(alias)
        if (normalized === normAlias || normalized.includes(normAlias) || normAlias.includes(normalized)) {
          colMap[field] = colNum
          break
        }
      }
    }
  })
  return colMap
}

function getCellString(row: ExcelJS.Row, colNum: number | undefined): string {
  if (!colNum) return ''
  const v = row.getCell(colNum).value
  if (v == null) return ''
  if (typeof v === 'object' && 'result' in (v as any)) return (v as any).result?.toString() || ''
  if (typeof v === 'object' && 'richText' in (v as any)) return (v as any).richText?.map((r: any) => r.text).join('') || ''
  return String(v).trim()
}

function getCellDate(row: ExcelJS.Row, colNum: number | undefined): string {
  if (!colNum) return ''
  const v = row.getCell(colNum).value
  if (v instanceof Date) return v.toISOString().split('T')[0]
  if (typeof v === 'string') {
    // Try parsing various date formats
    const cleaned = v.trim()
    // ISO format: 2026-04-09
    const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`
    // DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
    if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`
    // DD-Mon-YYYY
    const monMatch = cleaned.match(/^(\d{1,2})[\s-]([a-zA-Z]{3})[\s-](\d{4})/i)
    if (monMatch) {
      const months: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' }
      const m = months[monMatch[2].toLowerCase().substring(0, 3)]
      if (m) return `${monMatch[3]}-${m}-${monMatch[1].padStart(2, '0')}`
    }
  }
  if (typeof v === 'number' && v > 30000 && v < 60000) {
    // Excel serial date
    const d = new Date((v - 25569) * 86400 * 1000)
    return d.toISOString().split('T')[0]
  }
  return ''
}

export async function POST(req: NextRequest) {
  const result = await auth(req)
  if (result instanceof NextResponse) return result
  const { user } = result
  if (user.role === 'ENGINEER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const worksheet = workbook.worksheets[0]
    if (!worksheet) return NextResponse.json({ error: 'No worksheet found' }, { status: 400 })

    const headerRow = worksheet.getRow(1)
    const colMap = buildColumnMap(headerRow)

    const failedRows: Array<{ row: number; errors: string[]; data: any }> = []
    let successCount = 0
    let skippedCount = 0
    const totalRows = worksheet.rowCount - 1

    // Cache for engineer/store lookups to avoid repeated DB queries
    const engineerCache = new Map<string, any>()
    const storeCache = new Map<string, any>()
    const siteCache = new Map<string, any>()

    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i)
      const rowNum = row.number
      const errors: string[] = []

      const date = getCellDate(row, colMap['date'])
      const engName = getCellString(row, colMap['engineerName'])
      const engCode = getCellString(row, colMap['engineerCode'])
      const storeCode = getCellString(row, colMap['storeCode']) || getCellString(row, colMap['siteCode'])
      const storeName = getCellString(row, colMap['storeName'])
      const storeFormat = getCellString(row, colMap['storeFormat'])
      const vendor = getCellString(row, colMap['vendor'])
      const activity = getCellString(row, colMap['activity'])
      const statusStr = getCellString(row, colMap['status'])
      const remarks = getCellString(row, colMap['remarks'])
      const city = getCellString(row, colMap['city'])
      const state = getCellString(row, colMap['state'])
      // New extended fields
      const vertical = getCellString(row, colMap['vertical'])
      const callNumber = getCellString(row, colMap['callNumber'])
      const visitType = getCellString(row, colMap['visitType'])
      const problem = getCellString(row, colMap['problem'])
      const callDate = getCellDate(row, colMap['callDate'])
      const zone = getCellString(row, colMap['zone'])
      const smName = getCellString(row, colMap['smName'])
      const projectManager = getCellString(row, colMap['manager'])

      // Validate required fields
      if (!date) errors.push('Invalid or missing date')
      if (!engName && !engCode) errors.push('Missing engineer name and code')

      // Validate store code - skip obviously bad data
      if (!storeCode) {
        errors.push('Missing store/site code')
      } else if (storeCode.length > 20) {
        errors.push(`Invalid store code: "${storeCode.substring(0, 40)}..."`)
      }

      // Skip completely empty rows
      const isEmpty = !date && !engName && !engCode && !storeCode
      if (isEmpty) { skippedCount++; continue }

      if (errors.length > 0) {
        failedRows.push({ row: rowNum, errors, data: { date, engName, engCode, storeCode } })
        continue
      }

      try {
        // --- Find or create Engineer ---
        let engineer = engCode ? engineerCache.get(engCode) : undefined
        if (!engineer && engCode) {
          engineer = await db.user.findUnique({ where: { engineerCode: engCode } })
          if (engineer) engineerCache.set(engCode, engineer)
        }
        // Fallback: try finding by name if code didn't match
        if (!engineer && engName) {
          const normalizedName = engName.trim().toLowerCase()
          const byName = await db.user.findFirst({ where: { role: 'ENGINEER', name: { equals: engName.trim() } } })
          if (byName) {
            engineer = byName
            if (engCode) engineerCache.set(engCode, engineer)
          }
        }
        // Auto-create engineer if not found
        if (!engineer) {
          const code = engCode || `IMP${Date.now()}${Math.random().toString(36).substring(2, 6)}`
          engineer = await db.user.create({
            data: {
              engineerCode: code,
              name: engName || 'Unknown Engineer',
              password: hashSync('Import@123', 10),
              role: 'ENGINEER',
              status: 'ACTIVE',
              vertical: vertical || undefined,
              zone: zone || undefined,
              smName: smName || undefined,
              projectManager: projectManager || undefined,
            },
          })
          engineerCache.set(code, engineer)
        } else {
          // Backfill extended profile fields if the import provides them and the engineer is missing them
          const updates: any = {}
          if (vertical && !engineer.vertical) updates.vertical = vertical
          if (zone && !engineer.zone) updates.zone = zone
          if (smName && !engineer.smName) updates.smName = smName
          if (projectManager && !engineer.projectManager) updates.projectManager = projectManager
          if (Object.keys(updates).length > 0) {
            engineer = await db.user.update({ where: { id: engineer.id }, data: updates })
            if (engCode) engineerCache.set(engCode, engineer)
          }
        }

        // --- Find or create Store ---
        let store = storeCode ? storeCache.get(storeCode) : undefined
        if (!store && storeCode) {
          store = await db.store.findUnique({ where: { storeCode } })
          if (store) storeCache.set(storeCode, store)
        }
        if (!store && storeCode) {
          store = await db.store.create({
            data: {
              storeCode,
              storeName: storeName || storeCode,
              storeFormat: storeFormat || undefined,
              district: city || '',
              region: state || '',
            },
          })
          storeCache.set(storeCode, store)
        }

        // --- Find or create Site (use store code as site code too) ---
        const siteCode = storeCode
        let site = siteCode ? siteCache.get(siteCode) : undefined
        if (!site && siteCode) {
          site = await db.site.findUnique({ where: { siteCode } })
          if (site) siteCache.set(siteCode, site)
        }
        if (!site && siteCode) {
          site = await db.site.create({
            data: {
              siteCode,
              siteName: storeName || storeCode,
              district: city || '',
              region: state || '',
              vendor: vendor || undefined,
            },
          })
          siteCache.set(siteCode, site)
        }

        // --- Build schedule data ---
        let status = statusStr.toUpperCase().trim()
        const validStatuses = ['ASSIGNED', 'PENDING', 'COMPLETED', 'HOLD', 'CANCELLED', 'RESCHEDULED']
        if (!validStatuses.includes(status)) status = 'ASSIGNED'

        // --- Duplicate check: date + engineerId + storeId ---
        const whereClause: any = { date, engineerId: engineer.id }
        if (store?.id) whereClause.storeId = store.id
        else if (site?.id) whereClause.siteId = site.id

        const existing = await db.schedule.findFirst({ where: whereClause })
        if (existing) {
          await db.schedule.update({
            where: { id: existing.id },
            data: {
              siteId: site?.id,
              storeId: store?.id,
              vendor: vendor || undefined,
              activity: activity || undefined,
              status,
              remarks: remarks || undefined,
              vertical: vertical || undefined,
              callNumber: callNumber || undefined,
              visitType: visitType || undefined,
              problem: problem || undefined,
              callDate: callDate || undefined,
              zone: zone || engineer?.zone || undefined,
            },
          })
        } else {
          await db.schedule.create({
            data: {
              date,
              engineerId: engineer.id,
              siteId: site?.id,
              storeId: store?.id,
              vendor: vendor || undefined,
              activity: activity || undefined,
              status,
              remarks: remarks || undefined,
              vertical: vertical || engineer?.vertical || undefined,
              callNumber: callNumber || undefined,
              visitType: visitType || undefined,
              problem: problem || undefined,
              callDate: callDate || undefined,
              zone: zone || engineer?.zone || undefined,
            },
          })
        }
        successCount++
      } catch (e: any) {
        errors.push(e.message?.substring(0, 100) || 'Unknown error')
        failedRows.push({ row: rowNum, errors, data: { date, engName, engCode, storeCode } })
      }
    }

    await db.importHistory.create({
      data: {
        fileName: file.name, uploadedBy: user.userId, totalRows,
        successCount, failedCount: failedRows.length,
        report: JSON.stringify(failedRows),
      },
    })
    await logActivity({
      userId: user.userId, role: user.role, action: 'IMPORT_SCHEDULE', entity: 'Import',
      newValue: JSON.stringify({ fileName: file.name, totalRows, successCount, failedCount: failedRows.length, skippedCount }),
    })

    return NextResponse.json({
      success: true, totalRows, successCount, failedCount: failedRows.length,
      skippedCount, failedRows: failedRows.slice(0, 50),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Import failed' }, { status: 500 })
  }
}
