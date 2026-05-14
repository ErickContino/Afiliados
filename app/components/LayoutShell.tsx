'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type LayoutUser = {
  nome?: string
  email?: string
  role?: string
}

type ActivePage = 'dashboard' | 'comissoes' | 'usuarios' | 'casas' | 'perfil' | 'financeiro'

export default function LayoutShell({
  children,
  active,
  user,
}: {
  children: React.ReactNode
  active: ActivePage
  user: LayoutUser
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [hoverProfile, setHoverProfile] = useState(false)

  const isAdminMaster = user?.role === 'admin_master'

  const isGerente = user?.role === 'gerente'
  const canSeeComissoes = isAdminMaster || isGerente

  useEffect(() => {
    const saved = window.localStorage.getItem('sidebar_collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  function toggleSidebar() {
    const next = !collapsed
    setCollapsed(next)
    window.localStorage.setItem('sidebar_collapsed', String(next))
  }

  const initials = useMemo(() => {
    const name = user?.nome || user?.email || 'U'
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }, [user?.nome, user?.email])

  return (
    <div
      style={{
        minHeight: '100vh',
        color: '#f8fafc',
        display: 'grid',
        gridTemplateColumns: collapsed ? '86px 1fr' : '280px 1fr',
        transition: 'grid-template-columns 0.22s ease',
        background:
          'radial-gradient(circle at top left, rgba(34,197,94,0.16), transparent 30%), radial-gradient(circle at bottom right, rgba(16,185,129,0.12), transparent 28%), #030712',
      }}
    >
      <aside
        style={{
          borderRight: '1px solid rgba(34,197,94,0.12)',
          background: 'rgba(2, 6, 23, 0.78)',
          backdropFilter: 'blur(12px)',
          padding: collapsed ? '22px 14px' : '28px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'all 0.22s ease',
          overflow: 'hidden',
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: collapsed ? 'center' : 'flex-start',
              flexDirection: 'column',
              marginBottom: '28px',
              gap: '14px',
            }}
          >
            <div style={logoBox}>AZ</div>

            {!collapsed && (
              <div>
                <h2 style={brandTitle}>AffiliaZap</h2>
                <p style={brandSubtitle}>AffiliaZap</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleSidebar}
            style={{
              ...collapseButton,
              justifyContent: collapsed ? 'center' : 'space-between',
            }}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <span>{collapsed ? '☰' : 'Recolher menu'}</span>
            {!collapsed && <span>‹</span>}
          </button>

          <nav
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginTop: '22px',
            }}
          >
            <SidebarItem
              icon="⌂"
              label="Dashboard"
              href="/"
              active={active === 'dashboard'}
              collapsed={collapsed}
            />

            <SidebarItem
              icon="💰"
              label="Financeiro"
              href="/financeiro"
              active={active === 'financeiro'}
              collapsed={collapsed}
            />

            {canSeeComissoes && (
              <SidebarItem
                icon="₿"
                label="Comissões"
                href="/comissoes"
                active={active === 'comissoes'}
                collapsed={collapsed}
              />
            )}

            {isAdminMaster && (
              <SidebarItem
                icon="👥"
                label="Usuários"
                href="/usuarios"
                active={active === 'usuarios'}
                collapsed={collapsed}
              />
            )}

            {isAdminMaster && (
              <SidebarItem
                icon="◆"
                label="Casas"
                href="/casas"
                active={active === 'casas'}
                collapsed={collapsed}
              />
            )}
          </nav>
        </div>

        <div>
          <Link href="/perfil" style={{ textDecoration: 'none' }}>
            <div
              onMouseEnter={() => setHoverProfile(true)}
              onMouseLeave={() => setHoverProfile(false)}
              style={{
                ...userCard,
                padding: collapsed ? '10px' : '16px',
                alignItems: collapsed ? 'center' : 'flex-start',
                transform: hoverProfile ? 'translateY(-2px) scale(1.01)' : 'translateY(0) scale(1)',
                background: hoverProfile
                  ? 'rgba(34,197,94,0.12)'
                  : 'rgba(6, 12, 10, 0.8)',
                border: hoverProfile
                  ? '1px solid rgba(34,197,94,0.25)'
                  : '1px solid rgba(34,197,94,0.14)',
                boxShadow: hoverProfile
                  ? '0 10px 30px rgba(34,197,94,0.15)'
                  : 'none',
              }}
              title={`${user?.nome || '-'} | ${user?.email || '-'}`}
            >
              <div
                style={{
                  ...avatarBox,
                  background: hoverProfile
                    ? 'rgba(34,197,94,0.25)'
                    : 'rgba(34,197,94,0.14)',
                  border: hoverProfile
                    ? '1px solid rgba(34,197,94,0.35)'
                    : '1px solid rgba(34,197,94,0.18)',
                }}
              >
                {initials}
              </div>

              {!collapsed && (
                <>
                  <p style={userCardLabel}>Meu perfil</p>
                  <p style={userCardName}>{user?.nome || '-'}</p>
                  <p style={userCardEmail}>{user?.email || '-'}</p>
                  <p style={userCardRole}>Role: {user?.role || '-'}</p>
                </>
              )}
            </div>
          </Link>

          {!collapsed && (
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.href = '/'
              }}
              style={{ ...primaryButton, width: '100%', marginTop: '14px' }}
            >
              Sair
            </button>
          )}

          {collapsed && (
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.href = '/'
              }}
              style={logoutIconButton}
              title="Sair"
            >
              ⎋
            </button>
          )}
        </div>
      </aside>

      <section
        style={{
          padding: '28px',
          minWidth: 0,
        }}
      >
        {children}
      </section>
    </div>
  )
}

