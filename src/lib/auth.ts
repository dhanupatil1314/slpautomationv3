import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'crypto'

// LakhirAd auth — stateless signed-token sessions (HMAC)
// The token encodes {userId, exp} and is signed with a secret.
// This avoids in-memory session stores that don't survive hot reload / multi-instance.

const SESSION_COOKIE = 'lakhirad_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days
const SECRET = process.env.AUTH_SECRET || 'lakhirad-dev-secret-change-in-production'

// Password hashing — sha256 + per-user salt (sufficient for CMS demo; swap to argon2 for production)
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const hash = createHash('sha256').update(salt + password).digest('hex')
  return `sha256$${salt}$${hash}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'sha256') return false
  const [, salt, hash] = parts
  const computed = createHash('sha256').update(salt + password).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'))
  } catch {
    return false
  }
}

export interface SessionUser {
  id: string
  email: string
  name: string
  role: string
  organizationId?: string | null
  avatarUrl?: string | null
}

// Create a signed token: base64(payload).signature
export async function createSession(userId: string): Promise<string> {
  const payload = JSON.stringify({ uid: userId, exp: Date.now() + SESSION_MAX_AGE * 1000 })
  const payloadB64 = Buffer.from(payload).toString('base64url')
  const sig = createHmac('sha256', SECRET).update(payloadB64).digest('hex')
  return `${payloadB64}.${sig}`
}

// Verify and decode a signed token
export async function getSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, sig] = parts
  const expectedSig = createHmac('sha256', SECRET).update(payloadB64).digest('hex')
  if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) return null

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())
    if (payload.exp < Date.now()) return null
    const user = await db.user.findUnique({
      where: { id: payload.uid, deletedAt: null },
      select: { id: true, email: true, name: true, role: true, organizationId: true, avatarUrl: true, status: true },
    })
    if (!user || user.status !== 'active') return null
    const { status, ...rest } = user
    return rest
  } catch {
    return null
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  return getSession(token)
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function getSessionFromRequest(request: Request): Promise<SessionUser | null> {
  const cookieHeader = request.headers.get('cookie') || ''
  const tokenMatch = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))
  const token = tokenMatch?.[1]
  return getSession(token)
}

export { SESSION_COOKIE }
