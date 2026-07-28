'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { color, radius, shadow } from '@/lib/design-tokens'
import {
  LayoutDashboard,
  Wallet,
  Percent,
  Users,
  Building2,
  Menu,
  ChevronLeft,
  LogOut,
  MessageCircle,
  Settings,
} from './icons'

const SUPPORT_WHATSAPP_NUMBER = '5511965990451'

type LayoutUser = {
  nome?: string
  email?: string
  role?: string
}

type ActivePage = 'dashboard' | 'comissoes' | 'usuarios' | 'casas' | 'perfil' | 'financeiro' | 'admin'

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
        color: color.textPrimary,
        display: 'grid',
        gridTemplateColumns: collapsed ? '86px 1fr' : '280px 1fr',
        transition: 'grid-template-columns 0.22s ease',
        background: color.bgAppGradient,
      }}
    >
      <aside
        style={{
          borderRight: `1px solid ${color.cardBorder}`,
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
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, letterSpacing: '-0.03em' }}>AffiliaZap</h2>
                <p style={{ marginTop: '8px', color: color.greenSoft, fontSize: '14px' }}>Painel de afiliados</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleSidebar}
            style={{
              width: '100%',
              minHeight: '42px',
              border: `1px solid ${color.cardBorder}`,
              background: 'rgba(6, 12, 10, 0.65)',
              color: color.greenSofter,
              borderRadius: radius.md,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '0 12px',
              fontWeight: 700,
              fontSize: '13px',
              justifyContent: collapsed ? 'center' : 'space-between',
            }}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <Menu size={16} /> : <span>Recolher menu</span>}
            {!collapsed && <ChevronLeft size={16} />}
          </button>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '22px' }}>
            <SidebarItem icon={<LayoutDashboard size={18} />} label="Dashboard" href="/" active={active === 'dashboard'} collapsed={collapsed} />
            <SidebarItem icon={<Wallet size={18} />} label="Financeiro" href="/financeiro" active={active === 'financeiro'} collapsed={collapsed} />

            {canSeeComissoes && (
              <SidebarItem icon={<Percent size={18} />} label="Comissões" href="/comissoes" active={active === 'comissoes'} collapsed={collapsed} />
            )}

            {isAdminMaster && (
              <SidebarItem icon={<Users size={18} />} label="Usuários" href="/usuarios" active={active === 'usuarios'} collapsed={collapsed} />
            )}

            {isAdminMaster && (
              <SidebarItem icon={<Building2 size={18} />} label="Casas" href="/casas" active={active === 'casas'} collapsed={collapsed} />
            )}

            {isAdminMaster && !collapsed && (
              <p
                style={{
                  margin: '10px 4px 0',
                  color: '#4b5f56',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Administração
              </p>
            )}

            {isAdminMaster && (
              <SidebarItem icon={<Settings size={18} />} label="Painel do Admin" href="/admin" active={active === 'admin'} collapsed={collapsed} />
            )}
          </nav>
        </div>

        <div>
          <a
            href={`https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: '10px',
              padding: collapsed ? '10px' : '10px 14px',
              marginBottom: '12px',
              borderRadius: radius.md,
              border: `1px solid ${color.infoBorder}`,
              background: color.infoBg,
              color: color.greenSofter,
              fontWeight: 700,
              fontSize: '13px',
              textDecoration: 'none',
            }}
            title="Falar com o suporte"
          >
            <MessageCircle size={17} />
            {!collapsed && <span>Suporte via WhatsApp</span>}
          </a>

          <Link href="/perfil" style={{ textDecoration: 'none' }}>
            <div
              onMouseEnter={() => setHoverProfile(true)}
              onMouseLeave={() => setHoverProfile(false)}
              style={{
                border: `1px solid ${hoverProfile ? 'rgba(34,197,94,0.25)' : color.inputBorder}`,
                background: hoverProfile ? 'rgba(34,197,94,0.12)' : 'rgba(6, 12, 10, 0.8)',
                borderRadius: radius.lg,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                padding: collapsed ? '10px' : '16px',
                alignItems: collapsed ? 'center' : 'flex-start',
                transform: hoverProfile ? 'translateY(-2px) scale(1.01)' : 'translateY(0) scale(1)',
                boxShadow: hoverProfile ? shadow.hover : 'none',
              }}
              title={`${user?.nome || '-'} | ${user?.email || '-'}`}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: radius.md,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '14px',
                  transition: 'all 0.18s ease',
                  background: hoverProfile ? 'rgba(34,197,94,0.25)' : 'rgba(34,197,94,0.14)',
                  border: `1px solid ${hoverProfile ? 'rgba(34,197,94,0.35)' : 'rgba(34,197,94,0.18)'}`,
                  color: color.greenSofter,
                }}
              >
                {initials}
              </div>

              {!collapsed && (
                <>
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: color.greenSoft, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Meu perfil
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: 700 }}>{user?.nome || '-'}</p>
                  <p style={{ margin: 0, fontSize: '13px', color: color.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '210px' }}>
                    {user?.email || '-'}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: color.greenSofter }}>Role: {user?.role || '-'}</p>
                </>
              )}
            </div>
          </Link>

          <button
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/'
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              height: collapsed ? '42px' : undefined,
              marginTop: '14px',
              border: '1px solid rgba(34,197,94,0.25)',
              background: color.brandGradient,
              color: color.textOnBrand,
              padding: collapsed ? undefined : '12px 18px',
              borderRadius: radius.md,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '14px',
              boxShadow: shadow.button,
            }}
            title="Sair"
          >
            <LogOut size={16} />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      <section className="p-4 md:p-7" style={{ minWidth: 0 }}>
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
  icon: React.ReactNode
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
          borderRadius: radius.md,
          background: active ? 'rgba(34,197,94,0.12)' : 'transparent',
          border: active ? `1px solid ${color.cardBorderStrong}` : '1px solid transparent',
          color: active ? color.textOnBrand : color.textSecondary,
          fontWeight: active ? 700 : 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: '12px',
          transition: 'all 0.18s ease',
        }}
      >
        <span style={{ width: '26px', height: '26px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </span>
        {!collapsed && <span>{label}</span>}
      </div>
    </Link>
  )
}

const logoBox: React.CSSProperties = {
  width: '44px',
  height: '44px',
  minWidth: '44px',
  borderRadius: radius.md,
  background: color.brandGradientDiagonal,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 900,
  color: color.textOnLogo,
  boxShadow: shadow.logo,
}
