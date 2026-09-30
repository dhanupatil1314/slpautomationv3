// LakhirAd CSV export utility — converts array of objects to CSV and triggers download
// Usage: exportToCsv('devices.csv', [{id:1,name:'x'}, ...])

export function exportToCsv(filename: string, rows: Record<string, any>[], headers?: { key: string; label: string }[]) {
  if (!rows || rows.length === 0) {
    // Trigger empty file download
    downloadBlob(new Blob([''], { type: 'text/csv;charset=utf-8;' }), filename)
    return
  }

  // Determine columns: use provided headers or derive from first row
  const cols = headers || Object.keys(rows[0]).map((key) => ({ key, label: key }))
  const headerRow = cols.map((c) => escapeCsv(c.label)).join(',')
  const dataRows = rows.map((row) =>
    cols.map((c) => escapeCsv(row[c.key] ?? '')).join(',')
  )
  const csv = [headerRow, ...dataRows].join('\r\n')

  // Prepend BOM for Excel UTF-8 compatibility
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, filename)
}

function escapeCsv(value: any): string {
  const str = String(value ?? '')
  // Quote if contains comma, quote, newline
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
