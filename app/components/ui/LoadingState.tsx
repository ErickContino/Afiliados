'use client'

import { color } from '@/lib/design-tokens'
import { Loader2 } from '../icons'

export function Spinner({ size = 18 }: { size?: number }) {
  return <Loader2 size={size} style={{ animation: 'az-spin 0.8s linear infinite', color: color.greenSoft }} />
}

export default function LoadingState({
  label = 'Carregando...',
  fullPage = false,
}: {
  label?: string
  fullPage?: boolean
}) {
  const content = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: color.textSecondary, fontSize: '14px' }}>
      <Spinner />
      <span>{label}</span>
    </div>
  )

  if (!fullPage) return content

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: color.bgAppGradient,
      }}
    >
      {content}
    </div>
  )
}
