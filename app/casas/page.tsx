'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LayoutShell from '../components/LayoutShell'
import { color, radius } from '@/lib/design-tokens'
import {
  Card,
  Field,
  Input,
  Button,
  Callout,
  DataTable,
  Column,
  LoadingState,
  AccessBlockedState,
  Tooltip,
  useConfirmDialog,
  useToast,
} from '../components/ui'
import { Info } from '../components/icons'

type UserRow = {
  id: string
  nome: string
  email?: string
  role: string
}

type HouseRow = {
  id: string
  name: string
  gross_value: number
  michael_box_value: number
  commission_pool_value: number
  active: boolean
  valid_from?: string | null
  valid_to?: string | null
}

const emptyForm = {
  id: '',
  name: '',
  gross_value: '',
  michael_box_value: '',
  commission_pool_value: '',
  valid_from: '',

  master_full: '',
  partner_full: '',

  gerente_master: '',
  gerente_partner: '',
  gerente_self: '',

  afiliado_master: '',
  afiliado_partner: '',
  afiliado_gerente: '',
}

export default function CasasPage() {
  const toast = useToast()
  const { confirm, dialog } = useConfirmDialog()

  const [user, setUser] = useState<{ email?: string; db?: UserRow } | null>(null)
  const [houses, setHouses] = useState<HouseRow[]>([])
  const [form, setForm] = useState(emptyForm)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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

    const { data: userDb } = await supabase
      .from('users')
      .select('id, nome, email, role')
      .eq('auth_id', authData.user.id)
      .single()

    setUser({ email: authData.user.email, db: userDb || undefined })

    if (userDb?.role === 'admin_master') {
      await loadHouses()
    }

    setLoading(false)
  }

  async function loadHouses() {
    const { data, error } = await supabase.from('houses').select('*').eq('active', true).order('name')

    if (error) {
      toast.error(`Erro ao carregar casas: ${error.message}`)
      return
    }

    setHouses((data || []) as HouseRow[])
  }

  function editHouse(house: HouseRow) {
    setForm((prev) => ({
      ...prev,
      id: house.id,
      name: house.name || '',
      gross_value: String(house.gross_value ?? ''),
      michael_box_value: String(house.michael_box_value ?? ''),
      commission_pool_value: String(house.commission_pool_value ?? ''),
      valid_from: '',
    }))

    toast.success('Casa carregada. Ao salvar, uma nova versão será criada e o histórico anterior será preservado.')
  }

  function resetForm() {
    setForm(emptyForm)
  }

  function buildRules() {
    return [
      { lead_owner_role: 'admin_master', receiver_role: 'admin_master', amount: Number(form.master_full) },
      { lead_owner_role: 'admin_partner', receiver_role: 'admin_partner', amount: Number(form.partner_full) },
      { lead_owner_role: 'gerente', receiver_role: 'admin_master', amount: Number(form.gerente_master) },
      { lead_owner_role: 'gerente', receiver_role: 'admin_partner', amount: Number(form.gerente_partner) },
      { lead_owner_role: 'gerente', receiver_role: 'gerente', amount: Number(form.gerente_self) },
      { lead_owner_role: 'afiliado', receiver_role: 'admin_master', amount: Number(form.afiliado_master) },
      { lead_owner_role: 'afiliado', receiver_role: 'admin_partner', amount: Number(form.afiliado_partner) },
      { lead_owner_role: 'afiliado', receiver_role: 'gerente', amount: Number(form.afiliado_gerente) },
      { lead_owner_role: 'afiliado', receiver_role: 'afiliado', amount: 0 },
    ]
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    if (user?.db?.role !== 'admin_master') {
      toast.error('Apenas admin_master pode gerenciar casas.')
      return
    }

    if (!form.name || !form.gross_value || !form.michael_box_value || !form.commission_pool_value) {
      toast.error('Preencha nome, valor bruto, taxa de operação e pool de comissão.')
      return
    }

    const grossValue = Number(form.gross_value)
    const boxValue = Number(form.michael_box_value)
    const poolValue = Number(form.commission_pool_value)

    if (Number.isNaN(grossValue) || Number.isNaN(boxValue) || Number.isNaN(poolValue)) {
      toast.error('Informe valores numéricos válidos nos valores principais.')
      return
    }

    if (grossValue !== boxValue + poolValue) {
      toast.error('Valor bruto precisa ser igual a taxa de operação + pool de comissão.')
      return
    }

    const rules = buildRules()

    if (rules.length !== 9) {
      toast.error('Erro interno: a casa precisa ter exatamente 9 regras.')
      return
    }

    const invalidRule = rules.some((rule) => Number.isNaN(rule.amount) || rule.amount < 0)

    if (invalidRule) {
      toast.error('Preencha todos os valores das regras com números válidos e não negativos.')
      return
    }

    const confirmed = await confirm({
      title: 'Salvar casa',
      description: 'Salvar irá criar uma nova versão da casa. Conversões antigas não serão alteradas. Deseja continuar?',
      confirmLabel: 'Salvar nova versão',
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

      const res = await fetch('/api/houses/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: form.id || null,
          name: form.name,
          gross_value: grossValue,
          michael_box_value: boxValue,
          commission_pool_value: poolValue,
          valid_from: form.valid_from || null,
          rules,
        }),
      })

      const data = await res.json()
      setSaving(false)

      if (!res.ok) {
        toast.error(data.error || 'Erro ao salvar casa.')
        return
      }

      toast.success(form.id ? 'Nova versão da casa criada com sucesso.' : 'Casa criada com sucesso.')
      resetForm()
      await loadHouses()
    } catch {
      setSaving(false)
      toast.error('Erro inesperado ao salvar casa.')
    }
  }

  const isAdminMaster = user?.db?.role === 'admin_master'

  if (loading) {
    return <LoadingState fullPage label="Carregando casas..." />
  }

  if (!user?.db || !isAdminMaster) {
    return (
      <LayoutShell
        active="casas"
        user={{ nome: user?.db?.nome || 'Usuário', email: user?.email || '', role: user?.db?.role || '' }}
      >
        <AccessBlockedState kind="restricted" description="Esta tela está disponível apenas para admin master." />
      </LayoutShell>
    )
  }

  const calculatedPool = Number(form.gross_value || 0) - Number(form.michael_box_value || 0)
  const informedPool = Number(form.commission_pool_value || 0)
  const poolMismatch = !Number.isNaN(calculatedPool) && !Number.isNaN(informedPool) && calculatedPool !== informedPool

  const columns: Column<HouseRow>[] = [
    { key: 'name', header: 'Casa', render: (h) => h.name },
    { key: 'gross', header: 'Valor bruto', render: (h) => `R$ ${Number(h.gross_value || 0).toFixed(2)}` },
    { key: 'box', header: 'Taxa de operação', render: (h) => `R$ ${Number(h.michael_box_value || 0).toFixed(2)}` },
    { key: 'pool', header: 'Pool comissão', render: (h) => `R$ ${Number(h.commission_pool_value || 0).toFixed(2)}` },
    { key: 'validity', header: 'Vigência', render: (h) => `${h.valid_from || '-'} até ${h.valid_to || 'Atual'}` },
    { key: 'status', header: 'Status', render: (h) => (h.active ? 'Ativa' : 'Inativa') },
    {
      key: 'action',
      header: 'Ação',
      render: (h) => (
        <Button variant="secondary" size="sm" onClick={() => editHouse(h)}>
          Alterar casa
        </Button>
      ),
    },
  ]

  return (
    <LayoutShell active="casas" user={{ nome: user.db.nome, email: user.email || '', role: user.db.role }}>
      {dialog}
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <Card variant="header" style={{ marginBottom: '24px' }}>
          <p style={eyebrowStyle}>Configuração</p>
          <h1 style={{ margin: '10px 0 8px', fontSize: '34px', fontWeight: 800, letterSpacing: '-0.04em' }}>Casas</h1>
          <p style={{ margin: 0, color: color.textSecondary, fontSize: '15px' }}>
            Configure valores e regras. Alterações criam nova versão e preservam histórico.
          </p>
        </Card>

        <section className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-6 items-start">
          <div>
            <Card>
              <h2 style={panelTitleStyle}>Casas ativas</h2>
              <p style={{ ...panelSubtitleStyle, marginBottom: '18px' }}>{houses.length} registro(s)</p>
              <DataTable columns={columns} data={houses} rowKey={(h) => h.id} emptyMessage="Nenhuma casa ativa cadastrada." />
            </Card>
          </div>

          <aside className="xl:sticky xl:top-6">
            <Card>
              <h2 style={panelTitleStyle}>{form.id ? 'Alterar casa' : 'Nova casa'}</h2>
              <p style={panelSubtitleStyle}>Salvar cria uma versão ativa sem recalcular histórico.</p>

              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '18px' }}>
                <Field label="Nome da casa">
                  <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ex: Betano" />
                </Field>

                <Field label="Valor bruto">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.gross_value}
                    onChange={(e) => setForm((p) => ({ ...p, gross_value: e.target.value }))}
                    placeholder="Ex: 280"
                  />
                </Field>

                <Field label="Taxa de operação">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.michael_box_value}
                    onChange={(e) => setForm((p) => ({ ...p, michael_box_value: e.target.value }))}
                    placeholder="Ex: 130"
                  />
                </Field>

                <Field label="Pool de comissão">
                  <section
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      padding: '16px',
                      borderRadius: radius.lg,
                      border: '1px solid rgba(34,197,94,0.12)',
                      background: 'rgba(34,197,94,0.04)',
                      marginBottom: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: color.textTertiary, fontSize: '14px' }}>
                      <span>Valor bruto</span>
                      <strong>R$ {Number(form.gross_value || 0).toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: color.textTertiary, fontSize: '14px' }}>
                      <span>Taxa operacional</span>
                      <strong>- R$ {Number(form.michael_box_value || 0).toFixed(2)}</strong>
                    </div>
                    <div style={{ height: '1px', background: 'rgba(34,197,94,0.12)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: color.greenSofter, fontSize: '16px', fontWeight: 700 }}>
                      <span>Pool disponível</span>
                      <strong>R$ {(Number(form.gross_value || 0) - Number(form.michael_box_value || 0)).toFixed(2)}</strong>
                    </div>
                  </section>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.commission_pool_value}
                    onChange={(e) => setForm((p) => ({ ...p, commission_pool_value: e.target.value }))}
                    placeholder="Ex: 150"
                  />
                  {poolMismatch && (
                    <div style={{ marginTop: '10px' }}>
                      <Callout variant="error">O pool informado não bate com valor bruto - taxa de operação.</Callout>
                    </div>
                  )}
                </Field>

                <Field label="Válido a partir de">
                  <Input type="date" value={form.valid_from} onChange={(e) => setForm((p) => ({ ...p, valid_from: e.target.value }))} />
                </Field>

                <Callout variant="warning">Salvar irá criar uma nova versão da casa. Conversões antigas não serão alteradas.</Callout>

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
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: color.greenSofter }}>Regras obrigatórias</h3>

                  <RuleField
                    text="Admin master trouxe o lead → Admin master recebe"
                    info="Quando o próprio admin master é o dono do lead, ele recebe o valor completo definido para essa situação."
                    value={form.master_full}
                    onChange={(v) => setForm((p) => ({ ...p, master_full: v }))}
                  />
                  <RuleField
                    text="Admin partner trouxe o lead → Admin partner recebe"
                    info="Quando um admin partner é o dono do lead, ele recebe a pool de comissão definida para essa situação."
                    value={form.partner_full}
                    onChange={(v) => setForm((p) => ({ ...p, partner_full: v }))}
                  />
                  <RuleField
                    text="Gerente trouxe o lead → Admin master recebe"
                    info="Valor destinado ao admin master quando o lead pertence a um gerente."
                    value={form.gerente_master}
                    onChange={(v) => setForm((p) => ({ ...p, gerente_master: v }))}
                  />
                  <RuleField
                    text="Gerente trouxe o lead → Admin partner recebe"
                    info="Valor que cada admin partner ativo recebe quando o lead pertence a um gerente."
                    value={form.gerente_partner}
                    onChange={(v) => setForm((p) => ({ ...p, gerente_partner: v }))}
                  />
                  <RuleField
                    text="Gerente trouxe o lead → Gerente recebe"
                    info="Valor destinado ao gerente quando ele próprio é o dono do lead."
                    value={form.gerente_self}
                    onChange={(v) => setForm((p) => ({ ...p, gerente_self: v }))}
                  />
                  <RuleField
                    text="Afiliado trouxe o lead → Admin master recebe"
                    info="Valor destinado ao admin master quando o lead pertence a um afiliado."
                    value={form.afiliado_master}
                    onChange={(v) => setForm((p) => ({ ...p, afiliado_master: v }))}
                  />
                  <RuleField
                    text="Afiliado trouxe o lead → Admin partner recebe"
                    info="Valor que cada admin partner ativo recebe quando o lead pertence a um afiliado."
                    value={form.afiliado_partner}
                    onChange={(v) => setForm((p) => ({ ...p, afiliado_partner: v }))}
                  />
                  <RuleField
                    text="Afiliado trouxe o lead → Gerente recebe"
                    info="Este é o teto/base do gerente. A comissão do afiliado configurada na tela de Comissões sai deste valor."
                    value={form.afiliado_gerente}
                    onChange={(v) => setForm((p) => ({ ...p, afiliado_gerente: v }))}
                  />

                  <Callout variant="info">Lead afiliado → Afiliado é sempre R$ 0. O valor real vem da tela de Comissões.</Callout>
                </section>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <Button type="submit" loading={saving}>
                    {form.id ? 'Criar nova versão' : 'Criar casa'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Limpar
                  </Button>
                </div>
              </form>
            </Card>
          </aside>
        </section>
      </div>
    </LayoutShell>
  )
}

function RuleField({
  text,
  info,
  value,
  onChange,
}: {
  text: string
  info: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Field
      label={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          {text}
          <Tooltip content={info}>
            <Info size={14} color={color.greenSoft} style={{ cursor: 'help' }} />
          </Tooltip>
        </span>
      }
    >
      <Input type="number" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
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
