import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/invoices/[id] — invoice detail with payment history
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'billing.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      campaign: { select: { id: true, name: true, startDate: true, endDate: true } },
      advertiser: { select: { id: true, contactName: true, contactEmail: true, contactPhone: true, organization: { select: { id: true, name: true, gstin: true, address: true } } } },
      organization: { select: { id: true, name: true, gstin: true, address: true } },
      payments: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  return NextResponse.json({ invoice })
}

// PATCH /api/invoices/[id] — update invoice status, optionally record payment
// body: { action: 'mark_paid' | 'refund' | 'partially_refund', payment?: { amount, method, provider, providerRef } }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'billing.edit')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const { action, payment } = body

  const invoice = await db.invoice.findUnique({ where: { id }, include: { payments: true } })
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const paidSoFar = invoice.payments.filter((p) => p.status === 'success').reduce((a, p) => a + p.amount, 0)

  if (action === 'mark_paid') {
    const payAmount = payment?.amount || (invoice.totalAmount - paidSoFar)
    if (payAmount <= 0) return NextResponse.json({ error: 'Invoice already fully paid' }, { status: 400 })

    // Record payment — provider field is integration-ready (razorpay/manual)
    const newPayment = await db.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: parseFloat(payAmount),
        method: payment?.method || 'manual',
        provider: payment?.provider || 'manual',
        providerRef: payment?.providerRef || null,
        status: 'success',
      },
    })

    const newPaid = paidSoFar + parseFloat(payAmount)
    const newStatus = newPaid >= invoice.totalAmount ? 'paid' : 'partially_refunded'
    const updated = await db.invoice.update({
      where: { id },
      data: {
        status: newPaid >= invoice.totalAmount ? 'paid' : newStatus,
        paidAt: newPaid >= invoice.totalAmount ? new Date() : invoice.paidAt,
      },
    })

    await auditLog({
      user,
      action: 'invoice_mark_paid',
      entity: 'invoice',
      entityId: invoice.id,
      details: `Payment ₹${payAmount} via ${payment?.method || 'manual'} (${payment?.provider || 'manual'})`,
    })
    return NextResponse.json({ invoice: updated, payment: newPayment })
  }

  if (action === 'refund') {
    if (paidSoFar <= 0) return NextResponse.json({ error: 'No payments to refund' }, { status: 400 })
    const refundAmount = payment?.amount || paidSoFar
    await db.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: refundAmount,
        method: payment?.method || 'manual',
        provider: payment?.provider || 'manual',
        providerRef: payment?.providerRef || null,
        status: 'refunded',
      },
    })
    const updated = await db.invoice.update({
      where: { id },
      data: { status: refundAmount >= paidSoFar ? 'refunded' : 'partially_refunded' },
    })
    await auditLog({
      user,
      action: 'invoice_refund',
      entity: 'invoice',
      entityId: invoice.id,
      details: `Refund ₹${refundAmount}`,
    })
    return NextResponse.json({ invoice: updated })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
