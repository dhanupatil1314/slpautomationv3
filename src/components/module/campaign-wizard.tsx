'use client'

import { useState } from 'react'
import { useFetch, mutate } from '@/hooks/use-fetch'
import { useNav, useAuth } from '@/lib/store'
import { hasPermission } from '@/lib/rbac'
import {
  PageHeader, EmptyState, ErrorState,
} from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Megaphone, ArrowLeft, ArrowRight, Check, Building2, Film, MapPin, Monitor,
  Calendar, Clock, RefreshCw, IndianRupee, Send, Ban, ClipboardList, AlertCircle,
} from 'lucide-react'
import { formatINR, formatNumber } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const STEPS = [
  { n: 1, label: 'Name',           icon: Megaphone },
  { n: 2, label: 'Advertiser',     icon: Building2 },
  { n: 3, label: 'Media',          icon: Film },
  { n: 4, label: 'Cities',         icon: MapPin },
  { n: 5, label: 'Devices',        icon: Monitor },
  { n: 6, label: 'Date Range',     icon: Calendar },
  { n: 7, label: 'Time Range',     icon: Clock },
  { n: 8, label: 'Days of Week',   icon: Calendar },
  { n: 9, label: 'Frequency',      icon: RefreshCw },
  { n: 10, label: 'Budget',        icon: IndianRupee },
  { n: 11, label: 'Price',         icon: IndianRupee },
  { n: 12, label: 'Review',        icon: ClipboardList },
  { n: 13, label: 'Submit',        icon: Send },
]

const PRICE_PER_PLAY = 2 // INR per play (per spec)
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface WizardForm {
  name: string
  advertiserId: string
  mediaIds: string[]
  cityIds: string[]
  deviceIds: string[]
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  daysOfWeek: number[]
  frequencyPerHour: number
  budget: number
}

