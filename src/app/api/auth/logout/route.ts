import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, clearSessionCookie } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

// POST /api/auth/logout
export async function POST(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (user) {
    await auditLog({ user, action: 'logout' })
  }
  await clearSessionCookie()
  return NextResponse.json({ success: true })
}
