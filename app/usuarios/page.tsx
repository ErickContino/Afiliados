'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LayoutShell from '../components/LayoutShell'
import { color, radius } from '@/lib/design-tokens'
import {
  Card,
  Field,
  Input,
  Select,
  Button,
  Callout,
  DataTable,
  Column,
  StatusBadge,
  LoadingState,
  AccessBlockedState,
  useConfirmDialog,
  useToast,
} from '../components/ui'
import { CheckCircle2, XCircle, AlertTriangle } from '../components/icons'

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
  const toast = useToast()
  const { confirm, dialog } = useConfirmDialog()

  const [users, setUsers] = useState<UserRow[]>([])
  const [houses, setHouses] = useState<HouseRow[]>([])
  const [links, setLinks] = useState<UserHouseLink[]>([])
  const [linkForm, setLinkForm] = useState<Record<string, string>>({})
  const [baselineForm, setBaselineForm] = useState<Record<string, string>>({})

  const [unregisteredAffiliates, setUnregisteredAffiliates] = useState<UnregisteredAffiliate[]>([])
  const [currentUser, setCurrentUser] = useState<LoggedUser | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
      toast.error('Usuário autenticado não encontrado na tabela users.')
      return
    }

    const loggedUser = userDb as UserRow

    setCurrentUser({ email: authData.user.email, db: loggedUser })

    await Promise.all([loadUsers(), loadHouses(), loadLinks(), loadUnregisteredAffiliates(loggedUser)])

    setLoading(false)
  }

  async function loadUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('id, nome, email, role, parent_id, afiliado_nome, status')
      .order('email')

    if (error || !data) {
      toast.error(`Erro ao carregar usuários: ${error?.message || 'erro desconhecido'}`)
      return
    }

    setUsers(data as UserRow[])
  }

  async function loadHouses() {
    const { data, error } = await supabase.from('houses').select('id, name').eq('active', true).order('name')

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

    if (error || !data) return []
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
      toast.error(`Erro ao carregar afiliados não cadastrados: ${error?.message || 'erro desconhecido'}`)
      return
    }

    setUnregisteredAffiliates(data as UnregisteredAffiliate[])
  }

  async function reloadAll() {
    if (!currentUser?.db) return

    await Promise.all([loadUsers(), loadHouses(), loadLinks(), loadUnregisteredAffiliates(currentUser.db)])
  }

  async function handleManualCreate(e: React.FormEvent) {
    e.preventDefault()

    if (!currentUser?.db) return

    if (currentUser.db.role !== 'admin_master') {
      toast.error('Apenas admin_master pode criar usuários.')
      return
    }

    if (!manualForm.nome.trim() || !manualForm.email.trim() || !manualForm.senha.trim()) {
      toast.error('Preencha nome, email e senha.')
      return
    }

    if (!manualForm.afiliado_nome.trim()) {
      toast.error('Defina o nome de match no CSV.')
      return
    }

    const parentId = manualForm.role === 'afiliado' ? manualForm.parent_id || null : null

    if (manualForm.role === 'afiliado' && !parentId) {
      toast.error('Selecione um gerente responsável para o afiliado.')
      return
    }

    setSaving(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        setSaving(false)
        toast.error('Sessão inválida. Faça login novamente.')
        return
      }

      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
        toast.error(`Erro ao criar usuário: ${data.error || 'Erro desconhecido.'}`)
        return
      }

      toast.success('Usuário criado com sucesso.')
      setManualForm(emptyManualForm)
      await reloadAll()
    } catch {
      setSaving(false)
      toast.error('Erro inesperado ao criar usuário.')
    }
  }

  async function handleCompleteUser(e: React.FormEvent) {
    e.preventDefault()

    if (!currentUser?.db) return

    if (currentUser.db.role !== 'admin_master') {
      toast.error('Apenas admin_master pode completar cadastro.')
      return
    }

    if (!completeForm.user_id) {
      toast.error('Selecione um usuário para completar ou editar.')
      return
    }

    if (!completeForm.nome.trim() || !completeForm.role) {
      toast.error('Preencha nome e role.')
      return
    }

    const parentId = completeForm.role === 'afiliado' ? completeForm.parent_id || null : null

    if (completeForm.role === 'afiliado' && !parentId) {
      toast.error('Selecione um gerente responsável para o afiliado.')
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
        toast.error('Sessão inválida. Faça login novamente.')
        return
      }

      const res = await fetch('/api/users/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
        toast.error(`Erro ao salvar cadastro: ${data.error || 'Erro desconhecido.'}`)
        return
      }

      toast.success('Cadastro salvo com sucesso.')
      setCompleteForm(emptyCompleteForm)
      setLinkForm({})
      setBaselineForm({})
      await reloadAll()
    } catch {
      setSaving(false)
      toast.error('Erro inesperado ao salvar cadastro.')
    }
  }

  async function handleAssignAffiliate(e: React.FormEvent) {
    e.preventDefault()

    if (!currentUser?.db) return

    if (currentUser.db.role !== 'admin_master') {
      toast.error('Apenas admin_master pode atribuir afiliados.')
      return
    }

    if (!assigningAffiliate) {
      toast.error('Selecione um afiliado do CSV.')
      return
    }

    if (!selectedAssignUserId) {
      toast.error('Selecione um usuário para atribuir.')
      return
    }

    setSaving(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        setSaving(false)
        toast.error('Sessão inválida. Faça login novamente.')
        return
      }

      const res = await fetch('/api/users/assign-affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: selectedAssignUserId, afiliado_nome: assigningAffiliate.afiliado }),
      })

      const data = await res.json()
      setSaving(false)

      if (!res.ok) {
        toast.error(
          data.error === 'Afiliado já vinculado a outro usuário'
            ? 'Este afiliado já está vinculado a outro usuário.'
            : `Erro ao atribuir afiliado: ${data.error || 'Erro desconhecido.'}`
        )
        return
      }

      toast.success('Afiliado vinculado com sucesso.')
      setAssigningAffiliate(null)
      setSelectedAssignUserId('')
      await reloadAll()
    } catch {
      setSaving(false)
      toast.error('Erro inesperado ao atribuir afiliado.')
    }
  }

  async function handleDeactivate(user: UserRow) {
    const confirmed = await confirm({
      title: 'Desativar usuário',
      description: `Tem certeza que deseja desativar ${user.nome || user.email}? O acesso dele será bloqueado até ser reativado.`,
      confirmLabel: 'Desativar',
      danger: true,
    })
    if (!confirmed) return

    const { data: sessionData } = await supabase.auth.getSession()

    const res = await fetch('/api/users/deactivate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token}` },
      body: JSON.stringify({ user_id: user.id }),
    })

    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error || 'Erro ao desativar usuário.')
      return
    }

    toast.success('Usuário desativado com sucesso.')
    await reloadAll()
  }

  async function handleReactivate(userId: string) {
    const { data: sessionData } = await supabase.auth.getSession()

    const res = await fetch('/api/users/reactivate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token}` },
      body: JSON.stringify({ user_id: userId }),
    })

    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error || 'Erro ao reativar usuário.')
      return
    }

    toast.success('Usuário reativado com sucesso.')
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
    toast.success(`Editando cadastro de ${user.nome || user.email}.`)
  }

  function resetCompleteForm() {
    setCompleteForm(emptyCompleteForm)
    setLinkForm({})
    setBaselineForm({})
  }

  const isAdminMaster = currentUser?.db?.role === 'admin_master'
  const canViewPage = isAdminMaster
  const canCreateUser = isAdminMaster

  const pendingUsers = useMemo(() => users.filter((u) => u.status === 'pending'), [users])
  const activeUsers = useMemo(() => users.filter((u) => u.status === 'active'), [users])
  const inactiveUsers = useMemo(() => users.filter((u) => u.status === 'inactive'), [users])
  const managerOptions = useMemo(() => users.filter((u) => u.role === 'gerente' && u.status === 'active'), [users])

  const assignUserOptions = useMemo(() => {
    return [...pendingUsers, ...activeUsers].sort((a, b) => {
      const aHasAffiliate = Boolean(a.afiliado_nome)
      const bHasAffiliate = Boolean(b.afiliado_nome)

      if (aHasAffiliate !== bHasAffiliate) return aHasAffiliate ? 1 : -1
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      return !links.some((link) => link.user_id === userId && link.house_id === house.id && link.active && link.tracking_link)
    }).length
  }

  function formatRole(role: UserRole | null) {
    if (!role) return '-'
    const map = { admin_master: 'Admin Master', admin_partner: 'Admin Partner', gerente: 'Gerente', afiliado: 'Afiliado' }
    return map[role] || role
  }

  function formatStatus(status?: UserStatus) {
    const map = { pending: 'Pendente', active: 'Ativo', inactive: 'Inativo' }
    return map[status || 'pending']
  }

  function LinkSummary({ userId }: { userId: string }) {
    const missing = getMissingLinksCount(userId)

    if (houses.length === 0) return <span style={{ color: color.textSecondary }}>Sem casas ativas</span>
    if (missing === 0)
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: color.greenSofter }}>
          <CheckCircle2 size={14} /> Completo
        </span>
      )

    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: color.amberText }}>
        <AlertTriangle size={14} /> {missing} casa(s) sem link
      </span>
    )
  }

  if (loading) {
    return <LoadingState fullPage label="Carregando usuários..." />
  }

  if (!currentUser?.db) {
    return (
      <div style={{ minHeight: '100vh', background: color.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.textSecondary }}>
        Faça login novamente para acessar esta página.
      </div>
    )
  }

  if (currentUser.db.status === 'pending') {
    return <AccessBlockedState kind="pending" fullPage />
  }

  if (!canViewPage) {
    return (
      <LayoutShell active="usuarios" user={{ nome: currentUser.db.nome || '', email: currentUser.email || '', role: currentUser.db.role || '' }}>
        <AccessBlockedState kind="restricted" description="Esta tela está disponível apenas para admin master." />
      </LayoutShell>
    )
  }

  const pendingColumns: Column<UserRow>[] = [
    { key: 'nome', header: 'Nome', render: (u) => u.nome || '-' },
    { key: 'email', header: 'Email', render: (u) => u.email || '-' },
    { key: 'status', header: 'Status', render: (u) => <StatusBadge status={u.status} label={formatStatus(u.status)} /> },
    {
      key: 'action',
      header: 'Ação',
      render: (u) => (
        <Button variant="secondary" size="sm" onClick={() => startCompleteUser(u)}>
          Completar cadastro
        </Button>
      ),
    },
  ]

  const unregisteredColumns: Column<UnregisteredAffiliate>[] = [
    { key: 'nome', header: 'Nome no CSV', render: (a) => a.afiliado },
    {
      key: 'status',
      header: 'Status',
      render: () => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: color.redText }}>
          <XCircle size={14} /> Não vinculado
        </span>
      ),
    },
    { key: 'qtd', header: 'Conversões', render: (a) => a.qtd_conversoes },
    { key: 'primeira', header: 'Primeira', render: (a) => formatDate(a.primeira_conversao) },
    { key: 'ultima', header: 'Última', render: (a) => formatDate(a.ultima_conversao) },
    { key: 'casas', header: 'Casas', render: (a) => a.casas || '-' },
    {
      key: 'action',
      header: 'Ação',
      render: (a) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setAssigningAffiliate(a)
            setSelectedAssignUserId('')
          }}
        >
          Atribuir usuário
        </Button>
      ),
    },
  ]

  const activeColumns: Column<UserRow>[] = [
    { key: 'nome', header: 'Nome', render: (u) => u.nome || '-' },
    { key: 'csv', header: 'Nome CSV', render: (u) => u.afiliado_nome || '-' },
    { key: 'email', header: 'Email', render: (u) => u.email || '-' },
    { key: 'role', header: 'Role', render: (u) => formatRole(u.role) },
    { key: 'status', header: 'Status', render: (u) => <StatusBadge status={u.status} label={formatStatus(u.status)} /> },
    { key: 'manager', header: 'Gerente', render: (u) => getParentName(u.parent_id) },
    { key: 'links', header: 'Links', render: (u) => <LinkSummary userId={u.id} /> },
    {
      key: 'actions',
      header: 'Ação',
      render: (u) => (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={() => startCompleteUser(u)}>
            Editar cadastro
          </Button>
          {currentUser?.db?.role === 'admin_master' && u.role !== 'admin_master' && (
            <Button variant="danger" size="sm" onClick={() => handleDeactivate(u)}>
              Desativar
            </Button>
          )}
        </div>
      ),
    },
  ]

  const inactiveColumns: Column<UserRow>[] = [
    { key: 'nome', header: 'Nome', render: (u) => u.nome || '-' },
    { key: 'email', header: 'Email', render: (u) => u.email || '-' },
    { key: 'role', header: 'Role', render: (u) => formatRole(u.role) },
    { key: 'status', header: 'Status', render: (u) => <StatusBadge status={u.status} label={formatStatus(u.status)} /> },
    {
      key: 'action',
      header: 'Ações',
      render: (u) => (
        <Button size="sm" onClick={() => handleReactivate(u.id)}>
          Reativar
        </Button>
      ),
    },
  ]

  return (
    <LayoutShell active="usuarios" user={{ nome: currentUser.db.nome || '', email: currentUser.email || '', role: currentUser.db.role || '' }}>
      {dialog}
      <div style={{ maxWidth: '1500px', margin: '0 auto' }}>
        <Card variant="header" style={{ marginBottom: '24px' }}>
          <p style={eyebrowStyle}>Operação</p>
          <h1 style={{ margin: '10px 0 8px', fontSize: '34px', fontWeight: 800, letterSpacing: '-0.04em' }}>Usuários</h1>
          <p style={{ margin: 0, color: color.textSecondary, fontSize: '15px' }}>
            Gerencie cadastros pendentes, usuários ativos, hierarquia e links por casa.
          </p>
        </Card>

        <section className="grid grid-cols-1 xl:grid-cols-[1.55fr_0.95fr] gap-6 items-start">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Card>
              <h2 style={panelTitleStyle}>Cadastros pendentes</h2>
              <p style={{ ...panelSubtitleStyle, marginBottom: '18px' }}>{pendingUsers.length} usuário(s) aguardando liberação.</p>
              <DataTable columns={pendingColumns} data={pendingUsers} rowKey={(u) => u.id} emptyMessage="Nenhum cadastro pendente." />
            </Card>

            <Card>
              <h2 style={panelTitleStyle}>Afiliados detectados no CSV sem usuário</h2>
              <p style={{ ...panelSubtitleStyle, marginBottom: '18px' }}>
                Nomes encontrados em conversions.afiliado sem match em users.afiliado_nome.
              </p>
              <DataTable
                columns={unregisteredColumns}
                data={unregisteredAffiliates}
                rowKey={(a) => a.afiliado}
                emptyMessage="Nenhum afiliado sem usuário encontrado."
              />
            </Card>

            <Card>
              <h2 style={panelTitleStyle}>Filtros</h2>
              <p style={{ ...panelSubtitleStyle, marginBottom: '18px' }}>Refine a listagem de usuários ativos.</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <Field label="Role">
                  <Select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="admin_master">Admin master</option>
                    <option value="admin_partner">Admin partner</option>
                    <option value="gerente">Gerente</option>
                    <option value="afiliado">Afiliado</option>
                  </Select>
                </Field>

                <Field label="Gerente">
                  <Select value={selectedManager} onChange={(e) => setSelectedManager(e.target.value)}>
                    <option value="">Todos</option>
                    {managerOptions.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.nome}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Links">
                  <Select value={selectedLinkStatus} onChange={(e) => setSelectedLinkStatus(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="com_link">Links completos</option>
                    <option value="sem_link">Com link faltando</option>
                  </Select>
                </Field>
              </div>
            </Card>

            <Card>
              <h2 style={panelTitleStyle}>Usuários ativos</h2>
              <p style={{ ...panelSubtitleStyle, marginBottom: '18px' }}>{filteredActiveUsers.length} registro(s) encontrado(s)</p>
              <DataTable columns={activeColumns} data={filteredActiveUsers} rowKey={(u) => u.id} emptyMessage="Nenhum usuário ativo encontrado." />
            </Card>

            {inactiveUsers.length > 0 && (
              <Card>
                <h2 style={panelTitleStyle}>Usuários inativos</h2>
                <p style={{ ...panelSubtitleStyle, marginBottom: '18px' }}>{inactiveUsers.length} registro(s)</p>
                <DataTable columns={inactiveColumns} data={inactiveUsers} rowKey={(u) => u.id} />
              </Card>
            )}
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {assigningAffiliate && (
              <Card>
                <h2 style={panelTitleStyle}>Atribuir afiliado do CSV</h2>
                <p style={panelSubtitleStyle}>
                  Vincule <b>{assigningAffiliate.afiliado}</b> a um usuário existente.
                </p>

                <form onSubmit={handleAssignAffiliate} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '18px' }}>
                  <Field label="Usuário">
                    <Select value={selectedAssignUserId} onChange={(e) => setSelectedAssignUserId(e.target.value)}>
                      <option value="">Selecione</option>
                      {assignUserOptions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome || u.email} — {u.afiliado_nome ? `já vinculado: ${u.afiliado_nome}` : 'sem vínculo'}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Callout variant="warning">Esta ação irá definir o match CSV deste usuário como: {assigningAffiliate.afiliado}</Callout>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <Button type="submit" loading={saving}>
                      Confirmar atribuição
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setAssigningAffiliate(null)
                        setSelectedAssignUserId('')
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            <Card>
              <h2 style={panelTitleStyle}>{completeForm.user_id ? 'Completar / editar cadastro' : 'Completar cadastro'}</h2>
              <p style={panelSubtitleStyle}>Use para liberar pendentes, editar hierarquia e atualizar links por casa.</p>

              <form onSubmit={handleCompleteUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '18px' }}>
                <Field label="Usuário">
                  <Select
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
                  >
                    <option value="">Selecione</option>
                    {[...pendingUsers, ...activeUsers].map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome || u.email} — {u.email}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Nome">
                  <Input type="text" value={completeForm.nome} onChange={(e) => setCompleteForm((prev) => ({ ...prev, nome: e.target.value }))} />
                </Field>

                <Field label="Nome de match no CSV">
                  <Input
                    type="text"
                    value={completeForm.afiliado_nome}
                    onChange={(e) => setCompleteForm((prev) => ({ ...prev, afiliado_nome: e.target.value }))}
                    placeholder="Precisa bater com conversions.afiliado"
                  />
                </Field>

                <Field label="Role">
                  <Select
                    value={completeForm.role}
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole
                      setCompleteForm((prev) => ({ ...prev, role: nextRole, parent_id: nextRole === 'afiliado' ? prev.parent_id : '' }))
                    }}
                  >
                    <option value="afiliado">Afiliado</option>
                    <option value="gerente">Gerente</option>
                    <option value="admin_partner">Admin partner</option>
                  </Select>
                </Field>

                {completeForm.role === 'afiliado' && (
                  <Field label="Gerente responsável">
                    <Select value={completeForm.parent_id} onChange={(e) => setCompleteForm((prev) => ({ ...prev, parent_id: e.target.value }))}>
                      <option value="">Selecione</option>
                      {managerOptions.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.nome}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}

                <section
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    padding: '16px',
                    borderRadius: radius.lg,
                    border: '1px solid rgba(34,197,94,0.1)',
                    background: 'rgba(34,197,94,0.04)',
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: color.greenSofter }}>Links por casa</h3>

                  {houses.length === 0 ? (
                    <p style={panelSubtitleStyle}>Nenhuma casa ativa encontrada.</p>
                  ) : (
                    houses.map((house) => (
                      <div
                        key={house.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          padding: '14px',
                          borderRadius: radius.md,
                          border: '1px solid rgba(34,197,94,0.1)',
                          background: 'rgba(2, 6, 23, 0.45)',
                        }}
                      >
                        <Field label={`${house.name} — Tracking link`}>
                          <Input
                            type="text"
                            value={linkForm[house.id] || ''}
                            onChange={(e) => setLinkForm((prev) => ({ ...prev, [house.id]: e.target.value }))}
                            placeholder="Tracking link"
                          />
                        </Field>

                        <Field label="Baseline">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={baselineForm[house.id] || ''}
                            onChange={(e) => setBaselineForm((prev) => ({ ...prev, [house.id]: e.target.value }))}
                            placeholder="Ex: 50"
                          />
                        </Field>
                      </div>
                    ))
                  )}
                </section>

                {completeForm.user_id && Object.values(linkForm).every((value) => !value.trim()) && (
                  <Callout variant="warning">Este usuário ainda não possui links cadastrados.</Callout>
                )}

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <Button type="submit" loading={saving}>
                    Salvar cadastro
                  </Button>
                  <Button type="button" variant="ghost" onClick={resetCompleteForm}>
                    Limpar
                  </Button>
                </div>
              </form>
            </Card>

            {canCreateUser && (
              <Card>
                <h2 style={panelTitleStyle}>Criar usuário manualmente</h2>
                <p style={panelSubtitleStyle}>Fluxo administrativo via Auth. Use quando precisar criar login manual.</p>

                <form onSubmit={handleManualCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '18px' }}>
                  <Field label="Nome">
                    <Input
                      type="text"
                      value={manualForm.nome}
                      onChange={(e) => setManualForm((prev) => ({ ...prev, nome: e.target.value }))}
                      placeholder="Ex: AfiliadoA4"
                    />
                  </Field>

                  <Field label="Nome de match no CSV">
                    <Input
                      type="text"
                      value={manualForm.afiliado_nome}
                      onChange={(e) => setManualForm((prev) => ({ ...prev, afiliado_nome: e.target.value }))}
                      placeholder="Precisa bater com conversions.afiliado"
                    />
                  </Field>

                  <Field label="Email">
                    <Input
                      type="email"
                      value={manualForm.email}
                      onChange={(e) => setManualForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="Ex: afiliadoa4@test.com"
                    />
                  </Field>

                  <Field label="Senha temporária">
                    <Input
                      type="password"
                      value={manualForm.senha}
                      onChange={(e) => setManualForm((prev) => ({ ...prev, senha: e.target.value }))}
                      placeholder="Digite uma senha"
                    />
                  </Field>

                  <Field label="Role">
                    <Select
                      value={manualForm.role}
                      onChange={(e) => {
                        const nextRole = e.target.value as UserRole
                        setManualForm((prev) => ({ ...prev, role: nextRole, parent_id: nextRole === 'afiliado' ? prev.parent_id : '' }))
                      }}
                    >
                      <option value="afiliado">Afiliado</option>
                      <option value="gerente">Gerente</option>
                      <option value="admin_partner">Admin partner</option>
                    </Select>
                  </Field>

                  {manualForm.role === 'afiliado' && (
                    <Field label="Gerente responsável">
                      <Select value={manualForm.parent_id} onChange={(e) => setManualForm((prev) => ({ ...prev, parent_id: e.target.value }))}>
                        <option value="">Selecione</option>
                        {managerOptions.map((manager) => (
                          <option key={manager.id} value={manager.id}>
                            {manager.nome}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}

                  <Button type="submit" loading={saving}>
                    Criar usuário
                  </Button>
                </form>
              </Card>
            )}
          </aside>
        </section>
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

const panelTitleStyle: React.CSSProperties = { margin: 0, fontSize: '18px', fontWeight: 700 }
const panelSubtitleStyle: React.CSSProperties = { margin: '6px 0 0', color: color.textSecondary, fontSize: '14px' }
