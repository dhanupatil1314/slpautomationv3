'use client'

import { useState, useEffect } from 'react'
import { useFetch, mutate } from '@/hooks/use-fetch'
import { useNav, useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import { PageHeader, StatusBadge, EmptyState, TableSkeleton, Pagination, ErrorState, KpiCard } from '@/components/shared'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Film, Plus, Search, RefreshCw, Grid3x3, List, CheckCircle2, XCircle, Archive,
  Clock, FileVideo, FileImage, Link2, Upload, QrCode,
} from 'lucide-react'
import { formatINR, formatNumber, formatDate, bytesToSize, secondsToDuration } from '@/lib/format'
import { toast } from 'sonner'
import { QrCode as QrCodeComponent } from '@/components/shared/qr-code'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = ['draft', 'pending_approval', 'approved', 'rejected', 'archived']
const TYPE_OPTIONS = ['image', 'video']
const FORMAT_BY_TYPE: Record<string, string[]> = {
  image: ['jpg', 'png', 'webp'],
  video: ['mp4', 'webm', 'mov'],
}

export function MediaView() {
  const { user } = useAuth()
  const role = user?.role
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [advertiserFilter, setAdvertiserFilter] = useState('all')
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [refreshKey, setRefreshKey] = useState(0)
  const [showUpload, setShowUpload] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<any | null>(null)
  const pageSize = 12

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    search,
    type: typeFilter === 'all' ? '' : typeFilter,
    status: statusFilter === 'all' ? '' : statusFilter,
    advertiserId: advertiserFilter === 'all' ? '' : advertiserFilter,
  }).toString()

  const { data, loading, error, refresh } = useFetch<any>(`/api/media?${query}`, { refreshKey })
  const { data: advertisersData } = useFetch<any>('/api/advertisers?pageSize=100')

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setRefreshKey((k) => k + 1) }, 300)
    return () => clearTimeout(t)
  }, [search, typeFilter, statusFilter, advertiserFilter])

  const media = data?.media || []
  const total = data?.total || 0
  const pendingCount = media.filter((m: any) => m.approvalStatus === 'pending_approval').length
  const approvedCount = media.filter((m: any) => m.approvalStatus === 'approved').length

  const handleAction = async (m: any, action: 'approve' | 'reject' | 'archive' | 'rename', extra?: any) => {
    try {
      await mutate(`/api/media/${m.id}`, 'PATCH', { action, ...extra })
      toast.success(action === 'approve' ? 'Media approved' : action === 'reject' ? 'Media rejected' : action === 'archive' ? 'Media archived' : 'Media updated')
      setRefreshKey((k) => k + 1)
    } catch (e: any) {
      toast.error(e.message || 'Action failed')
    }
  }

  return (
    <div>
      <PageHeader
        title="Media Library"
        subtitle={`${formatNumber(total)} media assets`}
        breadcrumbs={[{ label: 'Advertising' }, { label: 'Media' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            {hasPermission(role, 'media.create') && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowUpload(true)}>
                <Upload className="h-3.5 w-3.5" /> Upload
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-4">
        <KpiCard label="Total Assets" value={formatNumber(total)} icon={Film} color="primary" />
        <KpiCard label="Pending Approval" value={formatNumber(pendingCount)} icon={Clock} color="warning" />
        <KpiCard label="Approved" value={formatNumber(approvedCount)} icon={CheckCircle2} color="success" />
        <KpiCard label="Total Usage" value={formatNumber(media.reduce((s: number, m: any) => s + m.usageCount, 0))} icon={Film} color="info" hint="Playlist references" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search media..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={advertiserFilter} onValueChange={setAdvertiserFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Advertiser" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Advertisers</SelectItem>
            {(advertisersData?.advertisers || []).map((a: any) => (
              <SelectItem key={a.id} value={a.id}>{a.organizationName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex border rounded-md">
          <Button variant={view === 'grid' ? 'default' : 'ghost'} size="sm" className="rounded-r-none" onClick={() => setView('grid')}>
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button variant={view === 'table' ? 'default' : 'ghost'} size="sm" className="rounded-l-none" onClick={() => setView('table')}>
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : media.length === 0 ? (
        <Card><CardContent><EmptyState icon={Film} title="No media found" description="Try adjusting filters or upload new media" /></CardContent></Card>
      ) : view === 'grid' ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {media.map((m: any) => (
              <MediaCard key={m.id} media={m} onAction={handleAction} onReject={() => setRejectTarget(m)} role={role} />
            ))}
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Name</th>
                    <th className="text-left p-3 font-semibold">Type</th>
                    <th className="text-left p-3 font-semibold">Advertiser</th>
                    <th className="text-left p-3 font-semibold">Size</th>
                    <th className="text-left p-3 font-semibold">Duration</th>
                    <th className="text-left p-3 font-semibold">Usage</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                    <th className="text-right p-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {media.map((m: any) => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-accent/50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className={cn('grid place-items-center h-9 w-9 rounded-md shrink-0', m.type === 'video' ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success')}>
                            {m.type === 'video' ? <FileVideo className="h-4 w-4" /> : <FileImage className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{m.name}</p>
                            <p className="text-xs text-muted-foreground truncate uppercase">{m.format}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 capitalize">{m.type}</td>
                      <td className="p-3 truncate max-w-[180px]">{m.advertiserName}</td>
                      <td className="p-3 text-xs tabular-nums">{bytesToSize(m.sizeBytes)}</td>
                      <td className="p-3 text-xs tabular-nums">{m.durationSec ? secondsToDuration(m.durationSec) : '—'}</td>
                      <td className="p-3 text-xs">{m.usageCount}</td>
                      <td className="p-3"><StatusBadge status={m.approvalStatus} /></td>
                      <td className="p-3">
                        <MediaActions media={m} onAction={handleAction} onReject={() => setRejectTarget(m)} role={role} compact />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </>
      )}

      {showUpload && <UploadMediaDialog onClose={() => setShowUpload(false)} onCreated={() => { setShowUpload(false); setRefreshKey((k) => k + 1) }} />}
      {rejectTarget && <RejectDialog media={rejectTarget} onClose={() => setRejectTarget(null)} onConfirm={(reason) => { handleAction(rejectTarget, 'reject', { reason }); setRejectTarget(null) }} />}
    </div>
  )
}

function MediaCard({ media, onAction, onReject, role }: { media: any; onAction: (m: any, a: any, e?: any) => void; onReject: () => void; role?: string }) {
  const [showQr, setShowQr] = useState(false)
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail placeholder (gradient) */}
      <div className={cn(
        'relative aspect-video grid place-items-center bg-gradient-to-br from-primary/80 to-primary text-primary-foreground',
        media.type === 'image' && 'from-success/80 to-success text-success-foreground'
      )}>
        <div className="text-center px-2">
          {media.type === 'video' ? <FileVideo className="h-8 w-8 mx-auto opacity-80" /> : <FileImage className="h-8 w-8 mx-auto opacity-80" />}
          <p className="mt-1 text-xs font-medium line-clamp-2 opacity-90">{media.name}</p>
        </div>
        <div className="absolute top-2 left-2">
          <Badge variant="secondary" className="bg-black/30 text-white border-0 backdrop-blur uppercase">{media.format}</Badge>
        </div>
        <div className="absolute top-2 right-2">
          <StatusBadge status={media.approvalStatus} className="bg-black/30 text-white border-0 backdrop-blur" />
        </div>
        {media.durationSec > 0 && (
          <div className="absolute bottom-2 right-2 text-xs bg-black/50 text-white px-1.5 py-0.5 rounded backdrop-blur tabular-nums">
            {secondsToDuration(media.durationSec)}
          </div>
        )}
      </div>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{media.name}</p>
            <p className="text-xs text-muted-foreground truncate">{media.advertiserName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="tabular-nums">{bytesToSize(media.sizeBytes)}</span>
          <span className="tabular-nums">{media.resolution || '—'}</span>
          {media.qrUrl && (
            <button onClick={() => setShowQr(true)} className="flex items-center gap-1 hover:text-primary transition-colors" title="View QR code">
              <QrCode className="h-3 w-3" />QR
            </button>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
          <span>Used {media.usageCount}×</span>
          <span>{formatDate(media.createdAt)}</span>
        </div>
        <MediaActions media={media} onAction={onAction} onReject={onReject} role={role} />
      </CardContent>
      {showQr && media.qrUrl && (
        <Dialog open onOpenChange={() => setShowQr(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><QrCode className="h-4 w-4" /> QR Code — {media.name}</DialogTitle>
              <DialogDescription>Scan to visit the campaign landing page</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-2">
              <QrCodeComponent value={media.qrUrl} size={200} label={media.qrUrl} />
              <p className="text-xs text-muted-foreground">URL: {media.qrUrl}</p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}

function MediaActions({ media, onAction, onReject, role, compact }: { media: any; onAction: (m: any, a: any, e?: any) => void; onReject: () => void; role?: string; compact?: boolean }) {
  const canApprove = hasPermission(role, 'media.approve')
  const canEdit = hasPermission(role, 'media.edit')
  const size = compact ? 'sm' : 'sm'
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {media.approvalStatus === 'pending_approval' && canApprove && (
        <>
          <Button size={size} variant="default" className="gap-1 h-7" onClick={() => onAction(media, 'approve')}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
          </Button>
          <Button size={size} variant="outline" className="gap-1 h-7 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={onReject}>
            <XCircle className="h-3.5 w-3.5" /> Reject
          </Button>
        </>
      )}
      {media.approvalStatus === 'rejected' && canApprove && (
        <Button size={size} variant="outline" className="gap-1 h-7" onClick={() => onAction(media, 'approve')}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
        </Button>
      )}
      {canEdit && !['archived'].includes(media.approvalStatus) && (
        <Button size={size} variant="ghost" className="gap-1 h-7" onClick={() => onAction(media, 'archive')}>
          <Archive className="h-3.5 w-3.5" /> Archive
        </Button>
      )}
    </div>
  )
}

function UploadMediaDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', type: 'video', format: 'mp4', resolution: '1920x1080',
    durationSec: '15', advertiserId: '', qrUrl: '', sizeBytes: '',
  })
  const [loading, setLoading] = useState(false)
  const { data: advertisersData } = useFetch<any>('/api/advertisers?pageSize=100')

  const submit = async () => {
    if (!form.name) return toast.error('Name is required')
    setLoading(true)
    try {
      await mutate('/api/media', 'POST', {
        name: form.name, type: form.type, format: form.format, resolution: form.resolution,
        durationSec: form.durationSec, advertiserId: form.advertiserId || undefined,
        qrUrl: form.qrUrl || undefined, sizeBytes: form.sizeBytes || undefined,
      })
      toast.success('Media uploaded (metadata stored). Awaiting approval.')
      onCreated()
    } catch (e: any) {
      toast.error(e.message || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Media</DialogTitle>
          <DialogDescription>Metadata is stored; actual file upload is handled by the CDN pipeline.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Diwali Sale 2024 Promo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v, format: v === 'video' ? 'mp4' : 'jpg' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Format</Label>
              <Select value={form.format} onValueChange={(v) => setForm({ ...form, format: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(FORMAT_BY_TYPE[form.type] || []).map((f) => <SelectItem key={f} value={f} className="uppercase">{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Resolution</Label>
              <Input value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })} placeholder="1920x1080" />
            </div>
            <div>
              <Label>Duration (sec)</Label>
              <Input type="number" value={form.durationSec} onChange={(e) => setForm({ ...form, durationSec: e.target.value })} disabled={form.type === 'image'} />
            </div>
          </div>
          <div>
            <Label>Advertiser</Label>
            <Select value={form.advertiserId || 'none'} onValueChange={(v) => setForm({ ...form, advertiserId: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Select advertiser (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(advertisersData?.advertisers || []).map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.organizationName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" />QR Target URL (optional)</Label>
            <Input value={form.qrUrl} onChange={(e) => setForm({ ...form, qrUrl: e.target.value })} placeholder="https://shop.example.com/diwali" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> {loading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RejectDialog({ media, onClose, onConfirm }: { media: any; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject Media</DialogTitle>
          <DialogDescription>Provide a reason for rejecting "{media.name}". This will be visible to the uploader.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Rejection Reason *</Label>
          <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Logo is cut off at the bottom, please re-export with 1920x1080 safe area" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={!reason} onClick={() => onConfirm(reason)}>Reject Media</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
