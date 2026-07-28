'use client'

import { useCallback, useRef, useState } from 'react'
import { color, radius, shadow } from '@/lib/design-tokens'
import Button from './Button'
import { AlertTriangle, ShieldAlert } from '../icons'

type ConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type PendingState = ConfirmOptions & { open: boolean }

/**
 * Substitui window.confirm(): `const ok = await confirm({ title, description }); if (!ok) return`
 */
export function useConfirmDialog() {
  const [state, setState] = useState<PendingState>({ open: false, title: '' })
  const resolver = useRef<(value: boolean) => void>(() => {})

  const confirm = useCallback((options: ConfirmOptions) => {
    setState({ ...options, open: true })
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (result: boolean) => {
    setState((s) => ({ ...s, open: false }))
    resolver.current(result)
  }

  const dialog = state.open ? (
    <ConfirmDialogView
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      danger={state.danger}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  ) : null

  return { confirm, dialog }
}

function ConfirmDialogView({
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmOptions & { onConfirm: () => void; onCancel: () => void }) {
  const Icon = danger ? AlertTriangle : ShieldAlert

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2,6,23,0.7)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px',
      }}
      onClick={onCancel}
    >
      <div
        className="az-animate-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '420px',
          borderRadius: radius.xl,
          border: `1px solid ${danger ? color.errorBorder : color.cardBorderStrong}`,
          background: color.cardBgHeader,
          boxShadow: shadow.cardFeatured,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              flexShrink: 0,
              borderRadius: radius.pill,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: danger ? color.errorBg : color.infoBg,
              border: `1px solid ${danger ? color.errorBorder : color.infoBorder}`,
            }}
          >
            <Icon size={18} color={danger ? color.red : color.brand} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '17px', color: color.textPrimary }}>{title}</h2>
            {description && (
              <p style={{ margin: '6px 0 0', fontSize: '13.5px', color: color.textSecondary, lineHeight: 1.5 }}>
                {description}
              </p>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
