'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LayoutShell from '../components/LayoutShell'
import { color } from '@/lib/design-tokens'
import {
  Card,
  Field,
  Select,
  Input,
  Button,
  Callout,
  DataTable,
  Column,
  LoadingState,
  AccessBlockedState,
  useConfirmDialog,
  useToast,
} from '../components/ui'

type LoggedUser = {
  email?: string
  db?: {
    id: string
    nome: string
    role: string
    parent_id?: string | null
  }
}

type UserRow = {
  id: string
  nome: string
  email?: string
  role: string
  parent_id?: string | null
}

type HouseRow = {
  id: string
  name: string
  commission_pool_value?: number
}

type CommissionSettingRow = {
  id: string
  manager_user_id: string
  affiliate_user_id: string
  house_id: string
  affiliate_amount: number
  active: boolean
  created_at?: string
  houses?: { id: string; name: string; active: boolean }[] | null
}

type FormState = {
  affiliate_user_id: string
  house_id: string
  affiliate_amount: string
}

const emptyForm: FormState = { affiliate_user_id: '', house_id: '', affiliate_amount: '' }

export default function ComissoesPage() {
  const toast = useToast()
  const { confirm, dialog } = useConfirmDialog()

  const [user, setUser] = useState<LoggedUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [users, setUsers] = useState<UserRow[]>([])
  const [houses, setHouses] = useState<HouseRow[]>([])
  const [settings, setSettings] = useState<CommissionSettingRow[]>([])

  const [selectedAffiliate, setSelectedAffiliate] = useState('')
  const [selectedHouse, setSelectedHouse] = useState('')

  const [form, setForm] = useState<FormState>(emptyForm)

  useEffect(() => {
    initializePage()
  }, [])

  async function initializePage() {
    setLoading(true)

    const { data: authData } = await supabase.auth.getUser()

    if (!authData.user) {
      setLoading(false)
      return
    }

    const { data: userDb } = await supabase
      .from('users')
      .select('id, nome, email, role, parent_id')
      .eq('auth_id', authData.user.id)
      .single()

    const loggedUser: LoggedUser = {
      email: authData.user.email,
      db: userDb
        ? { id: userDb.id, nome: userDb.nome, role: userDb.role, parent_id: userDb.parent_id ?? null }
        : undefined,
    }

    setUser(loggedUser)

    if (!userDb) {
      setLoading(false)
      toast.error('Usuário autenticado, mas não encontrado na tabela users.')
      return
    }

    await loadData(userDb)
    setLoading(false)
  }

  async function loadData(currentUser: { id: string; nome: string; role: string; parent_id?: string | null }) {
    const usersResponse = await supabase.from('users').select('id, nome, email, role, parent_id').order('nome')
    const housesResponse = await supabase
      .from('houses')
      .select('id, name, commission_pool_value')
      .eq('active', true)
      .order('name')

    const settingsResponse = await supabase
      .from('affiliate_commission_settings')
      .select(
        `
        id,
        manager_user_id,
        affiliate_user_id,
        house_id,
        affiliate_amount,
        active,
        created_at,
        houses!inner(id, name, active)
      `
      )
      .eq('active', true)
      .eq('houses.active', true)
      .order('created_at', { ascending: false })

    if (usersResponse.error) {
      toast.error(`Erro ao carregar usuários: ${usersResponse.error.message}`)
      return
    }
    if (housesResponse.error) {
      toast.error(`Erro ao carregar casas: ${housesResponse.error.message}`)
      return
    }
    if (settingsResponse.error) {
      toast.error(`Erro ao carregar comissões: ${settingsResponse.error.message}`)
      return
    }

    const allUsers = (usersResponse.data || []) as UserRow[]
    const allHousesRaw = (housesResponse.data || []) as HouseRow[]

    const allHouses = Array.from(new Map(allHousesRaw.map((house) => [house.name.toLowerCase(), house])).values())

    const rawSettings = (settingsResponse.data || []) as CommissionSettingRow[]

    const activeSettings = Array.from(
      new Map(
        rawSettings.map((setting) => {
          const affiliateId = setting.affiliate_user_id
          const houseName = setting.houses?.[0]?.name || setting.house_id
          return [`${affiliateId}-${houseName}`, setting]
        })
      ).values()
    )

    setUsers(allUsers)
    setHouses(allHouses)

    if (currentUser.role === 'admin_master' || currentUser.role === 'admin_partner') {
      setSettings(activeSettings)
      return
    }

    if (currentUser.role === 'gerente') {
      setSettings(activeSettings.filter((item) => item.manager_user_id === currentUser.id))
      return
    }

    setSettings([])
  }

  function resetForm() {
    setForm(emptyForm)
  }

  function startChange(setting: CommissionSettingRow) {
    setForm({
      affiliate_user_id: setting.affiliate_user_id,
      house_id: setting.house_id,
      affiliate_amount: String(setting.affiliate_amount ?? ''),
    })
  }

  function startCreateMissing(affiliateId: string, houseId: string) {
    setForm({ affiliate_user_id: affiliateId, house_id: houseId, affiliate_amount: '' })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user?.db) return

    if (user.db.role !== 'admin_master' && user.db.role !== 'gerente') {
      toast.error('Você não tem permissão para alterar comissões.')
      return
    }

    const amountNumber = Number(form.affiliate_amount)

    if (!form.affiliate_user_id || !form.house_id || !form.affiliate_amount) {
      toast.error('Preencha afiliado, casa e valor.')
      return
    }

    if (Number.isNaN(amountNumber) || amountNumber < 0) {
      toast.error('Informe um valor de comissão válido.')
      return
    }

    if (user.db.role === 'gerente') {
      const allowedAffiliate = affiliateOptions.some((affiliate) => affiliate.id === form.affiliate_user_id)
      if (!allowedAffiliate) {
        toast.error('Você só pode configurar afiliados abaixo de você.')
        return
      }
    }

    const confirmed = await confirm({
      title: 'Alterar comissão',
      description: 'Essa alteração só afetará novas conversões. Deseja continuar?',
      confirmLabel: 'Confirmar alteração',
    })
    if (!confirmed) return

    setSaving(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        setSaving(false)
        toast.error('Sessão inválida. Faça login novamente.')
        return
      }

      const managerUserId =
        user.db.role === 'admin_master' ? getAffiliateManagerId(form.affiliate_user_id) : user.db.id

      if (!managerUserId) {
        setSaving(false)
        toast.error('Não foi possível identificar o gerente do afiliado.')
        return
      }

      const res = await fetch('/api/commissions/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          manager_user_id: managerUserId,
          affiliate_user_id: form.affiliate_user_id,
          house_id: form.house_id,
          affiliate_amount: amountNumber,
        }),
      })

      const data = await res.json()
      setSaving(false)

      if (!res.ok) {
        toast.error(data.error || 'Erro ao salvar comissão. Verifique se o valor não ultrapassa o limite permitido da casa.')
        return
      }

      toast.success('Comissão alterada com sucesso. A nova regra vale para novas conversões.')
      resetForm()
      await loadData(user.db)
    } catch {
      setSaving(false)
      toast.error('Erro inesperado ao salvar comissão.')
    }
  }

  const isAdminMaster = user?.db?.role === 'admin_master'
  const isAdminPartner = user?.db?.role === 'admin_partner'
  const isManager = user?.db?.role === 'gerente'
  const canViewPage = isAdminMaster || isAdminPartner || isManager
  const canManage = isAdminMaster || isManager

  const affiliateOptions = useMemo(() => {
    if (!user?.db) return []
    const affiliates = users.filter((item) => item.role === 'afiliado')

    if (user.db.role === 'admin_master' || user.db.role === 'admin_partner') return affiliates
    if (user.db.role === 'gerente') return affiliates.filter((item) => item.parent_id === user.db?.id)
    return []
  }, [users, user])

  const filteredSettings = useMemo(() => {
    return settings.filter((item) => {
      const matchesAffiliate = selectedAffiliate ? item.affiliate_user_id === selectedAffiliate : true
      const matchesHouse = selectedHouse ? getHouseName(item.house_id) === getHouseName(selectedHouse) : true
      return matchesAffiliate && matchesHouse
    })
  }, [settings, selectedAffiliate, selectedHouse])

  const selectedCurrentSetting = useMemo(() => {
    if (!form.affiliate_user_id || !form.house_id) return null
    return settings.find((item) => item.affiliate_user_id === form.affiliate_user_id && item.house_id === form.house_id)
  }, [settings, form.affiliate_user_id, form.house_id])

  const selectedHouseData = useMemo(() => {
    if (!form.house_id) return null
    return houses.find((house) => house.id === form.house_id) || null
  }, [houses, form.house_id])

  const estimatedMaxAffiliateCommission = useMemo(() => {
    if (!selectedHouseData?.commission_pool_value) return null
    return Number(selectedHouseData.commission_pool_value)
  }, [selectedHouseData])

  const missingCommissionSettings = useMemo(() => {
    return affiliateOptions.flatMap((affiliate) => {
      return houses
        .filter((house) => {
          return !settings.some(
            (setting) => setting.affiliate_user_id === affiliate.id && getHouseName(setting.house_id) === house.name
          )
        })
        .map((house) => ({ affiliate, house }))
    })
  }, [affiliateOptions, houses, settings])

  function getUserName(userId: string) {
    return users.find((item) => item.id === userId)?.nome || 'Não encontrado'
  }

  function getHouseName(houseId: string) {
    return houses.find((item) => item.id === houseId)?.name || 'Não encontrada'
  }

  function getAffiliateManagerId(affiliateUserId: string) {
    return users.find((item) => item.id === affiliateUserId)?.parent_id || null
  }

  if (loading) {
    return <LoadingState fullPage label="Carregando comissões..." />
  }

  if (!user?.db) {
    return (
      <div style={{ minHeight: '100vh', background: color.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.textSecondary }}>
        Faça login novamente para acessar esta página.
      </div>
    )
  }

  if (!canViewPage) {
    return (
      <LayoutShell active="comissoes" user={{ nome: user.db.nome, email: user.email || '', role: user.db.role }}>
        <AccessBlockedState kind="restricted" description="Esta tela está disponível apenas para admin master, admin partner e gerente." />
      </LayoutShell>
    )
  }

  const settingsColumns: Column<CommissionSettingRow>[] = [
    { key: 'affiliate', header: 'Afiliado', render: (item) => getUserName(item.affiliate_user_id) },
    { key: 'manager', header: 'Gerente', render: (item) => getUserName(item.manager_user_id) },
    { key: 'house', header: 'Casa', render: (item) => getHouseName(item.house_id) },
    { key: 'amount', header: 'Comissão', render: (item) => `R$ ${Number(item.affiliate_amount || 0).toFixed(2)}` },
    {
      key: 'created',
      header: 'Criado em',
      render: (item) => (item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : '-'),
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (item) =>
        canManage ? (
          <Button variant="secondary" size="sm" onClick={() => startChange(item)}>
            Alterar comissão
          </Button>
        ) : (
          <span style={{ color: color.textSecondary }}>Somente leitura</span>
        ),
    },
  ]

  const missingColumns: Column<{ affiliate: UserRow; house: HouseRow }>[] = [
    { key: 'affiliate', header: 'Afiliado', render: (item) => item.affiliate.nome },
    { key: 'manager', header: 'Gerente', render: (item) => getUserName(item.affiliate.parent_id || '') },
    { key: 'house', header: 'Casa', render: (item) => item.house.name },
    {
      key: 'action',
      header: 'Ação',
      render: (item) =>
        canManage ? (
          <Button variant="secondary" size="sm" onClick={() => startCreateMissing(item.affiliate.id, item.house.id)}>
            Configurar
          </Button>
        ) : (
          <span style={{ color: color.textSecondary }}>Somente leitura</span>
        ),
    },
  ]

  return (
    <LayoutShell active="comissoes" user={{ nome: user.db.nome, email: user.email || '', role: user.db.role }}>
      {dialog}
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <Card variant="header" style={{ marginBottom: '24px' }}>
          <p style={eyebrowStyle}>Operação</p>
          <h1 style={{ margin: '10px 0 8px', fontSize: '34px', fontWeight: 800, letterSpacing: '-0.04em' }}>Comissão dos Afiliados</h1>
          <p style={{ margin: 0, color: color.textSecondary, fontSize: '15px' }}>Gerencie o valor ativo que cada afiliado recebe por casa.</p>
        </Card>

        <section className="grid grid-cols-1 xl:grid-cols-[1.5fr_0.9fr] gap-6 items-start">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Card>
              <h2 style={panelTitleStyle}>Filtros</h2>
              <p style={panelSubtitleStyle}>Refine a listagem das configurações ativas.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5" style={{ marginTop: '18px' }}>
                <Field label="Afiliado">
                  <Select value={selectedAffiliate} onChange={(e) => setSelectedAffiliate(e.target.value)}>
                    <option value="">Todos</option>
                    {affiliateOptions.map((affiliate) => (
                      <option key={affiliate.id} value={affiliate.id}>
                        {affiliate.nome}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Casa">
                  <Select value={selectedHouse} onChange={(e) => setSelectedHouse(e.target.value)}>
                    <option value="">Todas</option>
                    {houses.map((house) => (
                      <option key={house.id} value={house.id}>
                        {house.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Card>

            <Card>
              <h2 style={panelTitleStyle}>Configurações ativas</h2>
              <p style={{ ...panelSubtitleStyle, marginBottom: '18px' }}>{filteredSettings.length} registro(s) encontrado(s)</p>
              <DataTable columns={settingsColumns} data={filteredSettings} rowKey={(item) => item.id} emptyMessage="Nenhuma configuração ativa encontrada." />
            </Card>

            <Card>
              <h2 style={panelTitleStyle}>Afiliados sem comissão</h2>
              <p style={{ ...panelSubtitleStyle, marginBottom: '18px' }}>Combinações de afiliado + casa ainda sem configuração ativa.</p>
              <DataTable
                columns={missingColumns}
                data={missingCommissionSettings}
                rowKey={(item) => `${item.affiliate.id}-${item.house.id}`}
                emptyMessage="Todos os afiliados visíveis possuem comissão nas casas cadastradas."
              />
            </Card>
          </div>

          <aside>
            {canManage ? (
              <Card>
                <h2 style={panelTitleStyle}>Configurar comissão</h2>
                <p style={panelSubtitleStyle}>Alterações encerram a configuração anterior e criam uma nova.</p>

                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '18px' }}>
                  <Field label="Afiliado">
                    <Select
                      value={form.affiliate_user_id}
                      onChange={(e) => setForm((prev) => ({ ...prev, affiliate_user_id: e.target.value }))}
                    >
                      <option value="">Selecione</option>
                      {affiliateOptions.map((affiliate) => (
                        <option key={affiliate.id} value={affiliate.id}>
                          {affiliate.nome}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Casa">
                    <Select value={form.house_id} onChange={(e) => setForm((prev) => ({ ...prev, house_id: e.target.value }))}>
                      <option value="">Selecione</option>
                      {houses.map((house) => (
                        <option key={house.id} value={house.id}>
                          {house.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  {selectedCurrentSetting && (
                    <Callout variant="info">Comissão atual: R$ {Number(selectedCurrentSetting.affiliate_amount || 0).toFixed(2)}</Callout>
                  )}

                  {estimatedMaxAffiliateCommission !== null && (
                    <Callout variant="limit">
                      Máximo estimado nesta casa: R$ {estimatedMaxAffiliateCommission.toFixed(2)}
                      <br />
                      <span style={{ color: color.textSecondary, fontWeight: 500 }}>
                        O backend valida o limite real considerando a pool e os admin partners ativos.
                      </span>
                    </Callout>
                  )}

                  <Field label="Novo valor da comissão do afiliado">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.affiliate_amount}
                      onChange={(e) => setForm((prev) => ({ ...prev, affiliate_amount: e.target.value }))}
                      placeholder="Ex: 100"
                    />
                  </Field>

                  <Callout variant="warning">Essa alteração só afetará novas conversões. O histórico anterior não será recalculado.</Callout>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <Button type="submit" loading={saving}>
                      Alterar comissão
                    </Button>
                    <Button type="button" variant="ghost" onClick={resetForm}>
                      Limpar
                    </Button>
                  </div>
                </form>
              </Card>
            ) : (
              <Card>
                <h2 style={panelTitleStyle}>Somente leitura</h2>
                <p style={panelSubtitleStyle}>Admin partner pode visualizar as comissões, mas não pode alterar valores.</p>
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
