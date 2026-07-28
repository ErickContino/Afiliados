'use client'

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react'
import { color, radius } from '@/lib/design-tokens'
import { CheckCircle2, XCircle, X } from '../icons'

type ToastType = 'success' | 'error'
type ToastItem = { id: number; type: ToastType; message: string }

const ToastContext = createContext<{
  success: (message: string) => void
  error: (message: string) => void
} | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return ctx
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const push = useCallback((type: ToastType, message: string) => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4500)
  }, [])

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return (
    <ToastContext.Provider
      value={{
        success: (message: string) => push('success', message),
        error: (message: string) => push('error', message),
      }}
    >
      {children}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 1000,
          maxWidth: '360px',
        }}
      >
        {toasts.map((t) => {
          const isSuccess = t.type === 'success'
          const Icon = isSuccess ? CheckCircle2 : XCircle
          return (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '14px 16px',
                borderRadius: radius.md,
                border: `1px solid ${isSuccess ? color.successBorder : color.errorBorder}`,
                background: isSuccess ? 'rgba(9,20,13,0.98)' : 'rgba(24,9,9,0.98)',
                color: isSuccess ? color.greenSofter : color.redText,
                boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                animation: 'az-toast-in 0.2s ease-out',
                fontSize: '14px',
              }}
            >
              <Icon size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ flex: 1 }}>{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.7 }}
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
