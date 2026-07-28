'use client'

import { color, radius, shadow } from '@/lib/design-tokens'
import { AlertTriangle, ShieldAlert } from '../icons'

type Kind = 'pending' | 'inactive' | 'restricted'

const COPY: Record<Kind, { title: string; defaultDescription: string; tone: 'warning' | 'error' }> = {
  pending: {
    title: 'Cadastro recebido',
    defaultDescription: 'Seu cadastro está aguardando liberação pelo administrador.',
    tone: 'warning',
  },
  inactive: {
    title: 'Conta inativa',
    defaultDescription: 'Sua conta está inativa. Entre em contato com o administrador.',
    tone: 'error',
  },
  restricted: {
    title: 'Acesso restrito',
    defaultDescription: 'Esta tela não está disponível para o seu perfil de acesso.',
    tone: 'error',
  },
}

export default function AccessBlockedState({
  kind,
  description,
  fullPage = false,
}: {
  kind: Kind
  description?: string
  fullPage?: boolean
}) {
  const copy = COPY[kind]
  const Icon = copy.tone === 'warning' ? AlertTriangle : ShieldAlert
  const iconColor = copy.tone === 'warning' ? color.amber : color.red

  const card = (
    <section
      className="az-animate-in"
      style={{
        borderRadius: radius.xxl,
        border: `1px solid ${color.cardBorder}`,
        background: color.cardBg,
        boxShadow: shadow.card,
        padding: '36px 32px',
        maxWidth: '460px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '14px',
      }}
    >
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: radius.pill,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: copy.tone === 'warning' ? color.warningBg : color.errorBg,
          border: `1px solid ${copy.tone === 'warning' ? color.warningBorder : color.errorBorder}`,
        }}
      >
        <Icon size={24} color={iconColor} />
      </div>
      <h1 style={{ margin: 0, fontSize: '26px', color: color.textPrimary }}>{copy.title}</h1>
      <p style={{ margin: 0, color: color.textSecondary, fontSize: '15px', lineHeight: 1.5 }}>
        {description ?? copy.defaultDescription}
      </p>
    </section>
  )

  if (!fullPage) return card

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: color.bgAppGradient,
        padding: '24px',
      }}
    >
      {card}
    </div>
  )
}
