'use client'

import { useState, useEffect } from 'react'
import { useFetch, mutate } from '@/hooks/use-fetch'
import { useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import { PageHeader, EmptyState, ErrorState, LoadingGrid } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Settings, Building, Megaphone, Monitor, Wallet, Bell, Shield, Save, RefreshCw, Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { id: 'general', label: 'General', icon: Building, description: 'Brand, locale, currency' },
  { id: 'campaign', label: 'Campaign', icon: Megaphone, description: 'Default durations and approvals' },
  { id: 'device', label: 'Device', icon: Monitor, description: 'Heartbeat and health thresholds' },
  { id: 'revenue', label: 'Revenue', icon: Wallet, description: 'Earnings share and bonuses' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Alert thresholds and channels' },
  { id: 'security', label: 'Security', icon: Shield, description: 'Password and session policy' },
]

// Map keys to display labels and types
const FIELD_META: Record<string, { label: string; type: 'text' | 'number' | 'switch' | 'select'; options?: string[]; hint?: string }> = {
  brand_name: { label: 'Brand Name', type: 'text' },
  tagline: { label: 'Tagline', type: 'text' },
  timezone: { label: 'Timezone', type: 'select', options: ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'UTC'] },
  currency: { label: 'Currency', type: 'select', options: ['INR', 'USD', 'AED', 'SGD'] },
  language: { label: 'Language', type: 'select', options: ['en-IN', 'en-US', 'hi-IN'] },

  default_ad_duration_sec: { label: 'Default Ad Duration (sec)', type: 'number', hint: 'Standard ad length in seconds' },
  default_freq_per_hour: { label: 'Default Frequency / Hour', type: 'number' },
  require_approval: { label: 'Require Campaign Approval', type: 'switch' },
  default_priority: { label: 'Default Priority', type: 'select', options: ['1', '2', '3', '4', '5'], hint: '1=Emergency, 5=House' },

  heartbeat_interval_sec: { label: 'Heartbeat Interval (sec)', type: 'number' },
  offline_threshold_min: { label: 'Offline Threshold (min)', type: 'number', hint: 'Mark warning after this many minutes without heartbeat' },
  critical_offline_threshold_min: { label: 'Critical Offline Threshold (min)', type: 'number', hint: 'Escalate to critical' },
  storage_threshold_pct: { label: 'Storage Warning (%)', type: 'number' },
  storage_critical_pct: { label: 'Storage Critical (%)', type: 'number' },
  temperature_threshold_c: { label: 'Temperature Warning (°C)', type: 'number' },
  temperature_critical_c: { label: 'Temperature Critical (°C)', type: 'number' },
  ram_threshold_pct: { label: 'RAM Warning (%)', type: 'number' },

  platform_share_pct: { label: 'Platform Share (%)', type: 'number' },
  owner_share_pct: { label: 'Owner Share (%)', type: 'number' },
  driver_share_pct: { label: 'Driver Share (%)', type: 'number', hint: 'Must total 100% with platform and owner' },
  base_participation_inr: { label: 'Base Participation (INR)', type: 'number' },
  uptime_bonus_inr: { label: 'Uptime Bonus (INR)', type: 'number' },
  campaign_bonus_inr: { label: 'Campaign Bonus (INR)', type: 'number' },
  compliance_bonus_inr: { label: 'Compliance Bonus (INR)', type: 'number' },
  service_penalty_inr: { label: 'Service Penalty (INR)', type: 'number' },

  alert_critical_sms: { label: 'Send SMS for Critical Alerts', type: 'switch' },
  alert_warning_email: { label: 'Send Email for Warning Alerts', type: 'switch' },
  daily_summary_email: { label: 'Daily Summary Email', type: 'switch' },
  device_offline_alert: { label: 'Device Offline Alerts', type: 'switch' },
  sim_data_alert_threshold_pct: { label: 'SIM Data Alert Threshold (%)', type: 'number' },

  password_min_length: { label: 'Password Min Length', type: 'number' },
  session_duration_hours: { label: 'Session Duration (hours)', type: 'number', hint: '168 = 7 days' },
  two_factor_ready: { label: '2FA Ready', type: 'switch', hint: 'Enable two-factor auth infrastructure' },
  require_password_reset_days: { label: 'Password Reset Cycle (days)', type: 'number' },
  max_login_attempts: { label: 'Max Login Attempts', type: 'number' },
}

