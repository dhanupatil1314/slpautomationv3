'use client'

import { useState, useRef } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, History, SkipForward, Info } from 'lucide-react'
import { useApiQuery, useApiMutation } from '@/lib/hooks'
import { toast } from 'sonner'
import { format } from 'date-fns'

const SUPPORTED_COLUMNS = [
  { label: 'Date', aliases: 'Date, Schedule Date, Visit Date' },
  { label: 'Engineer Code', aliases: 'Engineer PPRR NO, Engineer Code, FE Code, Emp Code' },
  { label: 'Engineer Name', aliases: 'Engineer Name, FE Name, Technician Name' },
  { label: 'Store/Site Code', aliases: 'Store Code, Site Code, Call No, Ticket No' },
  { label: 'Store Name', aliases: 'Store Name, Site Name' },
  { label: 'Vendor/Format', aliases: 'Vendor, Store Format, Client' },
  { label: 'Activity/Type', aliases: 'Activity, Field Visit Type, Work Type, Category' },
  { label: 'Status', aliases: 'Status, Task Status' },
  { label: 'Remarks', aliases: 'Remarks, Problem Description, Comments, Notes' },
  { label: 'City/District', aliases: 'City, District, Location' },
  { label: 'State/Region', aliases: 'State, Region' },
]

export function ImportView() {
  const token = useAuthStore(s => s.token)
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [showColumns, setShowColumns] = useState(false)
  const { data: history, refetch } = useApiQuery<any>(['imports'], '/api/imports')

  const handleUpload = async () => {
    if (!file) { toast.error('Please select a file'); return }
    setUploading(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/imports', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setResult(data)
      toast.success(`Imported ${data.successCount} of ${data.totalRows} rows`)
      refetch()
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e: any) { toast.error(e.message) }
    finally { setUploading(false) }
  }

  return (
    <div className='space-y-6'>
      <div><h1 className='text-2xl font-bold'>Import Excel</h1><p className='text-muted-foreground text-sm'>Import schedules from Excel files (XLSX, XLS). Engineers and stores are auto-created if not found.</p></div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Upload File</CardTitle>
          <CardDescription className='space-y-1'>
            <p>Flexible column matching — the system auto-detects your column headers.</p>
            <button onClick={() => setShowColumns(!showColumns)} className='text-primary hover:underline text-xs flex items-center gap-1'>
              <Info className='h-3 w-3' />{showColumns ? 'Hide' : 'Show'} supported column names
            </button>
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {showColumns && (
            <div className='bg-muted/50 rounded-lg p-4 max-h-60 overflow-y-auto'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                {SUPPORTED_COLUMNS.map(col => (
                  <div key={col.label} className='text-xs'>
                    <span className='font-medium'>{col.label}:</span>{' '}
                    <span className='text-muted-foreground'>{col.aliases}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className='flex flex-col sm:flex-row gap-4 items-start'>
            <div className='flex-1'>
              <input ref={fileRef} type='file' accept='.xlsx,.xls' onChange={e => { setFile(e.target.files?.[0] || null); setResult(null) }} className='hidden' id='file-upload' />
              <label htmlFor='file-upload' className='flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors'>
                {file ? (
                  <div className='flex items-center gap-2'><FileSpreadsheet className='h-8 w-8 text-emerald-600' /><span className='text-sm font-medium'>{file.name}</span><span className='text-xs text-muted-foreground'>({(file.size / 1024).toFixed(1)} KB)</span></div>
                ) : (
                  <><Upload className='h-8 w-8 text-muted-foreground mb-2' /><p className='text-sm text-muted-foreground'>Click to select file or drag and drop</p><p className='text-xs text-muted-foreground'>XLSX, XLS</p></>
                )}
              </label>
            </div>
            <Button onClick={handleUpload} disabled={!file || uploading} className='h-10'>
              <Upload className='h-4 w-4 mr-2' />{uploading ? 'Importing...' : 'Import'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader><CardTitle className='text-base'>Import Result</CardTitle></CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4'>
              <div className='flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30'><CheckCircle2 className='h-5 w-5 text-emerald-600' /><div><p className='text-lg font-bold text-emerald-700 dark:text-emerald-400'>{result.successCount}</p><p className='text-xs text-muted-foreground'>Successful</p></div></div>
              <div className='flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30'><XCircle className='h-5 w-5 text-red-600' /><div><p className='text-lg font-bold text-red-700 dark:text-red-400'>{result.failedCount}</p><p className='text-xs text-muted-foreground'>Failed</p></div></div>
              {result.skippedCount > 0 && (
                <div className='flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30'><SkipForward className='h-5 w-5 text-amber-600' /><div><p className='text-lg font-bold text-amber-700 dark:text-amber-400'>{result.skippedCount}</p><p className='text-xs text-muted-foreground'>Skipped</p></div></div>
              )}
              <div className='flex items-center gap-2 p-3 rounded-lg bg-muted'><AlertCircle className='h-5 w-5 text-muted-foreground' /><div><p className='text-lg font-bold'>{result.totalRows}</p><p className='text-xs text-muted-foreground'>Total Rows</p></div></div>
            </div>
            {result.failedRows?.length > 0 && (
              <div className='max-h-60 overflow-y-auto'>
                <p className='text-sm font-medium mb-2 text-destructive'>Failed Rows:</p>
                {result.failedRows.map((r: any, i: number) => (
                  <div key={i} className='flex items-start gap-2 p-2 rounded bg-muted/50 text-xs mb-1'>
                    <span className='font-mono text-destructive shrink-0'>Row {r.row}:</span>
                    <span>{r.errors?.join(', ')}</span>
                    {r.data?.engName && <span className='text-muted-foreground ml-auto shrink-0'>({r.data.engName})</span>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className='text-base flex items-center gap-2'><History className='h-4 w-4' />Import History</CardTitle></CardHeader>
        <CardContent>
          <div className='space-y-3'>
            {(history?.imports || []).map((imp: any) => (
              <div key={imp.id} className='flex items-center justify-between py-2 border-b border-border last:border-0'>
                <div><p className='text-sm font-medium'>{imp.fileName}</p><p className='text-xs text-muted-foreground'>{imp.uploader?.name} • {format(new Date(imp.createdAt), 'MMM d, yyyy h:mm a')}</p></div>
                <div className='flex items-center gap-3'>
                  <span className='text-sm font-medium text-emerald-600'>{imp.successCount} success</span>
                  {imp.failedCount > 0 && <span className='text-sm font-medium text-red-600'>{imp.failedCount} failed</span>}
                </div>
              </div>
            ))}
            {(!history?.imports?.length) && <p className='text-sm text-muted-foreground text-center py-4'>No import history</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}