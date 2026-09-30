'use client'

import { cn } from '@/lib/utils'

// LakhirAd Sparkline — lightweight inline SVG mini-chart for KPI cards
// No external dependency; renders a smooth area+line from numeric data
export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = '#f97316',
  className,
  filled = true,
}: {
  data: number[]
  width?: number
  height?: number
  color?: string
  className?: string
  filled?: boolean
}) {
  if (!data || data.length === 0) {
    return <div className={cn('inline-block', className)} style={{ width, height }} />
  }

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const step = data.length > 1 ? width / (data.length - 1) : width

  const points = data.map((v, i) => {
    const x = i * step
    const y = height - ((v - min) / range) * (height - 4) - 2
    return [x, y]
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`
  const gradId = `spark-${color.replace('#', '')}`

  return (
    <svg width={width} height={height} className={cn('inline-block overflow-visible', className)} preserveAspectRatio="none">
      {filled && (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradId})`} />
        </>
      )}
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.length > 0 && (
        <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={2} fill={color} />
      )}
    </svg>
  )
}
