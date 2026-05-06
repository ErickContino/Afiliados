'use client'

import { useEffect, useState } from 'react'
import LayoutShell from '../components/LayoutShell'
import { supabase } from '@/lib/supabase'

type UserRole = 'admin_master' | 'admin_partner' | 'gerente' | 'afiliado'

type UserRow = {
  id: string
  nome: string | null
  email: string | null
  role: UserRole | null
  parent_id: string | null
  afiliado_nome: string | null
}

type LinkRow = {
  id: string
  tracking_link: string
  house_id: string
  houses: {
    id: string
    name: string
  }[] | null
}

export default function PerfilPage() {
  const [userDb, setUserDb] = useState<UserRow | null>(null)
  const [parentName, setParentName] = useState('-')
  const [links, setLinks] = useState<LinkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    init()
  }, [])

  async function init() {
    setLoading(true)
    setMessage('')

    const { data: authData } = await supabase.auth.getUser()

    if (!authData.user) {
      window.location.href = '/login'
      return
    }

    const { data: userData, error } = await supabase
      .from('users')
      .select('id, nome, email, role, parent_id, afiliado_nome')
      .eq('auth_id', authData.user.id)
      .single()

    if (error || !userData) {
      setMessage('Erro ao carregar perfil.')
      setLoading(false)
      return
    }

    const currentUser = userData as UserRow
    setUserDb(currentUser)

    if (currentUser.parent_id) {
      const { data: parentData } = await supabase
        .from('users')
        .select('nome, email')
        .eq('id', currentUser.parent_id)
        .maybeSingle()

      setParentName(parentData?.nome || parentData?.email || '-')
    }

    const { data: linksData } = await supabase
      .from('user_house_links')
      .select('id, tracking_link, house_id, houses(id, name)')
      .eq('user_id', currentUser.id)
      .eq('active', true)

    setLinks((linksData || []) as LinkRow[])
    setLoading(false)
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link)
    setMessage('Link copiado.')
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (!currentPassword.trim()) {
        setMessage('Digite sua senha atual.')
        return
    }

    if (!newPassword.trim() || newPassword.length < 6) {
        setMessage('A nova senha precisa ter pelo menos 6 caracteres.')
        return
    }

    if (newPassword !== confirmPassword) {
        setMessage('As senhas não conferem.')
        return
    }

    setSavingPassword(true)

    const { data: authData } = await supabase.auth.getUser()

    if (!authData.user?.email) {
        setSavingPassword(false)
        setMessage('Erro ao validar sessão.')
        return
    }

    const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: authData.user.email,
        password: currentPassword,
    })

    if (reauthError) {
        setSavingPassword(false)
        setMessage('Senha atual incorreta.')
        return
    }

    const { error } = await supabase.auth.updateUser({
        password: newPassword,
    })

    setSavingPassword(false)

    if (error) {
        setMessage(`Erro ao alterar senha: ${error.message}`)
        return
    }

    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setMessage('Senha alterada com sucesso.')
}

  function formatRole(role: UserRole | null) {
    if (!role) return '-'

    const map = {
      admin_master: 'Admin Master',
      admin_partner: 'Admin Partner',
      gerente: 'Gerente',
      afiliado: 'Afiliado',
    }

    return map[role]
  }

  if (loading) {
    return (
      <main style={pageBg}>
        <div style={centerBox}>Carregando...</div>
      </main>
    )
  }

  if (!userDb) {
    return (
      <main style={pageBg}>
        <div style={centerBox}>Perfil não encontrado.</div>
      </main>
    )
  }

  return (
    <LayoutShell
      active="perfil"
      user={{
        nome: userDb.nome || '',
        email: userDb.email || '',
        role: userDb.role || '',
      }}
    >
      <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
        <header style={headerCard}>
          <div>
            <p style={eyebrow}>Conta</p>
            <h1 style={pageTitle}>Meu Perfil</h1>
            <p style={pageSubtitle}>
              Consulte seus dados, links por casa e altere sua senha.
            </p>
          </div>
        </header>

        <section style={grid}>
          <div style={mainColumn}>
            <section style={panelCard}>
              <h2 style={panelTitle}>Dados básicos</h2>

              <div style={infoGrid}>
                <Info label="Nome" value={userDb.nome || '-'} />
                <Info label="Email" value={userDb.email || '-'} />
                <Info label="Role" value={formatRole(userDb.role)} />
                <Info label="Gerente" value={parentName} />
                <Info label="Nome CSV" value={userDb.afiliado_nome || 'Sem vínculo'} />
              </div>
            </section>

            <section style={panelCard}>
              <h2 style={panelTitle}>Meus links</h2>
              <p style={panelSubtitle}>
                Estes são seus links ativos por casa. Os links são gerenciados pelo administrador.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '18px' }}>
                {links.length === 0 ? (
                  <div style={emptyBox}>
                    Nenhum link cadastrado ainda.
                  </div>
                ) : (
                  links.map((item) => (
                    <div key={item.id} style={linkCard}>
                      <div style={{ minWidth: 0 }}>
                        <p style={linkHouse}>{item.houses?.[0]?.name || 'Casa sem nome'}</p>
                        <p style={linkText}>{item.tracking_link}</p>
                      </div>

                      <button
                        type="button"
                        style={secondaryButton}
                        onClick={() => copyLink(item.tracking_link)}
                      >
                        Copiar
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <aside style={sideColumn}>
            <section style={panelCard}>
              <h2 style={panelTitle}>Alterar senha</h2>
              <p style={panelSubtitle}>
                Defina uma nova senha para sua conta.
              </p>

              <form onSubmit={handleUpdatePassword} style={formStack}>
                <Field label="Senha atual">
                    <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Digite sua senha atual"
                        style={inputStyle}
                    />
                </Field>

                <Field label="Nova senha">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Digite a nova senha"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Confirmar nova senha">
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita a nova senha"
                        style={inputStyle}
                    />
                </Field>

                <button type="submit" style={primaryButton} disabled={savingPassword}>
                  {savingPassword ? 'Salvando...' : 'Alterar senha'}
                </button>
              </form>
            </section>

            {message && <p style={messageStyle}>{message}</p>}
          </aside>
        </section>
      </div>
    </LayoutShell>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoCard}>
      <p style={infoLabel}>{label}</p>
      <p style={infoValue}>{value}</p>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ fontSize: '14px', color: '#cbd5e1' }}>{label}</label>
      {children}
    </div>
  )
}

