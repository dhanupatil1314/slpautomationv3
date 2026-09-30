import type { ViewKey } from '@/lib/store'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Monitor, MonitorSmartphone, Car, User, Users, MapPin,
  Image, ListMusic, Megaphone, Building2, Package, CalendarClock, Store, Trophy,
  PlayCircle, BarChart3, Receipt, TrendingUp, Wallet, Banknote, GitCompare, PieChart,
  Signal, Activity, AlertTriangle, Wrench, HardHat, UserCog, Heart, LineChart, Radio,
  ShieldCheck, Bell, ScrollText, Settings, Map, Siren, Layers,
} from 'lucide-react'

export interface NavItem {
  view: ViewKey
  label: string
  icon: LucideIcon
  permission?: string
  badge?: string
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

// LakhirAd sidebar navigation — 29 modules grouped by function
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'devices.view' },
      { view: 'command-center', label: 'Command Center', icon: Radio, permission: 'command_center.view' },
      { view: 'live-map', label: 'Live Device Map', icon: Map, permission: 'devices.view' },
    ],
  },
  {
    title: 'Network',
    items: [
      { view: 'devices', label: 'Devices', icon: Monitor, permission: 'devices.view' },
      { view: 'device-groups', label: 'Device Groups', icon: Layers, permission: 'devices.view' },
      { view: 'screens', label: 'Screens', icon: MonitorSmartphone, permission: 'screens.view' },
      { view: 'vehicles', label: 'Vehicles', icon: Car, permission: 'vehicles.view' },
      { view: 'drivers', label: 'Drivers', icon: User, permission: 'drivers.view' },
      { view: 'owners', label: 'Vehicle Owners', icon: Users, permission: 'owners.view' },
      { view: 'locations', label: 'Locations', icon: MapPin, permission: 'locations.view' },
      { view: 'iot', label: 'IoT / SIM', icon: Signal, permission: 'iot.view' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { view: 'device-health', label: 'Device Health', icon: Activity, permission: 'health.view' },
      { view: 'fleet-health', label: 'Fleet Health Score', icon: Heart, permission: 'health.view' },
      { view: 'alerts', label: 'Alerts', icon: AlertTriangle, permission: 'alerts.view' },
      { view: 'service', label: 'Service Tickets', icon: Wrench, permission: 'service.view' },
      { view: 'engineers', label: 'Field Engineers', icon: HardHat, permission: 'engineers.view' },
    ],
  },
  {
    title: 'Advertising',
    items: [
      { view: 'advertisers', label: 'Advertisers', icon: Building2, permission: 'advertisers.view' },
      { view: 'leaderboard', label: 'Leaderboard', icon: Trophy, permission: 'advertisers.view' },
      { view: 'media', label: 'Media Library', icon: Image, permission: 'media.view' },
      { view: 'playlists', label: 'Playlists', icon: ListMusic, permission: 'playlists.view' },
      { view: 'campaigns', label: 'Campaigns', icon: Megaphone, permission: 'campaigns.view' },
      { view: 'emergency-content', label: 'Emergency Content', icon: Siren, permission: 'campaigns.view' },
      { view: 'inventory', label: 'Inventory', icon: Package, permission: 'inventory.view' },
      { view: 'marketplace', label: 'Marketplace', icon: Store, permission: 'inventory.view' },
      { view: 'scheduling', label: 'Scheduling', icon: CalendarClock, permission: 'scheduling.view' },
    ],
  },
  {
    title: 'Playback & Analytics',
    items: [
      { view: 'proof-of-play', label: 'Proof of Play', icon: PlayCircle, permission: 'playback.view' },
      { view: 'playback-monitor', label: 'Live Playback Monitor', icon: Radio, permission: 'playback.view' },
      { view: 'campaign-comparison', label: 'Campaign Comparison', icon: GitCompare, permission: 'analytics.view' },
      { view: 'analytics', label: 'Analytics', icon: BarChart3, permission: 'analytics.view' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { view: 'billing', label: 'Billing', icon: Receipt, permission: 'billing.view' },
      { view: 'budget-tracking', label: 'Budget Tracking', icon: PieChart, permission: 'campaigns.view' },
      { view: 'revenue', label: 'Revenue', icon: TrendingUp, permission: 'revenue.view' },
      { view: 'revenue-forecast', label: 'Revenue Forecast', icon: LineChart, permission: 'revenue.view' },
      { view: 'driver-earnings', label: 'Driver Earnings', icon: Wallet, permission: 'earnings.view' },
      { view: 'payouts', label: 'Payouts', icon: Banknote, permission: 'payouts.view' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { view: 'users', label: 'Users', icon: UserCog, permission: 'users.view' },
      { view: 'roles', label: 'Roles & Permissions', icon: ShieldCheck, permission: 'roles.view' },
      { view: 'notifications', label: 'Notifications', icon: Bell, permission: 'notifications.view' },
      { view: 'audit', label: 'Audit Logs', icon: ScrollText, permission: 'audit.view' },
      { view: 'settings', label: 'Settings', icon: Settings, permission: 'settings.view' },
    ],
  },
]

// Quick actions for dashboard
export interface QuickAction {
  view: ViewKey
  label: string
  permission: string
}

export const QUICK_ACTIONS: QuickAction[] = [
  { view: 'devices', label: 'Add Device', permission: 'devices.create' },
  { view: 'vehicles', label: 'Add Vehicle', permission: 'vehicles.create' },
  { view: 'drivers', label: 'Add Driver', permission: 'drivers.create' },
  { view: 'advertisers', label: 'Add Advertiser', permission: 'advertisers.create' },
  { view: 'media', label: 'Upload Media', permission: 'media.create' },
  { view: 'playlists', label: 'Create Playlist', permission: 'playlists.create' },
  { view: 'campaign-wizard', label: 'Create Campaign', permission: 'campaigns.create' },
  { view: 'service', label: 'Service Ticket', permission: 'service.create' },
]
