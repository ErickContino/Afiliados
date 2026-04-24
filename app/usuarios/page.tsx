'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LayoutShell from '../components/LayoutShell'

type UserRole = 'admin_master' | 'admin_partner' | 'gerente' | 'afiliado'

type UserRow = {
  id: string
  nome: string
  email: string
  role: UserRole
  parent_id?: string | null
  afiliado_nome?: string | null
  auth_id?: string | null
}

type LoggedUser = {
  email?: string
  db?: UserRow
}

type FormState = {
  nome: string
  email: string
  senha: string
  role: UserRole
  parent_id: string
  afiliado_nome: string
}

type UnregisteredAffiliate = {
  afiliado: string
  qtd_conversoes: number
  primeira_conversao: string
  ultima_conversao: string
  casas: string
}

const emptyForm: FormState = {
  nome: '',
  email: '',
  senha: '',
  role: 'afiliado',
  parent_id: '',
  afiliado_nome: '',
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [unregisteredAffiliates, setUnregisteredAffiliates] = useState<UnregisteredAffiliate[]>([])
  const [currentUser, setCurrentUser] = useState<LoggedUser | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [selectedRole, setSelectedRole] = useState('')
  const [selectedManager, setSelectedManager] = useState('')
  const [selectedAuthStatus, setSelectedAuthStatus] = useState('')

  const [form, setForm] = useState<FormState>(emptyForm)

  useEffect(() => {
    init()
  }, [])

  async function init() {
    setLoading(true)
    setMessage('')

    const { data: authData } = await supabase.auth.getUser()

    if (!authData.user) {
      setLoading(false)
      return
    }

    const { data: userDb, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authData.user.id)
      .single()

    if (error || !userDb) {
      setLoading(false)
      setMessage('Usuário autenticado não encontrado na tabela users.')
      return
    }

    const loggedUser = userDb as UserRow

    setCurrentUser({
      email: authData.user.email,
      db: loggedUser,
    })

    await loadUsers()
    await loadUnregisteredAffiliates(loggedUser)

    setLoading(false)
  }

  async function loadUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('nome')

    if (error || !data) {
      setMessage('Erro ao carregar usuários.')
      return
    }

    setUsers(data as UserRow[])
  }

  async function loadUnregisteredAffiliates(user: UserRow) {
    if (user.role !== 'admin_master') {
      setUnregisteredAffiliates([])
      return
    }

    const { data, error } = await supabase
      .from('unregistered_affiliates')
      .select('*')
      .order('qtd_conversoes', { ascending: false })

    if (error || !data) {
      setUnregisteredAffiliates([])
      setMessage(`Erro ao carregar afiliados não cadastrados: ${error?.message}`)
      return
    }

    setUnregisteredAffiliates(data as UnregisteredAffiliate[])
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (!currentUser?.db) return

    if (currentUser.db.role !== 'admin_master') {
      setMessage('Apenas admin_master pode criar usuários.')
      return
    }

    if (!form.nome || !form.email || !form.senha) {
      setMessage('Preencha nome, email e senha.')
      return
    }

    const parentId = form.parent_id || null

    if (form.role === 'afiliado' && !parentId) {
      setMessage('Selecione um gerente responsável para o afiliado.')
      return
    }

    setSaving(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        setSaving(false)
        setMessage('Sessão inválida. Faça login novamente.')
        return
      }

      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome: form.nome,
          email: form.email,
          senha: form.senha,
          role: form.role,
          parent_id: parentId,
          afiliado_nome: form.afiliado_nome || form.nome,
        }),
      })

      const data = await res.json()

      setSaving(false)

      if (!res.ok) {
        setMessage(`Erro ao criar usuário: ${data.error || 'Erro desconhecido.'}`)
        return
      }

      setMessage('Usuário criado com sucesso.')
      setForm(emptyForm)

      await loadUsers()

      if (currentUser.db) {
        await loadUnregisteredAffiliates(currentUser.db)
      }
    } catch {
      setSaving(false)
      setMessage('Erro inesperado ao criar usuário.')
    }
  }

  function fillFormFromUnregistered(affiliate: UnregisteredAffiliate) {
    setForm((prev) => ({
      ...prev,
      nome: affiliate.afiliado,
      afiliado_nome: affiliate.afiliado,
      role: 'afiliado',
      parent_id: '',
    }))

    setMessage(`Formulário preenchido com ${affiliate.afiliado}. Informe email, senha e gerente.`)
  }

  const isAdminMaster = currentUser?.db?.role === 'admin_master'
  const canViewPage = isAdminMaster
  const canCreateUser = isAdminMaster

  const managerOptions = useMemo(() => {
    return users.filter((u) => u.role === 'gerente')
  }, [users])

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesRole = selectedRole ? u.role === selectedRole : true
      const matchesManager = selectedManager ? u.parent_id === selectedManager : true

      const matchesAuth =
        selectedAuthStatus === 'vinculado'
          ? !!u.auth_id
          : selectedAuthStatus === 'sem_login'
            ? !u.auth_id
            : true

      return matchesRole && matchesManager && matchesAuth
    })
  }, [users, selectedRole, selectedManager, selectedAuthStatus])

  function getParentName(parentId?: string | null) {
    if (!parentId) return '-'
    return users.find((u) => u.id === parentId)?.nome || '-'
  }

  function formatDate(date?: string | null) {
    if (!date) return '-'
    return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR')
  }

  if (loading) {
    return (
      <main style={pageBg}>
        <div style={centerBox}>
          <p style={{ color: '#bbf7d0', fontSize: '16px' }}>Carregando...</p>
        </div>
      </main>
    )
  }

  if (!currentUser?.db) {
    return (
      <main style={pageBg}>
        <div style={centerBox}>
          <h1 style={{ color: '#f8fafc', marginBottom: '12px' }}>Acesso indisponível</h1>
          <p style={{ color: '#94a3b8' }}>Faça login novamente para acessar esta página.</p>
        </div>
      </main>
    )
  }

  if (!canViewPage) {
    return (
      <LayoutShell
        active="usuarios"
        user={{
          nome: currentUser.db.nome,
          email: currentUser.email || '',
          role: currentUser.db.role,
        }}
      >
        <section style={blockedCard}>
          <h1 style={blockedTitle}>Acesso restrito</h1>
          <p style={blockedText}>Esta tela está disponível apenas para admin.</p>
        </section>
      </LayoutShell>
    )
  }

  return (
    <LayoutShell
      active="usuarios"
      user={{
        nome: currentUser.db.nome,
        email: currentUser.email || '',
        role: currentUser.db.role,
      }}
    >
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <header style={headerCard}>
          <div>
            <p style={eyebrow}>Operação</p>
            <h1 style={pageTitle}>Usuários</h1>
            <p style={pageSubtitle}>
              Gerencie perfis, logins e vínculos hierárquicos do sistema.
            </p>
          </div>
        </header>

        <section style={gridSection}>
          <div style={mainColumn}>
            <section style={panelCard}>
              <div style={panelHeader}>
                <div>
                  <h2 style={panelTitle}>Filtros</h2>
                  <p style={panelSubtitle}>Refine a listagem de usuários.</p>
                </div>
              </div>

              <div style={filtersGrid}>
                <Field label="Role">
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Todos</option>
                    <option value="admin_master">Admin master</option>
                    <option value="admin_partner">Admin partner</option>
                    <option value="gerente">Gerente</option>
                    <option value="afiliado">Afiliado</option>
                  </select>
                </Field>

                <Field label="Gerente">
                  <select
                    value={selectedManager}
                    onChange={(e) => setSelectedManager(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Todos</option>
                    {managerOptions.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.nome}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Login">
                  <select
                    value={selectedAuthStatus}
                    onChange={(e) => setSelectedAuthStatus(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Todos</option>
                    <option value="vinculado">Com login</option>
                    <option value="sem_login">Sem login</option>
                  </select>
                </Field>
              </div>
            </section>

            <section style={panelCard}>
              <div style={panelHeader}>
                <div>
                  <h2 style={panelTitle}>Usuários cadastrados</h2>
                  <p style={panelSubtitle}>{filteredUsers.length} registro(s) encontrado(s)</p>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRow}>
                      <Th>Nome</Th>
                      <Th>Nome CSV</Th>
                      <Th>Email</Th>
                      <Th>Role</Th>
                      <Th>Gerente</Th>
                      <Th>Auth</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={emptyStateTd}>
                          Nenhum usuário encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id} style={tbodyRow}>
                          <Td>{u.nome}</Td>
                          <Td>{u.afiliado_nome || '-'}</Td>
                          <Td>{u.email}</Td>
                          <Td>{u.role}</Td>
                          <Td>{getParentName(u.parent_id)}</Td>
                          <Td>{u.auth_id ? 'Vinculado' : 'Sem login'}</Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {isAdminMaster && (
              <section style={panelCard}>
                <div style={panelHeader}>
                  <div>
                    <h2 style={panelTitle}>Afiliados não cadastrados</h2>
                    <p style={panelSubtitle}>
                      Nomes encontrados em conversions.afiliado sem cadastro em users.
                    </p>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr style={theadRow}>
                        <Th>Nome no CSV</Th>
                        <Th>Conversões</Th>
                        <Th>Primeira</Th>
                        <Th>Última</Th>
                        <Th>Casas</Th>
                        <Th>Ação</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {unregisteredAffiliates.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={emptyStateTd}>
                            Nenhum afiliado não cadastrado encontrado.
                          </td>
                        </tr>
                      ) : (
                        unregisteredAffiliates.map((affiliate) => (
                          <tr key={affiliate.afiliado} style={tbodyRow}>
                            <Td>{affiliate.afiliado}</Td>
                            <Td>{affiliate.qtd_conversoes}</Td>
                            <Td>{formatDate(affiliate.primeira_conversao)}</Td>
                            <Td>{formatDate(affiliate.ultima_conversao)}</Td>
                            <Td>{affiliate.casas || '-'}</Td>
                            <Td>
                              <button
                                type="button"
                                style={secondaryButton}
                                onClick={() => fillFormFromUnregistered(affiliate)}
                              >
                                Criar usuário
                              </button>
                            </Td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>

          <aside style={sideColumn}>
            {canCreateUser ? (
              <section style={panelCard}>
                <div style={panelHeader}>
                  <div>
                    <h2 style={panelTitle}>Novo usuário</h2>
                    <p style={panelSubtitle}>
                      A criação passa pelo Auth e vincula o usuário automaticamente.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleCreate} style={formStack}>
                  <Field label="Nome">
                    <input
                      type="text"
                      value={form.nome}
                      onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                      placeholder="Ex: AfiliadoA4"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Nome de match no CSV">
                    <input
                      type="text"
                      value={form.afiliado_nome}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, afiliado_nome: e.target.value }))
                      }
                      placeholder="Precisa bater com conversions.afiliado"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Email">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="Ex: afiliadoa4@test.com"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Senha temporária">
                    <input
                      type="password"
                      value={form.senha}
                      onChange={(e) => setForm((prev) => ({ ...prev, senha: e.target.value }))}
                      placeholder="Digite uma senha"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Role">
                    <select
                      value={form.role}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          role: e.target.value as UserRole,
                          parent_id: e.target.value === 'afiliado' ? prev.parent_id : '',
                        }))
                      }
                      style={inputStyle}
                    >
                      <option value="afiliado">Afiliado</option>
                      <option value="gerente">Gerente</option>
                      <option value="admin_partner">Admin partner</option>
                    </select>
                  </Field>

                  {form.role === 'afiliado' && (
                    <Field label="Gerente responsável">
                      <select
                        value={form.parent_id}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, parent_id: e.target.value }))
                        }
                        style={inputStyle}
                      >
                        <option value="">Selecione</option>
                        {managerOptions.map((manager) => (
                          <option key={manager.id} value={manager.id}>
                            {manager.nome}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}

                  <div style={formActions}>
                    <button type="submit" style={primaryButton} disabled={saving}>
                      {saving ? 'Criando...' : 'Criar usuário'}
                    </button>
                  </div>

                  {message && <p style={messageStyle}>{message}</p>}
                </form>
              </section>
            ) : (
              <section style={panelCard}>
                <h2 style={panelTitle}>Criação bloqueada</h2>
                <p style={panelSubtitle}>Apenas admin pode criar usuários e logins.</p>
              </section>
            )}
          </aside>
        </section>
      </div>
    </LayoutShell>
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

