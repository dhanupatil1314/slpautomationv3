import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken, JWTPayload } from '@/lib/auth'

export async function auth(req: NextRequest): Promise<{ user: JWTPayload } | NextResponse> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const payload = await verifyAccessToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }
  return { user: payload }
}

export function requireRole(...roles: string[]) {
  return async (req: NextRequest) => {
    const result = await auth(req)
    if (result instanceof NextResponse) return result
    if (!roles.includes(result.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return result
  }
}

export function parseQuery(req: NextRequest): Record<string, string> {
  const params = new URL(req.url).searchParams
  const obj: Record<string, string> = {}
  params.forEach((v, k) => { obj[k] = v })
  return obj
}

export async function logActivity(data: { userId: string; role: string; action: string; entity?: string; entityId?: string; ipAddress?: string; device?: string; previousValue?: string; newValue?: string }) {
  try {
    const { db } = await import('@/lib/db')
    await db.activityLog.create({ data })
  } catch (e) {
    console.error('Failed to log activity:', e)
  }
}
