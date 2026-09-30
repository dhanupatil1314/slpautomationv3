import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// Default settings seeded on first GET if missing
const DEFAULT_SETTINGS: { key: string; value: string; category: string }[] = [
  // General
  { key: 'brand_name', value: 'LakhirAd', category: 'general' },
  { key: 'tagline', value: 'Smart Digital Advertising Network', category: 'general' },
  { key: 'timezone', value: 'Asia/Kolkata', category: 'general' },
  { key: 'currency', value: 'INR', category: 'general' },
  { key: 'language', value: 'en-IN', category: 'general' },
  // Campaign
  { key: 'default_ad_duration_sec', value: '15', category: 'campaign' },
  { key: 'default_freq_per_hour', value: '4', category: 'campaign' },
  { key: 'require_approval', value: 'true', category: 'campaign' },
  { key: 'default_priority', value: '4', category: 'campaign' },
  // Device
  { key: 'heartbeat_interval_sec', value: '60', category: 'device' },
  { key: 'offline_threshold_min', value: '5', category: 'device' },
  { key: 'critical_offline_threshold_min', value: '15', category: 'device' },
  { key: 'storage_threshold_pct', value: '80', category: 'device' },
  { key: 'storage_critical_pct', value: '90', category: 'device' },
  { key: 'temperature_threshold_c', value: '50', category: 'device' },
  { key: 'temperature_critical_c', value: '60', category: 'device' },
  { key: 'ram_threshold_pct', value: '80', category: 'device' },
  // Revenue
  { key: 'platform_share_pct', value: '60', category: 'revenue' },
  { key: 'owner_share_pct', value: '15', category: 'revenue' },
  { key: 'driver_share_pct', value: '25', category: 'revenue' },
  { key: 'base_participation_inr', value: '500', category: 'revenue' },
  { key: 'uptime_bonus_inr', value: '200', category: 'revenue' },
  { key: 'campaign_bonus_inr', value: '100', category: 'revenue' },
  { key: 'compliance_bonus_inr', value: '100', category: 'revenue' },
  { key: 'service_penalty_inr', value: '50', category: 'revenue' },
  // Notifications
  { key: 'alert_critical_sms', value: 'false', category: 'notifications' },
  { key: 'alert_warning_email', value: 'true', category: 'notifications' },
  { key: 'daily_summary_email', value: 'true', category: 'notifications' },
  { key: 'device_offline_alert', value: 'true', category: 'notifications' },
  { key: 'sim_data_alert_threshold_pct', value: '80', category: 'notifications' },
  // Security
  { key: 'password_min_length', value: '8', category: 'security' },
  { key: 'session_duration_hours', value: '168', category: 'security' },
  { key: 'two_factor_ready', value: 'false', category: 'security' },
  { key: 'require_password_reset_days', value: '90', category: 'security' },
  { key: 'max_login_attempts', value: '5', category: 'security' },
]

// GET /api/settings — all settings grouped by category
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'settings.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Ensure defaults exist
  const existing = await db.setting.findMany()
  const existingKeys = new Set(existing.map((s) => s.key))
  const toCreate = DEFAULT_SETTINGS.filter((s) => !existingKeys.has(s.key))
  if (toCreate.length > 0) {
    await db.setting.createMany({ data: toCreate })
  }

  const all = await db.setting.findMany({ orderBy: [{ category: 'asc' }, { key: 'asc' }] })
  const grouped: Record<string, { key: string; value: string }[]> = {}
  for (const s of all) {
    if (!grouped[s.category]) grouped[s.category] = []
    grouped[s.category].push({ key: s.key, value: s.value })
  }

  return NextResponse.json({ settings: grouped })
}

// PUT /api/settings — update one or many settings
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'settings.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { updates } = body as { updates: { key: string; value: string }[] }
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'updates[] required' }, { status: 400 })
  }

  // Use a transaction to upsert each setting
  await db.$transaction(
    updates.map((u) =>
      db.setting.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: { key: u.key, value: u.value, category: inferCategory(u.key) },
      })
    )
  )

  await auditLog({
    user,
    action: 'settings_update',
    entity: 'setting',
    details: `Updated ${updates.length} setting(s): ${updates.map((u) => u.key).join(', ')}`.slice(0, 250),
  })

  return NextResponse.json({ success: true, updated: updates.length })
}

function inferCategory(key: string): string {
  if (key.startsWith('campaign') || key.includes('ad_duration') || key.includes('freq') || key.includes('approval') || key.includes('priority')) return 'campaign'
  if (key.startsWith('heartbeat') || key.includes('offline') || key.includes('storage') || key.includes('temperature') || key.includes('ram')) return 'device'
  if (key.includes('share') || key.includes('participation') || key.includes('bonus') || key.includes('penalty')) return 'revenue'
  if (key.includes('alert') || key.includes('notification') || key.includes('sms') || key.includes('email') || key.includes('summary')) return 'notifications'
  if (key.includes('password') || key.includes('session') || key.includes('2fa') || key.includes('two_factor') || key.includes('login_attempt')) return 'security'
  return 'general'
}
