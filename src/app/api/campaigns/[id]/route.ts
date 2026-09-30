import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/campaigns/[id] — campaign detail with all relations
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'campaigns.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      advertiser: { select: { id: true, contactName: true, contactEmail: true, contactPhone: true, organization: { select: { id: true, name: true } } } },
      playlist: {
        select: {
          id: true, name: true, totalDuration: true,
          items: { orderBy: { order: 'asc' }, include: { media: { select: { id: true, name: true, type: true, format: true, durationSec: true } } } },
        },
      },
      devices: {
        include: {
          device: {
            select: {
              id: true, deviceId: true, status: true, city: { select: { name: true } },
              zone: true, vehicle: { select: { registrationNo: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      schedules: { orderBy: { startDate: 'asc' } },
      approvalHistory: {
        include: { byUser: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      },
      playbackEvents: {
        include: {
          device: { select: { deviceId: true, city: { select: { name: true } } } },
          media: { select: { name: true } },
        },
        orderBy: { timestamp: 'desc' },
        take: 15,
      },
      invoices: { select: { id: true, invoiceNumber: true, totalAmount: true, status: true, dueDate: true }, take: 5 },
    },
  })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  // Aggregate playback stats
  const playbackAgg = await db.playbackEvent.aggregate({
    where: { campaignId: id },
    _count: { _all: true },
    _sum: { completionPct: true },
  })
  const statusAgg = await db.playbackEvent.groupBy({
    by: ['status'],
    where: { campaignId: id },
    _count: { _all: true },
  })
  const statusCounts: Record<string, number> = {}
  for (const s of statusAgg) statusCounts[s.status] = s._count._all

  return NextResponse.json({
    campaign: {
      ...campaign,
      playbackStats: {
        total: playbackAgg._count._all,
        avgCompletion: playbackAgg._count._all > 0 ? (playbackAgg._sum.completionPct || 0) / playbackAgg._count._all : 0,
        statusCounts,
      },
    },
  })
}

// PATCH /api/campaigns/[id] — update campaign fields
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'campaigns.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()

  const allowed = [
    'name', 'priority', 'startDate', 'endDate', 'startTime', 'endTime',
    'daysOfWeek', 'frequencyPerHour', 'budget', 'priceQuoted', 'amountPaid',
    'targetCities', 'targetZones', 'targetDeviceCount', 'playlistId',
  ]
  const data: any = {}
  for (const k of allowed) {
    if (body[k] !== undefined) {
      if (['startDate', 'endDate'].includes(k)) {
        data[k] = body[k] ? new Date(body[k]) : null
      } else if (['priority', 'frequencyPerHour', 'targetDeviceCount'].includes(k)) {
        data[k] = Number(body[k])
      } else if (['budget', 'priceQuoted', 'amountPaid'].includes(k)) {
        data[k] = Number(body[k])
      } else {
        data[k] = body[k]
      }
    }
  }

  const campaign = await db.campaign.update({ where: { id }, data })
  await auditLog({ user, action: 'campaign_update', entity: 'campaign', entityId: id, details: `Updated campaign "${campaign.name}"` })
  return NextResponse.json({ campaign })
}

// POST /api/campaigns/[id] — state-machine actions + device management
//   { action: 'submit' | 'approve' | 'reject' | 'publish' | 'pause' | 'complete' | 'cancel', reason? }
//   { action: 'add_device', deviceId }
//   { action: 'remove_device', deviceId }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { action } = body

  const campaign = await db.campaign.findUnique({ where: { id } })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  // Device management actions (require campaigns.edit)
  if (action === 'add_device' || action === 'remove_device') {
    if (!hasPermission(user.role, 'campaigns.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { deviceId } = body
    if (!deviceId) return NextResponse.json({ error: 'deviceId is required' }, { status: 400 })

    if (action === 'add_device') {
      await db.campaignDevice.create({ data: { campaignId: id, deviceId, status: 'selected' } }).catch(() => {})
      await auditLog({ user, action: 'campaign_device_add', entity: 'campaign', entityId: id, details: `Assigned device ${deviceId}` })
      return NextResponse.json({ success: true })
    } else {
      await db.campaignDevice.deleteMany({ where: { campaignId: id, deviceId } })
      await auditLog({ user, action: 'campaign_device_remove', entity: 'campaign', entityId: id, details: `Removed device ${deviceId}` })
      return NextResponse.json({ success: true })
    }
  }

  // Status transition map
  const TRANSITIONS: Record<string, { next: string; perm: string; log: string }> = {
    submit:    { next: 'submitted',     perm: 'campaigns.edit',    log: 'submitted for approval' },
    approve:   { next: 'approved',      perm: 'campaigns.approve', log: 'approved' },
    reject:    { next: 'rejected',      perm: 'campaigns.approve', log: 'rejected' },
    publish:   { next: 'live',          perm: 'campaigns.publish', log: 'published (now live)' },
    pause:     { next: 'paused',        perm: 'campaigns.publish', log: 'paused' },
    complete:  { next: 'completed',     perm: 'campaigns.publish', log: 'marked as completed' },
    cancel:    { next: 'cancelled',     perm: 'campaigns.edit',    log: 'cancelled' },
    reopen:    { next: 'draft',         perm: 'campaigns.edit',    log: 'reopened as draft' },
  }

  const t = TRANSITIONS[action]
  if (!t) return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  if (!hasPermission(user.role, t.perm)) return NextResponse.json({ error: 'Forbidden — missing ' + t.perm }, { status: 403 })

  const updated = await db.campaign.update({
    where: { id },
    data: {
      status: t.next,
      rejectionReason: action === 'reject' ? (body.reason || 'Rejected by reviewer') : null,
    },
  })

  await db.campaignApprovalHistory.create({
    data: {
      campaignId: id,
      action,
      byUserId: user.id,
      note: body.reason || t.log,
    },
  })

  await auditLog({
    user,
    action: `campaign_${action}`,
    entity: 'campaign',
    entityId: id,
    details: `Campaign "${campaign.name}" ${t.log}${body.reason ? ` — reason: ${body.reason}` : ''}`,
  })

  return NextResponse.json({ campaign: updated })
}

// DELETE /api/campaigns/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'campaigns.delete')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const campaign = await db.campaign.delete({ where: { id } })
  await auditLog({ user, action: 'campaign_delete', entity: 'campaign', entityId: id, details: `Deleted campaign "${campaign.name}"` })
  return NextResponse.json({ success: true })
}
