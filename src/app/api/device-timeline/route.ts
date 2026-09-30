import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

// GET /api/device-timeline?deviceId=id&limit=50
// Returns a unified timeline of all device events: heartbeats, commands, playback, alerts, service
// Sorted chronologically (most recent first)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user.role, 'devices.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const deviceId = searchParams.get('deviceId')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

  if (!deviceId) return NextResponse.json({ error: 'deviceId required' }, { status: 400 })

  // Fetch events from multiple sources in parallel
  const [heartbeats, commands, playback, alerts, serviceTickets] = await Promise.all([
    db.deviceHeartbeat.findMany({
      where: { deviceId },
      orderBy: { timestamp: 'desc' },
      take: Math.floor(limit * 0.3),
      select: { id: true, timestamp: true, signalStrength: true, temperature: true, storageUsage: true, ramUsage: true, networkType: true, appStatus: true },
    }),
    db.deviceCommand.findMany({
      where: { deviceId },
      orderBy: { createdAt: 'desc' },
      take: Math.floor(limit * 0.2),
      include: { issuedBy: { select: { name: true } } },
    }),
    db.playbackEvent.findMany({
      where: { deviceId },
      orderBy: { timestamp: 'desc' },
      take: Math.floor(limit * 0.3),
      include: {
        campaign: { select: { name: true } },
        media: { select: { name: true, type: true } },
      },
    }),
    db.alert.findMany({
      where: { deviceId },
      orderBy: { createdAt: 'desc' },
      take: Math.floor(limit * 0.1),
    }),
    db.serviceTicket.findMany({
      where: { deviceId },
      orderBy: { createdAt: 'desc' },
      take: Math.floor(limit * 0.1),
      select: { id: true, ticketId: true, problem: true, status: true, priority: true, createdAt: true, resolvedAt: true },
    }),
  ])

  // Normalize into unified timeline
  const timeline: any[] = []

  for (const h of heartbeats) {
    timeline.push({
      id: h.id,
      type: 'heartbeat',
      timestamp: h.timestamp,
      title: 'Heartbeat received',
      description: `Signal: ${h.signalStrength}% · Temp: ${h.temperature}°C · Storage: ${h.storageUsage}% · RAM: ${h.ramUsage}%`,
      status: h.appStatus,
      icon: 'activity',
      color: 'info',
    })
  }

  for (const c of commands) {
    timeline.push({
      id: c.id,
      type: 'command',
      timestamp: c.createdAt,
      title: `Command: ${c.command}`,
      description: c.result || `Status: ${c.status}`,
      status: c.status,
      issuedBy: c.issuedBy?.name || 'System',
      icon: 'terminal',
      color: c.status === 'completed' ? 'success' : c.status === 'failed' ? 'destructive' : 'warning',
    })
  }

  for (const p of playback) {
    timeline.push({
      id: p.id,
      type: 'playback',
      timestamp: p.timestamp,
      title: `Played: ${p.campaign?.name || 'Unknown'}`,
      description: `${p.media?.name || 'Creative'} · ${p.durationSec}s · ${p.completionPct}% complete`,
      status: p.status,
      icon: 'play',
      color: p.status === 'completed' ? 'success' : p.status === 'failed' ? 'destructive' : 'warning',
    })
  }

  for (const a of alerts) {
    timeline.push({
      id: a.id,
      type: 'alert',
      timestamp: a.createdAt,
      title: `Alert: ${a.type.replace(/_/g, ' ')}`,
      description: a.message,
      status: a.severity,
      acknowledged: a.acknowledged,
      icon: 'alert',
      color: a.severity === 'critical' ? 'destructive' : 'warning',
    })
  }

  for (const t of serviceTickets) {
    timeline.push({
      id: t.id,
      type: 'service',
      timestamp: t.createdAt,
      title: `Service ticket: ${t.ticketId}`,
      description: t.problem,
      status: t.status,
      priority: t.priority,
      resolvedAt: t.resolvedAt,
      icon: 'wrench',
      color: t.priority === 'critical' ? 'destructive' : t.priority === 'high' ? 'warning' : 'info',
    })
  }

  // Sort by timestamp descending and limit
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const limited = timeline.slice(0, limit)

  // Summary stats
  const summary = {
    total: timeline.length,
    heartbeats: heartbeats.length,
    commands: commands.length,
    playback: playback.length,
    alerts: alerts.length,
    service: serviceTickets.length,
  }

  return NextResponse.json({ timeline: limited, summary })
}
