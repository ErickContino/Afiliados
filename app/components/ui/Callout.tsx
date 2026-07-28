'use client'

import { ReactNode } from 'react'
import { color, radius } from '@/lib/design-tokens'
import { AlertTriangle, Info, XCircle, CheckCircle2 } from '../icons'

type Variant = 'warning' | 'info' | 'error' | 'success' | 'limit'

const styleByVariant: Record<Variant, { bg: string; border: string; text: string; Icon: typeof Info }> = {
  warning: { bg: color.warningBg, border: color.warningBorder, text: color.amberText, Icon: AlertTriangle },
  info: { bg: color.infoBg, border: color.infoBorder, text: color.greenSofter, Icon: Info },
  limit: { bg: color.limitBg, border: color.limitBorder, text: color.blueText, Icon: Info },
  error: { bg: color.errorBg, border: color.errorBorder, text: color.redText, Icon: XCircle },
  success: { bg: color.successBg, border: color.successBorder, text: color.greenSofter, Icon: CheckCircle2 },
}

export default function Callout({
  variant = 'info',
  title,
  children,
}: {
  variant?: Variant
  title?: string
  children: ReactNode
}) {
  const s = styleByVariant[variant]
  const Icon = s.Icon
  return (
    <div
      className="az-animate-in"
      style={{
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: radius.md,
        padding: '12px 14px',
        color: s.text,
        fontSize: '13px',
        lineHeight: 1.5,
      }}
    >
      <Icon size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
      <div>
        {title && <div style={{ fontWeight: 700, marginBottom: '2px' }}>{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  )
}
