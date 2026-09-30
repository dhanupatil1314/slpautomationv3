'use client'

import { useNav, useAuth, type ViewKey } from '@/lib/store'
import { NAV_GROUPS } from '@/lib/nav'
import { hasPermission } from '@/lib/rbac'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

// LakhirAd brand logo
function LakhirAdLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-3 h-16 shrink-0 border-b border-sidebar-border">
      <div className="relative grid place-items-center w-9 h-9 rounded-lg bg-primary text-primary-foreground font-bold shrink-0 shadow-sm">
        <span className="text-lg leading-none">L</span>
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success pulse-live border-2 border-sidebar" />
      </div>
      {!collapsed && (
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-sidebar-foreground text-[15px] tracking-tight">LAKHIRAD</span>
          <span className="text-[10px] text-sidebar-foreground/60 font-medium tracking-wide uppercase">CMS Platform</span>
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const { view, setView, sidebarCollapsed, toggleSidebar } = useNav()
  const { user } = useAuth()
  const role = user?.role

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-[width] duration-200 h-screen sticky top-0 shrink-0',
        sidebarCollapsed ? 'w-[68px]' : 'w-64'
      )}
    >
      <LakhirAdLogo collapsed={sidebarCollapsed} />

      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="space-y-4">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(
              (item) => !item.permission || hasPermission(role, item.permission)
            )
            if (visibleItems.length === 0) return null
            return (
              <div key={group.title}>
                {!sidebarCollapsed && (
                  <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                    {group.title}
                  </p>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon
                    const active = view === item.view || (view === 'device-detail' && item.view === 'devices') || (view === 'campaign-wizard' && item.view === 'campaigns')
                    return (
                      <button
                        key={item.view}
                        onClick={() => setView(item.view)}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors relative group',
                          active
                            ? 'nav-active text-sidebar-accent-foreground'
                            : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                        )}
                      >
                        <Icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-primary')} />
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Collapse toggle */}
      <div className="border-t border-sidebar-border p-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="w-full justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /> Collapse</>}
        </Button>
      </div>
    </aside>
  )
}

// Mobile sidebar (drawer)
export function MobileSidebar() {
  const { mobileNavOpen, setMobileNavOpen, view, setView } = useNav()
  const { user } = useAuth()
  const role = user?.role

  if (!mobileNavOpen) return null

  return (
    <div className="md:hidden fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
      <aside className="relative flex flex-col bg-sidebar text-sidebar-foreground w-72 max-w-[85vw] h-full animate-in slide-in-from-left duration-200">
        <LakhirAdLogo collapsed={false} />
        <ScrollArea className="flex-1 px-2 py-3">
          <nav className="space-y-4">
            {NAV_GROUPS.map((group) => {
              const visibleItems = group.items.filter(
                (item) => !item.permission || hasPermission(role, item.permission)
              )
              if (visibleItems.length === 0) return null
              return (
                <div key={group.title}>
                  <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                    {group.title}
                  </p>
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const Icon = item.icon
                      const active = view === item.view
                      return (
                        <button
                          key={item.view}
                          onClick={() => setView(item.view)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors relative',
                            active
                              ? 'nav-active text-sidebar-accent-foreground'
                              : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                          )}
                        >
                          <Icon className="h-[18px] w-[18px] shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </nav>
        </ScrollArea>
      </aside>
    </div>
  )
}
