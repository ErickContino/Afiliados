'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LayoutShell from '../components/LayoutShell'
import GerenciarDados from './components/GerenciarDados'
import { color } from '@/lib/design-tokens'
import { Card, Button, LoadingState, AccessBlockedState } from '../components/ui'

type UserRow = {
  id: string
  nome: string
  email: string
  role: string
}

type SectionKey = 'dados'

const sections: { key: SectionKey; label: string }[] = [
  { key: 'dados', label: 'Gerenciar Dados' },
]

export default function AdminPage() {
  const [user, setUser] = useState<{ email?: string; db?: UserRow } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<SectionKey>('dados')

  async function init() {
    setLoading(true)

    const { data: authData } = await supabase.auth.getUser()

    if (!authData.user) {
      window.location.href = '/login'
      return
    }

    const { data: userDb } = await supabase
      .from('users')
      .select('id, nome, email, role')
      .eq('auth_id', authData.user.id)
      .single()

    setUser({
      email: authData.user.email,
      db: (userDb as UserRow) || undefined,
    })

    setLoading(false)
  }

  useEffect(() => {
    init()
  }, [])

  if (loading) {
    return <LoadingState fullPage label="Carregando painel do admin..." />
  }

  if (!user?.db) {
    return (
      <div style={{ minHeight: '100vh', background: color.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.textSecondary }}>
        Faça login novamente para acessar esta página.
      </div>
    )
  }

  if (user.db.role !== 'admin_master') {
    return (
      <LayoutShell active="admin" user={{ nome: user.db.nome, email: user.email || '', role: user.db.role }}>
        <AccessBlockedState kind="restricted" description="O Painel do Admin está disponível apenas para admin_master." />
      </LayoutShell>
    )
  }

  return (
    <LayoutShell active="admin" user={{ nome: user.db.nome, email: user.email || '', role: user.db.role }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <Card variant="header" style={{ marginBottom: '24px' }}>
          <p style={eyebrowStyle}>Administração</p>
          <h1 style={{ margin: '10px 0 8px', fontSize: '34px', fontWeight: 800, letterSpacing: '-0.04em' }}>Painel do Admin</h1>
          <p style={{ margin: 0, color: color.textSecondary, fontSize: '15px' }}>Área restrita para gerenciar dados e configurações do sistema.</p>
        </Card>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {sections.map((section) => (
            <Button
              key={section.key}
              type="button"
              variant={activeSection === section.key ? 'secondary' : 'ghost'}
              onClick={() => setActiveSection(section.key)}
            >
              {section.label}
            </Button>
          ))}
        </div>

        {activeSection === 'dados' && <GerenciarDados />}
      </div>
    </LayoutShell>
  )
}

const eyebrowStyle: React.CSSProperties = {
  margin: 0,
  color: color.greenSoft,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}
