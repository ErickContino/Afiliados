'use client'

import { useEffect, useState } from 'react'
import LayoutShell from '../components/LayoutShell'
import { supabase } from '@/lib/supabase'
import { color, radius, shadow } from '@/lib/design-tokens'
import {
  Card,
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
import { Upload, FileText, Eye, X } from '../components/icons'

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
  const toast = useToast()
  const { confirm, dialog } = useConfirmDialog()

  const [userDb, setUserDb] = useState<UserRow | null>(null)
  const [overview, setOverview] = useState<FinancialOverview | null>(null)
  const [months, setMonths] = useState<FinancialMonth[]>([])
  const [houses, setHouses] = useState<FinancialHouse[]>([])
  const [selectedMonth, setSelectedMonth] = useState<FinancialMonth | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingHouses, setLoadingHouses] = useState(false)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [paymentNotes, setPaymentNotes] = useState('')
  const [activeTab, setActiveTab] = useState<'meu' | 'pagamentos'>('meu')
  const [adminPayables, setAdminPayables] = useState<AdminPayable[]>([])
  const [loadingPayables, setLoadingPayables] = useState(false)
  const [uploadMonth, setUploadMonth] = useState<FinancialMonth | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    init()
  }, [])

  async function init() {
    setLoading(true)

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
      toast.error('Usuário não encontrado.')
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
      toast.error(`Erro ao carregar resumo financeiro: ${overviewResponse.error.message}`)
      setLoading(false)
      return
    }

    if (monthsResponse.error) {
      toast.error(`Erro ao carregar histórico financeiro: ${monthsResponse.error.message}`)
      setLoading(false)
      return
    }

    const overviewData = Array.isArray(overviewResponse.data) ? overviewResponse.data[0] : overviewResponse.data

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

    const { data, error } = await supabase.rpc('get_my_financial_by_house', { p_year: year, p_month: month })

    if (error) {
      toast.error(`Erro ao carregar detalhamento por casa: ${error.message}`)
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
      toast.error(`Erro ao carregar pagamentos: ${error.message}`)
      setLoadingPayables(false)
      return
    }

    setAdminPayables((data || []) as AdminPayable[])
    setLoadingPayables(false)
  }

  async function handleMarkPaid(payable: { user_id: string; period_year: number; period_month: number }) {
    if (!userDb || userDb.role !== 'admin_master') return

    const rowKey = `${payable.user_id}-${payable.period_year}-${payable.period_month}`

    const confirmed = await confirm({
      title: 'Confirmar baixa',
      description: `Confirmar baixa de ${formatMonthName(payable.period_month, payable.period_year)}?`,
      confirmLabel: 'Confirmar baixa',
    })
    if (!confirmed) return

    setPayingId(rowKey)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        toast.error('Sessão inválida. Faça login novamente.')
        setPayingId(null)
        return
      }

      const res = await fetch('/api/financial/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          user_id: payable.user_id,
          period_year: payable.period_year,
          period_month: payable.period_month,
          notes: paymentNotes.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erro ao marcar como pago.')
        setPayingId(null)
        return
      }

      toast.success('Pagamento marcado como pago com sucesso.')
      setPaymentNotes('')

      await init()
      await loadAdminPayables()

      setPayingId(null)
    } catch {
      toast.error('Erro inesperado ao marcar como pago.')
      setPayingId(null)
    }
  }

  async function handleUploadInvoice(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadMonth || !uploadFile) return

    if (uploadFile.type !== 'application/pdf') {
      toast.error('Envie um arquivo em PDF.')
      return
    }

    setUploading(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        toast.error('Sessão inválida. Faça login novamente.')
        setUploading(false)
        return
      }

      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('period_year', String(uploadMonth.period_year))
      formData.append('period_month', String(uploadMonth.period_month))

      const res = await fetch('/api/financial/upload-invoice', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      const data = await res.json()
      setUploading(false)

      if (!res.ok) {
        toast.error(data.error || 'Erro ao enviar nota fiscal.')
        return
      }

      toast.success('Nota fiscal enviada com sucesso.')
      setUploadMonth(null)
      setUploadFile(null)
      await init()
    } catch {
      setUploading(false)
      toast.error('Erro inesperado ao enviar nota fiscal.')
    }
  }

  async function handleViewInvoice(userId: string, year: number, month: number) {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (!token) {
      toast.error('Sessão inválida. Faça login novamente.')
      return
    }

    const res = await fetch(`/api/financial/invoice-url?user_id=${userId}&period_year=${year}&period_month=${month}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    const data = await res.json()

    if (!res.ok || !data.url) {
      toast.error(data.error || 'Nota fiscal não encontrada.')
      return
    }

    window.open(data.url, '_blank', 'noopener,noreferrer')
  }

  function formatMoney(value?: number | null) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
  }

  function formatDate(date?: string | null) {
    if (!date) return '-'
    return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR')
  }

  function formatMonthName(month: number, year: number) {
    const date = new Date(year, month - 1, 1)
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
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
    return <LoadingState fullPage label="Carregando financeiro..." />
  }

  if (!userDb) {
    return (
      <div style={{ minHeight: '100vh', background: color.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.textSecondary }}>
        Financeiro indisponível.
      </div>
    )
  }

  if (userDb.status === 'pending') {
    return (
      <LayoutShell active="financeiro" user={{ nome: userDb.nome || '', email: userDb.email || '', role: userDb.role || '' }}>
        <AccessBlockedState kind="pending" />
      </LayoutShell>
    )
  }

  if (userDb.status === 'inactive') {
    return (
      <LayoutShell active="financeiro" user={{ nome: userDb.nome || '', email: userDb.email || '', role: userDb.role || '' }}>
        <AccessBlockedState kind="inactive" />
      </LayoutShell>
    )
  }

  const payableColumns: Column<AdminPayable>[] = [
    { key: 'user', header: 'Usuário', render: (p) => p.nome || p.email || '-' },
    { key: 'role', header: 'Role', render: (p) => p.role || '-' },
    { key: 'month', header: 'Competência', render: (p) => formatMonthName(p.period_month, p.period_year) },
    { key: 'period', header: 'Período', render: (p) => `${formatDate(p.period_start)} até ${formatDate(p.period_end)}` },
    { key: 'amount', header: 'Valor', render: (p) => formatMoney(p.amount) },
    {
      key: 'payout_status',
      header: 'Status pagamento',
      render: (p) => <StatusBadge status={p.payout_status} label={formatPayoutStatus(p.payout_status, false)} />,
    },
    {
      key: 'invoice_status',
      header: 'Status NF',
      render: (p) => <StatusBadge status={p.invoice_status} label={formatInvoiceStatus(p.invoice_status)} />,
    },
    { key: 'paid_at', header: 'Pago em', render: (p) => (p.paid_at ? new Date(p.paid_at).toLocaleDateString('pt-BR') : '-') },
    {
      key: 'action',
      header: 'Ação',
      render: (p) => {
        const rowKey = `${p.user_id}-${p.period_year}-${p.period_month}`
        return (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {p.invoice_status !== 'not_sent' && (
              <Button variant="ghost" size="sm" leftIcon={<Eye size={14} />} onClick={() => handleViewInvoice(p.user_id, p.period_year, p.period_month)}>
                Ver NF
              </Button>
            )}
            {p.payout_status !== 'paid' ? (
              <Button size="sm" loading={payingId === rowKey} onClick={() => handleMarkPaid(p)}>
                Dar baixa
              </Button>
            ) : (
              <span style={{ color: color.textSecondary, fontSize: '13px' }}>Pago</span>
            )}
          </div>
        )
      },
    },
  ]

  const monthColumns: Column<FinancialMonth>[] = [
    { key: 'month', header: 'Competência', render: (m) => formatMonthName(m.period_month, m.period_year) },
    { key: 'period', header: 'Período', render: (m) => `${formatDate(m.period_start)} até ${formatDate(m.period_end)}` },
    { key: 'amount', header: 'Valor', render: (m) => formatMoney(m.gross_amount) },
    {
      key: 'payout_status',
      header: 'Status pagamento',
      render: (m) => <StatusBadge status={m.payout_status} label={formatPayoutStatus(m.payout_status, m.is_current_month)} />,
    },
    {
      key: 'invoice_status',
      header: 'Status NF',
      render: (m) => <StatusBadge status={m.invoice_status} label={formatInvoiceStatus(m.invoice_status)} />,
    },
    { key: 'paid_at', header: 'Pago em', render: (m) => (m.paid_at ? new Date(m.paid_at).toLocaleDateString('pt-BR') : '-') },
    {
      key: 'actions',
      header: 'Ação',
      render: (m) => (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={() => selectMonth(m)}>
            Ver casas
          </Button>
          {!m.is_current_month &&
            (m.invoice_status === 'not_sent' ? (
              <Button variant="secondary" size="sm" leftIcon={<Upload size={14} />} onClick={() => setUploadMonth(m)}>
                Enviar NF
              </Button>
            ) : (
              <Button variant="ghost" size="sm" leftIcon={<FileText size={14} />} onClick={() => handleViewInvoice(userDb.id, m.period_year, m.period_month)}>
                Ver NF
              </Button>
            ))}
        </div>
      ),
    },
  ]

  return (
    <LayoutShell active="financeiro" user={{ nome: userDb.nome || '', email: userDb.email || '', role: userDb.role || '' }}>
      {dialog}
      {uploadMonth && (
        <InvoiceUploadModal
          month={uploadMonth}
          file={uploadFile}
          uploading={uploading}
          onFileChange={setUploadFile}
          onClose={() => {
            setUploadMonth(null)
            setUploadFile(null)
          }}
          onSubmit={handleUploadInvoice}
          formatMonthName={formatMonthName}
        />
      )}

      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <Card variant="header" style={{ marginBottom: '24px' }}>
          <p style={eyebrowStyle}>Pagamentos</p>
          <h1 style={{ margin: '10px 0 8px', fontSize: '34px', fontWeight: 800, letterSpacing: '-0.04em' }}>Financeiro</h1>
          <p style={{ margin: 0, color: color.textSecondary, fontSize: '15px' }}>
            Acompanhe seus ganhos, fechamentos e informações para emissão de NF.
          </p>
        </Card>

        {userDb.role === 'admin_master' && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <Button variant={activeTab === 'meu' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('meu')}>
              Meu Financeiro
            </Button>
            <Button variant={activeTab === 'pagamentos' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('pagamentos')}>
              Pagamentos
            </Button>
          </div>
        )}

        {activeTab === 'pagamentos' && userDb.role === 'admin_master' && (
          <Card>
            <h2 style={panelTitleStyle}>Pagamentos / Controle de Pagamentos</h2>
            <p style={panelSubtitleStyle}>Controle mensal de valores a pagar para todos os usuários ativos.</p>

            <div style={{ marginTop: '16px', marginBottom: '18px' }}>
              <textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Observações da baixa..."
                className="az-input"
                style={{
                  width: '100%',
                  minHeight: '90px',
                  padding: '14px 16px',
                  background: color.inputBg,
                  color: color.textPrimary,
                  border: `1px solid ${color.inputBorder}`,
                  borderRadius: radius.md,
                  fontSize: '14px',
                  resize: 'vertical',
                }}
              />
            </div>

            <DataTable
              columns={payableColumns}
              data={adminPayables}
              rowKey={(p) => `${p.user_id}-${p.period_year}-${p.period_month}`}
              loading={loadingPayables}
              emptyMessage="Nenhum pagamento encontrado."
            />
          </Card>
        )}

        {activeTab === 'meu' && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-5" style={{ marginBottom: '24px' }}>
              <Card variant="featured">
                <p style={cardLabelStyle}>Saldo disponível para saque</p>
                <h2 style={{ margin: '16px 0 8px', fontSize: '38px', fontWeight: 900, letterSpacing: '-0.04em' }}>
                  {formatMoney(overview?.available_balance)}
                </h2>
                <p style={cardTextStyle}>Competências fechadas ainda não pagas.</p>
              </Card>

              <Card>
                <p style={cardLabelStyle}>Comissão em andamento</p>
                <h2 style={{ margin: '14px 0 8px', fontSize: '28px', fontWeight: 900, letterSpacing: '-0.03em' }}>
                  {formatMoney(overview?.current_month_amount)}
                </h2>
                <p style={cardTextStyle}>
                  Período atual: {formatDate(overview?.current_period_start)} até {formatDate(overview?.current_period_end)}
                </p>
                <div style={{ marginTop: '16px' }}>
                  <Callout variant="warning">Este valor ainda não está disponível para saque.</Callout>
                </div>
              </Card>

              <Card>
                <p style={cardLabelStyle}>Último fechamento</p>
                {overview?.last_closed_year && overview?.last_closed_month ? (
                  <>
                    <h2 style={{ margin: '14px 0 8px', fontSize: '28px', fontWeight: 900, letterSpacing: '-0.03em' }}>
                      {formatMoney(overview.last_closed_amount)}
                    </h2>
                    <p style={cardTextStyle}>{formatMonthName(overview.last_closed_month, overview.last_closed_year)}</p>
                  </>
                ) : (
                  <p style={cardTextStyle}>Nenhum fechamento anterior encontrado.</p>
                )}
              </Card>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-[1.5fr_0.85fr] gap-6 items-start">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <Card>
                  <h2 style={panelTitleStyle}>Histórico mensal</h2>
                  <p style={{ ...panelSubtitleStyle, marginBottom: '18px' }}>Fechamentos e competências financeiras.</p>
                  <DataTable columns={monthColumns} data={months} rowKey={(m) => `${m.period_year}-${m.period_month}`} emptyMessage="Nenhum histórico financeiro encontrado." />
                </Card>

                <Card>
                  <h2 style={panelTitleStyle}>Detalhamento por casa</h2>
                  <p style={{ ...panelSubtitleStyle, marginBottom: '18px' }}>
                    {selectedMonth ? formatMonthName(selectedMonth.period_month, selectedMonth.period_year) : 'Selecione um mês para visualizar.'}
                  </p>

                  {loadingHouses ? (
                    <LoadingState label="Carregando casas..." />
                  ) : houses.length === 0 ? (
                    <div
                      style={{
                        padding: '24px',
                        borderRadius: radius.lg,
                        border: '1px dashed rgba(34,197,94,0.18)',
                        color: color.textSecondary,
                        textAlign: 'center',
                      }}
                    >
                      Nenhum valor por casa encontrado.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {houses.map((house) => (
                        <div
                          key={house.house_id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '16px',
                            padding: '16px',
                            borderRadius: radius.lg,
                            border: '1px solid rgba(34,197,94,0.1)',
                            background: 'rgba(2, 6, 23, 0.72)',
                          }}
                        >
                          <span>{house.house_name}</span>
                          <strong>{formatMoney(house.amount)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              <aside>
                <Card>
                  <h2 style={panelTitleStyle}>Informações para NF</h2>
                  <p style={panelSubtitleStyle}>Use estas informações para emissão da nota fiscal.</p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '18px' }}>
                    <NfInfo label="CNPJ" value="47.149.537/0001-81" />
                    <NfInfo label="Nome/Razão" value="Michael Prado Gonçalves" />
                    <NfInfo label="Tipo" value="Prestador" />
                    <NfInfo label="Serviço" value="17.06.01 — Propaganda de publicidade, inclusive promoções de vendas" />
                    <NfInfo
                      label="Descrição sugerida"
                      value={
                        selectedMonth
                          ? `Comissão por afiliação referente ao período ${formatMonthName(selectedMonth.period_month, selectedMonth.period_year)}.`
                          : 'Comissão por afiliação referente ao período [mês/ano].'
                      }
                    />
                  </div>

                  <div style={{ marginTop: '16px' }}>
                    <Callout variant="warning">Emita a nota fiscal com o valor do fechamento indicado na competência correspondente.</Callout>
                  </div>
                </Card>
              </aside>
            </section>
          </>
        )}
      </div>
    </LayoutShell>
  )
}

function InvoiceUploadModal({
  month,
  file,
  uploading,
  onFileChange,
  onClose,
  onSubmit,
  formatMonthName,
}: {
  month: FinancialMonth
  file: File | null
  uploading: boolean
  onFileChange: (file: File | null) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  formatMonthName: (month: number, year: number) => string
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2,6,23,0.7)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '420px' }}>
        <Card
          variant="header"
          style={{ borderRadius: radius.xl, boxShadow: shadow.cardFeatured }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Enviar nota fiscal</h2>
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: color.textSecondary, cursor: 'pointer' }}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
          <p style={{ margin: '0 0 18px', color: color.textSecondary, fontSize: '14px' }}>
            Competência: {formatMonthName(month.period_month, month.period_year)}
          </p>

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '28px',
                borderRadius: radius.lg,
                border: '1px dashed rgba(34,197,94,0.3)',
                background: 'rgba(34,197,94,0.04)',
                color: color.textSecondary,
                fontSize: '13px',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <Upload size={22} color={color.greenSoft} />
              {file ? <strong style={{ color: color.textPrimary }}>{file.name}</strong> : 'Clique para selecionar o PDF da nota fiscal'}
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                style={{ display: 'none' }}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" loading={uploading} disabled={!file}>
                Enviar NF
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}

function NfInfo({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '14px', borderRadius: radius.lg, border: '1px solid rgba(34,197,94,0.1)', background: 'rgba(34,197,94,0.04)' }}>
      <p style={{ margin: 0, color: color.greenSoft, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>{label}</p>
      <p style={{ margin: '7px 0 0', color: color.textPrimary, fontSize: '14px', lineHeight: 1.45, overflowWrap: 'anywhere' }}>{value}</p>
    </div>
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
const cardLabelStyle: React.CSSProperties = { margin: 0, color: color.greenSoft, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }
const cardTextStyle: React.CSSProperties = { margin: '8px 0 0', color: color.textSecondary, fontSize: '14px', lineHeight: 1.5 }
