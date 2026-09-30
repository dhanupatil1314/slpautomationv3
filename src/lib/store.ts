'use client'

import { create } from 'zustand'

// LakhirAd navigation state — client-side view routing
// Since the app is constrained to the `/` route, navigation is managed via Zustand.
// Each module is a "view". Detail pages carry an entityId for context.

export type ViewKey =
  | 'dashboard'
  | 'devices'
  | 'device-detail'
  | 'device-groups'
  | 'screens'
  | 'vehicles'
  | 'drivers'
  | 'owners'
  | 'locations'
  | 'media'
  | 'playlists'
  | 'playlist-detail'
  | 'campaigns'
  | 'campaign-detail'
  | 'campaign-wizard'
  | 'advertisers'
  | 'leaderboard'
  | 'emergency-content'
  | 'inventory'
  | 'marketplace'
  | 'scheduling'
  | 'proof-of-play'
  | 'playback-monitor'
  | 'campaign-comparison'
  | 'analytics'
  | 'billing'
  | 'budget-tracking'
  | 'revenue'
  | 'revenue-forecast'
  | 'driver-earnings'
  | 'payouts'
  | 'iot'
  | 'device-health'
  | 'fleet-health'
  | 'alerts'
  | 'service'
  | 'engineers'
  | 'users'
  | 'roles'
  | 'notifications'
  | 'audit'
  | 'settings'
  | 'profile'
  | 'command-center'
  | 'live-map'

interface NavState {
  view: ViewKey
  entityId: string | null
  setView: (view: ViewKey, entityId?: string | null) => void
  openDetail: (view: ViewKey, id: string) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
}

export const useNav = create<NavState>((set) => ({
  view: 'dashboard',
  entityId: null,
  setView: (view, entityId = null) => set({ view, entityId, mobileNavOpen: false }),
  openDetail: (view, id) => set({ view, entityId: id, mobileNavOpen: false }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
}))

// Auth state — client mirror of server session
interface AuthState {
  user: {
    id: string
    email: string
    name: string
    role: string
    organizationId?: string | null
    avatarUrl?: string | null
  } | null
  loading: boolean
  setUser: (user: AuthState['user']) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  logout: () => set({ user: null, loading: false }),
}))