export function CampaignWizardView() {
  const { setView, openDetail } = useNav()
  const { user } = useAuth()
  const role = user?.role
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState<WizardForm>({
    name: '',
    advertiserId: '',
    mediaIds: [],
    cityIds: [],
    deviceIds: [],
    startDate: '',
    endDate: '',
    startTime: '08:00',
    endTime: '22:00',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    frequencyPerHour: 4,
    budget: 50000,
  })

  // Lookups (fetched in parallel)
  const { data: advData } = useFetch<any>('/api/advertisers?pageSize=100')
  const { data: mediaData } = useFetch<any>('/api/media?status=approved&pageSize=100')
  const { data: citiesData } = useFetch<any>('/api/cities')
  const { data: devicesData } = useFetch<any>('/api/devices?pageSize=200')

  if (!hasPermission(role, 'campaigns.create')) {
    return (
      <div>
        <PageHeader title="New Campaign" breadcrumbs={[{ label: 'Campaigns', onClick: () => setView('campaigns') }, { label: 'Wizard' }]} />
        <Card><CardContent><EmptyState icon={Ban} title="Access denied" description="You don't have permission to create campaigns. Contact your administrator." /></CardContent></Card>
      </div>
    )
  }

  const advertisers = advData?.advertisers || []
  const mediaList = mediaData?.media || []
  const cities = citiesData?.cities || []
  const devices = devicesData?.devices || []

  // Compute pricing
  const selectedDeviceCount = form.deviceIds.length
  const numberOfDays = form.startDate && form.endDate
    ? Math.max(1, Math.ceil((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000) + 1)
    : 0
  const dailyPlays = selectedDeviceCount * form.frequencyPerHour
  const totalPlays = dailyPlays * numberOfDays
  const estimatedPrice = totalPlays * PRICE_PER_PLAY

  const set = <K extends keyof WizardForm>(key: K, value: WizardForm[K]) => setForm((f) => ({ ...f, [key]: value }))

  // Validation per step
  const stepErrors: Record<number, string | null> = {
    1: form.name.trim() ? null : 'Campaign name is required',
    2: form.advertiserId ? null : 'Please select an advertiser',
    3: form.mediaIds.length > 0 ? null : 'Select at least one media asset',
    4: form.cityIds.length > 0 ? null : 'Select at least one target city',
    5: null, // devices optional
    6: form.startDate && form.endDate ? null : 'Start and end dates are required',
    7: form.startTime && form.endTime ? null : 'Time range is required',
    8: form.daysOfWeek.length > 0 ? null : 'Select at least one day',
    9: form.frequencyPerHour > 0 ? null : 'Frequency must be at least 1',
    10: form.budget > 0 ? null : 'Budget must be greater than 0',
    11: null,
    12: null,
    13: null,
  }
  const canAdvance = !stepErrors[step]

  const next = () => { if (canAdvance && step < 13) setStep(step + 1) }
  const back = () => { if (step > 1) setStep(step - 1) }

  const submit = async () => {
    setSubmitting(true)
    try {
      const payload = {
        name: form.name,
        advertiserId: form.advertiserId,
        priority: 4,
        status: 'submitted',
        startDate: form.startDate,
        endDate: form.endDate,
        startTime: form.startTime,
        endTime: form.endTime,
        daysOfWeek: form.daysOfWeek.join(','),
        frequencyPerHour: form.frequencyPerHour,
        budget: form.budget,
        priceQuoted: estimatedPrice,
        targetCities: cities.filter((c: any) => form.cityIds.includes(c.id)).map((c: any) => c.name).join(','),
        targetDeviceCount: selectedDeviceCount,
        deviceIds: form.deviceIds,
      }
      const res = await mutate('/api/campaigns', 'POST', payload)
      toast.success(`Campaign "${form.name}" submitted for approval`)
      if (res?.campaign?.id) {
        openDetail('campaign-detail', res.campaign.id)
      } else {
        setView('campaigns')
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit campaign')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="New Campaign Wizard"
        subtitle="Step-by-step campaign builder"
        breadcrumbs={[
          { label: 'Campaigns', onClick: () => setView('campaigns') },
          { label: 'Wizard' },
        ]}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setView('campaigns')}>
            <ArrowLeft className="h-3.5 w-3.5" /> Cancel
          </Button>
        }
      />

      {/* Stepper */}
      <Card className="mb-4">
        <CardContent className="p-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {STEPS.map((s, i) => {
              const done = s.n < step
              const current = s.n === step
              return (
                <div key={s.n} className="flex items-center shrink-0">
                  <button
                    onClick={() => s.n < step && setStep(s.n)}
                    disabled={s.n >= step}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
                      current && 'bg-primary text-primary-foreground',
                      done && 'bg-success/15 text-success hover:bg-success/25 cursor-pointer',
                      !current && !done && 'text-muted-foreground'
                    )}
                  >
                    <span className={cn(
                      'grid place-items-center h-5 w-5 rounded-full border text-[10px] font-bold shrink-0',
                      current ? 'border-primary-foreground' : done ? 'border-success' : 'border-muted-foreground/40'
                    )}>
                      {done ? <Check className="h-3 w-3" /> : s.n}
                    </span>
                    <span className="hidden lg:inline">{s.label}</span>
                  </button>
                  {i < STEPS.length - 1 && <span className="w-3 h-px bg-border mx-0.5" />}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step content */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            {(() => {
              const Icon = STEPS[step - 1].icon
              return <Icon className="h-4 w-4" />
            })()}
            Step {step} of 13 — {STEPS[step - 1].label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 min-h-[300px]">
          {/* Step 1: Name */}
          {step === 1 && (
            <div className="space-y-2 max-w-md">
              <Label>Campaign Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Diwali Mega Sale 2024 — Vadodara Auto Network"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Pick a clear, unique name to identify this campaign in reports and approvals.</p>
            </div>
          )}

          {/* Step 2: Advertiser */}
          {step === 2 && (
            <div className="space-y-2">
              <Label>Select Advertiser *</Label>
              <Select value={form.advertiserId} onValueChange={(v) => set('advertiserId', v)}>
                <SelectTrigger className="max-w-md"><SelectValue placeholder="Choose advertiser..." /></SelectTrigger>
                <SelectContent>
                  {advertisers.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.organizationName} ({a.contactName})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.advertiserId && (
                <div className="mt-3 p-3 rounded-md bg-primary/5 border border-primary/20 max-w-md">
                  {(() => {
                    const a = advertisers.find((x: any) => x.id === form.advertiserId)
                    return a ? (
                      <div className="text-sm space-y-1">
                        <p className="font-medium">{a.organizationName}</p>
                        <p className="text-xs text-muted-foreground">{a.contactName} · {a.contactEmail}</p>
                        <p className="text-xs text-muted-foreground">Category: {a.category} · Status: {a.status}</p>
                      </div>
                    ) : null
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Media */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Select Approved Media * ({form.mediaIds.length} selected)</Label>
              </div>
              {mediaList.length === 0 ? (
                <EmptyState icon={Film} title="No approved media" description="Approve media in the Media Library first" />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto p-1">
                  {mediaList.map((m: any) => {
                    const checked = form.mediaIds.includes(m.id)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => set('mediaIds', checked ? form.mediaIds.filter((x) => x !== m.id) : [...form.mediaIds, m.id])}
                        className={cn(
                          'relative text-left rounded-md border-2 overflow-hidden hover:border-primary/60 transition-colors',
                          checked ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                        )}
                      >
                        <div className={cn(
                          'relative aspect-video grid place-items-center bg-gradient-to-br text-primary-foreground',
                          m.type === 'video' ? 'from-primary/80 to-primary' : 'from-success/80 to-success'
                        )}>
                          <Film className="h-5 w-5 opacity-90" />
                          <span className="absolute bottom-1 right-1 text-[10px] bg-black/40 px-1 rounded uppercase">{m.format}</span>
                          {checked && (
                            <div className="absolute top-1 right-1 grid place-items-center h-5 w-5 rounded-full bg-primary text-primary-foreground">
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                        <div className="p-1.5">
                          <p className="text-xs font-medium truncate">{m.name}</p>
                          <p className="text-[10px] text-muted-foreground">{m.durationSec}s · {m.resolution || '—'}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Cities */}
          {step === 4 && (
            <div className="space-y-3">
              <Label>Select Target Cities * ({form.cityIds.length} selected)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto">
                {cities.map((c: any) => {
                  const checked = form.cityIds.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => set('cityIds', checked ? form.cityIds.filter((x) => x !== c.id) : [...form.cityIds, c.id])}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-md border-2 text-left transition-colors',
                        checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                      )}
                    >
                      <div className={cn(
                        'grid place-items-center h-9 w-9 rounded-md shrink-0',
                        checked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      )}>
                        {checked ? <Check className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.state}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 5: Devices */}
          {step === 5 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Select Devices ({form.deviceIds.length} selected)</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => set('deviceIds', devices.map((d: any) => d.id))}>Select All</Button>
                  <Button size="sm" variant="outline" onClick={() => set('deviceIds', [])}>Clear</Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{devices.length} devices available in the network</p>
              <div className="max-h-[400px] overflow-y-auto border rounded-md divide-y">
                {devices.map((d: any) => {
                  const checked = form.deviceIds.includes(d.id)
                  return (
                    <label
                      key={d.id}
                      className={cn('flex items-center gap-3 p-2.5 cursor-pointer hover:bg-accent/50', checked && 'bg-primary/5')}
                    >
                      <Checkbox checked={checked} onCheckedChange={(v) => v ? set('deviceIds', [...form.deviceIds, d.id]) : set('deviceIds', form.deviceIds.filter((x) => x !== d.id))} />
                      <div className="grid place-items-center h-8 w-8 rounded bg-primary/10 text-primary shrink-0">
                        <Monitor className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{d.deviceId}</p>
                        <p className="text-xs text-muted-foreground truncate">{d.city} · {d.zone || '—'} · {d.vehicleReg}</p>
                      </div>
                      <Badge variant="outline" className={cn('text-[10px]', d.status === 'online' && 'border-success/40 text-success')}>{d.status}</Badge>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 6: Date Range */}
          {step === 6 && (
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Input type="date" value={form.endDate} min={form.startDate} onChange={(e) => set('endDate', e.target.value)} />
              </div>
              {numberOfDays > 0 && (
                <div className="col-span-2 p-3 rounded-md bg-primary/5 border border-primary/20 text-sm">
                  <Calendar className="h-4 w-4 inline mr-1 text-primary" />
                  Campaign duration: <strong>{numberOfDays} day(s)</strong>
                </div>
              )}
            </div>
          )}

          {/* Step 7: Time Range */}
          {step === 7 && (
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div className="space-y-2">
                <Label>Daily Start Time *</Label>
                <Input type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Daily End Time *</Label>
                <Input type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} />
              </div>
              <div className="col-span-2 p-3 rounded-md bg-primary/5 border border-primary/20 text-sm">
                <Clock className="h-4 w-4 inline mr-1 text-primary" />
                Daily active window: <strong>{form.startTime} – {form.endTime}</strong>
              </div>
            </div>
          )}

          {/* Step 8: Days of Week */}
          {step === 8 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Days of Week *</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => set('daysOfWeek', [0, 1, 2, 3, 4, 5, 6])}>All Days</Button>
                  <Button size="sm" variant="outline" onClick={() => set('daysOfWeek', [0, 1, 2, 3, 4])}>Weekdays</Button>
                  <Button size="sm" variant="outline" onClick={() => set('daysOfWeek', [5, 6])}>Weekends</Button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {DAY_LABELS.map((d, i) => {
                  const checked = form.daysOfWeek.includes(i)
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => set('daysOfWeek', checked ? form.daysOfWeek.filter((x) => x !== i) : [...form.daysOfWeek, i].sort())}
                      className={cn(
                        'flex flex-col items-center gap-1 p-3 rounded-md border-2 transition-colors',
                        checked ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40 text-muted-foreground'
                      )}
                    >
                      <Checkbox checked={checked} className="pointer-events-none" />
                      <span className="text-xs font-semibold">{d}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 9: Frequency */}
          {step === 9 && (
            <div className="space-y-3 max-w-md">
              <Label>Plays per Hour (per device) *</Label>
              <Input
                type="number" min="1" max="60"
                value={form.frequencyPerHour}
                onChange={(e) => set('frequencyPerHour', Math.max(1, Number(e.target.value) || 1))}
              />
              <p className="text-xs text-muted-foreground">Each selected device will play the campaign approximately {form.frequencyPerHour}× per hour during the daily active window.</p>
              <div className="p-3 rounded-md bg-primary/5 border border-primary/20 text-sm">
                <RefreshCw className="h-4 w-4 inline mr-1 text-primary" />
                Estimated plays per day per device: <strong>{form.frequencyPerHour * 14}</strong> (assuming 14-hour active window)
              </div>
            </div>
          )}

          {/* Step 10: Budget */}
          {step === 10 && (
            <div className="space-y-3 max-w-md">
              <Label>Campaign Budget (INR) *</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="number" min="1" className="pl-9" value={form.budget} onChange={(e) => set('budget', Number(e.target.value) || 0)} />
              </div>
              <p className="text-xs text-muted-foreground">Maximum budget the advertiser has approved for this campaign.</p>
            </div>
          )}

          {/* Step 11: Price */}
          {step === 11 && (
            <div className="max-w-lg space-y-4">
              <div className="p-4 rounded-md bg-primary/5 border border-primary/20">
                <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-primary" /> Estimated Price Breakdown
                </p>
                <div className="space-y-2 text-sm">
                  <BreakRow label="Selected devices" value={formatNumber(selectedDeviceCount)} />
                  <BreakRow label="Campaign duration (days)" value={formatNumber(numberOfDays)} />
                  <BreakRow label="Frequency per hour" value={`${form.frequencyPerHour} plays`} />
                  <BreakRow label="Plays per day (across all devices)" value={formatNumber(dailyPlays)} />
                  <BreakRow label="Total plays" value={formatNumber(totalPlays)} />
                  <BreakRow label="Rate per play" value={formatINR(PRICE_PER_PLAY)} />
                  <div className="border-t my-2" />
                  <div className="flex items-center justify-between font-bold text-base">
                    <span>Estimated Total</span>
                    <span className="text-primary tabular-nums">{formatINR(estimatedPrice)}</span>
                  </div>
                </div>
              </div>
              {estimatedPrice > form.budget && (
                <div className="p-3 rounded-md bg-warning/10 border border-warning/30 text-sm flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-warning-foreground shrink-0 mt-0.5" />
                  <span>Estimated price ({formatINR(estimatedPrice)}) exceeds the budget ({formatINR(form.budget)}). Consider reducing devices, days, or frequency.</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Pricing formula: devices × days × frequencyPerHour × 14 hours × ₹{PRICE_PER_PLAY}/play</p>
            </div>
          )}

          {/* Step 12: Review */}
          {step === 12 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Review all selections before submitting for approval.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ReviewCard label="Campaign Name" value={form.name || '—'} icon={Megaphone} />
                <ReviewCard label="Advertiser" value={advertisers.find((a: any) => a.id === form.advertiserId)?.organizationName || '—'} icon={Building2} />
                <ReviewCard label="Media" value={`${form.mediaIds.length} selected`} icon={Film} />
                <ReviewCard label="Cities" value={cities.filter((c: any) => form.cityIds.includes(c.id)).map((c: any) => c.name).join(', ') || '—'} icon={MapPin} />
                <ReviewCard label="Devices" value={`${selectedDeviceCount} selected`} icon={Monitor} />
                <ReviewCard label="Date Range" value={form.startDate && form.endDate ? `${form.startDate} → ${form.endDate} (${numberOfDays} days)` : '—'} icon={Calendar} />
                <ReviewCard label="Time Window" value={`${form.startTime} – ${form.endTime}`} icon={Clock} />
                <ReviewCard label="Days of Week" value={form.daysOfWeek.length === 7 ? 'Every day' : form.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ')} icon={Calendar} />
                <ReviewCard label="Frequency" value={`${form.frequencyPerHour} plays/hr`} icon={RefreshCw} />
                <ReviewCard label="Budget" value={formatINR(form.budget)} icon={IndianRupee} />
                <ReviewCard label="Estimated Price" value={formatINR(estimatedPrice)} icon={IndianRupee} />
                <ReviewCard label="Total Plays" value={formatNumber(totalPlays)} icon={Send} />
              </div>
            </div>
          )}

          {/* Step 13: Submit */}
          {step === 13 && (
            <div className="space-y-4 max-w-md mx-auto text-center py-6">
              <div className="grid place-items-center h-16 w-16 rounded-full bg-primary/10 text-primary mx-auto">
                <Send className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold">Ready to Submit</h3>
              <p className="text-sm text-muted-foreground">
                Campaign <strong>&ldquo;{form.name}&rdquo;</strong> will be submitted for approval.
                The approver will be notified and can approve, reject, or request changes.
              </p>
              <div className="p-3 rounded-md bg-muted text-left text-sm space-y-1">
                <p><strong>Budget:</strong> {formatINR(form.budget)}</p>
                <p><strong>Estimated Price:</strong> {formatINR(estimatedPrice)}</p>
                <p><strong>Devices:</strong> {selectedDeviceCount}</p>
                <p><strong>Duration:</strong> {numberOfDays} days</p>
              </div>
              <Button size="lg" className="gap-2 w-full" disabled={submitting} onClick={submit}>
                <Send className="h-4 w-4" />
                {submitting ? 'Submitting...' : 'Submit for Approval'}
              </Button>
            </div>
          )}

          {/* Validation message */}
          {stepErrors[step] && step !== 13 && (
            <div className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {stepErrors[step]}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer nav */}
      <div className="flex items-center justify-between mt-4">
        <Button variant="outline" onClick={back} disabled={step === 1} className="gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <span className="text-xs text-muted-foreground">Step {step} of 13</span>
        {step < 13 ? (
          <Button onClick={next} disabled={!canAdvance} className="gap-1.5">
            Next <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={submitting} className="gap-1.5">
            <Send className="h-3.5 w-3.5" /> Submit
          </Button>
        )}
      </div>
    </div>
  )
}

function BreakRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

function ReviewCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="flex items-start gap-2 p-3 border rounded-md">
      <div className="grid place-items-center h-8 w-8 rounded-md bg-primary/10 text-primary shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
    </div>
  )
}