function Th({ children }: { children: React.ReactNode }) {
  return <th style={thStyle}>{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={tdStyle}>{children}</td>
}

const pageBg: React.CSSProperties = {
  minHeight: '100vh',
  background:
    'radial-gradient(circle at top left, rgba(34,197,94,0.16), transparent 30%), radial-gradient(circle at bottom right, rgba(16,185,129,0.12), transparent 28%), #030712',
}

const centerBox: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  padding: '24px',
}

const headerCard: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '20px',
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

const gridSection: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.5fr 0.9fr',
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
}

const panelCard: React.CSSProperties = {
  borderRadius: '24px',
  border: '1px solid rgba(34,197,94,0.12)',
  background: 'linear-gradient(180deg, rgba(9,14,12,0.96), rgba(4,8,7,0.96))',
  overflow: 'hidden',
  boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
  padding: '22px 24px',
}

const panelHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  marginBottom: '18px',
}

const panelTitle: React.CSSProperties = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 700,
}

const panelSubtitle: React.CSSProperties = {
  margin: '6px 0 0',
  color: '#94a3b8',
  fontSize: '14px',
}

const filtersGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))',
  gap: '14px',
}

const formStack: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
}

const formActions: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  marginTop: '6px',
  flexWrap: 'wrap',
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
  padding: '9px 12px',
  borderRadius: '12px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '13px',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  minWidth: '900px',
  borderCollapse: 'collapse',
}

