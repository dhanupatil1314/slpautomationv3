// LakhirAd formatting utilities — INR currency, dates, numbers

export function formatINR(amount: number, compact = false): string {
  if (compact) {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)}Cr`
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(n: number, compact = false): string {
  return new Intl.NumberFormat('en-IN', compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}).format(n)
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return 'never'
  const d = typeof date === 'string' ? new Date(date) : date
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(d)
}

export function bytesToSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function secondsToDuration(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    online: 'bg-success/15 text-success border-success/30',
    active: 'bg-success/15 text-success border-success/30',
    approved: 'bg-success/15 text-success border-success/30',
    paid: 'bg-success/15 text-success border-success/30',
    completed: 'bg-success/15 text-success border-success/30',
    live: 'bg-success/15 text-success border-success/30',
    resolved: 'bg-success/15 text-success border-success/30',
    offline: 'bg-destructive/15 text-destructive border-destructive/30',
    failed: 'bg-destructive/15 text-destructive border-destructive/30',
    rejected: 'bg-destructive/15 text-destructive border-destructive/30',
    cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
    suspended: 'bg-destructive/15 text-destructive border-destructive/30',
    decommissioned: 'bg-muted text-muted-foreground border-border',
    inactive: 'bg-muted text-muted-foreground border-border',
    warning: 'bg-warning/15 text-warning-foreground border-warning/30',
    pending: 'bg-warning/15 text-warning-foreground border-warning/30',
    pending_approval: 'bg-warning/15 text-warning-foreground border-warning/30',
    pending_installation: 'bg-warning/15 text-warning-foreground border-warning/30',
    payment_pending: 'bg-warning/15 text-warning-foreground border-warning/30',
    under_review: 'bg-info/15 text-info border-info/30',
    submitted: 'bg-info/15 text-info border-info/30',
    scheduled: 'bg-info/15 text-info border-info/30',
    processing: 'bg-info/15 text-info border-info/30',
    assigned: 'bg-info/15 text-info border-info/30',
    in_progress: 'bg-info/15 text-info border-info/30',
    draft: 'bg-muted text-muted-foreground border-border',
    archived: 'bg-muted text-muted-foreground border-border',
    maintenance: 'bg-warning/15 text-warning-foreground border-warning/30',
    open: 'bg-warning/15 text-warning-foreground border-warning/30',
    critical: 'bg-destructive/15 text-destructive border-destructive/30',
  }
  return map[status.toLowerCase()] || 'bg-muted text-muted-foreground border-border'
}

export function statusLabel(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