export function SettingsView() {
  const { user } = useAuth()
  const role = user?.role
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeCategory, setActiveCategory] = useState('general')
  const [localValues, setLocalValues] = useState<Record<string, string>>({})
  const [savingCat, setSavingCat] = useState<string | null>(null)

  const { data, loading, error } = useFetch<any>('/api/settings', { refreshKey })

  if (!hasPermission(role, 'settings.view')) {
    return (
      <div>
        <PageHeader title="Settings" breadcrumbs={[{ label: 'Administration' }, { label: 'Settings' }]} />
        <Card><CardContent><EmptyState icon={Lock} title="Insufficient permissions" /></CardContent></Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Settings" breadcrumbs={[{ label: 'Administration' }, { label: 'Settings' }]} />
        <LoadingGrid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3" count={6} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div>
        <PageHeader title="Settings" breadcrumbs={[{ label: 'Administration' }, { label: 'Settings' }]} />
        <ErrorState message={error || 'Failed to load settings'} onRetry={() => setRefreshKey((k) => k + 1)} />
      </div>
    )
  }

  const settings = data.settings as Record<string, { key: string; value: string }[]>
  const canEdit = hasPermission(role, 'settings.edit')

  // Get effective value (local override if any, else DB)
  const getValue = (key: string, dbValue: string) => localValues[key] ?? dbValue
  const hasLocalChanges = (category: string) =>
    (settings[category] || []).some((s) => localValues[s.key] !== undefined && localValues[s.key] !== s.value)

  const saveCategory = async (category: string) => {
    const updates = (settings[category] || [])
      .filter((s) => localValues[s.key] !== undefined && localValues[s.key] !== s.value)
      .map((s) => ({ key: s.key, value: localValues[s.key] }))
    if (updates.length === 0) return toast.info('No changes to save')

    setSavingCat(category)
    try {
      await mutate('/api/settings', 'PUT', { updates })
      toast.success(`Saved ${updates.length} setting(s)`)
      setLocalValues((prev) => {
        const next = { ...prev }
        for (const u of updates) delete next[u.key]
        return next
      })
      setRefreshKey((k) => k + 1)
    } catch (e: any) {
      toast.error(e.message || 'Failed to save')
    } finally {
      setSavingCat(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="System configuration organized by category"
        breadcrumbs={[{ label: 'Administration' }, { label: 'Settings' }]}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="h-3.5 w-3.5" /> Reload
          </Button>
        }
      />

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="mb-4 flex-wrap h-auto">
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.id} value={c.id} className="gap-1.5">
              <c.icon className="h-3.5 w-3.5" />
              {c.label}
              {hasLocalChanges(c.id) && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map((cat) => (
          <TabsContent key={cat.id} value={cat.id}>
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2"><cat.icon className="h-4 w-4" /> {cat.label} Settings</CardTitle>
                  <CardDescription className="text-xs">{cat.description}</CardDescription>
                </div>
                {canEdit && (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => saveCategory(cat.id)}
                    disabled={!hasLocalChanges(cat.id) || savingCat === cat.id}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingCat === cat.id ? 'Saving...' : 'Save Changes'}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(settings[cat.id] || []).map((s) => {
                    const meta = FIELD_META[s.key] || { label: s.key, type: 'text' as const }
                    const value = getValue(s.key, s.value)
                    const isDirty = localValues[s.key] !== undefined && localValues[s.key] !== s.value
                    return (
                      <div key={s.key} className={cn('space-y-1.5', isDirty && 'rounded-md p-2 -m-2 bg-primary/5')}>
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-xs font-medium">{meta.label}</Label>
                          {isDirty && <span className="text-[10px] text-primary font-medium">unsaved</span>}
                        </div>
                        {renderField(meta, value, (v) => setLocalValues((prev) => ({ ...prev, [s.key]: v })), !canEdit)}
                        {meta.hint && <p className="text-[10px] text-muted-foreground">{meta.hint}</p>}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

function renderField(
  meta: { type: string; options?: string[] },
  value: string,
  onChange: (v: string) => void,
  disabled: boolean
) {
  if (meta.type === 'switch') {
    return (
      <div className="flex items-center gap-2">
        <Switch
          checked={value === 'true'}
          onCheckedChange={(c) => onChange(c ? 'true' : 'false')}
          disabled={disabled}
        />
        <span className="text-xs text-muted-foreground">{value === 'true' ? 'Enabled' : 'Disabled'}</span>
      </div>
    )
  }
  if (meta.type === 'select') {
    return (
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {meta.options?.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    )
  }
  if (meta.type === 'number') {
    return <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
  }
  return <Input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
}
