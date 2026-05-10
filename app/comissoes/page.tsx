'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LayoutShell from '../components/LayoutShell'

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
  houses?: {
    id: string
    name: string
    active: boolean
  }[] | null
}

type FormState = {
  affiliate_user_id: string
  house_id: string
  affiliate_amount: string
}

const emptyForm: FormState = {
  affiliate_user_id: '',
  house_id: '',
  affiliate_amount: '',
}

export default function ComissoesPage() {
  const [user, setUser] = useState<LoggedUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

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
    setMessage('')

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
        ? {
            id: userDb.id,
            nome: userDb.nome,
            role: userDb.role,
            parent_id: userDb.parent_id ?? null,
          }
        : undefined,
    }

    setUser(loggedUser)

    if (!userDb) {
      setLoading(false)
      setMessage('Usuário autenticado, mas não encontrado na tabela users.')
      return
    }

    await loadData(userDb)
    setLoading(false)
  }

  async function loadData(currentUser: {
    id: string
    nome: string
    role: string
    parent_id?: string | null
  }) {
    const usersResponse = await supabase
      .from('users')
      .select('id, nome, email, role, parent_id')
      .order('nome')

    const housesResponse = await supabase
      .from('houses')
      .select('id, name, commission_pool_value')
      .eq('active', true)
      .order('name')

    const settingsResponse = await supabase
      .from('affiliate_commission_settings')
      .select(`
        id,
        manager_user_id,
        affiliate_user_id,
        house_id,
        affiliate_amount,
        active,
        created_at,
        houses!inner(id, name, active)
      `)
      .eq('active', true)
      .eq('houses.active', true)
      .order('created_at', { ascending: false })

    if (usersResponse.error) {
      setMessage(`Erro ao carregar usuários: ${usersResponse.error.message}`)
      return
    }

    if (housesResponse.error) {
      setMessage(`Erro ao carregar casas: ${housesResponse.error.message}`)
      return
    }

    if (settingsResponse.error) {
      setMessage(`Erro ao carregar comissões: ${settingsResponse.error.message}`)
      return
    }

    const allUsers = (usersResponse.data || []) as UserRow[]
    const allHousesRaw = (housesResponse.data || []) as HouseRow[]

    const allHouses = Array.from(
      new Map(
        allHousesRaw.map((house) => [house.name.toLowerCase(), house])
      ).values()
    )

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
      setSettings(
        activeSettings.filter((item) => item.manager_user_id === currentUser.id)
      )
      return
    }

    setSettings([])
  }

  function resetForm() {
    setForm(emptyForm)
    setMessage('')
  }

  function startChange(setting: CommissionSettingRow) {
    setForm({
      affiliate_user_id: setting.affiliate_user_id,
      house_id: setting.house_id,
      affiliate_amount: String(setting.affiliate_amount ?? ''),
    })
    setMessage('Configuração carregada. Ao salvar, a alteração valerá apenas para novas conversões.')
  }

  function startCreateMissing(affiliateId: string, houseId: string) {
    setForm({
      affiliate_user_id: affiliateId,
      house_id: houseId,
      affiliate_amount: '',
    })

    setMessage('Configuração carregada. Informe o valor da comissão e salve.')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user?.db) return

    setMessage('')

    if (user.db.role !== 'admin_master' && user.db.role !== 'gerente') {
      setMessage('Você não tem permissão para alterar comissões.')
      return
    }

    const amountNumber = Number(form.affiliate_amount)

    if (!form.affiliate_user_id || !form.house_id || !form.affiliate_amount) {
      setMessage('Preencha afiliado, casa e valor.')
      return
    }

    if (Number.isNaN(amountNumber) || amountNumber < 0) {
      setMessage('Informe um valor de comissão válido.')
      return
    }

    if (user.db.role === 'gerente') {
      const allowedAffiliate = affiliateOptions.some(
        (affiliate) => affiliate.id === form.affiliate_user_id
      )

      if (!allowedAffiliate) {
        setMessage('Você só pode configurar afiliados abaixo de você.')
        return
      }
    }

    const confirmed = window.confirm(
      'Essa alteração só afetará novas conversões. Deseja continuar?'
    )

    if (!confirmed) return

    setSaving(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        setSaving(false)
        setMessage('Sessão inválida. Faça login novamente.')
        return
      }

      const managerUserId =
        user.db.role === 'admin_master'
          ? getAffiliateManagerId(form.affiliate_user_id)
          : user.db.id

      if (!managerUserId) {
        setSaving(false)
        setMessage('Não foi possível identificar o gerente do afiliado.')
        return
      }

      const res = await fetch('/api/commissions/upsert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
        setMessage(
          data.error ||
            'Erro ao salvar comissão. Verifique se o valor não ultrapassa o limite permitido da casa.'
        )
        return
      }

      setMessage('Comissão alterada com sucesso. A nova regra vale para novas conversões.')
      resetForm()
      await loadData(user.db)
    } catch {
      setSaving(false)
      setMessage('Erro inesperado ao salvar comissão.')
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

    if (user.db.role === 'admin_master' || user.db.role === 'admin_partner') {
      return affiliates
    }

    if (user.db.role === 'gerente') {
      return affiliates.filter((item) => item.parent_id === user.db?.id)
    }

    return []
  }, [users, user])

  const filteredSettings = useMemo(() => {
    return settings.filter((item) => {
      const matchesAffiliate = selectedAffiliate
        ? item.affiliate_user_id === selectedAffiliate
        : true

      const matchesHouse = selectedHouse
        ? getHouseName(item.house_id) === getHouseName(selectedHouse)
        : true

      return matchesAffiliate && matchesHouse
    })
  }, [settings, selectedAffiliate, selectedHouse])

  const selectedCurrentSetting = useMemo(() => {
    if (!form.affiliate_user_id || !form.house_id) return null

    return settings.find(
      (item) =>
        item.affiliate_user_id === form.affiliate_user_id &&
        item.house_id === form.house_id
    )
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
            (setting) =>
              setting.affiliate_user_id === affiliate.id &&
              getHouseName(setting.house_id) === house.name
          )
        })
        .map((house) => ({
          affiliate,
          house,
        }))
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
    return (
      <main style={pageBg}>
        <div style={centerBox}>
          <p style={{ color: '#bbf7d0', fontSize: '16px' }}>Carregando...</p>
        </div>
      </main>
    )
  }

  if (!user?.db) {
    return (
      <main style={pageBg}>
        <div style={centerBox}>
          <h1 style={{ color: '#f8fafc', marginBottom: '12px' }}>Acesso indisponível</h1>
          <p style={{ color: '#94a3b8' }}>
            Faça login novamente para acessar esta página.
          </p>
        </div>
      </main>
    )
  }

  if (!canViewPage) {
    return (
      <LayoutShell
        active="comissoes"
        user={{
          nome: user.db.nome,
          email: user.email || '',
          role: user.db.role,
        }}
      >
        <section style={blockedCard}>
          <h1 style={blockedTitle}>Acesso restrito</h1>
          <p style={blockedText}>
            Esta tela está disponível apenas para admin master, admin partner e gerente.
          </p>
        </section>
      </LayoutShell>
    )
  }

  return (
    <LayoutShell
      active="comissoes"
      user={{
        nome: user.db.nome,
        email: user.email || '',
        role: user.db.role,
      }}
    >
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <header style={headerCard}>
          <div>
            <p style={eyebrow}>Operação</p>
            <h1 style={pageTitle}>Comissão dos Afiliados</h1>
            <p style={pageSubtitle}>
              Gerencie o valor ativo que cada afiliado recebe por casa.
            </p>
          </div>
        </header>

        <section style={gridSection}>
          <div style={mainColumn}>
            <section style={panelCard}>
              <div style={panelHeader}>
                <div>
                  <h2 style={panelTitle}>Filtros</h2>
                  <p style={panelSubtitle}>Refine a listagem das configurações ativas.</p>
                </div>
              </div>

              <div style={filtersGrid}>
                <Field label="Afiliado">
                  <select
                    value={selectedAffiliate}
                    onChange={(e) => setSelectedAffiliate(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Todos</option>
                    {affiliateOptions.map((affiliate) => (
                      <option key={affiliate.id} value={affiliate.id}>
                        {affiliate.nome}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Casa">
                  <select
                    value={selectedHouse}
                    onChange={(e) => setSelectedHouse(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Todas</option>
                    {houses.map((house) => (
                      <option key={house.id} value={house.id}>
                        {house.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>

            <section style={panelCard}>
              <div style={panelHeader}>
                <div>
                  <h2 style={panelTitle}>Configurações ativas</h2>
                  <p style={panelSubtitle}>
                    {filteredSettings.length} registro(s) encontrado(s)
                  </p>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRow}>
                      <Th>Afiliado</Th>
                      <Th>Gerente</Th>
                      <Th>Casa</Th>
                      <Th>Comissão</Th>
                      <Th>Criado em</Th>
                      <Th>Ações</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSettings.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={emptyStateTd}>
                          Nenhuma configuração ativa encontrada.
                        </td>
                      </tr>
                    ) : (
                      filteredSettings.map((item) => (
                        <tr key={item.id} style={tbodyRow}>
                          <Td>{getUserName(item.affiliate_user_id)}</Td>
                          <Td>{getUserName(item.manager_user_id)}</Td>
                          <Td>{getHouseName(item.house_id)}</Td>
                          <Td>R$ {Number(item.affiliate_amount || 0).toFixed(2)}</Td>
                          <Td>
                            {item.created_at
                              ? new Date(item.created_at).toLocaleDateString('pt-BR')
                              : '-'}
                          </Td>
                          <Td>
                            {canManage ? (
                              <button
                                onClick={() => startChange(item)}
                                style={secondaryButton}
                              >
                                Alterar comissão
                              </button>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>Somente leitura</span>
                            )}
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
                  <h2 style={panelTitle}>Afiliados sem comissão</h2>
                  <p style={panelSubtitle}>
                    Combinações de afiliado + casa ainda sem configuração ativa.
                  </p>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRow}>
                      <Th>Afiliado</Th>
                      <Th>Gerente</Th>
                      <Th>Casa</Th>
                      <Th>Ação</Th>
                    </tr>
                  </thead>

                  <tbody>
                    {missingCommissionSettings.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={emptyStateTd}>
                          Todos os afiliados visíveis possuem comissão nas casas cadastradas.
                        </td>
                      </tr>
                    ) : (
                      missingCommissionSettings.map((item) => (
                        <tr
                          key={`${item.affiliate.id}-${item.house.id}`}
                          style={tbodyRow}
                        >
                          <Td>{item.affiliate.nome}</Td>
                          <Td>{getUserName(item.affiliate.parent_id || '')}</Td>
                          <Td>{item.house.name}</Td>
                          <Td>
                            {canManage ? (
                              <button
                                type="button"
                                style={secondaryButton}
                                onClick={() =>
                                  startCreateMissing(item.affiliate.id, item.house.id)
                                }
                              >
                                Configurar
                              </button>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>Somente leitura</span>
                            )}
                          </Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside style={sideColumn}>
            {canManage ? (
              <section style={panelCard}>
                <div style={panelHeader}>
                  <div>
                    <h2 style={panelTitle}>Configurar comissão</h2>
                    <p style={panelSubtitle}>
                      Alterações encerram a configuração anterior e criam uma nova.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSave} style={formStack}>
                  <Field label="Afiliado">
                    <select
                      value={form.affiliate_user_id}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          affiliate_user_id: e.target.value,
                        }))
                      }
                      style={inputStyle}
                    >
                      <option value="">Selecione</option>
                      {affiliateOptions.map((affiliate) => (
                        <option key={affiliate.id} value={affiliate.id}>
                          {affiliate.nome}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Casa">
                    <select
                      value={form.house_id}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, house_id: e.target.value }))
                      }
                      style={inputStyle}
                    >
                      <option value="">Selecione</option>
                      {houses.map((house) => (
                        <option key={house.id} value={house.id}>
                          {house.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {selectedCurrentSetting && (
                    <div style={infoBox}>
                      Comissão atual: R$ {Number(selectedCurrentSetting.affiliate_amount || 0).toFixed(2)}
                    </div>
                  )}

                  {estimatedMaxAffiliateCommission !== null && (
                    <div style={limitInfoBox}>
                      Máximo estimado nesta casa: R$ {estimatedMaxAffiliateCommission.toFixed(2)}
                      <br />
                      <span style={{ color: '#94a3b8', fontWeight: 500 }}>
                        O backend valida o limite real considerando a pool e os admin partners ativos.
                      </span>
                    </div>
                  )}

                  <Field label="Novo valor da comissão do afiliado">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.affiliate_amount}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          affiliate_amount: e.target.value,
                        }))
                      }
                      placeholder="Ex: 100"
                      style={inputStyle}
                    />
                  </Field>

                  <div style={warningBox}>
                    Essa alteração só afetará novas conversões. O histórico anterior não será recalculado.
                  </div>

                  <div style={formActions}>
                    <button type="submit" style={primaryButton} disabled={saving}>
                      {saving ? 'Salvando...' : 'Alterar comissão'}
                    </button>

                    <button type="button" onClick={resetForm} style={ghostButton}>
                      Limpar
                    </button>
                  </div>

                  {message && <p style={messageStyle}>{message}</p>}
                </form>
              </section>
            ) : (
              <section style={panelCard}>
                <h2 style={panelTitle}>Somente leitura</h2>
                <p style={panelSubtitle}>
                  Admin partner pode visualizar as comissões, mas não pode alterar valores.
                </p>
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
  gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))',
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
  border: '1px solid rgba(34,197,94,0.16)',
  background: 'rgba(34,197,94,0.08)',
  color: '#dcfce7',
  padding: '9px 12px',
  borderRadius: '10px',
  cursor: 'pointer',
  fontWeight: 600,
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

const messageStyle: React.CSSProperties = {
  margin: 0,
  color: '#bbf7d0',
  fontSize: '14px',
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

const infoBox: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: '14px',
  background: 'rgba(34,197,94,0.08)',
  border: '1px solid rgba(34,197,94,0.16)',
  color: '#bbf7d0',
  fontSize: '13px',
  fontWeight: 700,
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

const limitInfoBox: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: '14px',
  background: 'rgba(59,130,246,0.08)',
  border: '1px solid rgba(59,130,246,0.18)',
  color: '#bfdbfe',
  fontSize: '13px',
  fontWeight: 700,
  lineHeight: 1.5,
}