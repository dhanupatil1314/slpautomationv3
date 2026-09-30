import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fems-super-secret-key-change-in-production')
const REFRESH_SECRET = new TextEncoder().encode(process.env.REFRESH_SECRET || 'fems-refresh-secret-key-change-in-production')

export type UserRole = 'ADMIN' | 'MANAGER' | 'ENGINEER'
export type UserStatus = 'ACTIVE' | 'INACTIVE'
export type ScheduleStatus = 'ASSIGNED' | 'PENDING' | 'COMPLETED' | 'HOLD' | 'CANCELLED' | 'RESCHEDULED'
export type VisitStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type NotificationType = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'

export interface JWTPayload {
  userId: string
  engineerCode: string
  name: string
  role: UserRole
  managerId?: string | null
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function generateAccessToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('365d')
    .sign(JWT_SECRET)
}

export async function generateRefreshToken(payload: { userId: string }): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('365d')
    .sign(REFRESH_SECRET)
}

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, REFRESH_SECRET)
    return payload as unknown as { userId: string }
  } catch {
    return null
  }
}

export const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  PENDING: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20',
  ASSIGNED: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20',
  HOLD: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  CANCELLED: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20',
  RESCHEDULED: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20',
}

export const STATUS_DOT_COLORS: Record<string, string> = {
  COMPLETED: 'bg-emerald-500',
  PENDING: 'bg-orange-500',
  ASSIGNED: 'bg-sky-500',
  HOLD: 'bg-yellow-500',
  CANCELLED: 'bg-red-500',
  RESCHEDULED: 'bg-purple-500',
}
