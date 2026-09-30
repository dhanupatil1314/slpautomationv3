import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { auditLog } from '@/lib/audit'

// GET /api/playlists/[id] — playlist with ordered items and media info
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'playlists.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const playlist = await db.playlist.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { order: 'asc' },
        include: {
          media: {
            select: {
              id: true, name: true, type: true, format: true, durationSec: true,
              resolution: true, approvalStatus: true, thumbnailUrl: true,
            },
          },
        },
      },
      campaigns: { select: { id: true, name: true, status: true }, take: 20 },
    },
  })
  if (!playlist) return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
  return NextResponse.json({ playlist })
}

// PATCH /api/playlists/[id] — update playlist fields OR reorder/replace items
// Body shapes:
//   { name?, description?, city?, zone?, priority?, status? }   — update meta
//   { reorder: [{id, order}, ...] }                              — bulk reorder existing items
//   { itemUpdate: { id, durationSec?, frequency? } }            — update single item attrs
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'playlists.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()

  // Reorder mode
  if (Array.isArray(body.reorder)) {
    await db.$transaction(
      body.reorder.map((r: { id: string; order: number }) =>
        db.playlistItem.update({ where: { id: r.id, playlistId: id }, data: { order: Number(r.order) } })
      )
    )
    await auditLog({ user, action: 'playlist_reorder', entity: 'playlist', entityId: id, details: `Reordered ${body.reorder.length} items` })
    const refreshed = await db.playlist.findUnique({ where: { id }, include: { items: { orderBy: { order: 'asc' }, include: { media: true } } } })
    return NextResponse.json({ playlist: refreshed })
  }

  // Single item attr update
  if (body.itemUpdate && body.itemUpdate.id) {
    const iu = body.itemUpdate
    const data: any = {}
    if (iu.durationSec !== undefined) data.durationSec = Number(iu.durationSec)
    if (iu.frequency !== undefined) data.frequency = Number(iu.frequency)
    const item = await db.playlistItem.update({ where: { id: iu.id, playlistId: id }, data })
    // Recompute total duration
    const items = await db.playlistItem.findMany({ where: { playlistId: id }, select: { durationSec: true, frequency: true } })
    const total = items.reduce((s, it) => s + (it.durationSec * it.frequency), 0)
    await db.playlist.update({ where: { id }, data: { totalDuration: total } })
    return NextResponse.json({ item, totalDuration: total })
  }

  // Meta update
  const allowed = ['name', 'description', 'city', 'zone', 'priority', 'status']
  const data: any = {}
  for (const k of allowed) {
    if (body[k] !== undefined) {
      data[k] = k === 'priority' ? Number(body[k]) : body[k]
    }
  }
  const playlist = await db.playlist.update({ where: { id }, data })
  await auditLog({ user, action: 'playlist_update', entity: 'playlist', entityId: id, details: `Updated playlist "${playlist.name}"` })
  return NextResponse.json({ playlist })
}

// POST /api/playlists/[id] — manage items
//   { action: 'add',    mediaId, durationSec?, frequency?, order? }
//   { action: 'remove', itemId }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'playlists.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { action } = body

  if (action === 'add') {
    const { mediaId, durationSec, frequency, order } = body
    if (!mediaId) return NextResponse.json({ error: 'mediaId is required' }, { status: 400 })
    const media = await db.media.findUnique({ where: { id: mediaId } })
    if (!media) return NextResponse.json({ error: 'Media not found' }, { status: 404 })

    // Determine next order index
    let nextOrder = order !== undefined ? Number(order) : 0
    if (order === undefined) {
      const last = await db.playlistItem.findFirst({ where: { playlistId: id }, orderBy: { order: 'desc' }, select: { order: true } })
      nextOrder = (last?.order ?? -1) + 1
    }

    const item = await db.playlistItem.create({
      data: {
        playlistId: id,
        mediaId,
        order: nextOrder,
        durationSec: Number(durationSec) || media.durationSec || 15,
        frequency: Number(frequency) || 1,
      },
      include: { media: true },
    })

    // Bump usage count + recompute total duration
    await db.media.update({ where: { id: mediaId }, data: { usageCount: { increment: 1 } } })
    const items = await db.playlistItem.findMany({ where: { playlistId: id }, select: { durationSec: true, frequency: true } })
    const total = items.reduce((s, it) => s + (it.durationSec * it.frequency), 0)
    await db.playlist.update({ where: { id }, data: { totalDuration: total } })

    await auditLog({ user, action: 'playlist_item_add', entity: 'playlist', entityId: id, details: `Added media "${media.name}" to playlist` })
    return NextResponse.json({ item, totalDuration: total }, { status: 201 })
  }

  if (action === 'remove') {
    const { itemId } = body
    if (!itemId) return NextResponse.json({ error: 'itemId is required' }, { status: 400 })
    const item = await db.playlistItem.findUnique({ where: { id: itemId }, include: { media: true } })
    if (!item || item.playlistId !== id) return NextResponse.json({ error: 'Item not found in this playlist' }, { status: 404 })

    await db.playlistItem.delete({ where: { id: itemId } })
    if (item.media) {
      await db.media.update({ where: { id: item.mediaId }, data: { usageCount: { decrement: 1 } } }).catch(() => {})
    }
    const items = await db.playlistItem.findMany({ where: { playlistId: id }, select: { durationSec: true, frequency: true } })
    const total = items.reduce((s, it) => s + (it.durationSec * it.frequency), 0)
    await db.playlist.update({ where: { id }, data: { totalDuration: total } })

    await auditLog({ user, action: 'playlist_item_remove', entity: 'playlist', entityId: id, details: `Removed media "${item.media?.name || itemId}" from playlist` })
    return NextResponse.json({ success: true, totalDuration: total })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// DELETE /api/playlists/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'playlists.delete')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const playlist = await db.playlist.delete({ where: { id } })
  await auditLog({ user, action: 'playlist_delete', entity: 'playlist', entityId: id, details: `Deleted playlist "${playlist.name}"` })
  return NextResponse.json({ success: true })
}
