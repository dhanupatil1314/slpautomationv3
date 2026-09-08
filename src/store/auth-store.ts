'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UserRole = 'ADMIN' | 'MANAGER' | 'ENGINEER'

interface User {
  id: string
  engineerCode: string
  name: string
  role: UserRole
  managerId?: string | null
  phone?: string | null
  status: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  mustChangePassword: boolean
  currentView: string
  sidebarOpen: boolean
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  login: (user: User, token: string, mustChangePassword?: boolean) => void
  logout: () => void
  setLoading: (loading: boolean) => void
  setCurrentView: (view: string) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setMustChangePassword: (v: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      mustChangePassword: false,
      currentView: 'dashboard',
      sidebarOpen: true,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      login: (user, token, mustChangePassword = false) => set({ user, token, isAuthenticated: true, isLoading: false, mustChangePassword }),
      logout: () => set({ user: null, token: null, isAuthenticated: false, mustChangePassword: false, currentView: 'dashboard' }),
      setLoading: (isLoading) => set({ isLoading }),
      setCurrentView: (currentView) => set({ currentView }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setMustChangePassword: (mustChangePassword) => set({ mustChangePassword }),
    }),
    {
      name: 'fems-auth',
      partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated, mustChangePassword: state.mustChangePassword, currentView: state.currentView }),
    }
  )
)

export const getRoleView = (role: UserRole): string => {
  switch (role) {
    case 'ADMIN': return 'admin-dashboard'
    case 'MANAGER': return 'manager-dashboard'
    case 'ENGINEER': return 'engineer-dashboard'
    default: return 'dashboard'
  }
}
