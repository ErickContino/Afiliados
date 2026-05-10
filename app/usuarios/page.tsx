'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LayoutShell from '../components/LayoutShell'

type UserRole = 'admin_master' | 'admin_partner' | 'gerente' | 'afiliado'
type UserStatus = 'pending' | 'active' | 'inactive'

type UserRow = {
  id: string
  nome: string | null
  email: string | null
  role: UserRole | null
  parent_id?: string | null
  afiliado_nome?: string | null
  auth_id?: string | null
  status: UserStatus
}

type LoggedUser = {
  email?: string
  db?: UserRow
}

type HouseRow = {
  id: string
  name: string
}

type UserHouseLink = {
  id: string
  user_id: string
  house_id: string
  tracking_link: string
  baseline_value: number | null
  active: boolean
}

type ManualCreateForm = {
  nome: string
  email: string
  senha: string
  role: UserRole
  parent_id: string
  afiliado_nome: string
}

type CompleteForm = {
  user_id: string
  nome: string
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

const emptyManualForm: ManualCreateForm = {
  nome: '',
  email: '',
  senha: '',
  role: 'afiliado',
  parent_id: '',
  afiliado_nome: '',
}

const emptyCompleteForm: CompleteForm = {
  user_id: '',
  nome: '',
  role: 'afiliado',
  parent_id: '',
  afiliado_nome: '',
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [houses, setHouses] = useState<HouseRow[]>([])
  const [links, setLinks] = useState<UserHouseLink[]>([])
  const [linkForm, setLinkForm] = useState<Record<string, string>>({})
  const [baselineForm, setBaselineForm] = useState<Record<string, string>>({})

  const [unregisteredAffiliates, setUnregisteredAffiliates] = useState<UnregisteredAffiliate[]>([])
  const [currentUser, setCurrentUser] = useState<LoggedUser | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [selectedRole, setSelectedRole] = useState('')
  const [selectedManager, setSelectedManager] = useState('')
  const [selectedLinkStatus, setSelectedLinkStatus] = useState('')

  const [manualForm, setManualForm] = useState<ManualCreateForm>(emptyManualForm)
  const [completeForm, setCompleteForm] = useState<CompleteForm>(emptyCompleteForm)
  const [assigningAffiliate, setAssigningAffiliate] = useState<UnregisteredAffiliate | null>(null)
  const [selectedAssignUserId, setSelectedAssignUserId] = useState('')

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
      .select('id, nome, email, role, parent_id, afiliado_nome, status')
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

    await Promise.all([
      loadUsers(),
      loadHouses(),
      loadLinks(),
      loadUnregisteredAffiliates(loggedUser),
    ])

    setLoading(false)
  }

  async function loadUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('id, nome, email, role, parent_id, afiliado_nome, status')
      .order('email')

    if (error || !data) {
      setMessage(`Erro ao carregar usuários: ${error?.message || 'erro desconhecido'}`)
      return
    }

    setUsers(data as UserRow[])
  }

  async function loadHouses() {
    const { data, error } = await supabase
      .from('houses')
      .select('id, name')
      .eq('active', true)
      .order('name')

    if (error || !data) {
      setHouses([])
      return
    }

    setHouses(data as HouseRow[])
  }

  async function loadLinks() {
    const { data, error } = await supabase
      .from('user_house_links')
      .select('id, user_id, house_id, tracking_link, baseline_value, active')
      .eq('active', true)

    if (error || !data) {
      setLinks([])
      return
    }

    setLinks(data as UserHouseLink[])
  }

  async function loadLinksForUser(userId: string) {
    const { data, error } = await supabase
      .from('user_house_links')
      .select('id, user_id, house_id, tracking_link, baseline_value, active')
      .eq('user_id', userId)
      .eq('active', true)

    if (error || !data) {
      return []
    }

    return data as UserHouseLink[]
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
      setMessage(`Erro ao carregar afiliados não cadastrados: ${error?.message || 'erro desconhecido'}`)
      return
    }

    setUnregisteredAffiliates(data as UnregisteredAffiliate[])
  }

  async function reloadAll() {
    if (!currentUser?.db) return

    await Promise.all([
      loadUsers(),
      loadHouses(),
      loadLinks(),
      loadUnregisteredAffiliates(currentUser.db),
    ])
  }

  async function handleManualCreate(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (!currentUser?.db) return

    if (currentUser.db.role !== 'admin_master') {
      setMessage('Apenas admin_master pode criar usuários.')
      return
    }

    if (!manualForm.nome.trim() || !manualForm.email.trim() || !manualForm.senha.trim()) {
      setMessage('Preencha nome, email e senha.')
      return
    }

    if (!manualForm.afiliado_nome.trim()) {
      setMessage('Defina o nome de match no CSV.')
      return
    }

    const parentId = manualForm.role === 'afiliado' ? manualForm.parent_id || null : null

    if (manualForm.role === 'afiliado' && !parentId) {
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
          nome: manualForm.nome.trim(),
          email: manualForm.email.trim(),
          senha: manualForm.senha,
          role: manualForm.role,
          parent_id: parentId,
          afiliado_nome: manualForm.afiliado_nome.trim(),
        }),
      })

      const data = await res.json()

      setSaving(false)

      if (!res.ok) {
        setMessage(`Erro ao criar usuário: ${data.error || 'Erro desconhecido.'}`)
        return
      }

      setMessage('Usuário criado com sucesso.')
      setManualForm(emptyManualForm)
      await reloadAll()
    } catch {
      setSaving(false)
      setMessage('Erro inesperado ao criar usuário.')
    }
  }

  async function handleCompleteUser(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (!currentUser?.db) return

    if (currentUser.db.role !== 'admin_master') {
      setMessage('Apenas admin_master pode completar cadastro.')
      return
    }

    if (!completeForm.user_id) {
      setMessage('Selecione um usuário para completar ou editar.')
      return
    }

    if (!completeForm.nome.trim() || !completeForm.role) {
      setMessage('Preencha nome e role.')
      return
    }

    const parentId = completeForm.role === 'afiliado' ? completeForm.parent_id || null : null

    if (completeForm.role === 'afiliado' && !parentId) {
      setMessage('Selecione um gerente responsável para o afiliado.')
      return
    }

    const linksPayload = houses
      .map((house) => {
        const trackingLink = linkForm[house.id]?.trim() || ''
        const baselineValue = baselineForm[house.id]?.trim() || ''

        return {
          house_id: house.id,
          tracking_link: trackingLink,
          baseline_value: baselineValue ? Number(baselineValue) : null,
        }
      })
      .filter((item) => item.tracking_link || item.baseline_value !== null)

    setSaving(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        setSaving(false)
        setMessage('Sessão inválida. Faça login novamente.')
        return
      }

      const res = await fetch('/api/users/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: completeForm.user_id,
          nome: completeForm.nome.trim(),
          role: completeForm.role,
          parent_id: parentId,
          afiliado_nome: completeForm.afiliado_nome.trim() || null,
          links: linksPayload,
        }),
      })

      const data = await res.json()

      setSaving(false)

      if (!res.ok) {
        setMessage(`Erro ao salvar cadastro: ${data.error || 'Erro desconhecido.'}`)
        return
      }

      setMessage('Cadastro salvo com sucesso.')
      setCompleteForm(emptyCompleteForm)
      setLinkForm({})
      setBaselineForm({})
      await reloadAll()
    } catch {
      setSaving(false)
      setMessage('Erro inesperado ao salvar cadastro.')
    }
  }

  async function handleAssignAffiliate(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (!currentUser?.db) return

    if (currentUser.db.role !== 'admin_master') {
      setMessage('Apenas admin_master pode atribuir afiliados.')
      return
    }

    if (!assigningAffiliate) {
      setMessage('Selecione um afiliado do CSV.')
      return
    }

    if (!selectedAssignUserId) {
      setMessage('Selecione um usuário para atribuir.')
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

      const res = await fetch('/api/users/assign-affiliate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: selectedAssignUserId,
          afiliado_nome: assigningAffiliate.afiliado,
        }),
      })

      const data = await res.json()

      setSaving(false)

      if (!res.ok) {
        setMessage(
          data.error === 'Afiliado já vinculado a outro usuário'
            ? 'Este afiliado já está vinculado a outro usuário.'
            : `Erro ao atribuir afiliado: ${data.error || 'Erro desconhecido.'}`
        )
        return
      }

      setMessage('Afiliado vinculado com sucesso.')
      setAssigningAffiliate(null)
      setSelectedAssignUserId('')
      await reloadAll()
    } catch {
      setSaving(false)
      setMessage('Erro inesperado ao atribuir afiliado.')
    }
  }

  async function handleDeactivate(userId: string) {
    const { data: sessionData } = await supabase.auth.getSession()

    const res = await fetch('/api/users/deactivate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session?.access_token}`,
      },
      body: JSON.stringify({
        user_id: userId,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setMessage(data.error || 'Erro ao desativar usuário.')
      return
    }

    setMessage('Usuário desativado com sucesso.')
    await reloadAll()
  }

  async function handleReactivate(userId: string) {
    const { data: sessionData } = await supabase.auth.getSession()

    const res = await fetch('/api/users/reactivate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session?.access_token}`,
      },
      body: JSON.stringify({
        user_id: userId,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setMessage(data.error || 'Erro ao reativar usuário.')
      return
    }

    setMessage('Usuário reativado com sucesso.')
    await reloadAll()
  }

  async function startCompleteUser(user: UserRow) {
    setCompleteForm({
      user_id: user.id,
      nome: user.nome || user.email?.split('@')[0] || '',
      role: user.role || 'afiliado',
      parent_id: user.parent_id || '',
      afiliado_nome: user.afiliado_nome || '',
    })

    const userLinks = await loadLinksForUser(user.id)

    const nextLinks: Record<string, string> = {}
    const nextBaselines: Record<string, string> = {}

    for (const house of houses) {
      const existingLink = userLinks.find((link) => link.house_id === house.id)

      nextLinks[house.id] = existingLink?.tracking_link || ''
      nextBaselines[house.id] =
        existingLink?.baseline_value !== null && existingLink?.baseline_value !== undefined
          ? String(existingLink.baseline_value)
          : ''
    }

    setLinkForm(nextLinks)
    setBaselineForm(nextBaselines)
    setMessage(`Editando cadastro de ${user.nome || user.email}.`)
  }

  function resetCompleteForm() {
    setCompleteForm(emptyCompleteForm)
    setLinkForm({})
    setBaselineForm({})
    setMessage('')
  }

  const isAdminMaster = currentUser?.db?.role === 'admin_master'
  const canViewPage = isAdminMaster
  const canCreateUser = isAdminMaster

  const pendingUsers = useMemo(() => {
    return users.filter((u) => u.status === 'pending')
  }, [users])

  const activeUsers = useMemo(() => {
    return users.filter((u) => u.status === 'active')
  }, [users])

  const inactiveUsers = useMemo(() => {
    return users.filter((u) => u.status === 'inactive')
  }, [users])

  const managerOptions = useMemo(() => {
    return users.filter((u) => u.role === 'gerente' && u.status === 'active')
  }, [users])

  const assignUserOptions = useMemo(() => {
    return [...pendingUsers, ...activeUsers]
      .sort((a, b) => {
        const aHasAffiliate = Boolean(a.afiliado_nome)
        const bHasAffiliate = Boolean(b.afiliado_nome)

        if (aHasAffiliate !== bHasAffiliate) {
          return aHasAffiliate ? 1 : -1
        }

        return (a.nome || a.email || '').localeCompare(b.nome || b.email || '')
      })
  }, [pendingUsers, activeUsers])

  const filteredActiveUsers = useMemo(() => {
    return activeUsers.filter((u) => {
      const matchesRole = selectedRole ? u.role === selectedRole : true
      const matchesManager = selectedManager ? u.parent_id === selectedManager : true

      const matchesLinks =
        selectedLinkStatus === 'com_link'
          ? getMissingLinksCount(u.id) === 0
          : selectedLinkStatus === 'sem_link'
            ? getMissingLinksCount(u.id) > 0
            : true

      return matchesRole && matchesManager && matchesLinks
    })
  }, [activeUsers, selectedRole, selectedManager, selectedLinkStatus, links, houses])

  function getParentName(parentId?: string | null) {
    if (!parentId) return '-'
    return users.find((u) => u.id === parentId)?.nome || '-'
  }

  function formatDate(date?: string | null) {
    if (!date) return '-'
    return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR')
  }

  function getMissingLinksCount(userId: string) {
    return houses.filter((house) => {
      return !links.some(
        (link) =>
          link.user_id === userId &&
          link.house_id === house.id &&
          link.active &&
          link.tracking_link
      )
    }).length
  }
  
  function formatRole(role: UserRole | null) {
    if (!role) return '-'

    const map = {
      admin_master: 'Admin Master',
      admin_partner: 'Admin Partner',
      gerente: 'Gerente',
      afiliado: 'Afiliado',
    }

    return map[role] || role
  }

  function formatStatus(status?: 'pending' | 'active' | 'inactive') {
    const map = {
      pending: 'Pendente',
      active: 'Ativo',
      inactive: 'Inativo',
    }

    return map[status || 'pending']
  }

  function getLinkSummary(userId: string) {
    const missing = getMissingLinksCount(userId)

    if (houses.length === 0) return 'Sem casas ativas'
    if (missing === 0) return '✔ Completo'

    return `⚠️ ${missing} casa(s) sem link`
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

  if (currentUser.db.status === 'pending') {
    return (
      <main style={pageBg}>
        <div style={centerBox}>
          <section style={blockedCard}>
            <h1 style={blockedTitle}>Cadastro recebido</h1>
            <p style={blockedText}>
              Seu cadastro está aguardando liberação pelo administrador.
            </p>
          </section>
        </div>
      </main>
    )
  }

  if (!canViewPage) {
    return (
      <LayoutShell
        active="usuarios"
        user={{
          nome: currentUser.db.nome || '',
          email: currentUser.email || '',
          role: currentUser.db.role || '',
        }}
      >
        <section style={blockedCard}>
          <h1 style={blockedTitle}>Acesso restrito</h1>
          <p style={blockedText}>Esta tela está disponível apenas para admin master.</p>
        </section>
      </LayoutShell>
    )
  }

  return (
    <LayoutShell
      active="usuarios"
      user={{
        nome: currentUser.db.nome || '',
        email: currentUser.email || '',
        role: currentUser.db.role || '',
      }}
    >
      <div style={{ maxWidth: '1500px', margin: '0 auto' }}>
        <header style={headerCard}>
          <div>
            <p style={eyebrow}>Operação</p>
            <h1 style={pageTitle}>Usuários</h1>
            <p style={pageSubtitle}>
              Gerencie cadastros pendentes, usuários ativos, hierarquia e links por casa.
            </p>
          </div>
        </header>

        <section style={gridSection}>
          <div style={mainColumn}>
            <section style={panelCard}>
              <div style={panelHeader}>
                <div>
                  <h2 style={panelTitle}>Cadastros pendentes</h2>
                  <p style={panelSubtitle}>
                    {pendingUsers.length} usuário(s) aguardando liberação.
                  </p>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRow}>
                      <Th>Nome</Th>
                      <Th>Email</Th>
                      <Th>Status</Th>
                      <Th>Ação</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={emptyStateTd}>
                          Nenhum cadastro pendente.
                        </td>
                      </tr>
                    ) : (
                      pendingUsers.map((u) => (
                        <tr key={u.id} style={tbodyRow}>
                          <Td>{u.nome || '-'}</Td>
                          <Td>{u.email || '-'}</Td>
                          <Td>{formatStatus(u.status)}</Td>
                          <Td>
                            <button
                              type="button"
                              style={secondaryButton}
                              onClick={() => startCompleteUser(u)}
                            >
                              Completar cadastro
                            </button>
                          </Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section style={panelCard}>
              <div style={panelHeader}>
                <div>
                  <h2 style={panelTitle}>Afiliados detectados no CSV sem usuário</h2>
                  <p style={panelSubtitle}>
                    Nomes encontrados em conversions.afiliado sem match em users.afiliado_nome.
                  </p>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRow}>
                      <Th>Nome no CSV</Th>
                      <Th>Status</Th>
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
                        <td colSpan={7} style={emptyStateTd}>
                          Nenhum afiliado sem usuário encontrado.
                        </td>
                      </tr>
                    ) : (
                      unregisteredAffiliates.map((affiliate) => (
                        <tr key={affiliate.afiliado} style={tbodyRow}>
                          <Td>{affiliate.afiliado}</Td>
                          <Td>❌ Não vinculado</Td>
                          <Td>{affiliate.qtd_conversoes}</Td>
                          <Td>{formatDate(affiliate.primeira_conversao)}</Td>
                          <Td>{formatDate(affiliate.ultima_conversao)}</Td>
                          <Td>{affiliate.casas || '-'}</Td>
                          <Td>
                            <button
                              type="button"
                              style={secondaryButton}
                              onClick={() => {
                                setAssigningAffiliate(affiliate)
                                setSelectedAssignUserId('')
                                setMessage(`Atribuindo ${affiliate.afiliado} a um usuário existente.`)
                              }}
                            >
                              Atribuir usuário
                            </button>
                          </Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section style={panelCard}>
              <div style={panelHeader}>
                <div>
                  <h2 style={panelTitle}>Filtros</h2>
                  <p style={panelSubtitle}>Refine a listagem de usuários ativos.</p>
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

                <Field label="Links">
                  <select
                    value={selectedLinkStatus}
                    onChange={(e) => setSelectedLinkStatus(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Todos</option>
                    <option value="com_link">Links completos</option>
                    <option value="sem_link">Com link faltando</option>
                  </select>
                </Field>
              </div>
            </section>

            <section style={panelCard}>
              <div style={panelHeader}>
                <div>
                  <h2 style={panelTitle}>Usuários ativos</h2>
                  <p style={panelSubtitle}>
                    {filteredActiveUsers.length} registro(s) encontrado(s)
                  </p>
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
                      <Th>Status</Th>
                      <Th>Gerente</Th>
                      <Th>Links</Th>
                      <Th>Ação</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActiveUsers.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={emptyStateTd}>
                          Nenhum usuário ativo encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredActiveUsers.map((u) => (
                        <tr key={u.id} style={tbodyRow}>
                          <Td>{u.nome || '-'}</Td>
                          <Td>{u.afiliado_nome || '-'}</Td>
                          <Td>{u.email || '-'}</Td>
                          <Td>{formatRole(u.role)}</Td>
                          <Td>{formatStatus(u.status)}</Td>
                          <Td>{getParentName(u.parent_id)}</Td>
                          <Td>{getLinkSummary(u.id)}</Td>
                          <Td>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                style={secondaryButton}
                                onClick={() => startCompleteUser(u)}
                              >
                                Editar cadastro
                              </button>

                              {currentUser?.db?.role === 'admin_master' &&
                                u.role !== 'admin_master' && (
                                  <button
                                    type="button"
                                    style={dangerButton}
                                    onClick={() => handleDeactivate(u.id)}
                                  >
                                    Desativar
                                  </button>
                                )}
                            </div>
                          </Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {inactiveUsers.length > 0 && (
              <section style={panelCard}>
                <div style={panelHeader}>
                  <div>
                    <h2 style={panelTitle}>Usuários inativos</h2>
                    <p style={panelSubtitle}>{inactiveUsers.length} registro(s)</p>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr style={theadRow}>
                        <Th>Nome</Th>
                        <Th>Email</Th>
                        <Th>Role</Th>
                        <Th>Status</Th>
                        <Th>Ações</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {inactiveUsers.map((u) => (
                        <tr key={u.id} style={tbodyRow}>
                          <Td>{u.nome || '-'}</Td>
                          <Td>{u.email || '-'}</Td>
                          <Td>{formatRole(u.role)}</Td>
                          <Td>{formatStatus(u.status)}</Td>
                          <Td>
                            <button
                              type="button"
                              style={primaryButton}
                              onClick={() => handleReactivate(u.id)}
                            >
                              Reativar
                            </button>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>

          <aside style={sideColumn}>
            {assigningAffiliate && (
              <section style={panelCard}>
                <div style={panelHeader}>
                  <div>
                    <h2 style={panelTitle}>Atribuir afiliado do CSV</h2>
                    <p style={panelSubtitle}>
                      Vincule <b>{assigningAffiliate.afiliado}</b> a um usuário existente.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleAssignAffiliate} style={formStack}>
                  <Field label="Usuário">
                    <select
                      value={selectedAssignUserId}
                      onChange={(e) => setSelectedAssignUserId(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Selecione</option>

                      {assignUserOptions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome || u.email} — {u.afiliado_nome
                            ? `já vinculado: ${u.afiliado_nome}`
                            : 'sem vínculo'}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div style={warningBox}>
                    Esta ação irá definir o match CSV deste usuário como: {assigningAffiliate.afiliado}
                  </div>

                  <div style={formActions}>
                    <button type="submit" style={primaryButton} disabled={saving}>
                      {saving ? 'Atribuindo...' : 'Confirmar atribuição'}
                    </button>

                    <button
                      type="button"
                      style={ghostButton}
                      onClick={() => {
                        setAssigningAffiliate(null)
                        setSelectedAssignUserId('')
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </section>
            )}
            <section style={panelCard}>
              <div style={panelHeader}>
                <div>
                  <h2 style={panelTitle}>
                    {completeForm.user_id ? 'Completar / editar cadastro' : 'Completar cadastro'}
                  </h2>
                  <p style={panelSubtitle}>
                    Use para liberar pendentes, editar hierarquia e atualizar links por casa.
                  </p>
                </div>
              </div>

              <form onSubmit={handleCompleteUser} style={formStack}>
                <Field label="Usuário">
                  <select
                    value={completeForm.user_id}
                    onChange={(e) => {
                      const selected = users.find((u) => u.id === e.target.value)

                      if (selected) {
                        startCompleteUser(selected)
                      } else {
                        setCompleteForm(emptyCompleteForm)
                        setLinkForm({})
                        setBaselineForm({})
                      }
                    }}
                    style={inputStyle}
                  >
                    <option value="">Selecione</option>
                    {[...pendingUsers, ...activeUsers].map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome || u.email} — {u.email}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Nome">
                  <input
                    type="text"
                    value={completeForm.nome}
                    onChange={(e) =>
                      setCompleteForm((prev) => ({ ...prev, nome: e.target.value }))
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Nome de match no CSV">
                  <input
                    type="text"
                    value={completeForm.afiliado_nome}
                    onChange={(e) =>
                      setCompleteForm((prev) => ({
                        ...prev,
                        afiliado_nome: e.target.value,
                      }))
                    }
                    placeholder="Precisa bater com conversions.afiliado"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Role">
                  <select
                    value={completeForm.role}
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole

                      setCompleteForm((prev) => ({
                        ...prev,
                        role: nextRole,
                        parent_id: nextRole === 'afiliado' ? prev.parent_id : '',
                      }))
                    }}
                    style={inputStyle}
                  >
                    <option value="afiliado">Afiliado</option>
                    <option value="gerente">Gerente</option>
                    <option value="admin_partner">Admin partner</option>
                  </select>
                </Field>

                {completeForm.role === 'afiliado' && (
                  <Field label="Gerente responsável">
                    <select
                      value={completeForm.parent_id}
                      onChange={(e) =>
                        setCompleteForm((prev) => ({
                          ...prev,
                          parent_id: e.target.value,
                        }))
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

                <section style={subPanel}>
                  <h3 style={subPanelTitle}>Links por casa</h3>

                  {houses.length === 0 ? (
                    <p style={panelSubtitle}>Nenhuma casa ativa encontrada.</p>
                  ) : (
                    houses.map((house) => (
                      <div key={house.id} style={linkEditCard}>
                        <Field label={`${house.name} — Tracking link`}>
                          <input
                            type="text"
                            value={linkForm[house.id] || ''}
                            onChange={(e) =>
                              setLinkForm((prev) => ({
                                ...prev,
                                [house.id]: e.target.value,
                              }))
                            }
                            placeholder="Tracking link"
                            style={inputStyle}
                          />
                        </Field>

                        <Field label="Baseline">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={baselineForm[house.id] || ''}
                            onChange={(e) =>
                              setBaselineForm((prev) => ({
                                ...prev,
                                [house.id]: e.target.value,
                              }))
                            }
                            placeholder="Ex: 50"
                            style={inputStyle}
                          />
                        </Field>
                      </div>
                    ))
                  )}
                </section>

                {completeForm.user_id &&
                  Object.values(linkForm).every((value) => !value.trim()) && (
                    <div style={warningBox}>
                      Este usuário ainda não possui links cadastrados.
                    </div>
                )}

                <div style={formActions}>
                  <button type="submit" style={primaryButton} disabled={saving}>
                    {saving ? 'Salvando...' : 'Salvar cadastro'}
                  </button>

                  <button type="button" style={ghostButton} onClick={resetCompleteForm}>
                    Limpar
                  </button>
                </div>
              </form>
            </section>

            {canCreateUser && (
              <section style={panelCard}>
                <div style={panelHeader}>
                  <div>
                    <h2 style={panelTitle}>Criar usuário manualmente</h2>
                    <p style={panelSubtitle}>
                      Fluxo administrativo via Auth. Use quando precisar criar login manual.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleManualCreate} style={formStack}>
                  <Field label="Nome">
                    <input
                      type="text"
                      value={manualForm.nome}
                      onChange={(e) =>
                        setManualForm((prev) => ({ ...prev, nome: e.target.value }))
                      }
                      placeholder="Ex: AfiliadoA4"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Nome de match no CSV">
                    <input
                      type="text"
                      value={manualForm.afiliado_nome}
                      onChange={(e) =>
                        setManualForm((prev) => ({
                          ...prev,
                          afiliado_nome: e.target.value,
                        }))
                      }
                      placeholder="Precisa bater com conversions.afiliado"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Email">
                    <input
                      type="email"
                      value={manualForm.email}
                      onChange={(e) =>
                        setManualForm((prev) => ({ ...prev, email: e.target.value }))
                      }
                      placeholder="Ex: afiliadoa4@test.com"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Senha temporária">
                    <input
                      type="password"
                      value={manualForm.senha}
                      onChange={(e) =>
                        setManualForm((prev) => ({
                          ...prev,
                          senha: e.target.value,
                        }))
                      }
                      placeholder="Digite uma senha"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Role">
                    <select
                      value={manualForm.role}
                      onChange={(e) => {
                        const nextRole = e.target.value as UserRole

                        setManualForm((prev) => ({
                          ...prev,
                          role: nextRole,
                          parent_id: nextRole === 'afiliado' ? prev.parent_id : '',
                        }))
                      }}
                      style={inputStyle}
                    >
                      <option value="afiliado">Afiliado</option>
                      <option value="gerente">Gerente</option>
                      <option value="admin_partner">Admin partner</option>
                    </select>
                  </Field>

                  {manualForm.role === 'afiliado' && (
                    <Field label="Gerente responsável">
                      <select
                        value={manualForm.parent_id}
                        onChange={(e) =>
                          setManualForm((prev) => ({
                            ...prev,
                            parent_id: e.target.value,
                          }))
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
                </form>
              </section>
            )}

            {message && <p style={messageStyle}>{message}</p>}
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
  gridTemplateColumns: '1.55fr 0.95fr',
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
  overflow: 'hidden',
  boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
  padding: '22px 24px',
}

const linkEditCard: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '14px',
  borderRadius: '16px',
  border: '1px solid rgba(34,197,94,0.1)',
  background: 'rgba(2, 6, 23, 0.45)',
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

const subPanel: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  padding: '16px',
  borderRadius: '18px',
  border: '1px solid rgba(34,197,94,0.1)',
  background: 'rgba(34,197,94,0.04)',
}

const subPanelTitle: React.CSSProperties = {
  margin: 0,
  fontSize: '15px',
  fontWeight: 700,
  color: '#bbf7d0',
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

const dangerButton: React.CSSProperties = {
  border: '1px solid rgba(239,68,68,0.25)',
  background: 'rgba(239,68,68,0.12)',
  color: '#fecaca',
  padding: '9px 12px',
  borderRadius: '12px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '13px',
}

const ghostButton: React.CSSProperties = {
  border: '1px solid rgba(148,163,184,0.16)',
  background: 'transparent',
  color: '#cbd5e1',
  padding: '12px 18px',
  borderRadius: '14px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '14px',
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

const warningBox: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: '14px',
  background: 'rgba(250,204,21,0.08)',
  border: '1px solid rgba(250,204,21,0.18)',
  color: '#fde68a',
  fontSize: '13px',
  lineHeight: 1.4,
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