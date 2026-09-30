import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/advertisers — paginated, filterable, searchable advertiser list
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'advertisers.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const category = searchParams.get('category') || ''

  const where: any = {}
  if (search) {
    where.OR = [
      { contactName: { contains: search } },
      { contactEmail: { contains: search } },
      { contactPhone: { contains: search } },
      { organization: { name: { contains: search } } },
    ]
  }
  if (status) where.status = status
  if (category) where.category = category

  const [advertisers, total] = await Promise.all([
    db.advertiser.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true, type: true } },
        _count: { select: { campaigns: true, media: true, invoices: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.advertiser.count({ where }),
  ])

  // Compute total spend per advertiser from paid invoices
  const advertiserIds = advertisers.map((a) => a.id)
  const spendAgg = await db.invoice.groupBy({
    by: ['advertiserId'],
    where: { advertiserId: { in: advertiserIds }, status: 'paid' },
    _sum: { totalAmount: true },
  })
  const spendMap = new Map(spendAgg.map((s) => [s.advertiserId, s._sum.totalAmount || 0]))

  return NextResponse.json({
    advertisers: advertisers.map((a) => ({
      id: a.id,
      organizationId: a.organizationId,
      organizationName: a.organization.name,
      contactName: a.contactName,
      contactPhone: a.contactPhone,
      contactEmail: a.contactEmail,
      category: a.category || '—',
      billingAddress: a.billingAddress,
      creditLimit: a.creditLimit,
      status: a.status,
      campaignCount: a._count.campaigns,
      mediaCount: a._count.media,
      invoiceCount: a._count.invoices,
      totalSpend: spendMap.get(a.id) || 0,
      createdAt: a.createdAt,
    })),
    total, page, pageSize,
  })
}

// POST /api/advertisers — create a new advertiser (and an org if not provided)
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'advertisers.create')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const {
    organizationName, contactName, contactPhone, contactEmail,
    category, billingAddress, creditLimit, status,
  } = body

  if (!contactName || !contactPhone || !contactEmail || !organizationName) {
    return NextResponse.json({ error: 'Organization name, contact name, phone and email are required' }, { status: 400 })
  }

  // Find or create organization
  let org = await db.organization.findFirst({ where: { name: organizationName } })
  if (!org) {
    org = await db.organization.create({
      data: {
        name: organizationName,
        type: 'advertiser',
        email: contactEmail,
        phone: contactPhone,
        address: billingAddress || null,
        status: 'active',
      },
    })
  }

  const advertiser = await db.advertiser.create({
    data: {
      organizationId: org.id,
      contactName, contactPhone, contactEmail,
      category: category || null,
      billingAddress: billingAddress || null,
      creditLimit: Number(creditLimit) || 0,
      status: status || 'active',
    },
  })

  await auditLog({
    user,
    action: 'advertiser_create',
    entity: 'advertiser',
    entityId: advertiser.id,
    details: `Created advertiser ${contactName} (${organizationName})`,
  })

  return NextResponse.json({ advertiser }, { status: 201 })
}
