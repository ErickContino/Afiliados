'use client'

import { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { color, radius, shadow } from '@/lib/design-tokens'
import { Loader2 } from '../icons'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const variantStyle: Record<Variant, CSSProperties> = {
  primary: {
    border: '1px solid rgba(34,197,94,0.25)',
    background: color.brandGradient,
    color: color.textOnBrand,
    boxShadow: shadow.button,
  },
  secondary: {
    border: `1px solid ${color.infoBorder}`,
    background: color.infoBg,
    color: color.textOnBrandMuted,
  },
  ghost: {
    border: '1px solid rgba(148,163,184,0.16)',
    background: 'transparent',
    color: color.textTertiary,
  },
  danger: {
    border: `1px solid ${color.errorBorder}`,
    background: color.errorBg,
    color: color.redText,
  },
}

const sizeStyle: Record<Size, CSSProperties> = {
  md: { padding: '12px 18px', fontSize: '14px', borderRadius: radius.md },
  sm: { padding: '9px 13px', fontSize: '13px', borderRadius: radius.sm },
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  style,
  fullWidth,
  leftIcon,
  ...rest
}: {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
  leftIcon?: ReactNode
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const isDisabled = disabled || loading
  return (
    <button
      {...rest}
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontWeight: 700,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        transition: 'transform 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease',
        width: fullWidth ? '100%' : undefined,
        ...variantStyle[variant],
        ...sizeStyle[size],
        ...style,
      }}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 14 : 16} style={{ animation: 'az-spin 0.8s linear infinite' }} />
      ) : (
        leftIcon
      )}
      {children}
    </button>
  )
}