const pageBg: React.CSSProperties = {
  minHeight: '100vh',
  background: '#030712',
  color: '#f8fafc',
}

const centerBox: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#bbf7d0',
}

const headerCard: React.CSSProperties = {
  marginBottom: '24px',
  padding: '24px 26px',
  borderRadius: '24px',
  border: '1px solid rgba(34,197,94,0.12)',
  background: 'linear-gradient(180deg, rgba(10,18,14,0.94), rgba(4,9,7,0.94))',
  boxShadow: '0 12px 40px rgba(0,0,0,0.28)',
}

const eyebrow: React.CSSProperties = {
  margin: 0,
  color: '#86efac',
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const pageTitle: React.CSSProperties = {
  margin: '10px 0 8px',
  fontSize: '34px',
  fontWeight: 800,
  letterSpacing: '-0.04em',
}

const pageSubtitle: React.CSSProperties = {
  margin: 0,
  color: '#94a3b8',
  fontSize: '15px',
}

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.4fr 0.8fr',
  gap: '24px',
  alignItems: 'start',
}

const mainColumn: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
}

const sideColumn: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
}

const panelCard: React.CSSProperties = {
  borderRadius: '24px',
  border: '1px solid rgba(34,197,94,0.12)',
  background: 'linear-gradient(180deg, rgba(9,14,12,0.96), rgba(4,8,7,0.96))',
  boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
  padding: '22px 24px',
}

const panelTitle: React.CSSProperties = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 700,
}

const panelSubtitle: React.CSSProperties = {
  margin: '8px 0 0',
  color: '#94a3b8',
  fontSize: '14px',
}

const infoGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))',
  gap: '14px',
  marginTop: '18px',
}

const infoCard: React.CSSProperties = {
  padding: '16px',
  borderRadius: '18px',
  border: '1px solid rgba(34,197,94,0.1)',
  background: 'rgba(34,197,94,0.04)',
}

const infoLabel: React.CSSProperties = {
  margin: 0,
  color: '#86efac',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const infoValue: React.CSSProperties = {
  margin: '8px 0 0',
  color: '#f8fafc',
  fontSize: '15px',
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const linkCard: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: '14px',
  alignItems: 'center',
  padding: '16px',
  borderRadius: '18px',
  border: '1px solid rgba(34,197,94,0.1)',
  background: 'rgba(2, 6, 23, 0.72)',
}

const linkHouse: React.CSSProperties = {
  margin: 0,
  color: '#bbf7d0',
  fontWeight: 800,
}

const linkText: React.CSSProperties = {
  margin: '6px 0 0',
  color: '#94a3b8',
  fontSize: '13px',
  overflowWrap: 'anywhere',
}

const emptyBox: React.CSSProperties = {
  padding: '24px',
  borderRadius: '18px',
  border: '1px dashed rgba(34,197,94,0.18)',
  color: '#94a3b8',
  textAlign: 'center',
}

const formStack: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  marginTop: '18px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  background: 'rgba(2, 6, 23, 0.85)',
  color: '#f8fafc',
  border: '1px solid rgba(34,197,94,0.14)',
  borderRadius: '14px',
  outline: 'none',
  fontSize: '14px',
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

const secondaryButton: React.CSSProperties = {
  border: '1px solid rgba(34,197,94,0.18)',
  background: 'rgba(34,197,94,0.08)',
  color: '#bbf7d0',
  padding: '10px 14px',
  borderRadius: '12px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '13px',
}

const messageStyle: React.CSSProperties = {
  margin: 0,
  color: '#bbf7d0',
  fontSize: '14px',
}