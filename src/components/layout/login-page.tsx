'use client'

import { useState } from 'react'
import { useAuthStore, getRoleView } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Wrench, Eye, EyeOff, Loader2, KeyRound, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

export function LoginPage() {
  const { login, setMustChangePassword } = useAuthStore()
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code || !password) { toast.error('Please enter both engineer code and password'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engineerCode: code, password }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Login failed'); return }
      if (data.mustChangePassword) {
        setMustChangePassword(true)
      }
      login(data.user, data.token, data.mustChangePassword)
      if (data.mustChangePassword) {
        toast.warning('Please change your default password before continuing.')
      } else {
        toast.success(`Welcome back, ${data.user.name}!`)
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally { setSubmitting(false) }
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4'>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card className='w-full max-w-md shadow-xl border-border/50'>
          <CardHeader className='text-center pb-2'>
            <div className='mx-auto mb-3 flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground'>
              <Wrench className='h-7 w-7' />
            </div>
            <CardTitle className='text-2xl font-bold'>FEMS</CardTitle>
            <CardDescription className='text-sm'>Field Engineer Schedule Management System</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='code'>Engineer Code</Label>
                <Input id='code' placeholder='e.g.PPRR01167804
,ADM001' value={code} onChange={e => setCode(e.target.value)} autoComplete='username' className='h-11' />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='password'>Password</Label>
                <div className='relative'>
                  <Input id='password' type={showPassword ? 'text' : 'password'} placeholder='Enter your password' value={password} onChange={e => setPassword(e.target.value)} autoComplete='current-password' className='h-11 pr-10' />
                  <Button type='button' variant='ghost' size='icon' className='absolute right-0 top-0 h-11 w-11' onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                  </Button>
                </div>
              </div>
              <Button type='submit' className='w-full h-11 font-medium' disabled={submitting}>
                {submitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                Sign In
              </Button>
            </form>
            <div className='mt-6 pt-4 border-t border-border'>
              <p className='text-xs text-muted-foreground mb-2 font-medium'>Made With ❤️ For SLP Engineers.</p>
              <p className='text-xs text-muted-foreground mb-2 font-medium'>Design By Dhananjay & Deepak.</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

export function ChangePasswordDialog() {
  const { token, user, setMustChangePassword, logout } = useAuthStore()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required'); return
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters'); return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match'); return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to change password'); return }
      setMustChangePassword(false)
      toast.success('Password changed successfully!')
    } catch {
      setError('Network error. Please try again.')
    } finally { setSubmitting(false) }
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4'>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card className='w-full max-w-md shadow-xl border-border/50'>
          <CardHeader className='text-center pb-2'>
            <div className='mx-auto mb-3 flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'>
              <ShieldCheck className='h-7 w-7' />
            </div>
            <CardTitle className='text-xl font-bold'>Change Your Password</CardTitle>
            <CardDescription className='text-sm'>
              Welcome, <span className='font-medium text-foreground'>{user?.name}</span>. You must change your default password before accessing the system.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className='space-y-4'>
              {error && (
                <div className='p-3 rounded-lg bg-destructive/10 text-destructive text-sm'>{error}</div>
              )}
              <div className='space-y-2'>
                <Label htmlFor='current'>Current Password</Label>
                <div className='relative'>
                  <Input id='current' type={showCurrent ? 'text' : 'password'} placeholder='Enter current password' value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete='current-password' className='h-11 pr-10' />
                  <Button type='button' variant='ghost' size='icon' className='absolute right-0 top-0 h-11 w-11' onClick={() => setShowCurrent(!showCurrent)}>
                    {showCurrent ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                  </Button>
                </div>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='new'>New Password</Label>
                <div className='relative'>
                  <Input id='new' type={showNew ? 'text' : 'password'} placeholder='Enter new password (min 6 chars)' value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete='new-password' className='h-11 pr-10' />
                  <Button type='button' variant='ghost' size='icon' className='absolute right-0 top-0 h-11 w-11' onClick={() => setShowNew(!showNew)}>
                    {showNew ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                  </Button>
                </div>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='confirm'>Confirm New Password</Label>
                <Input id='confirm' type='password' placeholder='Confirm new password' value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete='new-password' className='h-11' />
              </div>
              <Button type='submit' className='w-full h-11 font-medium' disabled={submitting}>
                {submitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                <KeyRound className='mr-2 h-4 w-4' />
                Update Password
              </Button>
              <Button type='button' variant='ghost' className='w-full h-11 text-muted-foreground' onClick={logout}>
                Sign out and use different account
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
