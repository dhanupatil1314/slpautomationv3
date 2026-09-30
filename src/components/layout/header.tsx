'use client'

import { useNav, useAuth } from '@/lib/store'
import { ROLE_LABELS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Moon, Sun, Menu, Search, Bell, LogOut, User as UserIcon, Settings as SettingsIcon, ChevronDown, Check, CheckCheck, AlertTriangle, Info, CheckCircle2, AlertCircle } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/format'

// LakhirAd Header — search, notifications dropdown with unread count, theme toggle, user menu
export function Header() {
  const { setMobileNavOpen, setView } = useNav()
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Fetch notifications
  const fetchNotifs = useCallback(async () => {
    try {
      const r = await fetch('/api/notifications?pageSize=10')
      const d = await r.json()
      setNotifications(d.notifications || [])
      setUnreadCount(d.unreadCount || 0)
    } catch {}
  }, [])

  useEffect(() => {
    if (!user) return
    // Defer to avoid synchronous setState in effect
    const id = requestAnimationFrame(() => fetchNotifs())
    const interval = setInterval(fetchNotifs, 30000) // poll every 30s
    return () => { cancelAnimationFrame(id); clearInterval(interval) }
  }, [user, fetchNotifs])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      logout()
      toast.success('Logged out successfully')
    } catch {
      logout()
    }
  }

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    } catch {
      toast.error('Failed to mark notifications as read')
    }
  }

  const markOneRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      })
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch {}
  }

  // Global search
  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return }
    try {
      const [devRes, vehRes, campRes] = await Promise.all([
        fetch(`/api/devices?page=1&pageSize=5&search=${encodeURIComponent(q)}`),
        fetch(`/api/vehicles?page=1&pageSize=5&search=${encodeURIComponent(q)}`),
        fetch(`/api/campaigns?page=1&pageSize=5&search=${encodeURIComponent(q)}`),
      ])
      const [devs, vehs, camps] = await Promise.all([devRes.json(), vehRes.json(), campRes.json()])
      const results = [
        ...(devs.devices || []).map((d: any) => ({ type: 'Device', label: d.deviceId, sub: d.vehicleReg, view: 'device-detail' as const, id: d.id })),
        ...(vehs.vehicles || []).map((v: any) => ({ type: 'Vehicle', label: v.registrationNo, sub: v.driverName, view: 'vehicles' as const, id: v.id })),
        ...(camps.campaigns || []).map((c: any) => ({ type: 'Campaign', label: c.name, sub: c.advertiserName, view: 'campaigns' as const, id: c.id })),
      ].slice(0, 8)
      setSearchResults(results)
    } catch {}
  }, [])

  useEffect(() => {
    const t = setTimeout(() => performSearch(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery, performSearch])

  const initials = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'

  const notifIcon = (type: string) => {
    const map: Record<string, any> = {
      critical: AlertTriangle, success: CheckCircle2, warning: AlertCircle, info: Info,
    }
    const Icon = map[type] || Bell
    const colorMap: Record<string, string> = {
      critical: 'text-destructive bg-destructive/10', success: 'text-success bg-success/10',
      warning: 'text-warning-foreground bg-warning/10', info: 'text-info bg-info/10',
    }
    return <div className={cn('grid place-items-center h-8 w-8 rounded-md shrink-0', colorMap[type] || colorMap.info)}><Icon className="h-4 w-4" /></div>
  }

  return (
    <header className="sticky top-0 z-30 h-16 border-b bg-background/80 backdrop-blur-md flex items-center gap-3 px-4 md:px-6">
      {/* Mobile menu button */}
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileNavOpen(true)}>
        <Menu className="h-5 w-5" />
      </Button>

      {/* Global Search with dropdown */}
      <div className="hidden sm:flex items-center flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true) }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
          placeholder="Search devices, vehicles, campaigns..."
          className="w-full h-9 pl-9 pr-3 rounded-md bg-muted/60 text-sm border border-transparent focus:border-primary focus:bg-background focus:outline-none transition-colors"
        />
        {searchOpen && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 overflow-hidden">
            {searchResults.map((r, i) => (
              <button
                key={i}
                onClick={() => { setView(r.view, r.id); setSearchOpen(false); setSearchQuery('') }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent transition-colors text-left border-b last:border-0"
              >
                <Badge variant="outline" className="text-[10px] uppercase shrink-0">{r.type}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{r.label}</p>
                  {r.sub && <p className="text-xs text-muted-foreground truncate">{r.sub}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 sm:hidden" />

      {/* Right actions */}
      <div className="flex items-center gap-1.5">
        {/* Notifications dropdown */}
        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger asChild>
            <button className="relative grid place-items-center h-9 w-9 rounded-md hover:bg-accent transition-colors" title="Notifications">
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 grid place-items-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 sm:w-96 p-0">
            <div className="flex items-center justify-between p-3 border-b">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">Notifications</h3>
                {unreadCount > 0 && <Badge variant="default" className="text-[10px]">{unreadCount} new</Badge>}
              </div>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <CheckCheck className="h-3 w-3" /> Mark all read
                </button>
              )}
            </div>
            <ScrollArea className="h-80">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No notifications
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => { if (!n.read) markOneRead(n.id); setNotifOpen(false); setView('notifications') }}
                      className={cn('w-full flex items-start gap-3 p-3 hover:bg-accent transition-colors text-left', !n.read && 'bg-primary/5')}
                    >
                      {notifIcon(n.type)}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          {n.title}
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="p-2 border-t">
              <Button variant="ghost" size="sm" className="w-full" onClick={() => { setNotifOpen(false); setView('notifications') }}>
                View all notifications
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme">
          {mounted && theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 h-9 px-1.5 rounded-md hover:bg-accent transition-colors">
              <Avatar className="h-7 w-7 border">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden lg:flex flex-col items-start leading-tight">
                <span className="text-xs font-semibold">{user?.name}</span>
                <span className="text-[10px] text-muted-foreground">{ROLE_LABELS[user?.role || ''] || user?.role}</span>
              </div>
              <ChevronDown className="hidden lg:block h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{user?.name}</span>
                <span className="text-xs text-muted-foreground font-normal">{user?.email}</span>
                <Badge variant="secondary" className="mt-1 w-fit text-[10px]">{ROLE_LABELS[user?.role || ''] || user?.role}</Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setView('profile')}>
              <UserIcon className="mr-2 h-4 w-4" /> Profile & Security
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView('settings')}>
              <SettingsIcon className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-background py-4 px-4 md:px-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">LakhirAd CMS</span>
          <span>·</span>
          <span>Smart Digital Advertising Network</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success pulse-live" />
            All systems operational
          </span>
          <span>·</span>
          <span>v2.4.2</span>
          <span>·</span>
          <span>© 2026 LakhirAd</span>
        </div>
      </div>
    </footer>
  )
}
