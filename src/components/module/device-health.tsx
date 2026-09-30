'use client'

import { useState } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { useNav, useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import { PageHeader, KpiCard, StatusBadge, EmptyState, LoadingGrid, ErrorState } from '@/components/shared'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Activity, Signal, Thermometer, HardDrive, MemoryStick, Clock, MapPin, Car, Wifi,
  HeartPulse, AlertTriangle, CheckCircle2, Monitor, Smartphone, Cpu, RefreshCw, Lock,
} from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

const ISSUE_LABELS: Record<string, { label: string; color: string }> = {
  critical_offline: { label: 'Critical Offline', color: 'bg-destructive/15 text-destructive border-destructive/30' },
  no_heartbeat: { label: 'No Heartbeat', color: 'bg-warning/15 text-warning-foreground border-warning/30' },
  high_temperature: { label: 'High Temperature', color: 'bg-destructive/15 text-destructive border-destructive/30' },
  temp_warning: { label: 'Temp Warning', color: 'bg-warning/15 text-warning-foreground border-warning/30' },
  low_storage: { label: 'Low Storage', color: 'bg-destructive/15 text-destructive border-destructive/30' },
  storage_warning: { label: 'Storage Warning', color: 'bg-warning/15 text-warning-foreground border-warning/30' },
  ram_critical: { label: 'RAM Critical', color: 'bg-destructive/15 text-destructive border-destructive/30' },
  weak_signal: { label: 'Weak Signal', color: 'bg-warning/15 text-warning-foreground border-warning/30' },
}

