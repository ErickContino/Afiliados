'use client'

import { CSSProperties, ReactNode } from 'react'
import { color, radius, shadow } from '@/lib/design-tokens'

type CardVariant = 'panel' | 'header' | 'featured' | 'plain'

const base: CSSProperties = {
  borderRadius: radius.xl,
  border: `1px solid ${color.cardBorder}`,
  background: color.cardBg,
  boxShadow: shadow.card,
  padding: '22px 24px',
}

const variantStyle: Record<CardVariant, CSSProperties> = {
  panel: base,
  header: {
    ...base,
    background: color.cardBgHeader,
    boxShadow: shadow.cardHeader,
    padding: '24px 26px',
  },
  featured: {
    ...base,
    border: `1px solid ${color.cardBorderStrong}`,
    background: `radial-gradient(circle at top left, rgba(34,197,94,0.18), transparent 38%), ${color.cardBg}`,
    boxShadow: shadow.cardFeatured,
  },
  plain: {
    borderRadius: radius.lg,
    border: '1px solid rgba(148,163,184,0.12)',
    background: 'rgba(2,6,23,0.4)',
    padding: '18px 20px',
  },
}

export default function Card({
  variant = 'panel',
  children,
  style,
  className,
  as: As = 'div',
}: {
  variant?: CardVariant
  children: ReactNode
  style?: CSSProperties
  className?: string
  as?: 'div' | 'section' | 'aside'
}) {
  return (
    <As className={className} style={{ ...variantStyle[variant], ...style }}>
      {children}
    </As>
  )
}
