'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

// LakhirAd page transition wrapper — subtle fade + slide on view change
export function PageTransition({ children, viewKey }: { children: ReactNode; viewKey: string }) {
  return (
    <motion.div
      key={viewKey}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  )
}
