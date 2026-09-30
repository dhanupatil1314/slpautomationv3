import { db } from '@/lib/db'

// LakhirAd RBAC — role definitions and permission checks
// Roles: super_admin, ops_admin, ads_manager, finance_admin, service_engineer, advertiser, vehicle_owner, driver

export type Role =
  | 'super_admin'
  | 'ops_admin'
  | 'ads_manager'
  | 'finance_admin'
  | 'service_engineer'
  | 'advertiser'
  | 'vehicle_owner'
  | 'driver'
  | 'viewer'

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  ops_admin: 'Operations Admin',
  ads_manager: 'Advertising Manager',
  finance_admin: 'Finance Admin',
  service_engineer: 'Service Engineer',
  advertiser: 'Advertiser',
  vehicle_owner: 'Vehicle Owner',
  driver: 'Driver',
  viewer: 'Viewer',
}

// Granular permissions per module
export const PERMISSIONS = [
  'devices.view', 'devices.create', 'devices.edit', 'devices.delete', 'devices.restart', 'devices.command',
  'screens.view', 'screens.create', 'screens.edit', 'screens.delete',
  'vehicles.view', 'vehicles.create', 'vehicles.edit', 'vehicles.delete',
  'drivers.view', 'drivers.create', 'drivers.edit', 'drivers.delete',
  'owners.view', 'owners.create', 'owners.edit', 'owners.delete',
  'locations.view', 'locations.create', 'locations.edit',
  'media.view', 'media.create', 'media.edit', 'media.delete', 'media.approve',
  'playlists.view', 'playlists.create', 'playlists.edit', 'playlists.delete',
  'campaigns.view', 'campaigns.create', 'campaigns.edit', 'campaigns.delete', 'campaigns.approve', 'campaigns.publish',
  'advertisers.view', 'advertisers.create', 'advertisers.edit', 'advertisers.delete',
  'inventory.view',
  'scheduling.view', 'scheduling.edit',
  'playback.view', 'proof_of_play.view',
  'analytics.view',
  'billing.view', 'billing.create', 'billing.edit',
  'revenue.view',
  'earnings.view', 'earnings.edit',
  'payouts.view', 'payouts.approve',
  'iot.view', 'iot.edit',
  'health.view',
  'alerts.view', 'alerts.acknowledge',
  'service.view', 'service.create', 'service.edit', 'service.assign',
  'engineers.view', 'engineers.create', 'engineers.edit',
  'users.view', 'users.create', 'users.edit', 'users.delete',
  'roles.view', 'roles.edit',
  'notifications.view',
  'audit.view',
  'settings.view', 'settings.edit',
  'command_center.view',
] as const

export type Permission = (typeof PERMISSIONS)[number]

// Role → permission mapping
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: [...PERMISSIONS],
  ops_admin: [
    'devices.view', 'devices.create', 'devices.edit', 'devices.restart', 'devices.command',
    'screens.view', 'screens.create', 'screens.edit',
    'vehicles.view', 'vehicles.create', 'vehicles.edit',
    'drivers.view', 'drivers.create', 'drivers.edit',
    'owners.view', 'owners.create', 'owners.edit',
    'locations.view', 'locations.create', 'locations.edit',
    'playlists.view', 'playlists.create', 'playlists.edit',
    'campaigns.view', 'campaigns.approve', 'campaigns.publish',
    'inventory.view', 'scheduling.view', 'scheduling.edit',
    'playback.view', 'proof_of_play.view', 'analytics.view',
    'health.view', 'alerts.view', 'alerts.acknowledge',
    'service.view', 'service.create', 'service.edit', 'service.assign',
    'engineers.view', 'engineers.create', 'engineers.edit',
    'notifications.view', 'audit.view', 'command_center.view',
    'iot.view',
  ],
  ads_manager: [
    'advertisers.view', 'advertisers.create', 'advertisers.edit',
    'media.view', 'media.create', 'media.edit', 'media.approve',
    'playlists.view', 'playlists.create', 'playlists.edit',
    'campaigns.view', 'campaigns.create', 'campaigns.edit', 'campaigns.approve', 'campaigns.publish',
    'inventory.view', 'scheduling.view', 'scheduling.edit',
    'playback.view', 'proof_of_play.view', 'analytics.view',
    'billing.view',
  ],
  finance_admin: [
    'billing.view', 'billing.create', 'billing.edit',
    'revenue.view',
    'earnings.view', 'earnings.edit',
    'payouts.view', 'payouts.approve',
    'analytics.view',
    'campaigns.view',
    'advertisers.view',
  ],
  service_engineer: [
    'devices.view',
    'service.view', 'service.create', 'service.edit',
    'health.view', 'alerts.view',
    'engineers.view',
  ],
  advertiser: [
    'media.view', 'media.create', 'media.edit',
    'playlists.view',
    'campaigns.view', 'campaigns.create',
    'inventory.view', 'scheduling.view',
    'playback.view', 'proof_of_play.view', 'analytics.view',
    'billing.view',
  ],
  vehicle_owner: [
    'vehicles.view', 'devices.view',
    'earnings.view',
    'payouts.view',
    'health.view',
    'service.view',
  ],
  driver: [
    'vehicles.view', 'devices.view',
    'earnings.view',
    'payouts.view',
    'health.view',
    'service.view',
  ],
  viewer: ['devices.view', 'vehicles.view', 'drivers.view', 'analytics.view'],
}

export function hasPermission(role: string | undefined | null, permission: string): boolean {
  if (!role) return false
  const perms = ROLE_PERMISSIONS[role]
  if (!perms) return false
  return perms.includes(permission)
}

export function hasAnyPermission(role: string | undefined | null, permissions: string[]): boolean {
  if (!role) return false
  return permissions.some((p) => hasPermission(role, p))
}

// Seed default roles into the database
export async function seedRoles() {
  const roles = [
    { name: 'super_admin', description: 'Full system access', isSystem: true, permissions: JSON.stringify([...PERMISSIONS]) },
    { name: 'ops_admin', description: 'Operations — devices, vehicles, drivers, service, campaigns', isSystem: true, permissions: JSON.stringify(ROLE_PERMISSIONS.ops_admin) },
    { name: 'ads_manager', description: 'Advertising — advertisers, media, campaigns, playlists, inventory', isSystem: true, permissions: JSON.stringify(ROLE_PERMISSIONS.ads_manager) },
    { name: 'finance_admin', description: 'Finance — invoices, payments, revenue, payouts', isSystem: true, permissions: JSON.stringify(ROLE_PERMISSIONS.finance_admin) },
    { name: 'service_engineer', description: 'Field service — assigned devices and tickets', isSystem: true, permissions: JSON.stringify(ROLE_PERMISSIONS.service_engineer) },
    { name: 'advertiser', description: 'Advertiser portal — own org, campaigns, media, billing', isSystem: true, permissions: JSON.stringify(ROLE_PERMISSIONS.advertiser) },
    { name: 'vehicle_owner', description: 'Owner portal — own vehicles, devices, earnings', isSystem: true, permissions: JSON.stringify(ROLE_PERMISSIONS.vehicle_owner) },
    { name: 'driver', description: 'Driver portal — assigned vehicle, earnings, support', isSystem: true, permissions: JSON.stringify(ROLE_PERMISSIONS.driver) },
  ]
  for (const r of roles) {
    await db.role.upsert({
      where: { name: r.name },
      update: { permissions: r.permissions },
      create: r,
    })
  }
}
