'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { statusColor, statusLabel } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Sparkline } from '@/components/shared/sparkline'

// Page header with title, subtitle, breadcrumbs, and actions
export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
}: {
  title: string
  subtitle?: string
  breadcrumbs?: { label: string; onClick?: () => void }[]
  actions?: ReactNode
}) {
  return (
    <div className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span>/</span>}
              {b.onClick ? (
                <button onClick={b.onClick} className="hover:text-foreground transition-colors">{b.label}</button>
              ) : (
                <span className={i === breadcrumbs.length - 1 ? 'text-foreground font-medium' : ''}>{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
    </div>
  )
}

// KPI stat card
export function KpiCard({
  label,
  value,
  icon: Icon,
  trend,
  trendValue,
  color = 'primary',
  hint,
  sparkData,
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  color?: 'primary' | 'success' | 'warning' | 'destructive' | 'info'
  hint?: string
  sparkData?: number[]
}) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning-foreground',
    destructive: 'bg-destructive/10 text-destructive',
    info: 'bg-info/10 text-info',
  }
  const sparkColor = {
    primary: '#f97316',
    success: '#22c55e',
    warning: '#f59e0b',
    destructive: '#ef4444',
    info: '#3b82f6',
  }
  return (
    <Card className="overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5 group">
      <CardContent className="p-4 md:p-5 relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
            <p className="text-2xl font-bold mt-1.5 tracking-tight tabular-nums">{value}</p>
            {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
            {trend && trendValue && (
              <div className="flex items-center gap-1 mt-1.5">
                <span
                  className={cn(
                    'text-xs font-semibold flex items-center gap-0.5',
                    trend === 'up' && 'text-success',
                    trend === 'down' && 'text-destructive',
                    trend === 'neutral' && 'text-muted-foreground'
                  )}
                >
                  {trend === 'up' && '↑'}
                  {trend === 'down' && '↓'}
                  {trendValue}
                </span>
                <span className="text-[11px] text-muted-foreground">vs last period</span>
              </div>
            )}
          </div>
          <div className={cn('grid place-items-center h-10 w-10 rounded-lg shrink-0 transition-transform group-hover:scale-110', colorMap[color])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {sparkData && sparkData.length > 1 && (
          <div className="absolute bottom-0 right-0 opacity-60 group-hover:opacity-100 transition-opacity">
            <Sparkline data={sparkData} color={sparkColor[color]} width={80} height={28} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Status badge with color coding
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize',
        statusColor(status),
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {statusLabel(status)}
    </span>
  )
}

// Empty state — enhanced with decorative gradient, icon ring, and optional CTA
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: ReactNode
  variant?: 'default' | 'success' | 'warning'
}) {
  const variantColors = {
    default: 'from-primary/10 to-primary/5 text-primary',
    success: 'from-success/10 to-success/5 text-success',
    warning: 'from-warning/10 to-warning/5 text-warning-foreground',
  }
  const ringColor = {
    default: 'ring-primary/10',
    success: 'ring-success/10',
    warning: 'ring-warning/10',
  }
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center relative overflow-hidden">
      {/* Decorative gradient backdrop */}
      <div className={cn('absolute inset-0 bg-gradient-to-b opacity-50 pointer-events-none', variantColors[variant])} />
      <div className="relative">
        {/* Icon with decorative ring */}
        <div className={cn('relative grid place-items-center h-16 w-16 rounded-2xl bg-gradient-to-br shadow-sm ring-8 mb-4 mx-auto', variantColors[variant], ringColor[variant])}>
          <Icon className="h-8 w-8" />
          {/* Pulse dot */}
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-30" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
          </span>
        </div>
        <h3 className="font-semibold text-base">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">{description}</p>}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  )
}

// Error state
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>{message}</span>
        {onRetry && (
          <button onClick={onRetry} className="text-xs font-semibold underline hover:no-underline">
            Retry
          </button>
        )}
      </AlertDescription>
    </Alert>
  )
}

// Loading skeleton grid
export function LoadingGrid({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Table loading skeleton
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-6" />
          ))}
        </div>
      ))}
    </div>
  )
}

// Pagination controls
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return (
    <div className="flex items-center justify-between gap-2 py-3 text-sm">
      <p className="text-muted-foreground">
        Showing <span className="font-medium text-foreground">{start}</span>–
        <span className="font-medium text-foreground">{end}</span> of{' '}
        <span className="font-medium text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-accent disabled:opacity-50 disabled:pointer-events-none transition-colors"
        >
          Previous
        </button>
        <span className="px-2 text-xs text-muted-foreground">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-accent disabled:opacity-50 disabled:pointer-events-none transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}
