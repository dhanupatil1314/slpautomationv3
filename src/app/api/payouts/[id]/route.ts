import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/payouts/[id] — payout detail
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'payouts.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const payout = await db.payout.findUnique({
    where: { id },
    include: {
      driver: { select: { id: true, name: true, mobile: true, email: true, city: true, upiId: true, bankAccount: true, bankIfsc: true, status: true } },
      owner: { select: { id: true, name: true, mobile: true, email: true, city: true, upiId: true, bankAccount: true, bankIfsc: true, status: true, revenueShare: true } },
    },
  })

  if (!payout) return NextResponse.json({ error: 'Payout not found' }, { status: 404 })

  return NextResponse.json({ payout })
}

// PATCH /api/payouts/[id] — update payout status
// body: { action: 'approve' | 'process' | 'mark_paid' | 'mark_failed' | 'reject' }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'payouts.approve')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const { action } = body

  const payout = await db.payout.findUnique({ where: { id } })
  if (!payout) return NextResponse.json({ error: 'Payout not found' }, { status: 404 })

  // State machine transitions
  const transitions: Record<string, { next: string; requires?: string[]; action_name: string }> = {
    approve: { next: 'approved', requires: ['pending', 'under_review'], action_name: 'payout_approve' },
    process: { next: 'processing', requires: ['approved'], action_name: 'payout_process' },
    mark_paid: { next: 'paid', requires: ['processing', 'approved'], action_name: 'payout_mark_paid' },
    mark_failed: { next: 'failed', requires: ['processing', 'approved', 'paid'], action_name: 'payout_mark_failed' },
    reject: { next: 'reversed', requires: ['pending', 'approved', 'processing'], action_name: 'payout_reverse' },
  }

  const transition = transitions[action]
  if (!transition) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  if (transition.requires && !transition.requires.includes(payout.status)) {
    return NextResponse.json({
      error: `Cannot ${action} from status '${payout.status}'. Valid from: ${transition.requires.join(', ')}`,
    }, { status: 400 })
  }

  const updated = await db.payout.update({
    where: { id },
    data: {
      status: transition.next,
      processedAt: ['paid', 'failed', 'reversed'].includes(transition.next) ? new Date() : payout.processedAt,
    },
  })

  await auditLog({
    user,
    action: transition.action_name,
    entity: 'payout',
    entityId: payout.id,
    details: `${payout.payoutRef} → ${transition.next} (₹${payout.amount})`,
  })

  return NextResponse.json({ payout: updated })
}
