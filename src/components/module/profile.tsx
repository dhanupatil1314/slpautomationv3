'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/store'
import { useFetch, mutate } from '@/hooks/use-fetch'
import { PageHeader, StatusBadge, ErrorState } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Shield, Lock, KeyRound, History, Mail, Phone, Building2, CalendarClock,
  CheckCircle2, XCircle, Smartphone, Globe, Eye, EyeOff, Fingerprint, Clock,
} from 'lucide-react'
import { ROLE_LABELS } from '@/lib/rbac'
import { formatDateTime, timeAgo } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function ProfileView() {
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [loading, setLoading] = useState(false)
  const { data: loginData, loading: loginLoading } = useFetch<any>('/api/profile/login-activity')

  const initials = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      return toast.error('All fields are required')
    }
    if (newPassword !== confirmPassword) {
      return toast.error('New passwords do not match')
    }
    if (newPassword.length < 8) {
      return toast.error('Password must be at least 8 characters')
    }
    setLoading(true)
    try {
      await mutate('/api/profile/password', 'POST', { currentPassword, newPassword })
      toast.success('Password updated successfully')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch (e: any) {
      toast.error(e.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  const passwordStrength = (() => {
    if (!newPassword) return { score: 0, label: '', color: '' }
    let score = 0
    if (newPassword.length >= 8) score++
    if (newPassword.length >= 12) score++
    if (/[A-Z]/.test(newPassword)) score++
    if (/[0-9]/.test(newPassword)) score++
    if (/[^A-Za-z0-9]/.test(newPassword)) score++
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong']
    const colors = ['bg-destructive', 'bg-destructive', 'bg-warning', 'bg-warning', 'bg-success', 'bg-success']
    return { score, label: labels[score], color: colors[score] }
  })()

  const activities = loginData?.activities || []

  return (
    <div>
      <PageHeader
        title="Profile & Security"
        subtitle="Manage your account, password, and view login activity"
        breadcrumbs={[{ label: 'Administration' }, { label: 'Profile' }]}
      />

      {/* Profile card */}
      <Card className="mb-4 overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-primary/80 to-primary" />
        <CardContent className="p-6 pt-0 -mt-10">
          <div className="flex items-end gap-4">
            <Avatar className="h-20 w-20 border-4 border-background shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 pb-2">
              <h2 className="text-xl font-bold">{user?.name}</h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <Badge variant="default" className="mb-2">{ROLE_LABELS[user?.role || ''] || user?.role}</Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="security">
        <TabsList className="mb-4">
          <TabsTrigger value="security" className="gap-1.5"><Shield className="h-4 w-4" /> Security</TabsTrigger>
          <TabsTrigger value="info" className="gap-1.5"><Fingerprint className="h-4 w-4" /> Account Info</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5"><History className="h-4 w-4" /> Login Activity</TabsTrigger>
        </TabsList>

        {/* Security tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4" /> Change Password</CardTitle>
              <CardDescription>Update your password regularly to keep your account secure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-1.5">
                <Label htmlFor="current">Current Password</Label>
                <div className="relative">
                  <Input
                    id="current"
                    type={showPasswords ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new">New Password</Label>
                <Input
                  id="new"
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
                {newPassword && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn('h-full transition-all', passwordStrength.color)} style={{ width: `${(passwordStrength.score / 5) * 100}%` }} />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground w-20">{passwordStrength.label}</span>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm New Password</Label>
                <Input
                  id="confirm"
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1"><XCircle className="h-3 w-3" /> Passwords do not match</p>
                )}
                {confirmPassword && newPassword === confirmPassword && newPassword.length >= 8 && (
                  <p className="text-xs text-success flex items-center gap-1 mt-1"><CheckCircle2 className="h-3 w-3" /> Passwords match</p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setShowPasswords(!showPasswords)} className="gap-1.5">
                  {showPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showPasswords ? 'Hide' : 'Show'} passwords
                </Button>
                <Button onClick={handleChangePassword} disabled={loading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}>
                  {loading ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" /> Security Checklist</CardTitle>
              <CardDescription>Recommendations to improve your account security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: 'Strong password (8+ characters)', done: true },
                { label: 'Two-factor authentication', done: false, badge: '2FA Ready' },
                { label: 'Login activity monitoring', done: true },
                { label: 'Session timeout (7 days)', done: true },
                { label: 'Audit trail enabled', done: true },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-md border">
                  {item.done ? (
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-sm flex-1">{item.label}</span>
                  {item.badge && <Badge variant="outline" className="text-[10px]">{item.badge}</Badge>}
                  <StatusBadge status={item.done ? 'active' : 'pending'} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Info tab */}
        <TabsContent value="info" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Account Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow icon={Mail} label="Email" value={user?.email} />
                <InfoRow icon={Phone} label="Phone" value={user?.phone || 'Not set'} />
                <InfoRow icon={Building2} label="Organization" value={user?.organizationId || 'N/A'} />
                <InfoRow icon={Shield} label="Role" value={ROLE_LABELS[user?.role || ''] || user?.role} />
                <InfoRow icon={CalendarClock} label="Last Login" value={user?.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Permissions Summary</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">Your role grants access to specific modules and actions.</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">{ROLE_LABELS[user?.role || '']}</Badge>
                  <Badge variant="outline" className="text-[10px]">Full dashboard access</Badge>
                  <Badge variant="outline" className="text-[10px]">Audit logging</Badge>
                  <Badge variant="outline" className="text-[10px]">Session management</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Login Activity tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Recent Login Activity</CardTitle>
              <CardDescription>Last 20 login attempts for your account</CardDescription>
            </CardHeader>
            <CardContent>
              {loginLoading ? (
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />)}</div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No login activity recorded
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-1">
                    {activities.map((a: any) => (
                      <div key={a.id} className="flex items-center gap-3 p-3 rounded-md border hover:bg-accent/50 transition-colors">
                        <div className={cn('grid place-items-center h-8 w-8 rounded-md shrink-0', a.success ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
                          {a.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{a.success ? 'Login successful' : 'Login failed'}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{a.ip || 'Unknown IP'}</span>
                            {a.userAgent && <span className="flex items-center gap-1 truncate"><Smartphone className="h-3 w-3" />{a.userAgent.slice(0, 40)}</span>}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                          <Clock className="h-3 w-3" />{timeAgo(a.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground flex items-center gap-2"><Icon className="h-3.5 w-3.5" />{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}
