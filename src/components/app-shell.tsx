'use client'

import { useEffect } from 'react'
import { useAuth, useNav } from '@/lib/store'
import { PageTransition } from '@/components/shared/page-transition'
import { Sidebar, MobileSidebar } from '@/components/layout/sidebar'
import { Header, Footer } from '@/components/layout/header'
import { LoginScreen } from '@/components/layout/login-screen'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardView } from '@/components/module/dashboard'
import { DevicesView } from '@/components/module/devices'
import { DeviceGroupsView } from '@/components/module/device-groups'
import { DeviceDetailView } from '@/components/module/device-detail'
import { ScreensView } from '@/components/module/screens'
import { VehiclesView } from '@/components/module/vehicles'
import { DriversView } from '@/components/module/drivers'
import { OwnersView } from '@/components/module/owners'
import { LocationsView } from '@/components/module/locations'
import { MediaView } from '@/components/module/media'
import { PlaylistsView, PlaylistDetailView } from '@/components/module/playlists'
import { CampaignsView, CampaignDetailView } from '@/components/module/campaigns'
import { CampaignWizardView } from '@/components/module/campaign-wizard'
import { AdvertisersView } from '@/components/module/advertisers'
import { LeaderboardView } from '@/components/module/leaderboard'
import { EmergencyContentView } from '@/components/module/emergency-content'
import { InventoryView } from '@/components/module/inventory'
import { MarketplaceView } from '@/components/module/marketplace'
import { SchedulingView } from '@/components/module/scheduling'
import { ProofOfPlayView } from '@/components/module/proof-of-play'
import { PlaybackMonitorView } from '@/components/module/playback-monitor'
import { CampaignComparisonView } from '@/components/module/campaign-comparison'
import { AnalyticsView } from '@/components/module/analytics'
import { BillingView } from '@/components/module/billing'
import { BudgetTrackingView } from '@/components/module/budget-tracking'
import { RevenueView } from '@/components/module/revenue'
import { RevenueForecastView } from '@/components/module/revenue-forecast'
import { DriverEarningsView } from '@/components/module/driver-earnings'
import { PayoutsView } from '@/components/module/payouts'
import { IotView } from '@/components/module/iot'
import { DeviceHealthView } from '@/components/module/device-health'
import { FleetHealthView } from '@/components/module/fleet-health'
import { AlertsView } from '@/components/module/alerts'
import { ServiceView } from '@/components/module/service'
import { EngineersView } from '@/components/module/engineers'
import { UsersView } from '@/components/module/users'
import { RolesView } from '@/components/module/roles'
import { NotificationsView } from '@/components/module/notifications'
import { AuditView } from '@/components/module/audit'
import { SettingsView } from '@/components/module/settings'
import { ProfileView } from '@/components/module/profile'
import { CommandCenterView } from '@/components/module/command-center'
import { LiveMapView } from '@/components/module/live-map'

export function AppShell({ serverUser }: { serverUser: any }) {
  const { user, setUser, loading } = useAuth()
  const { view } = useNav()

  // Hydrate auth state from server
  useEffect(() => {
    if (serverUser) {
      setUser(serverUser)
    } else {
      // Verify session via API (covers cookie-based sessions)
      fetch('/api/auth/me')
        .then((r) => r.json())
        .then((data) => setUser(data.user))
        .catch(() => setUser(null))
    }
  }, [serverUser, setUser])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md px-6">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center w-10 h-10 rounded-lg bg-primary text-primary-foreground font-bold">
              L
            </div>
            <div>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-40 mt-1" />
            </div>
          </div>
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen />
  }

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <MobileSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto">
          <PageTransition viewKey={view}>
            {renderView(view)}
          </PageTransition>
        </main>
        <Footer />
      </div>
    </div>
  )
}

function renderView(view: string) {
  switch (view) {
    case 'dashboard': return <DashboardView />
    case 'devices': return <DevicesView />
    case 'device-detail': return <DeviceDetailView />
    case 'device-groups': return <DeviceGroupsView />
    case 'screens': return <ScreensView />
    case 'vehicles': return <VehiclesView />
    case 'drivers': return <DriversView />
    case 'owners': return <OwnersView />
    case 'locations': return <LocationsView />
    case 'media': return <MediaView />
    case 'playlists': return <PlaylistsView />
    case 'playlist-detail': return <PlaylistDetailView />
    case 'campaigns': return <CampaignsView />
    case 'campaign-detail': return <CampaignDetailView />
    case 'campaign-wizard': return <CampaignWizardView />
    case 'advertisers': return <AdvertisersView />
    case 'leaderboard': return <LeaderboardView />
    case 'emergency-content': return <EmergencyContentView />
    case 'inventory': return <InventoryView />
    case 'marketplace': return <MarketplaceView />
    case 'scheduling': return <SchedulingView />
    case 'proof-of-play': return <ProofOfPlayView />
    case 'playback-monitor': return <PlaybackMonitorView />
    case 'campaign-comparison': return <CampaignComparisonView />
    case 'analytics': return <AnalyticsView />
    case 'billing': return <BillingView />
    case 'budget-tracking': return <BudgetTrackingView />
    case 'revenue': return <RevenueView />
    case 'revenue-forecast': return <RevenueForecastView />
    case 'driver-earnings': return <DriverEarningsView />
    case 'payouts': return <PayoutsView />
    case 'iot': return <IotView />
    case 'device-health': return <DeviceHealthView />
    case 'fleet-health': return <FleetHealthView />
    case 'alerts': return <AlertsView />
    case 'service': return <ServiceView />
    case 'engineers': return <EngineersView />
    case 'users': return <UsersView />
    case 'roles': return <RolesView />
    case 'notifications': return <NotificationsView />
    case 'audit': return <AuditView />
    case 'settings': return <SettingsView />
    case 'profile': return <ProfileView />
    case 'command-center': return <CommandCenterView />
    case 'live-map': return <LiveMapView />
    default: return <DashboardView />
  }
}
