'use client'

import { useEffect, useState } from 'react'
import LayoutShell from '../components/LayoutShell'
import { supabase } from '@/lib/supabase'

type UserRole = 'admin_master' | 'admin_partner' | 'gerente' | 'afiliado'
type UserStatus = 'pending' | 'active' | 'inactive'

type UserRow = {
  id: string
  nome: string | null
  email: string | null
  role: UserRole | null
  status: UserStatus
}

type FinancialOverview = {
  available_balance: number
  current_month_amount: number
  current_period_start: string
  current_period_end: string
  last_closed_year: number | null
  last_closed_month: number | null
  last_closed_amount: number | null
}

type FinancialMonth = {
  period_year: number
  period_month: number
  period_start: string
  period_end: string
  is_current_month: boolean
  gross_amount: number
  payout_status: string
  invoice_status: string
  paid_at: string | null
}

type FinancialHouse = {
  house_id: string
  house_name: string
  amount: number
}

type AdminPayable = {
  user_id: string
  nome: string | null
  email: string | null
  role: UserRole | null
  period_year: number
  period_month: number
  period_start: string
  period_end: string
  amount: number
  payout_status: string
  invoice_status: string
  paid_at: string | null
}

export default function FinanceiroPage() {
  const [userDb, setUserDb] = useState<UserRow | null>(null)
  const [overview, setOverview] = useState<FinancialOverview | null>(null)
  const [months, setMonths] = useState<FinancialMonth[]>([])
  const [houses, setHouses] = useState<FinancialHouse[]>([])
  const [selectedMonth, setSelectedMonth] = useState<FinancialMonth | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingHouses, setLoadingHouses] = useState(false)
  const [message, setMessage] = useState('')
  const [paying, setPaying] = useState(false)
  const [paymentNotes, setPaymentNotes] = useState('')
  const [activeTab, setActiveTab] = useState<'meu' | 'pagamentos'>('meu')
  const [adminPayables, setAdminPayables] = useState<AdminPayable[]>([])
  const [loadingPayables, setLoadingPayables] = useState(false)

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

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, nome, email, role, status')
      .eq('auth_id', authData.user.id)
      .single()

    if (userError || !userData) {
      setMessage('Usuário não encontrado.')
      setLoading(false)
      return
    }

    const currentUser = userData as UserRow
    setUserDb(currentUser)

    if (currentUser.status !== 'active') {
      setLoading(false)
      return
    }

    const [overviewResponse, monthsResponse] = await Promise.all([
      supabase.rpc('get_my_financial_overview'),
      supabase.rpc('get_my_financial_months'),
    ])

    if (overviewResponse.error) {
      setMessage(`Erro ao carregar resumo financeiro: ${overviewResponse.error.message}`)
      setLoading(false)
      return
    }

    if (monthsResponse.error) {
      setMessage(`Erro ao carregar histórico financeiro: ${monthsResponse.error.message}`)
      setLoading(false)
      return
    }

    const overviewData = Array.isArray(overviewResponse.data)
      ? overviewResponse.data[0]
      : overviewResponse.data

    setOverview(overviewData as FinancialOverview)
    setMonths((monthsResponse.data || []) as FinancialMonth[])
    if (currentUser.role === 'admin_master') {
      await loadAdminPayables()
    }

    const firstMonth = (monthsResponse.data || [])[0] as FinancialMonth | undefined

    if (firstMonth) {
      setSelectedMonth(firstMonth)
      await loadHouses(firstMonth.period_year, firstMonth.period_month)
    }

    setLoading(false)
  }

  async function loadHouses(year: number, month: number) {
    setLoadingHouses(true)

    const { data, error } = await supabase.rpc('get_my_financial_by_house', {
      p_year: year,
      p_month: month,
    })

    if (error) {
      setMessage(`Erro ao carregar detalhamento por casa: ${error.message}`)
      setLoadingHouses(false)
      return
    }

    setHouses((data || []) as FinancialHouse[])
    setLoadingHouses(false)
  }

  async function selectMonth(month: FinancialMonth) {
    setSelectedMonth(month)
    await loadHouses(month.period_year, month.period_month)
  }

  async function loadAdminPayables() {
    setLoadingPayables(true)

    const { data, error } = await supabase.rpc('get_admin_financial_payables')

    if (error) {
      setMessage(`Erro ao carregar pagamentos: ${error.message}`)
      setLoadingPayables(false)
      return
    }

    setAdminPayables((data || []) as AdminPayable[])
    setLoadingPayables(false)
  }

  async function handleMarkPaid(payable: {
    user_id: string
    period_year: number
    period_month: number
  }) {
    if (!userDb || userDb.role !== 'admin_master') return

    const confirmed = window.confirm(
      `Confirmar baixa de ${formatMonthName(payable.period_month, payable.period_year)}?`
    )

    if (!confirmed) return

    setPaying(true)
    setMessage('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        setMessage('Sessão inválida. Faça login novamente.')
        setPaying(false)
        return
      }

      const res = await fetch('/api/financial/mark-paid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: payable.user_id,
          period_year: payable.period_year,
          period_month: payable.period_month,
          notes: paymentNotes.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || 'Erro ao marcar como pago.')
        setPaying(false)
        return
      }

      setMessage('Pagamento marcado como pago com sucesso.')
      setPaymentNotes('')

      await init()
      await loadAdminPayables()

      setPaying(false)
    } catch {
      setMessage('Erro inesperado ao marcar como pago.')
      setPaying(false)
    }
  }

  function formatMoney(value?: number | null) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(value || 0))
  }

  function formatDate(date?: string | null) {
    if (!date) return '-'
    return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR')
  }

  function formatMonthName(month: number, year: number) {
    const date = new Date(year, month - 1, 1)
    return date.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    })
  }

  function formatPayoutStatus(status: string, isCurrent: boolean) {
    if (isCurrent) return 'Em andamento'

    const map: Record<string, string> = {
      awaiting_nf: 'Aguardando NF',
      paid: 'Pago',
      blocked: 'Bloqueado',
      cancelled: 'Cancelado',
      open: 'Em andamento',
    }

    return map[status] || status
  }

  function formatInvoiceStatus(status: string) {
    const map: Record<string, string> = {
      not_sent: 'NF não enviada',
      sent: 'NF enviada',
      approved: 'NF aprovada',
      rejected: 'NF rejeitada',
    }

    return map[status] || status
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
        <div style={centerBox}>Financeiro indisponível.</div>
      </main>
    )
  }

  if (userDb.status === 'pending') {
    return (
      <LayoutShell
        active="financeiro"
        user={{
          nome: userDb.nome || '',
          email: userDb.email || '',
          role: userDb.role || '',
        }}
      >
        <section style={blockedCard}>
          <h1 style={blockedTitle}>Cadastro recebido</h1>
          <p style={blockedText}>
            Seu cadastro está aguardando liberação pelo administrador.
          </p>
        </section>
      </LayoutShell>
    )
  }

  if (userDb.status === 'inactive') {
    return (
      <LayoutShell
        active="financeiro"
        user={{
          nome: userDb.nome || '',
          email: userDb.email || '',
          role: userDb.role || '',
        }}
      >
        <section style={blockedCard}>
          <h1 style={blockedTitle}>Conta inativa</h1>
          <p style={blockedText}>
            Sua conta está inativa. Entre em contato com o administrador.
          </p>
        </section>
      </LayoutShell>
    )
  }

  return (
    <LayoutShell
      active="financeiro"
      user={{
        nome: userDb.nome || '',
        email: userDb.email || '',
        role: userDb.role || '',
      }}
    >
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <header style={headerCard}>
          <div>
            <p style={eyebrow}>Pagamentos</p>
            <h1 style={pageTitle}>Financeiro</h1>
            <p style={pageSubtitle}>
              Acompanhe seus ganhos, fechamentos e informações para emissão de NF.
            </p>
          </div>
        </header>

        {userDb.role === 'admin_master' && (
          <div style={tabsBar}>
            <button
              type="button"
              style={activeTab === 'meu' ? activeTabButton : tabButton}
              onClick={() => setActiveTab('meu')}
            >
              Meu Financeiro
            </button>

            <button
              type="button"
              style={activeTab === 'pagamentos' ? activeTabButton : tabButton}
              onClick={() => setActiveTab('pagamentos')}
            >
              Pagamentos
            </button>
          </div>
        )}

        {message && <p style={messageStyle}>{message}</p>}

        {activeTab === 'pagamentos' && userDb.role === 'admin_master' && (
          <section style={panelCard}>
            <div style={panelHeader}>
              <div>
                <h2 style={panelTitle}>Pagamentos / Controle de Pagamentos</h2>
                <p style={panelSubtitle}>
                  Controle mensal de valores a pagar para todos os usuários ativos.
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Observações da baixa..."
                style={textareaStyle}
              />
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={theadRow}>
                    <Th>Usuário</Th>
                    <Th>Role</Th>
                    <Th>Competência</Th>
                    <Th>Período</Th>
                    <Th>Valor</Th>
                    <Th>Status pagamento</Th>
                    <Th>Status NF</Th>
                    <Th>Pago em</Th>
                    <Th>Ação</Th>
                  </tr>
                </thead>

                <tbody>
                  {loadingPayables ? (
                    <tr>
                      <td colSpan={9} style={emptyStateTd}>
                        Carregando pagamentos...
                      </td>
                    </tr>
                  ) : adminPayables.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={emptyStateTd}>
                        Nenhum pagamento encontrado.
                      </td>
                    </tr>
                  ) : (
                    adminPayables.map((payable) => (
                      <tr
                        key={`${payable.user_id}-${payable.period_year}-${payable.period_month}`}
                        style={tbodyRow}
                      >
                        <Td>{payable.nome || payable.email || '-'}</Td>
                        <Td>{payable.role || '-'}</Td>
                        <Td>{formatMonthName(payable.period_month, payable.period_year)}</Td>
                        <Td>
                          {formatDate(payable.period_start)} até {formatDate(payable.period_end)}
                        </Td>
                        <Td>{formatMoney(payable.amount)}</Td>
                        <Td>{formatPayoutStatus(payable.payout_status, false)}</Td>
                        <Td>{formatInvoiceStatus(payable.invoice_status)}</Td>
                        <Td>
                          {payable.paid_at
                            ? new Date(payable.paid_at).toLocaleDateString('pt-BR')
                            : '-'}
                        </Td>
                        <Td>
                          {payable.payout_status !== 'paid' ? (
                            <button
                              type="button"
                              style={primaryButton}
                              disabled={paying}
                              onClick={() => handleMarkPaid(payable)}
                            >
                              {paying ? 'Salvando...' : 'Dar baixa'}
                            </button>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>Pago</span>
                          )}
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'meu' && (
          <>
            <section style={cardsGrid}>
          <section style={featuredCard}>
            <p style={cardLabel}>Saldo disponível para saque</p>
            <h2 style={bigValue}>{formatMoney(overview?.available_balance)}</h2>
            <p style={cardText}>Competências fechadas ainda não pagas.</p>
          </section>

          <section style={panelCard}>
            <p style={cardLabel}>Comissão em andamento</p>
            <h2 style={cardValue}>{formatMoney(overview?.current_month_amount)}</h2>
            <p style={cardText}>
              Período atual: {formatDate(overview?.current_period_start)} até{' '}
              {formatDate(overview?.current_period_end)}
            </p>
            <div style={warningBox}>Este valor ainda não está disponível para saque.</div>
          </section>

          <section style={panelCard}>
            <p style={cardLabel}>Último fechamento</p>

            {overview?.last_closed_year && overview?.last_closed_month ? (
              <>
                <h2 style={cardValue}>
                  {formatMoney(overview.last_closed_amount)}
                </h2>
                <p style={cardText}>
                  {formatMonthName(overview.last_closed_month, overview.last_closed_year)}
                </p>
              </>
            ) : (
              <p style={cardText}>Nenhum fechamento anterior encontrado.</p>
            )}
          </section>
        </section>

        <section style={gridSection}>
          <div style={mainColumn}>
            <section style={panelCard}>
              <div style={panelHeader}>
                <div>
                  <h2 style={panelTitle}>Histórico mensal</h2>
                  <p style={panelSubtitle}>Fechamentos e competências financeiras.</p>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRow}>
                      <Th>Competência</Th>
                      <Th>Período</Th>
                      <Th>Valor</Th>
                      <Th>Status pagamento</Th>
                      <Th>Status NF</Th>
                      <Th>Pago em</Th>
                      <Th>Ação</Th>
                    </tr>
                  </thead>

                  <tbody>
                    {months.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={emptyStateTd}>
                          Nenhum histórico financeiro encontrado.
                        </td>
                      </tr>
                    ) : (
                      months.map((month) => (
                        <tr key={`${month.period_year}-${month.period_month}`} style={tbodyRow}>
                          <Td>{formatMonthName(month.period_month, month.period_year)}</Td>
                          <Td>
                            {formatDate(month.period_start)} até {formatDate(month.period_end)}
                          </Td>
                          <Td>{formatMoney(month.gross_amount)}</Td>
                          <Td>{formatPayoutStatus(month.payout_status, month.is_current_month)}</Td>
                          <Td>{formatInvoiceStatus(month.invoice_status)}</Td>
                          <Td>{month.paid_at ? new Date(month.paid_at).toLocaleDateString('pt-BR') : '-'}</Td>
                          <Td>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                style={secondaryButton}
                                onClick={() => selectMonth(month)}
                              >
                                Ver casas
                              </button>
                            </div>
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
                  <h2 style={panelTitle}>Detalhamento por casa</h2>
                  <p style={panelSubtitle}>
                    {selectedMonth
                      ? formatMonthName(selectedMonth.period_month, selectedMonth.period_year)
                      : 'Selecione um mês para visualizar.'}
                  </p>
                </div>
              </div>

              {loadingHouses ? (
                <p style={panelSubtitle}>Carregando casas...</p>
              ) : houses.length === 0 ? (
                <div style={emptyBox}>Nenhum valor por casa encontrado.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {houses.map((house) => (
                    <div key={house.house_id} style={houseCard}>
                      <span>{house.house_name}</span>
                      <strong>{formatMoney(house.amount)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

            <aside style={sideColumn}>
              <section style={panelCard}>
                <h2 style={panelTitle}>Informações para NF</h2>
              <p style={panelSubtitle}>
                Use estas informações para emissão da nota fiscal.
              </p>

              <div style={nfList}>
                <Info label="CNPJ" value="47.149.537/0001-81" />
                <Info label="Nome/Razão" value="Michael Prado Gonçalves" />
                <Info label="Tipo" value="Prestador" />
                <Info
                  label="Serviço"
                  value="17.06.01 — Propaganda de publicidade, inclusive promoções de vendas"
                />
                <Info
                  label="Descrição sugerida"
                  value={
                    selectedMonth
                      ? `Comissão por afiliação referente ao período ${formatMonthName(
                          selectedMonth.period_month,
                          selectedMonth.period_year
                        )}.`
                      : 'Comissão por afiliação referente ao período [mês/ano].'
                  }
                />
              </div>

              <div style={warningBox}>
                Emita a nota fiscal com o valor do fechamento indicado na competência correspondente.
              </div>
            </section>
                    </aside>
                  </section>
                </>
              )}
                </div>
    </LayoutShell>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoItem}>
      <p style={infoLabel}>{label}</p>
      <p style={infoValue}>{value}</p>
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

const cardsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.2fr 1fr 1fr',
  gap: '20px',
  marginBottom: '24px',
}

const gridSection: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.5fr 0.85fr',
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

const featuredCard: React.CSSProperties = {
  ...panelCard,
  border: '1px solid rgba(34,197,94,0.24)',
  background:
    'radial-gradient(circle at top left, rgba(34,197,94,0.18), transparent 38%), linear-gradient(180deg, rgba(9,14,12,0.98), rgba(4,8,7,0.98))',
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

const cardLabel: React.CSSProperties = {
  margin: 0,
  color: '#86efac',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 800,
}

const bigValue: React.CSSProperties = {
  margin: '16px 0 8px',
  fontSize: '38px',
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const cardValue: React.CSSProperties = {
  margin: '14px 0 8px',
  fontSize: '28px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const cardText: React.CSSProperties = {
  margin: '8px 0 0',
  color: '#94a3b8',
  fontSize: '14px',
  lineHeight: 1.5,
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  minWidth: '1000px',
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

const warningBox: React.CSSProperties = {
  marginTop: '16px',
  padding: '12px 14px',
  borderRadius: '14px',
  background: 'rgba(250,204,21,0.08)',
  border: '1px solid rgba(250,204,21,0.18)',
  color: '#fde68a',
  fontSize: '13px',
  lineHeight: 1.4,
}

const messageStyle: React.CSSProperties = {
  margin: '0 0 18px',
  color: '#bbf7d0',
  fontSize: '14px',
}

const emptyBox: React.CSSProperties = {
  padding: '24px',
  borderRadius: '18px',
  border: '1px dashed rgba(34,197,94,0.18)',
  color: '#94a3b8',
  textAlign: 'center',
}

const houseCard: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '16px',
  padding: '16px',
  borderRadius: '18px',
  border: '1px solid rgba(34,197,94,0.1)',
  background: 'rgba(2, 6, 23, 0.72)',
  color: '#f8fafc',
}

const nfList: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  marginTop: '18px',
}

const infoItem: React.CSSProperties = {
  padding: '14px',
  borderRadius: '16px',
  border: '1px solid rgba(34,197,94,0.1)',
  background: 'rgba(34,197,94,0.04)',
}

const infoLabel: React.CSSProperties = {
  margin: 0,
  color: '#86efac',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 800,
}

const infoValue: React.CSSProperties = {
  margin: '7px 0 0',
  color: '#f8fafc',
  fontSize: '14px',
  lineHeight: 1.45,
  overflowWrap: 'anywhere',
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

const primaryButton: React.CSSProperties = {
  border: '1px solid rgba(34,197,94,0.25)',
  background: 'linear-gradient(180deg, #16a34a, #15803d)',
  color: '#f0fdf4',
  padding: '9px 12px',
  borderRadius: '10px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '13px',
  boxShadow: '0 0 18px rgba(34,197,94,0.16)',
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '90px',
  marginTop: '16px',
  padding: '14px 16px',
  background: 'rgba(2, 6, 23, 0.85)',
  color: '#f8fafc',
  border: '1px solid rgba(34,197,94,0.14)',
  borderRadius: '14px',
  outline: 'none',
  fontSize: '14px',
  resize: 'vertical',
}

const tabsBar: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  marginBottom: '24px',
  flexWrap: 'wrap',
}

const tabButton: React.CSSProperties = {
  border: '1px solid rgba(34,197,94,0.14)',
  background: 'rgba(2, 6, 23, 0.65)',
  color: '#94a3b8',
  padding: '11px 16px',
  borderRadius: '14px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '14px',
}

const activeTabButton: React.CSSProperties = {
  ...tabButton,
  background: 'rgba(34,197,94,0.12)',
  color: '#bbf7d0',
  border: '1px solid rgba(34,197,94,0.26)',
}