export function DeviceHealthView() {
  const { openDetail } = useNav()
  const { user } = useAuth()
  const role = user?.role
  const [status, setStatus] = useState('all')
  const [city, setCity] = useState('all')
  const [issue, setIssue] = useState('all')
  const [refreshKey, setRefreshKey] = useState(0)

  const query = new URLSearchParams({
    status: status === 'all' ? '' : status,
    city: city === 'all' ? '' : city,
    issue: issue === 'all' ? '' : issue,
  }).toString()

  const { data, loading, error, refresh } = useFetch<any>(`/api/device-health?${query}`, { refreshKey })

  if (!hasPermission(role, 'health.view')) {
    return (
      <div>
        <PageHeader title="Device Health" breadcrumbs={[{ label: 'Operations' }, { label: 'Device Health' }]} />
        <Card><CardContent><EmptyState icon={Lock} title="Insufficient permissions" description="You don't have permission to view device health" /></CardContent></Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Device Health Monitor"
        subtitle="Real-time health, vitals, and auto-alerts across the device fleet"
        breadcrumbs={[{ label: 'Operations' }, { label: 'Device Health' }]}
        actions={
          <button onClick={() => setRefreshKey((k) => k + 1)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-accent">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      />

      {/* Auto-alert rules banner */}
      <Card className="mb-4 border-l-4 border-l-primary">
        <CardContent className="p-3 flex items-start gap-3 flex-wrap">
          <div className="grid place-items-center h-9 w-9 rounded-lg bg-primary/10 text-primary shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Auto-Alert Rules (configurable in Settings)</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
              <span>No heartbeat &gt;5min → <span className="text-warning-foreground font-medium">Warning</span></span>
              <span>No heartbeat &gt;15min → <span className="text-destructive font-medium">Critical</span></span>
              <span>Temperature ≥60°C → <span className="text-destructive font-medium">Critical</span></span>
              <span>Storage ≥90% → <span className="text-destructive font-medium">Critical</span></span>
              <span>Signal &lt;30% → <span className="text-warning-foreground font-medium">Warning</span></span>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : loading ? (
        <>
          <LoadingGrid className="grid-cols-2 md:grid-cols-3 lg:grid-cols-6" count={6} />
          <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
        </>
      ) : data ? (
        <>
          {/* KPI summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <KpiCard label="Healthy" value={formatNumber(data.summary.online)} icon={CheckCircle2} color="success" />
            <KpiCard label="Warning" value={formatNumber(data.summary.warning)} icon={AlertTriangle} color="warning" />
            <KpiCard label="Critical" value={formatNumber(data.summary.critical)} icon={AlertTriangle} color="destructive" />
            <KpiCard label="Offline" value={formatNumber(data.summary.offline)} icon={Activity} color="destructive" />
            <KpiCard label="Avg Temp" value={`${data.summary.avgTemp}°C`} icon={Thermometer} color="info" />
            <KpiCard label="Avg Signal" value={`${data.summary.avgSignal}%`} icon={Signal} color="primary" />
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Filter by city..."
              value={city === 'all' ? '' : city}
              onChange={(e) => setCity(e.target.value || 'all')}
              className="flex-1 sm:max-w-48"
            />
            <Select value={issue} onValueChange={setIssue}>
              <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Health Issue" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Issues</SelectItem>
                {Object.entries(ISSUE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Device health grid */}
          {data.devices.length === 0 ? (
            <Card><CardContent><EmptyState icon={HeartPulse} title="No devices match filters" description="Adjust filters to see device health" /></CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.devices.map((d: any) => (
                <Card
                  key={d.id}
                  onClick={() => openDetail('device-detail', d.id)}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{d.deviceId}</span>
                          <StatusBadge status={d.status} />
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {d.vehicleReg !== '—' ? <><Car className="inline h-3 w-3" /> {d.vehicleReg} · </> : null}
                          <MapPin className="inline h-3 w-3" /> {d.city}
                        </p>
                      </div>
                      <HealthScoreBadge score={d.healthScore} />
                    </div>

                    {/* Vitals grid */}
                    <div className="grid grid-cols-4 gap-2 text-center mb-3">
                      <Vital icon={Signal} label="Signal" value={d.signalStrength != null ? `${d.signalStrength}%` : '—'} status={vitalStatus(d.signalStrength, [30, 50], true)} />
                      <Vital icon={Thermometer} label="Temp" value={d.temperature != null ? `${d.temperature}°` : '—'} status={vitalStatus(d.temperature, [50, 60], false)} />
                      <Vital icon={HardDrive} label="Storage" value={d.storageUsage != null ? `${d.storageUsage}%` : '—'} status={vitalStatus(d.storageUsage, [80, 90], false)} />
                      <Vital icon={MemoryStick} label="RAM" value={d.ramUsage != null ? `${d.ramUsage}%` : '—'} status={vitalStatus(d.ramUsage, [80, 90], false)} />
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{d.minutesAgo != null ? `${d.minutesAgo}m ago` : 'never'}</span>
                      <span className="flex items-center gap-1"><Wifi className="h-3 w-3" />{d.networkType || '—'}</span>
                      <span className="flex items-center gap-1"><Monitor className="h-3 w-3" />Screen: {d.screenStatus}</span>
                      <span className="flex items-center gap-1"><Cpu className="h-3 w-3" />App: {d.appStatus}</span>
                      <span className="flex items-center gap-1"><Smartphone className="h-3 w-3" />GPS: {d.gpsFix ? 'fix' : 'no'}</span>
                    </div>

                    {/* Issues */}
                    {d.issues.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t">
                        {d.issues.map((iss: string) => (
                          <Badge key={iss} variant="outline" className={cn('text-[10px]', ISSUE_LABELS[iss]?.color)}>
                            {ISSUE_LABELS[iss]?.label || iss}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

function HealthScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-success/15 text-success border-success/30' : score >= 50 ? 'bg-warning/15 text-warning-foreground border-warning/30' : 'bg-destructive/15 text-destructive border-destructive/30'
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold border', color)}>
      <HeartPulse className="h-3 w-3" />
      {score}
    </span>
  )
}

function Vital({ icon: Icon, label, value, status }: { icon: any; label: string; value: string; status: 'good' | 'warning' | 'critical' | 'unknown' }) {
  const colorMap = {
    good: 'text-success',
    warning: 'text-warning-foreground',
    critical: 'text-destructive',
    unknown: 'text-muted-foreground',
  }
  return (
    <div className="rounded-md bg-muted/40 py-1.5">
      <Icon className={cn('h-3.5 w-3.5 mx-auto', colorMap[status])} />
      <p className="text-xs font-semibold mt-0.5">{value}</p>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  )
}

function vitalStatus(value: number | null, thresholds: [number, number], invert = false): 'good' | 'warning' | 'critical' | 'unknown' {
  if (value == null) return 'unknown'
  if (invert) {
    if (value < thresholds[0]) return 'critical'
    if (value < thresholds[1]) return 'warning'
    return 'good'
  }
  if (value >= thresholds[1]) return 'critical'
  if (value >= thresholds[0]) return 'warning'
  return 'good'
}
