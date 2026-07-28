'use client'

import { ReactNode, useState } from 'react'
import { color, radius } from '@/lib/design-tokens'

export default function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className="az-animate-in"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0a0f0c',
            border: `1px solid ${color.cardBorderStrong}`,
            color: color.textPrimary,
            fontSize: '12px',
            lineHeight: 1.4,
            padding: '8px 10px',
            borderRadius: radius.sm,
            width: 'max-content',
            maxWidth: '240px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 50,
          }}
        >
          {content}
        </span>
      )}
    </span>
  )
}
