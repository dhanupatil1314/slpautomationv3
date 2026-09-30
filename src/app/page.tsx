import { getCurrentUser } from '@/lib/auth'
import { AppShell } from '@/components/app-shell'

// LakhirAd CMS — single user-visible route "/"
// Server component checks session, then renders the client app shell.
// All modules are client-side views managed via Zustand navigation state.
export default async function HomePage() {
  const user = await getCurrentUser()
  return <AppShell serverUser={user} />
}