const theadRow: React.CSSProperties = {
  background: 'rgba(34,197,94,0.05)',
  textAlign: 'left',
}

const tbodyRow: React.CSSProperties = {
  borderTop: '1px solid rgba(34,197,94,0.08)',
}

const thStyle: React.CSSProperties = {
  padding: '14px 16px',
  color: '#bbf7d0',
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const tdStyle: React.CSSProperties = {
  padding: '16px',
  color: '#f8fafc',
  fontSize: '14px',
}

const emptyStateTd: React.CSSProperties = {
  padding: '28px',
  textAlign: 'center',
  color: '#94a3b8',
}

const messageStyle: React.CSSProperties = {
  margin: 0,
  color: '#bbf7d0',
  fontSize: '14px',
}

const blockedCard: React.CSSProperties = {
  maxWidth: '760px',
  margin: '0 auto',
  borderRadius: '24px',
  border: '1px solid rgba(34,197,94,0.12)',
  background: 'linear-gradient(180deg, rgba(10,18,14,0.94), rgba(4,9,7,0.94))',
  boxShadow: '0 12px 40px rgba(0,0,0,0.28)',
  padding: '28px',
}

const blockedTitle: React.CSSProperties = {
  margin: 0,
  fontSize: '28px',
  color: '#f8fafc',
}

const blockedText: React.CSSProperties = {
  margin: '10px 0 0',
  color: '#94a3b8',
  fontSize: '15px',
}