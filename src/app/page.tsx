'use client'

import { useEffect, useRef } from 'react'
import { useAuthStore, getRoleView } from '@/store/auth-store'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { LoginPage, ChangePasswordDialog } from '@/components/layout/login-page'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'

import dynamic from 'next/dynamic'

const AdminDashboard = dynamic(() => import('@/components/modules/admin-dashboard').then(m => ({ default: m.AdminDashboard })), { loading: () => <PageSkeleton /> })
const ManagerDashboard = dynamic(() => import('@/components/modules/manager-dashboard').then(m => ({ default: m.ManagerDashboard })), { loading: () => <PageSkeleton /> })
const EngineerDashboard = dynamic(() => import('@/components/modules/engineer-dashboard').then(m => ({ default: m.EngineerDashboard })), { loading: () => <PageSkeleton /> })

const SchedulesView = dynamic(() => import('@/components/modules/schedules-view').then(m => ({ default: m.SchedulesView })), { loading: () => <PageSkeleton /> })
const DailyScheduleView = dynamic(() => import('@/components/modules/daily-schedule-view').then(m => ({ default: m.DailyScheduleView })), { loading: () => <PageSkeleton /> })
const SitesView = dynamic(() => import('@/components/modules/sites-view').then(m => ({ default: m.SitesView })), { loading: () => <PageSkeleton /> })
const StoresView = dynamic(() => import('@/components/modules/stores-view').then(m => ({ default: m.StoresView })), { loading: () => <PageSkeleton /> })
const UsersView = dynamic(() => import('@/components/modules/users-view').then(m => ({ default: m.UsersView })), { loading: () => <PageSkeleton /> })
const VisitsView = dynamic(() => import('@/components/modules/visits-view').then(m => ({ default: m.VisitsView })), { loading: () => <PageSkeleton /> })
const ImportView = dynamic(() => import('@/components/modules/import-view').then(m => ({ default: m.ImportView })), { loading: () => <PageSkeleton /> })
const ExportView = dynamic(() => import('@/components/modules/export-view').then(m => ({ default: m.ExportView })), { loading: () => <PageSkeleton /> })
const AnalyticsView = dynamic(() => import('@/components/modules/analytics-view').then(m => ({ default: m.AnalyticsView })), { loading: () => <PageSkeleton /> })
const ActivityLogsView = dynamic(() => import('@/components/modules/activity-logs-view').then(m => ({ default: m.ActivityLogsView })), { loading: () => <PageSkeleton /> })
const NotificationsView = dynamic(() => import('@/components/modules/notifications-view').then(m => ({ default: m.NotificationsView })), { loading: () => <PageSkeleton /> })

const VIEW_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', 'daily-schedule': 'Daily Schedule Task', schedules: 'Schedules', sites: 'Sites', stores: 'Stores',
  visits: 'Visits', users: 'Users', import: 'Import Excel', export: 'Export Data',
  analytics: 'Analytics', 'activity-logs': 'Activity Logs', notifications: 'Notifications',
}

export default function Home() {
  const { user, token, isAuthenticated, mustChangePassword, logout, setCurrentView, currentView } = useAuthStore()

  const initialized = useRef(false)
  useEffect(() => {
    if (isAuthenticated && user && !initialized.current) {
      initialized.current = true
      if (currentView === 'dashboard') {
        setCurrentView(getRoleView(user.role))
      }
      fetch('/api/auth/verify', { method: 'POST', headers: { authorization: `Bearer ${token}` } }).then(r => {
        if (!r.ok) logout()
      }).catch(() => {})
    }
  }, [isAuthenticated, user])

  if (!isAuthenticated) {
    return <LoginPage />
  }

  if (!user) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='flex flex-col items-center gap-3'><div className='h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent' /><p className='text-sm text-muted-foreground'>Loading...</p></div>
      </div>
    )
  }

  // Force password change before accessing the app
  if (mustChangePassword) {
    return <ChangePasswordDialog />
  }

  const roleDashboard = getRoleView(user.role)

  const renderView = () => {
    // Always enforce role-appropriate dashboard
    if (currentView === 'dashboard' || currentView === 'admin-dashboard' || currentView === 'manager-dashboard' || currentView === 'engineer-dashboard') {
      if (user.role === 'ADMIN') return <AdminDashboard />
      if (user.role === 'MANAGER') return <ManagerDashboard />
      return <EngineerDashboard />
    }

    switch (currentView) {
      case 'daily-schedule': return <DailyScheduleView />
      case 'schedules': return <SchedulesView />
      case 'sites': return <SitesView />
      case 'stores': return <StoresView />
      case 'users': return user.role === 'ENGINEER' ? null : <UsersView />
      case 'visits': return <VisitsView />
      case 'import': return (user.role === 'ADMIN' || user.role === 'MANAGER') ? <ImportView /> : null
      case 'export': return <ExportView />
      case 'analytics': return (user.role === 'ADMIN' || user.role === 'MANAGER') ? <AnalyticsView /> : null
      case 'activity-logs': return user.role === 'ADMIN' ? <ActivityLogsView /> : null
      case 'notifications': return <NotificationsView />
      default: return user.role === 'ADMIN' ? <AdminDashboard /> : user.role === 'MANAGER' ? <ManagerDashboard /> : <EngineerDashboard />
    }
  }

  const breadcrumbLabel = VIEW_LABELS[currentView] || 'Dashboard'

  return (
    <div className='flex h-screen overflow-hidden bg-background'>
      <Sidebar />
      <div className='flex flex-col flex-1 min-w-0'>
        <Header />
        <main className='flex-1 overflow-y-auto p-4 md:p-6 flex flex-col'>
          <Breadcrumb className='mb-4'>
            <BreadcrumbList>
              <BreadcrumbItem><BreadcrumbLink onClick={() => setCurrentView(getRoleView(user.role))} className='cursor-pointer'>Home</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>{breadcrumbLabel}</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          {renderView()}
          <footer className='mt-auto pt-6 pb-4 text-center text-xs text-muted-foreground border-t border-border'>
            FEMS - Field Engineer Schedule Management System • v2.0
          </footer>
        </main>
      </div>
    </div>
  )
}

function PageSkeleton() {
  return <div className='space-y-4'><Skeleton className='h-8 w-48' /><Skeleton className='h-64 w-full' /><Skeleton className='h-64 w-full' /></div>
}
