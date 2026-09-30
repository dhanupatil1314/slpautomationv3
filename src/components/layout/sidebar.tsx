'use client'

import { useAuthStore } from '@/store/auth-store'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, CalendarDays, MapPin, Building2, Users, Upload, Download,
  BarChart3, History, Bell, LogOut, ClipboardList, CalendarCheck
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { motion, AnimatePresence } from 'framer-motion'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER', 'ENGINEER'] },
  { id: 'daily-schedule', label: 'Daily Schedule Task', icon: CalendarCheck, roles: ['ADMIN', 'MANAGER', 'ENGINEER'] },
  { id: 'schedules', label: 'Schedules', icon: CalendarDays, roles: ['ADMIN', 'MANAGER', 'ENGINEER'] },
  { id: 'sites', label: 'Sites', icon: MapPin, roles: ['ADMIN', 'MANAGER', 'ENGINEER'] },
  { id: 'stores', label: 'Stores', icon: Building2, roles: ['ADMIN', 'MANAGER', 'ENGINEER'] },
  { id: 'visits', label: 'Visits', icon: ClipboardList, roles: ['ADMIN', 'MANAGER', 'ENGINEER'] },
  { id: 'users', label: 'Users', icon: Users, roles: ['ADMIN', 'MANAGER'] },
  { id: 'import', label: 'Import Excel', icon: Upload, roles: ['ADMIN', 'MANAGER'] },
  { id: 'export', label: 'Export Data', icon: Download, roles: ['ADMIN', 'MANAGER', 'ENGINEER'] },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, roles: ['ADMIN', 'MANAGER'] },
  { id: 'activity-logs', label: 'Activity Logs', icon: History, roles: ['ADMIN'] },
  { id: 'notifications', label: 'Notifications', icon: Bell, roles: ['ADMIN', 'MANAGER', 'ENGINEER'] },
]

function SidebarNavContent({ collapsed }: { collapsed: boolean }) {
  const { user, currentView, setCurrentView } = useAuthStore()
  const filteredItems = navItems.filter(item => user?.role && item.roles.includes(user.role))

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center h-14 px-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground text-sm font-bold shrink-0">F</div>
          {!collapsed && <span className="font-semibold text-sm">FEMS</span>}
        </div>
      </div>
      <ScrollArea className="flex-1 py-3 px-2">
        <nav className="flex flex-col gap-1">
          {filteredItems.map(item => {
            const Icon = item.icon
            const isActive = currentView === item.id
            const btn = (
              <Button
                key={item.id}
                variant={isActive ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start gap-3 h-10 px-3 text-sm font-medium transition-all cursor-pointer',
                  isActive && 'bg-accent text-accent-foreground shadow-sm',
                  collapsed && 'justify-center px-2'
                )}
                onClick={() => setCurrentView(item.id)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Button>
            )
            if (collapsed) {
              return (
                <Tooltip key={item.id} delayDuration={0}>
                  <TooltipTrigger asChild>{btn}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
                </Tooltip>
              )
            }
            return btn
          })}
        </nav>
      </ScrollArea>
      <div className="border-t border-border p-2 shrink-0">
        <Button
          variant="ghost"
          className={cn('w-full justify-start gap-3 h-10 px-3 text-sm text-muted-foreground hover:text-destructive cursor-pointer', collapsed && 'justify-center px-2')}
          onClick={() => useAuthStore.getState().logout()}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </Button>
      </div>
    </div>
  )
}

export function Sidebar() {
  const { user, sidebarOpen, toggleSidebar } = useAuthStore()
  if (!user) return null

  return (
    <>
      <aside className={cn('hidden md:flex flex-col h-screen bg-card border-r border-border transition-all duration-300 shrink-0', sidebarOpen ? 'w-60' : 'w-16')}>
        <SidebarNavContent collapsed={!sidebarOpen} />
      </aside>
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black z-40 md:hidden" onClick={toggleSidebar} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed left-0 top-0 z-50 w-64 h-full bg-card border-r border-border md:hidden">
              <SidebarNavContent collapsed={false} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
