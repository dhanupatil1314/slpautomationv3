import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/device/config?deviceId=LKD-0001 — returns device configuration & active campaign manifest
// This is what the player polls to get its playlist, schedule, and settings.
// Download-and-play architecture: player downloads media locally, then plays offline.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const deviceId = searchParams.get('deviceId')
  if (!deviceId) return NextResponse.json({ error: 'deviceId required' }, { status: 400 })

  const device = await db.device.findUnique({
    where: { deviceId },
    include: {
      city: true,
      vehicle: { include: { screen: true } },
      campaignDevices: {
        where: { campaign: { status: 'live' } },
        include: {
          campaign: {
            include: {
              playlist: { include: { items: { include: { media: true } } } },
              advertiser: { select: { contactName: true, organization: { select: { name: true } } } },
            },
          },
        },
      },
    },
  })

  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 })

  // Build campaign manifest
  const activeCampaigns = device.campaignDevices.map((cd) => ({
    campaignId: cd.campaign.id,
    name: cd.campaign.name,
    priority: cd.campaign.priority,
    startDate: cd.campaign.startDate,
    endDate: cd.campaign.endDate,
    startTime: cd.campaign.startTime,
    endTime: cd.campaign.endTime,
    daysOfWeek: cd.campaign.daysOfWeek,
    frequencyPerHour: cd.campaign.frequencyPerHour,
    playlist: cd.campaign.playlist ? {
      id: cd.campaign.playlist.id,
      name: cd.campaign.playlist.name,
      totalDuration: cd.campaign.playlist.totalDuration,
      items: cd.campaign.playlist.items.map((item) => ({
        order: item.order,
        mediaId: item.media.id,
        name: item.media.name,
        fileUrl: item.media.fileUrl,
        thumbnailUrl: item.media.thumbnailUrl,
        type: item.media.type,
        duration: item.durationSec,
        frequency: item.frequency,
      })),
    } : null,
  }))

  // Check for active emergency content overrides
  const emergencyContent = await db.emergencyContent.findMany({
    where: {
      status: 'active',
      expiresAt: { gt: new Date() },
      OR: [
        { targetScope: 'all' },
        { targetScope: 'city', targetCity: device.city?.name },
        { targetScope: 'device', targetDeviceId: device.deviceId },
      ],
    },
    orderBy: { priority: 'asc' },
  })

  return NextResponse.json({
    device: {
      id: device.deviceId,
      status: device.status,
      city: device.city?.name || null,
      zone: device.zone,
      heartbeatInterval: 60,
      offlineThresholdMin: 5,
    },
    screen: device.vehicle?.screen ? {
      model: device.vehicle.screen.model,
      resolution: device.vehicle.screen.resolution,
      orientation: device.vehicle.screen.orientation,
      brightness: device.vehicle.screen.brightness,
    } : null,
    activeCampaigns,
    emergencyOverrides: emergencyContent.map((e) => ({
      id: e.id,
      title: e.title,
      message: e.message,
      priority: e.priority,
      mediaUrl: e.mediaUrl,
      durationMin: e.durationMin,
      expiresAt: e.expiresAt,
    })),
    configVersion: `v${Date.now()}`,
    serverTime: new Date().toISOString(),
  })
}
