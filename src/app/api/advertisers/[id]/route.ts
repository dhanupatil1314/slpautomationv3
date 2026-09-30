import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/advertisers/[id] — detail with campaigns, media, invoices
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'advertisers.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const advertiser = await db.advertiser.findUnique({
    where: { id },
    include: {
      organization: true,
      campaigns: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, name: true, status: true, budget: true, startDate: true, endDate: true, targetDeviceCount: true },
      },
      media: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, name: true, type: true, format: true, approvalStatus: true, durationSec: true, createdAt: true },
      },
      invoices: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, invoiceNumber: true, totalAmount: true, status: true, dueDate: true, paidAt: true, createdAt: true },
      },
    },
  })

  if (!advertiser) return NextResponse.json({ error: 'Advertiser not found' }, { status: 404 })

  return NextResponse.json({ advertiser })
}

// PATCH /api/advertisers/[id] — update advertiser
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'advertisers.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const allowed = ['contactName', 'contactPhone', 'contactEmail', 'category', 'billingAddress', 'creditLimit', 'status']
  const data: any = {}
  for (const k of allowed) {
    if (body[k] !== undefined) {
      data[k] = k === 'creditLimit' ? Number(body[k]) : body[k]
    }
  }

  const advertiser = await db.advertiser.update({ where: { id }, data })
  await auditLog({
    user,
    action: 'advertiser_update',
    entity: 'advertiser',
    entityId: id,
    details: `Updated advertiser ${advertiser.contactName} (${Object.keys(data).join(', ') || 'no fields'})`,
  })
  return NextResponse.json({ advertiser })
}
