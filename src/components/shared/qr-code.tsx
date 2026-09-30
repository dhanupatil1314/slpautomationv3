'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { cn } from '@/lib/utils'

// LakhirAd QR code component — renders a QR code as SVG from a URL string
// Used for campaign QR codes (website, WhatsApp, offer, app download URLs)
export function QrCode({
  value,
  size = 160,
  className,
  label,
}: {
  value: string
  size?: number
  className?: string
  label?: string
}) {
  const [dataUrl, setDataUrl] = useState<string>('')

  useEffect(() => {
    if (!value) return
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(''))
  }, [value, size])

  if (!value) {
    return (
      <div
        className={cn('grid place-items-center rounded-lg border border-dashed border-border bg-muted/40 text-muted-foreground text-xs', className)}
        style={{ width: size, height: size }}
      >
        No URL
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="rounded-lg border border-border bg-white p-2 shadow-sm">
        {dataUrl ? (
          <img src={dataUrl} alt="QR Code" width={size} height={size} className="block" />
        ) : (
          <div className="grid place-items-center text-muted-foreground text-xs" style={{ width: size, height: size }}>
            Generating...
          </div>
        )}
      </div>
      {label && <span className="text-xs text-muted-foreground text-center max-w-[180px] break-all">{label}</span>}
    </div>
  )
}
