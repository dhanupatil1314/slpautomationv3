'use client'

import { useFetch, mutate } from '@/hooks/use-fetch'
import { useNav, useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import { PageHeader, StatusBadge, EmptyState, ErrorState } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Monitor, ArrowLeft, Power, RefreshCw, Camera, Download, Lock, Sun, Volume2, RefreshCcwDot,
  Signal, Thermometer, HardDrive, MemoryStick, Clock, MapPin, Car, User, Wifi, Activity,
  AlertTriangle, PlayCircle, Wrench, Settings, Smartphone, Cpu, Radio, Copy, CheckCircle2,
} from 'lucide-react'
import { formatDateTime, timeAgo, secondsToDuration, statusColor } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useState } from 'react'

export function DeviceDetailView() {
  const { entityId, setView } = useNav()
  const { user } = useAuth()
  const role = user?.role
  const [refreshKey, setRefreshKey] = useState(0)
  const { data, loading, error } = useFetch<any>(`/api/devices/${entityId}`, { refreshKey })

  if (loading) {
    return (
      <div>
        <PageHeader title="Device Detail" breadcrumbs={[{ label: 'Devices', onClick: () => setView('devices') }, { label: '...' }]} />
        <div className="space-y-3"><div className="h-32 bg-muted animate-pulse rounded-lg" /><div className="h-64 bg-muted animate-pulse rounded-lg" /></div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div>
        <PageHeader title="Device Detail" breadcrumbs={[{ label: 'Devices', onClick: () => setView('devices') }]} />
        <ErrorState message={error || 'Device not found'} onRetry={() => setView('devices')} />
      </div>
    )
  }

  const d = data?.device

  if (!d) {
    return (
      <div>
        <PageHeader title="Device Detail" breadcrumbs={[{ label: 'Devices', onClick: () => setView('devices') }]} />
        <ErrorState message="Device not found" onRetry={() => setView('devices')} />
      </div>
    )
  }

  const sendCommand = async (command: string, payload?: any) => {
    try {
      const res = await mutate(`/api/devices/${d.id}`, 'POST', { command, payload })
      toast.success(res.message)
      setRefreshKey((k) => k + 1)
    } catch (e: any) {
      toast.error(e.message || 'Command failed')
    }
  }

  return (
    <div>
      <PageHeader
        title={d.deviceId}
        subtitle={`${d.model || 'LakhirAd Player'} · ${d.serialNumber}`}
        breadcrumbs={[{ label: 'Devices', onClick: () => setView('devices') }, { label: d.deviceId }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setView('devices')}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            {hasPermission(role, 'devices.command') && (
              <Button size="sm" className="gap-1.5" onClick={() => sendCommand('restart')}>
                <Power className="h-3.5 w-3.5" /> Restart
              </Button>
            )}
          </>
        }
      />

      {/* Status banner */}
      <Card className={cn('mb-4 border-l-4', statusColor(d.status))}>
        <CardContent className="p-4 flex items-center gap-4 flex-wrap">
          <div className={cn('grid place-items-center h-12 w-12 rounded-lg', statusColor(d.status))}>
            <Monitor className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">{d.deviceId}</h2>
              <StatusBadge status={d.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {d.vehicle?.registrationNo || 'Unassigned'} · {d.city?.name || '—'} · {d.zone || '—'}
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Last Heartbeat</p>
              <p className="font-medium">{timeAgo(d.lastHeartbeat)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Uptime</p>
              <p className="font-medium">{secondsToDuration(d.uptimeSeconds)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">Live Health</TabsTrigger>
          <TabsTrigger value="screen">Screen</TabsTrigger>
          <TabsTrigger value="vehicle">Vehicle</TabsTrigger>
          <TabsTrigger value="campaign">Campaign</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5"><Activity className="h-3.5 w-3.5" /> Timeline</TabsTrigger>
          <TabsTrigger value="mqtt" className="gap-1.5"><Radio className="h-3.5 w-3.5" /> MQTT</TabsTrigger>
          <TabsTrigger value="actions">Remote Actions</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Device Info</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              <Row label="Device ID" value={d.deviceId} />
              <Row label="Serial Number" value={d.serialNumber} />
              <Row label="IMEI" value={d.imei} />
              <Row label="Model" value={d.model || '—'} />
              <Row label="Player Version" value={d.playerVersion || '—'} />
              <Row label="Android Version" value={d.androidVersion || '—'} />
            </CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Network</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              <Row label="Network Type" value={d.networkType || '—'} />
              <Row label="Signal Strength" value={`${d.signalStrength ?? '—'}%`} />
              <Row label="IP Address" value={d.ipAddress || '—'} />
              <Row label="SIM Operator" value={d.sim?.operator || '—'} />
              <Row label="SIM ICCID" value={d.sim?.iccid || '—'} />
              <Row label="Data Usage" value={d.sim ? `${((d.sim.currentUsageMb / d.sim.monthlyAllowanceMb) * 100).toFixed(0)}%` : '—'} />
            </CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Location & Dates</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              <Row label="City" value={d.city?.name || '—'} />
              <Row label="Zone" value={d.zone || '—'} />
              <Row label="GPS" value={d.latitude ? `${d.latitude.toFixed(4)}, ${d.longitude?.toFixed(4)}` : '—'} />
              <Row label="Installed" value={formatDateTime(d.installationDate)} />
              <Row label="Warranty" value={d.warranty || '—'} />
              <Row label="Last Service" value={formatDateTime(d.lastServiceDate)} />
            </CardContent></Card>
          </div>

          {/* Content Distribution / Sync Status */}
          {d.contentSyncStatus && (
            <ContentSyncCard device={d} onSync={async () => {
              try {
                const res = await fetch(`/api/devices/${d.id}/sync`, { method: 'POST' })
                const syncData = await res.json()
                toast.success(syncData.message || 'Sync initiated')
                setRefreshKey((k) => k + 1)
              } catch (e: any) {
                toast.error(e.message || 'Sync failed')
              }
            }} />
          )}
        </TabsContent>

        {/* Live Health */}
        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <HealthCard icon={Signal} label="Signal" value={`${d.signalStrength ?? '—'}%`} progress={d.signalStrength} color="info" />
            <HealthCard icon={Thermometer} label="Temperature" value={`${d.temperature ?? '—'}°C`} progress={d.temperature ? (d.temperature / 70) * 100 : 0} color={d.temperature > 50 ? 'destructive' : 'success'} />
            <HealthCard icon={HardDrive} label="Storage" value={`${d.storageUsage ?? '—'}%`} progress={d.storageUsage} color={d.storageUsage > 85 ? 'warning' : 'success'} />
            <HealthCard icon={MemoryStick} label="RAM" value={`${d.ramUsage ?? '—'}%`} progress={d.ramUsage} color={d.ramUsage > 85 ? 'warning' : 'success'} />
            <HealthCard icon={Clock} label="Uptime" value={secondsToDuration(d.uptimeSeconds)} color="info" />
            <HealthCard icon={Wifi} label="Network" value={d.networkType || '—'} color="info" />
            <HealthCard icon={Activity} label="Last Heartbeat" value={timeAgo(d.lastHeartbeat)} color={d.status === 'online' ? 'success' : 'destructive'} />
            <HealthCard icon={Monitor} label="Status" value={d.status} color={d.status === 'online' ? 'success' : 'destructive'} />
          </div>
          {/* Heartbeat history */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Heartbeat History</CardTitle><CardDescription className="text-xs">Last 20 heartbeats</CardDescription></CardHeader>
            <CardContent>
              <div className="max-h-72 overflow-y-auto scrollbar-thin space-y-1">
                {d.heartbeats?.map((h: any) => (
                  <div key={h.id} className="flex items-center gap-3 py-1.5 border-b last:border-0 text-sm">
                    <span className="text-muted-foreground w-32">{formatDateTime(h.timestamp)}</span>
                    <span className="flex items-center gap-1"><Signal className="h-3 w-3 text-muted-foreground" />{h.signalStrength}%</span>
                    <span className="flex items-center gap-1"><Thermometer className="h-3 w-3 text-muted-foreground" />{h.temperature}°C</span>
                    <span className="flex items-center gap-1"><HardDrive className="h-3 w-3 text-muted-foreground" />{h.storageUsage}%</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">{h.appStatus}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Screen */}
        <TabsContent value="screen" className="space-y-4">
          {d.vehicle?.screen ? (
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Screen Information</CardTitle></CardHeader><CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <Row label="Screen ID" value={d.vehicle.screen.screenId} />
              <Row label="Model" value={d.vehicle.screen.model || '—'} />
              <Row label="Size" value={d.vehicle.screen.size || '—'} />
              <Row label="Resolution" value={d.vehicle.screen.resolution || '—'} />
              <Row label="Orientation" value={d.vehicle.screen.orientation} />
              <Row label="Brightness" value={`${d.vehicle.screen.brightness}%`} />
              <Row label="Manufacturer" value={d.vehicle.screen.manufacturer || '—'} />
              <Row label="Serial" value={d.vehicle.screen.serialNumber || '—'} />
              <Row label="Status" value={<StatusBadge status={d.vehicle.screen.status} />} />
            </CardContent></Card>
          ) : <Card><CardContent><EmptyState icon={Smartphone} title="No screen assigned" description="This device is not linked to a screen" /></CardContent></Card>}
        </TabsContent>

        {/* Vehicle */}
        <TabsContent value="vehicle" className="space-y-4">
          {d.vehicle ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Vehicle</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
                <Row label="Registration" value={d.vehicle.registrationNo} />
                <Row label="Type" value={d.vehicle.vehicleType} />
                <Row label="Manufacturer" value={d.vehicle.manufacturer || '—'} />
                <Row label="Model" value={d.vehicle.model || '—'} />
                <Row label="Status" value={<StatusBadge status={d.vehicle.status} />} />
              </CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Driver</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
                <Row label="Name" value={d.vehicle.driver?.name || '—'} />
                <Row label="Mobile" value={d.vehicle.driver?.mobile || '—'} />
                <Row label="City" value={d.vehicle.driver?.city || '—'} />
                <Row label="KYC" value={<StatusBadge status={d.vehicle.driver?.kycStatus || 'pending'} />} />
                <Row label="Score" value={`${d.vehicle.driver?.driverScore || 0}/100`} />
              </CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Owner</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
                <Row label="Name" value={d.vehicle.owner?.name || '—'} />
                <Row label="Mobile" value={d.vehicle.owner?.mobile || '—'} />
                <Row label="Revenue Share" value={`${d.vehicle.owner?.revenueShare || 0}%`} />
                <Row label="Status" value={<StatusBadge status={d.vehicle.owner?.status || 'active'} />} />
              </CardContent></Card>
            </div>
          ) : <Card><CardContent><EmptyState icon={Car} title="No vehicle assigned" /></CardContent></Card>}
        </TabsContent>

        {/* Campaign */}
        <TabsContent value="campaign" className="space-y-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Current Campaign</CardTitle></CardHeader><CardContent>
            <p className="text-sm text-muted-foreground">Campaign ID: {d.currentCampaignId || 'None active'}</p>
          </CardContent></Card>
          {d.playbackEvents?.length > 0 && (
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Recent Playback</CardTitle></CardHeader><CardContent>
              <div className="max-h-72 overflow-y-auto scrollbar-thin space-y-1">
                {d.playbackEvents.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 py-1.5 border-b last:border-0 text-sm">
                    <PlayCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate flex-1">{p.campaign?.name || '—'}</span>
                    <span className="text-xs text-muted-foreground">{p.media?.name || '—'}</span>
                    <StatusBadge status={p.status} />
                    <span className="text-xs text-muted-foreground w-28 text-right">{formatDateTime(p.timestamp)}</span>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Command History</CardTitle></CardHeader><CardContent>
            {d.commands?.length === 0 ? <EmptyState icon={Settings} title="No commands issued" /> : (
              <div className="space-y-1">
                {d.commands?.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-3 py-2 border-b last:border-0 text-sm">
                    <Badge variant="outline" className="capitalize">{c.command}</Badge>
                    <span className="text-muted-foreground flex-1 truncate">{c.result || c.status}</span>
                    <StatusBadge status={c.status} />
                    <span className="text-xs text-muted-foreground">{c.issuedBy?.name || 'System'}</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
          {d.alerts?.length > 0 && (
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Alerts</CardTitle></CardHeader><CardContent>
              <div className="space-y-1">{d.alerts.map((a: any) => (
                <div key={a.id} className="flex items-center gap-2 py-1.5 border-b last:border-0 text-sm">
                  <AlertTriangle className={cn('h-4 w-4', a.severity === 'critical' ? 'text-destructive' : 'text-warning-foreground')} />
                  <span className="flex-1">{a.message}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(a.createdAt)}</span>
                </div>
              ))}</div>
            </CardContent></Card>
          )}
        </TabsContent>

        {/* Device Timeline */}
        <TabsContent value="timeline" className="space-y-4">
          <DeviceTimeline deviceId={d.id} />
        </TabsContent>

        {/* MQTT Topics */}
        <TabsContent value="mqtt" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Radio className="h-4 w-4" /> MQTT Topic Structure</CardTitle>
              <CardDescription className="text-xs">Device communication channels — integration-ready (credentials never exposed in frontend)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-md bg-muted/50 border border-dashed text-center text-xs text-muted-foreground">
                Topic prefix: <code className="font-mono text-primary">lakhirad/device/{d.deviceId}/</code>
                <CopyButton text={`lakhirad/device/${d.deviceId}`} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  { topic: 'heartbeat', desc: 'Device telemetry (60s interval)', dir: 'publish', color: 'text-success' },
                  { topic: 'command', desc: 'Commands: restart, sync, screenshot', dir: 'subscribe', color: 'text-info' },
                  { topic: 'status', desc: 'Online/offline state changes', dir: 'publish', color: 'text-success' },
                  { topic: 'campaign', desc: 'Campaign manifest updates', dir: 'subscribe', color: 'text-info' },
                  { topic: 'playback', desc: 'Playback event reporting', dir: 'publish', color: 'text-success' },
                  { topic: 'error', desc: 'Error logs and crash reports', dir: 'publish', color: 'text-destructive' },
                ].map((t) => (
                  <div key={t.topic} className="flex items-start gap-3 p-3 rounded-md border bg-card hover:bg-accent/30 transition-colors group">
                    <div className={cn('grid place-items-center h-8 w-8 rounded-md shrink-0 bg-muted', t.color)}>
                      {t.dir === 'publish' ? <ArrowLeft className="h-4 w-4 rotate-180" /> : <ArrowLeft className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono font-semibold">lakhirad/device/{d.deviceId}/{t.topic}</code>
                        <CopyButton text={`lakhirad/device/${d.deviceId}/${t.topic}`} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                      <Badge variant="outline" className={cn('text-[10px] mt-1', t.dir === 'publish' ? 'border-success/30 text-success' : 'border-info/30 text-info')}>
                        {t.dir === 'publish' ? '↑ Device → Cloud' : '↓ Cloud → Device'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-md bg-warning/5 border border-warning/20 text-xs text-muted-foreground">
                <strong className="text-warning-foreground">Note:</strong> MQTT broker credentials are stored securely on the backend and never exposed in frontend code.
                In production, connect via backend microservice that bridges HTTP commands to MQTT topics.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Remote Actions */}
        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Remote Device Actions</CardTitle><CardDescription className="text-xs">Each action creates an audit record and is queued via MQTT-ready command channel</CardDescription></CardHeader>
            <CardContent>
              {!hasPermission(role, 'devices.command') ? (
                <EmptyState icon={Lock} title="Insufficient permissions" description="You don't have permission to send device commands" />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  <ActionBtn icon={Power} label="Restart" color="destructive" onClick={() => sendCommand('restart')} />
                  <ActionBtn icon={Power} label="Shutdown" color="destructive" onClick={() => sendCommand('shutdown')} />
                  <ActionBtn icon={RefreshCw} label="Sync Content" onClick={() => sendCommand('sync')} />
                  <ActionBtn icon={RefreshCw} label="Refresh" onClick={() => sendCommand('refresh')} />
                  <ActionBtn icon={Camera} label="Screenshot" onClick={() => sendCommand('screenshot')} />
                  <ActionBtn icon={Lock} label="Lock Device" color="warning" onClick={() => sendCommand('lock')} />
                  <ActionBtn icon={RefreshCcwDot} label="Update App" onClick={() => sendCommand('update')} />
                  <ActionBtn icon={Sun} label="Brightness" onClick={() => sendCommand('brightness', { value: 80 })} />
                  <ActionBtn icon={Volume2} label="Volume" onClick={() => sendCommand('volume', { value: 70 })} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}

function HealthCard({ icon: Icon, label, value, progress, color = 'info' }: { icon: any; label: string; value: string; progress?: number; color?: string }) {
  const colorMap: Record<string, string> = {
    success: 'text-success', destructive: 'text-destructive', warning: 'text-warning-foreground', info: 'text-info',
  }
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4', colorMap[color])} />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
      {progress != null && <Progress value={progress} className="mt-2 h-1.5" />}
    </CardContent></Card>
  )
}

function ActionBtn({ icon: Icon, label, color = 'default', onClick }: { icon: any; label: string; color?: string; onClick: () => void }) {
  const colorMap: Record<string, string> = {
    destructive: 'hover:border-destructive hover:bg-destructive/5 hover:text-destructive',
    warning: 'hover:border-warning hover:bg-warning/5 hover:text-warning-foreground',
    default: 'hover:border-primary hover:bg-primary/5 hover:text-primary',
  }
  return (
    <button onClick={onClick} className={cn('flex flex-col items-center gap-2 p-4 rounded-lg border bg-card transition-colors', colorMap[color])}>
      <Icon className="h-5 w-5" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

// Content Distribution / Sync Status card — shows download-and-play architecture state
function ContentSyncCard({ device, onSync }: { device: any; onSync: () => void }) {
  const status = device.contentSyncStatus || 'synced'
  const syncConfig = {
    synced: { label: 'Content Synced', color: 'text-success', bg: 'bg-success/10 border-success/20', icon: CheckCircle2, desc: 'Device has latest campaign manifest & media files cached locally' },
    syncing: { label: 'Syncing...', color: 'text-info', bg: 'bg-info/10 border-info/20', icon: RefreshCw, desc: 'Downloading campaign manifest and media files from cloud' },
    pending: { label: 'Sync Pending', color: 'text-warning-foreground', bg: 'bg-warning/10 border-warning/20', icon: Clock, desc: 'New content available — waiting for device to come online' },
    failed: { label: 'Sync Failed', color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/20', icon: AlertTriangle, desc: 'Last sync attempt failed — check network connectivity' },
    offline: { label: 'Device Offline', color: 'text-muted-foreground', bg: 'bg-muted border-border', icon: Monitor, desc: 'Cannot sync — device is offline. Will sync when reconnected.' },
  }
  const cfg = syncConfig[status as keyof typeof syncConfig] || syncConfig.synced
  const Icon = cfg.icon

  return (
    <Card className={cn('border-l-4', cfg.bg)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Download className="h-4 w-4" /> Content Distribution Engine
        </CardTitle>
        <CardDescription className="text-xs">Download-and-play architecture — device caches media locally for offline playback</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-4 flex-wrap">
          <div className={cn('grid place-items-center h-12 w-12 rounded-lg shrink-0', cfg.bg)}>
            <Icon className={cn('h-6 w-6', cfg.color, status === 'syncing' && 'animate-spin')} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={cn('font-semibold text-sm', cfg.color)}>{cfg.label}</h3>
              <Badge variant="outline" className={cn('text-[10px] uppercase', cfg.color)}>{status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{cfg.desc}</p>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Last sync: {device.contentSyncedAt ? timeAgo(device.contentSyncedAt) : '—'}</span>
              <span className="flex items-center gap-1"><Download className="h-3 w-3" /> Storage: {device.storageUsedMb || 0} MB used</span>
              <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Version: {device.contentVersion || '—'}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={onSync} disabled={status === 'syncing'}>
            <RefreshCw className={cn('h-3.5 w-3.5', status === 'syncing' && 'animate-spin')} />
            {status === 'syncing' ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>

        {/* Sync flow visualization */}
        <div className="mt-4 pt-3 border-t">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Content Distribution Flow</p>
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin pb-1">
            {['Cloud', 'Manifest', 'Download', 'Local Storage', 'Playlist', 'Playback', 'Sync Logs'].map((step, i) => (
              <div key={step} className="flex items-center gap-1 shrink-0">
                <div className={cn('px-2 py-1 rounded text-[10px] font-medium border', i <= (status === 'synced' ? 6 : status === 'syncing' ? 3 : 1) ? cfg.bg + ' ' + cfg.color : 'bg-muted text-muted-foreground border-border')}>
                  {step}
                </div>
                {i < 6 && <span className="text-muted-foreground text-[10px]">→</span>}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Device Timeline — unified chronological view of all device events
function DeviceTimeline({ deviceId }: { deviceId: string }) {
  const { data, loading, error } = useFetch<any>(`/api/device-timeline?deviceId=${deviceId}&limit=50`)

  if (loading) {
    return <Card><CardContent className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</CardContent></Card>
  }
  if (error || !data) {
    return <Card><CardContent className="p-6"><ErrorState message={error || 'Failed to load timeline'} /></CardContent></Card>
  }

  const timeline = data.timeline || []
  const summary = data.summary

  const typeConfig: Record<string, { icon: any; color: string; label: string }> = {
    heartbeat: { icon: Activity, color: 'text-info bg-info/10', label: 'Heartbeat' },
    command: { icon: Settings, color: 'text-warning-foreground bg-warning/10', label: 'Command' },
    playback: { icon: PlayCircle, color: 'text-success bg-success/10', label: 'Playback' },
    alert: { icon: AlertTriangle, color: 'text-destructive bg-destructive/10', label: 'Alert' },
    service: { icon: Wrench, color: 'text-primary bg-primary/10', label: 'Service' },
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" /> Device Timeline</CardTitle>
        <CardDescription className="text-xs">Unified view of heartbeats, commands, playback, alerts, and service events</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary chips */}
        <div className="flex items-center gap-2 flex-wrap mb-4 pb-4 border-b">
          <Badge variant="outline" className="text-[10px] gap-1"><Activity className="h-3 w-3" /> {summary.heartbeats} heartbeats</Badge>
          <Badge variant="outline" className="text-[10px] gap-1"><Settings className="h-3 w-3" /> {summary.commands} commands</Badge>
          <Badge variant="outline" className="text-[10px] gap-1"><PlayCircle className="h-3 w-3" /> {summary.playback} plays</Badge>
          <Badge variant="outline" className="text-[10px] gap-1"><AlertTriangle className="h-3 w-3" /> {summary.alerts} alerts</Badge>
          <Badge variant="outline" className="text-[10px] gap-1"><Wrench className="h-3 w-3" /> {summary.service} tickets</Badge>
        </div>

        {timeline.length === 0 ? (
          <EmptyState icon={Activity} title="No timeline events" description="Device activity will appear here as it occurs" />
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

            <div className="space-y-3">
              {timeline.map((event: any) => {
                const cfg = typeConfig[event.type] || typeConfig.heartbeat
                const Icon = cfg.icon
                return (
                  <div key={event.id} className="flex items-start gap-3 relative">
                    {/* Icon node */}
                    <div className={cn('grid place-items-center h-10 w-10 rounded-full shrink-0 z-10 border-2 border-background', cfg.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{event.title}</span>
                        <Badge variant="outline" className={cn('text-[10px]', `text-${event.color}`, `border-${event.color}/30`)}>{event.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span>{formatDateTime(event.timestamp)}</span>
                        <span>·</span>
                        <span>{timeAgo(event.timestamp)}</span>
                        {event.issuedBy && <><span>·</span><span>by {event.issuedBy}</span></>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Copy-to-clipboard button for MQTT topics
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Copy failed')
    }
  }
  return (
    <button onClick={handleCopy} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-accent" title="Copy">
      <Copy className={cn('h-3 w-3', copied ? 'text-success' : 'text-muted-foreground')} />
    </button>
  )
}