function SidebarItem({
  icon,
  label,
  href,
  active = false,
  collapsed,
}: {
  icon: string
  label: string
  href: string
  active?: boolean
  collapsed: boolean
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div
        title={collapsed ? label : undefined}
        style={{
          minHeight: '48px',
          padding: collapsed ? '0' : '12px 14px',
          borderRadius: '16px',
          background: active ? 'rgba(34,197,94,0.12)' : 'transparent',
          border: active ? '1px solid rgba(34,197,94,0.16)' : '1px solid transparent',
          color: active ? '#f0fdf4' : '#94a3b8',
          fontWeight: active ? 700 : 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: '12px',
          transition: 'all 0.18s ease',
        }}
      >
        <span style={sidebarIcon}>{icon}</span>
        {!collapsed && <span>{label}</span>}
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

const collapseButton: React.CSSProperties = {
  width: '100%',
  minHeight: '42px',
  border: '1px solid rgba(34,197,94,0.12)',
  background: 'rgba(6, 12, 10, 0.65)',
  color: '#bbf7d0',
  borderRadius: '14px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '0 12px',
  fontWeight: 700,
  fontSize: '13px',
}

const logoBox: React.CSSProperties = {
  width: '44px',
  height: '44px',
  minWidth: '44px',
  borderRadius: '14px',
  background: 'linear-gradient(135deg, #22c55e, #15803d)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 900,
  color: '#02100a',
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

const sidebarIcon: React.CSSProperties = {
  width: '26px',
  height: '26px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '17px',
}

const userCard: React.CSSProperties = {
  border: '1px solid rgba(34,197,94,0.14)',
  background: 'rgba(6, 12, 10, 0.8)',
  borderRadius: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  cursor: 'pointer',
  transition: 'all 0.18s ease',
}

const avatarBox: React.CSSProperties = {
  width: '42px',
  height: '42px',
  borderRadius: '14px',
  background: 'rgba(34,197,94,0.14)',
  border: '1px solid rgba(34,197,94,0.18)',
  color: '#bbf7d0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  fontSize: '14px',
  transition: 'all 0.18s ease',
}

const userCardLabel: React.CSSProperties = {
  margin: '6px 0 0',
  fontSize: '12px',
  color: '#86efac',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const userCardName: React.CSSProperties = {
  margin: '2px 0 0',
  fontSize: '16px',
  fontWeight: 700,
}

const userCardEmail: React.CSSProperties = {
  margin: 0,
  fontSize: '13px',
  color: '#94a3b8',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '210px',
}

const userCardRole: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: '13px',
  color: '#bbf7d0',
}

const logoutIconButton: React.CSSProperties = {
  width: '100%',
  height: '42px',
  marginTop: '12px',
  border: '1px solid rgba(34,197,94,0.18)',
  background: 'rgba(34,197,94,0.08)',
  color: '#bbf7d0',
  borderRadius: '14px',
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: '18px',
}