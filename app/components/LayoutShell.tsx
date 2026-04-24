'use client'

import React from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type LayoutUser = {
  nome?: string
  email?: string
  role?: string
}

export default function LayoutShell({
  children,
  active,
  user,
}: {
  children: React.ReactNode
  active: 'dashboard' | 'comissoes' | 'usuarios' | 'casas' | 'conversoes'
  user: LayoutUser
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        color: '#f8fafc',
        display: 'grid',
        gridTemplateColumns: '280px 1fr',
        background:
          'radial-gradient(circle at top left, rgba(34,197,94,0.16), transparent 30%), radial-gradient(circle at bottom right, rgba(16,185,129,0.12), transparent 28%), #030712',
      }}
    >
      <aside
        style={{
          borderRight: '1px solid rgba(34,197,94,0.12)',
          background: 'rgba(2, 6, 23, 0.75)',
          backdropFilter: 'blur(10px)',
          padding: '28px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ marginBottom: '36px' }}>
            <div style={logoBox}>GA</div>
            <h2 style={brandTitle}>Gestão de Afiliados</h2>
            <p style={brandSubtitle}>Painel operacional</p>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <SidebarItem label="Dashboard" href="/" active={active === 'dashboard'} />
            <SidebarItem label="Comissões" href="/comissoes" active={active === 'comissoes'} />
            <SidebarItem label="Usuários" href="/usuarios" active={active === 'usuarios'} />
            <SidebarItem label="Casas" href="/casas" active={active === 'casas'} />
            <SidebarItem label="Conversões" href="/conversoes" active={active === 'conversoes'} />
          </nav>
        </div>

        <div style={userCard}>
          <p style={userCardLabel}>Usuário logado</p>
          <p style={userCardName}>{user?.nome || '-'}</p>
          <p style={userCardEmail}>{user?.email || '-'}</p>
          <p style={userCardRole}>Role: {user?.role || '-'}</p>

          <button
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/'
            }}
            style={{ ...primaryButton, width: '100%', marginTop: '14px' }}
          >
            Sair
          </button>
        </div>
      </aside>

      <section style={{ padding: '28px' }}>{children}</section>
    </div>
  )
}

function SidebarItem({
  label,
  href,
  active = false,
}: {
  label: string
  href: string
  active?: boolean
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div
        style={{
          padding: '12px 14px',
          borderRadius: '14px',
          background: active ? 'rgba(34,197,94,0.12)' : 'transparent',
          border: active ? '1px solid rgba(34,197,94,0.14)' : '1px solid transparent',
          color: active ? '#f0fdf4' : '#94a3b8',
          fontWeight: active ? 700 : 500,
          cursor: 'pointer',
        }}
      >
        {label}
      </div>
    </Link>
  )
}

const primaryButton: React.CSSProperties = {
  border: '1px solid rgba(34,197,94,0.25)',
  background: 'linear-gradient(180deg, #16a34a, #15803d)',
  color: '#f0fdf4',
  padding: '12px 18px',
  borderRadius: '14px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '14px',
  boxShadow: '0 0 24px rgba(34,197,94,0.2)',
}

const logoBox: React.CSSProperties = {
  width: '44px',
  height: '44px',
  borderRadius: '12px',
  background: 'linear-gradient(135deg, #22c55e, #15803d)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  color: '#02100a',
  marginBottom: '14px',
  boxShadow: '0 0 24px rgba(34,197,94,0.22)',
}

const brandTitle: React.CSSProperties = {
  margin: 0,
  fontSize: '22px',
  fontWeight: 800,
  letterSpacing: '-0.03em',
}

const brandSubtitle: React.CSSProperties = {
  marginTop: '8px',
  color: '#86efac',
  fontSize: '14px',
}

const userCard: React.CSSProperties = {
  border: '1px solid rgba(34,197,94,0.14)',
  background: 'rgba(6, 12, 10, 0.8)',
  borderRadius: '18px',
  padding: '16px',
}

const userCardLabel: React.CSSProperties = {
  margin: 0,
  fontSize: '12px',
  color: '#86efac',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const userCardName: React.CSSProperties = {
  margin: '10px 0 4px',
  fontSize: '16px',
  fontWeight: 700,
}

const userCardEmail: React.CSSProperties = {
  margin: 0,
  fontSize: '13px',
  color: '#94a3b8',
}

const userCardRole: React.CSSProperties = {
  margin: '10px 0 0',
  fontSize: '13px',
  color: '#bbf7d0',
}