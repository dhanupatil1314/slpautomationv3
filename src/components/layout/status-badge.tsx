'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { STATUS_COLORS, STATUS_DOT_COLORS } from '@/lib/auth'

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant='outline' className={cn('gap-1.5 font-medium text-xs px-2.5 py-0.5', STATUS_COLORS[status] || '', className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT_COLORS[status] || 'bg-gray-400')} />
      {status}
    </Badge>
  )
}