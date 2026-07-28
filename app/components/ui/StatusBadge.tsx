'use client'

import { radius, statusColor, StatusColorKey } from '@/lib/design-tokens'

const STATUS_MAP: Record<string, StatusColorKey> = {
  active: 'active',
  ativo: 'active',
  paid: 'paid',
  pago: 'paid',
  approved: 'active',
  aprovado: 'active',
  sent: 'info',
  enviado: 'info',
  pending: 'pending',
  pendente: 'pending',
  awaiting_nf: 'pending',
  not_sent: 'pending',
  open: 'pending',
  inactive: 'inactive',
  inativo: 'inactive',
  blocked: 'blocked',
  bloqueado: 'blocked',
  cancelled: 'blocked',
  cancelado: 'blocked',
  rejected: 'blocked',
  rejeitado: 'blocked',
}

export default function StatusBadge({
  status,
  label,
  colorKey,
}: {
  status?: string
  label: string
  colorKey?: StatusColorKey
}) {
  const key = colorKey ?? (status ? STATUS_MAP[status.toLowerCase()] : undefined) ?? 'neutral'
  const c = statusColor[key]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: radius.pill,
        fontSize: '12px',
        fontWeight: 700,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}
