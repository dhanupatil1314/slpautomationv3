import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

const GST_RATE = 0.18

// GET /api/billing — invoices list with filters & summary
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'billing.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)
  const status = searchParams.get('status') || ''
  const search = searchParams.get('search') || ''

  const where: any = {}
  if (status) where.status = status
  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search } },
      { campaign: { name: { contains: search } } },
      { advertiser: { contactName: { contains: search } } },
      { advertiser: { organization: { name: { contains: search } } } },
    ]
  }

  const [invoices, total, summaryRaw] = await Promise.all([
    db.invoice.findMany({
      where,
      include: {
        campaign: { select: { id: true, name: true } },
        advertiser: { select: { id: true, contactName: true, organization: { select: { name: true } } } },
        payments: { select: { id: true, amount: true, method: true, provider: true, status: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.invoice.count({ where }),
    db.invoice.groupBy({ by: ['status'], _count: true, _sum: { totalAmount: true } }),
  ])

  const now = new Date()
  const [totalBilledAgg, totalPaidAgg, outstandingAgg, overdueAgg] = await Promise.all([
    db.invoice.aggregate({ _sum: { totalAmount: true } }),
    db.invoice.aggregate({ where: { status: 'paid' }, _sum: { totalAmount: true } }),
    db.invoice.aggregate({ where: { status: { in: ['pending', 'failed'] } }, _sum: { totalAmount: true } }),
    db.invoice.aggregate({
      where: { status: { in: ['pending', 'failed'] }, dueDate: { lt: now } },
      _sum: { totalAmount: true },
    }),
  ])

  return NextResponse.json({
    invoices: invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      campaignId: inv.campaignId,
      campaignName: inv.campaign?.name || '—',
      advertiserId: inv.advertiserId,
      advertiserName: inv.advertiser?.organization?.name || inv.advertiser?.contactName || '—',
      amount: inv.amount,
      gst: inv.gst,
      totalAmount: inv.totalAmount,
      status: inv.status,
      dueDate: inv.dueDate,
      paidAt: inv.paidAt,
      createdAt: inv.createdAt,
      paymentsCount: inv.payments.length,
      paidAmount: inv.payments.filter((p) => p.status === 'success').reduce((a, p) => a + p.amount, 0),
    })),
    total, page, pageSize,
    summary: {
      totalBilled: totalBilledAgg._sum.totalAmount || 0,
      totalPaid: totalPaidAgg._sum.totalAmount || 0,
      outstanding: outstandingAgg._sum.totalAmount || 0,
      overdue: overdueAgg._sum.totalAmount || 0,
    },
  })
}

// POST /api/billing — create invoice
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'billing.create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { campaignId, advertiserId, organizationId, amount, dueDate, note } = body
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 })
  }
  if (!campaignId && !advertiserId) {
    return NextResponse.json({ error: 'Either campaign or advertiser is required' }, { status: 400 })
  }

  // Generate sequential invoice number
  const count = await db.invoice.count()
  const invoiceNumber = `LKD-INV-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`
  const gst = parseFloat((amount * GST_RATE).toFixed(2))
  const totalAmount = parseFloat((amount + gst).toFixed(2))

  // Resolve advertiser / org if only campaign provided
  let advId = advertiserId
  let orgId = organizationId
  if (!advId && campaignId) {
    const camp = await db.campaign.findUnique({ where: { id: campaignId }, select: { advertiserId: true, organizationId: true } })
    advId = camp?.advertiserId
    orgId = orgId || camp?.organizationId
  }

  const invoice = await db.invoice.create({
    data: {
      invoiceNumber,
      campaignId: campaignId || null,
      advertiserId: advId || null,
      organizationId: orgId || null,
      amount: parseFloat(amount),
      gst,
      totalAmount,
      status: 'pending',
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 15 * 86400000),
    },
  })

  await auditLog({
    user,
    action: 'invoice_create',
    entity: 'invoice',
    entityId: invoice.id,
    details: `Invoice ${invoiceNumber} for ₹${totalAmount}`,
  })

  return NextResponse.json({ invoice }, { status: 201 })
}
