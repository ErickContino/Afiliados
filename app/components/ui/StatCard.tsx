'use client'

import { ReactNode } from 'react'
import { color, radius, shadow } from '@/lib/design-tokens'

export default function StatCard({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  accent?: boolean
}) {
  return (
    <div
      className="az-animate-in"
      style={{
        borderRadius: radius.lg,
        border: `1px solid ${accent ? color.cardBorderStrong : color.cardBorder}`,
        background: accent
          ? `radial-gradient(circle at top left, rgba(34,197,94,0.16), transparent 45%), ${color.cardBg}`
          : color.cardBg,
        boxShadow: shadow.card,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontSize: '12px',
            fontWeight: 700,
            color: color.greenSoft,
          }}
        >
          {label}
        </span>
        {icon && <span style={{ color: color.greenSoft, opacity: 0.8 }}>{icon}</span>}
      </div>
      <span style={{ fontSize: '28px', fontWeight: 800, color: color.textOnBrand }}>{value}</span>
    </div>
  )
}
