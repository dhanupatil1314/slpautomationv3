'use client'

import { useAuthStore } from '@/store/auth-store'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Menu, Sun, Moon, Bell, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

export function Header() {
  const { user, toggleSidebar, sidebarOpen, setCurrentView } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const { data: notifData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => fetch('/api/notifications', { headers: { authorization: `Bearer ${useAuthStore.getState().token}` } }).then(r => r.json()),
    enabled: !!user,
    refetchInterval: 30000,
  })

  const unreadCount = notifData?.unreadCount || 0

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      setCurrentView('schedules')
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('globalSearch', { detail: searchQuery }))
      }, 100)
      setSearchOpen(false)
      setSearchQuery('')
    }
  }

  if (!user) return null

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)

  return (
    <header className='sticky top-0 z-30 h-14 bg-card/80 backdrop-blur-md border-b border-border flex items-center px-4 gap-3 shrink-0'>
      <Button variant='ghost' size='icon' className='md:hidden h-9 w-9' onClick={toggleSidebar}>
        <Menu className='h-5 w-5' />
      </Button>
      <Button variant='ghost' size='icon' className='hidden md:flex h-9 w-9' onClick={toggleSidebar}>
        {sidebarOpen ? null : <Menu className='h-5 w-5' />}
      </Button>

      <div className='flex-1 flex items-center justify-end gap-2'>
        {/* Global Search */}
        <AnimatePresence>
          {searchOpen ? (
            <motion.form initial={{ width: 0, opacity: 0 }} animate={{ width: 300, opacity: 1 }} exit={{ width: 0, opacity: 0 }} onSubmit={handleGlobalSearch} className='overflow-hidden'>
              <Input
                placeholder='Search schedules, sites, engineers...'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className='h-9'
                autoFocus
                onBlur={() => { if (!searchQuery) setSearchOpen(false) }}
                onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery('') } }}
              />
            </motion.form>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Button variant='ghost' size='icon' className='h-9 w-9' onClick={() => setSearchOpen(true)}>
                <Search className='h-4 w-4' />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Theme Toggle */}
        <Button variant='ghost' size='icon' className='h-9 w-9' onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          <Sun className='h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0' />
          <Moon className='absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100' />
        </Button>

        {/* Notifications */}
        <Button variant='ghost' size='icon' className='h-9 w-9 relative' onClick={() => setCurrentView('notifications')}>
          <Bell className='h-4 w-4' />
          {unreadCount > 0 && (
            <span className='absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold'>{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' className='h-9 px-2 gap-2'>
              <Avatar className='h-7 w-7'>
                <AvatarFallback className='text-xs font-semibold'>{initials}</AvatarFallback>
              </Avatar>
              <div className='hidden sm:flex flex-col items-start'>
                <span className='text-sm font-medium leading-tight'>{user.name}</span>
                <span className='text-[10px] text-muted-foreground leading-tight'>{user.engineerCode}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-56'>
            <DropdownMenuLabel>
              <div className='flex flex-col'>
                <span>{user.name}</span>
                <Badge variant='outline' className='mt-1 w-fit text-[10px]'>{user.role}</Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCurrentView('notifications')} className='cursor-pointer'>
              <Bell className='mr-2 h-4 w-4' /> Notifications {unreadCount > 0 && <Badge className='ml-auto' variant='destructive'>{unreadCount}</Badge>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => useAuthStore.getState().logout()} className='cursor-pointer text-destructive focus:text-destructive'>
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}