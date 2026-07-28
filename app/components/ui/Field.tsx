'use client'

import { CSSProperties, ReactNode } from 'react'
import { color } from '@/lib/design-tokens'

export default function Field({
  label,
  children,
  hint,
  style,
}: {
  label: ReactNode
  children: ReactNode
  hint?: string
  style?: CSSProperties
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', ...style }}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: color.textTertiary }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: '12px', color: color.textSecondary }}>{hint}</span>}
    </label>
  )
}
