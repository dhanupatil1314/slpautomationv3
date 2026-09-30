'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Radio, ShieldCheck, Activity, Megaphone, Wallet } from 'lucide-react'
import { toast } from 'sonner'

const DEMO_USERS = [
  { email: 'admin@lakhirad.com', role: 'Super Admin' },
  { email: 'ops@lakhirad.com', role: 'Operations' },
  { email: 'ads@lakhirad.com', role: 'Ads Manager' },
  { email: 'finance@lakhirad.com', role: 'Finance' },
  { email: 'advertiser@lakhirad.com', role: 'Advertiser' },
  { email: 'driver@lakhirad.com', role: 'Driver' },
]

export function LoginScreen() {
  const { setUser } = useAuth()
  const [email, setEmail] = useState('admin@lakhirad.com')
  const [password, setPassword] = useState('lakhirad123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Login failed')
        return
      }
      setUser(data.user)
      toast.success(`Welcome back, ${data.user.name}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = (demoEmail: string) => {
    setEmail(demoEmail)
    setPassword('lakhirad123')
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left brand panel */}
      <div className="lg:w-1/2 bg-sidebar text-sidebar-foreground p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-12">
            <div className="grid place-items-center w-11 h-11 rounded-xl bg-primary text-primary-foreground font-bold text-xl shadow-lg">
              L
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tight">LAKHIRAD</h1>
              <p className="text-xs text-sidebar-foreground/60 uppercase tracking-wider">CMS Platform</p>
            </div>
          </div>

          <div className="max-w-md">
            <h2 className="text-3xl lg:text-4xl font-bold leading-tight mb-3">
              Smart Digital Advertising Network
            </h2>
            <p className="text-sidebar-foreground/70 text-base leading-relaxed mb-8">
              Enterprise platform for managing IoT-connected DOOH advertising at scale — from auto-rickshaw screens to nationwide signage networks.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Radio, label: '10,000+ Devices', sub: 'Real-time monitoring' },
                { icon: Megaphone, label: 'Campaign Engine', sub: 'Full workflow & approval' },
                { icon: Activity, label: 'Proof of Play', sub: 'Verified playback' },
                { icon: Wallet, label: 'Driver Earnings', sub: 'Configurable payouts' },
              ].map((f) => (
                <div key={f.label} className="flex items-start gap-2.5 p-3 rounded-lg bg-sidebar-accent/40">
                  <f.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">{f.label}</p>
                    <p className="text-xs text-sidebar-foreground/60">{f.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative text-xs text-sidebar-foreground/50 mt-8">
          © 2026 LakhirAd · Smart Digital Advertising Network · India
        </div>
      </div>

      {/* Right login form */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md">
          <Card className="border shadow-lg">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl">Sign in</CardTitle>
              <CardDescription>Enter your credentials to access the LakhirAd CMS</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@lakhirad.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>
              </form>

              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> Demo accounts
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_USERS.map((u) => (
                    <button
                      key={u.email}
                      onClick={() => quickLogin(u.email)}
                      className="text-left px-3 py-2 rounded-md border border-border hover:border-primary hover:bg-accent transition-colors group"
                    >
                      <p className="text-xs font-semibold group-hover:text-primary">{u.role}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-3 text-center">
                  Password for all demo accounts: <code className="font-mono bg-muted px-1.5 py-0.5 rounded">lakhirad123</code>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
