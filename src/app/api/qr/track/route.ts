import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/qr/track?m={mediaId}&c={campaignId}&d={deviceId}&u={url}
// Public endpoint — records a QR scan and redirects to the target URL.
// This is the LakhirAd redirect/analytics URL used in campaign QR codes.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mediaId = searchParams.get('m') || null
  const campaignId = searchParams.get('c') || null
  const deviceId = searchParams.get('d') || null
  const url = searchParams.get('u') || ''

  if (!url) {
    return NextResponse.json({ error: 'Missing target URL (u param)' }, { status: 400 })
  }

  // Record the scan event
  try {
    await db.qrScanEvent.create({
      data: {
        mediaId: mediaId || null,
        campaignId: campaignId || null,
        url,
        deviceId: deviceId || null,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    })
  } catch (e) {
    console.error('QR scan tracking failed:', e)
  }

  // Redirect to the actual URL
  return NextResponse.redirect(url, 302)
}
