'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LayoutShell from '../components/LayoutShell'

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
  const [user, setUser] = useState<{ email?: string; db?: UserRow } | null>(null)
  const [houses, setHouses] = useState<HouseRow[]>([])
  const [form, setForm] = useState(emptyForm)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

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

    setUser({
      email: authData.user.email,
      db: userDb || undefined,
    })

    if (userDb?.role === 'admin_master') {
      await loadHouses()
    }

    setLoading(false)
  }

  async function loadHouses() {
    const { data, error } = await supabase
      .from('houses')
      .select('*')
      .eq('active', true)
      .order('name')

    if (error) {
      setMessage(`Erro ao carregar casas: ${error.message}`)
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

    setMessage(
      'Casa carregada. Ao salvar, uma nova versão será criada e o histórico anterior será preservado.'
    )
  }

  function resetForm() {
    setForm(emptyForm)
    setMessage('')
  }

  function buildRules() {
    return [
      {
        lead_owner_role: 'admin_master',
        receiver_role: 'admin_master',
        amount: Number(form.master_full),
      },
      {
        lead_owner_role: 'admin_partner',
        receiver_role: 'admin_partner',
        amount: Number(form.partner_full),
      },
      {
        lead_owner_role: 'gerente',
        receiver_role: 'admin_master',
        amount: Number(form.gerente_master),
      },
      {
        lead_owner_role: 'gerente',
        receiver_role: 'admin_partner',
        amount: Number(form.gerente_partner),
      },
      {
        lead_owner_role: 'gerente',
        receiver_role: 'gerente',
        amount: Number(form.gerente_self),
      },
      {
        lead_owner_role: 'afiliado',
        receiver_role: 'admin_master',
        amount: Number(form.afiliado_master),
      },
      {
        lead_owner_role: 'afiliado',
        receiver_role: 'admin_partner',
        amount: Number(form.afiliado_partner),
      },
      {
        lead_owner_role: 'afiliado',
        receiver_role: 'gerente',
        amount: Number(form.afiliado_gerente),
      },
      {
        lead_owner_role: 'afiliado',
        receiver_role: 'afiliado',
        amount: 0,
      },
    ]
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (user?.db?.role !== 'admin_master') {
      setMessage('Apenas admin_master pode gerenciar casas.')
      return
    }

    if (!form.name || !form.gross_value || !form.michael_box_value || !form.commission_pool_value) {
      setMessage('Preencha nome, valor bruto, caixinha e pool de comissão.')
      return
    }

    const grossValue = Number(form.gross_value)
    const boxValue = Number(form.michael_box_value)
    const poolValue = Number(form.commission_pool_value)

    if (
      Number.isNaN(grossValue) ||
      Number.isNaN(boxValue) ||
      Number.isNaN(poolValue)
    ) {
      setMessage('Informe valores numéricos válidos nos valores principais.')
      return
    }

    if (grossValue !== boxValue + poolValue) {
      setMessage('Valor bruto precisa ser igual a caixinha + pool de comissão.')
      return
    }

    const rules = buildRules()

    if (rules.length !== 9) {
      setMessage('Erro interno: a casa precisa ter exatamente 9 regras.')
      return
    }

    const invalidRule = rules.some(
      (rule) => Number.isNaN(rule.amount) || rule.amount < 0
    )

    if (invalidRule) {
      setMessage('Preencha todos os valores das regras com números válidos e não negativos.')
      return
    }

    const confirmed = window.confirm(
      'Salvar irá criar uma nova versão da casa. Conversões antigas não serão alteradas. Deseja continuar?'
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

      const res = await fetch('/api/houses/upsert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
        setMessage(data.error || 'Erro ao salvar casa.')
        return
      }

      setMessage(
        form.id
          ? 'Nova versão da casa criada com sucesso.'
          : 'Casa criada com sucesso.'
      )

      resetForm()
      await loadHouses()
    } catch {
      setSaving(false)
      setMessage('Erro inesperado ao salvar casa.')
    }
  }

  const isAdminMaster = user?.db?.role === 'admin_master'

  if (loading) {
    return (
      <main style={pageBg}>
        <div style={centerBox}>
          <p style={{ color: '#bbf7d0' }}>Carregando...</p>
        </div>
      </main>
    )
  }

  if (!user?.db || !isAdminMaster) {
    return (
      <LayoutShell
        active="casas"
        user={{
          nome: user?.db?.nome || 'Usuário',
          email: user?.email || '',
          role: user?.db?.role || '',
        }}
      >
        <section style={panelCard}>
          <h1 style={pageTitle}>Acesso restrito</h1>
          <p style={pageSubtitle}>Esta tela está disponível apenas para admin master.</p>
        </section>
      </LayoutShell>
    )
  }

  return (
    <LayoutShell
      active="casas"
      user={{
        nome: user.db.nome,
        email: user.email || '',
        role: user.db.role,
      }}
    >
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <header style={headerCard}>
          <div>
            <p style={eyebrow}>Configuração</p>
            <h1 style={pageTitle}>Casas</h1>
            <p style={pageSubtitle}>
              Configure valores e regras. Alterações criam nova versão e preservam histórico.
            </p>
          </div>
        </header>

        <section style={gridSection}>
          <div style={mainColumn}>
            <section style={panelCard}>
              <div style={panelHeader}>
                <div>
                  <h2 style={panelTitle}>Casas ativas</h2>
                  <p style={panelSubtitle}>{houses.length} registro(s)</p>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRow}>
                      <Th>Casa</Th>
                      <Th>Valor bruto</Th>
                      <Th>Caixinha</Th>
                      <Th>Pool comissão</Th>
                      <Th>Vigência</Th>
                      <Th>Status</Th>
                      <Th>Ação</Th>
                    </tr>
                  </thead>

                  <tbody>
                    {houses.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={emptyStateTd}>
                          Nenhuma casa ativa cadastrada.
                        </td>
                      </tr>
                    ) : (
                      houses.map((house) => (
                        <tr key={house.id} style={tbodyRow}>
                          <Td>{house.name}</Td>
                          <Td>R$ {Number(house.gross_value || 0).toFixed(2)}</Td>
                          <Td>R$ {Number(house.michael_box_value || 0).toFixed(2)}</Td>
                          <Td>R$ {Number(house.commission_pool_value || 0).toFixed(2)}</Td>
                          <Td>
                            {house.valid_from || '-'} até {house.valid_to || 'Atual'}
                          </Td>
                          <Td>{house.active ? 'Ativa' : 'Inativa'}</Td>
                          <Td>
                            <button style={secondaryButton} onClick={() => editHouse(house)}>
                              Alterar casa
                            </button>
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
            <section style={panelCard}>
              <div style={panelHeader}>
                <div>
                  <h2 style={panelTitle}>
                    {form.id ? 'Alterar casa' : 'Nova casa'}
                  </h2>
                  <p style={panelSubtitle}>
                    Salvar cria uma versão ativa sem recalcular histórico.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSave} style={formStack}>
                <Field label="Nome da casa">
                  <input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    style={inputStyle}
                    placeholder="Ex: Betano"
                  />
                </Field>

                <Field label="Valor bruto">
                  <input
                    type="number"
                    step="0.01"
                    value={form.gross_value}
                    onChange={(e) => setForm((p) => ({ ...p, gross_value: e.target.value }))}
                    style={inputStyle}
                    placeholder="Ex: 280"
                  />
                </Field>

                <Field label="Caixinha Michael">
                  <input
                    type="number"
                    step="0.01"
                    value={form.michael_box_value}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, michael_box_value: e.target.value }))
                    }
                    style={inputStyle}
                    placeholder="Ex: 130"
                  />
                </Field>

                <Field label="Pool de comissão">
                  <input
                    type="number"
                    step="0.01"
                    value={form.commission_pool_value}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, commission_pool_value: e.target.value }))
                    }
                    style={inputStyle}
                    placeholder="Ex: 150"
                  />
                </Field>

                <Field label="Válido a partir de">
                  <input
                    type="date"
                    value={form.valid_from}
                    onChange={(e) => setForm((p) => ({ ...p, valid_from: e.target.value }))}
                    style={inputStyle}
                  />
                </Field>

                <div style={warningBox}>
                  Salvar irá criar uma nova versão da casa. Conversões antigas não serão alteradas.
                </div>

                <section style={subPanel}>
                  <h3 style={subPanelTitle}>Regras obrigatórias</h3>

                  <Field label="Lead admin master → Admin master">
                    <input
                      type="number"
                      step="0.01"
                      value={form.master_full}
                      onChange={(e) => setForm((p) => ({ ...p, master_full: e.target.value }))}
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Lead admin partner → Admin partner">
                    <input
                      type="number"
                      step="0.01"
                      value={form.partner_full}
                      onChange={(e) => setForm((p) => ({ ...p, partner_full: e.target.value }))}
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Lead gerente → Admin master">
                    <input
                      type="number"
                      step="0.01"
                      value={form.gerente_master}
                      onChange={(e) => setForm((p) => ({ ...p, gerente_master: e.target.value }))}
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Lead gerente → Admin partner">
                    <input
                      type="number"
                      step="0.01"
                      value={form.gerente_partner}
                      onChange={(e) => setForm((p) => ({ ...p, gerente_partner: e.target.value }))}
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Lead gerente → Gerente">
                    <input
                      type="number"
                      step="0.01"
                      value={form.gerente_self}
                      onChange={(e) => setForm((p) => ({ ...p, gerente_self: e.target.value }))}
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Lead afiliado → Admin master">
                    <input
                      type="number"
                      step="0.01"
                      value={form.afiliado_master}
                      onChange={(e) => setForm((p) => ({ ...p, afiliado_master: e.target.value }))}
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Lead afiliado → Admin partner">
                    <input
                      type="number"
                      step="0.01"
                      value={form.afiliado_partner}
                      onChange={(e) => setForm((p) => ({ ...p, afiliado_partner: e.target.value }))}
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Lead afiliado → Gerente">
                    <input
                      type="number"
                      step="0.01"
                      value={form.afiliado_gerente}
                      onChange={(e) => setForm((p) => ({ ...p, afiliado_gerente: e.target.value }))}
                      style={inputStyle}
                    />
                  </Field>

                  <div style={infoBox}>
                    Lead afiliado → Afiliado é sempre R$ 0. O valor real vem da tela de Comissões.
                  </div>
                </section>

                <div style={formActions}>
                  <button type="submit" style={primaryButton} disabled={saving}>
                    {saving ? 'Salvando...' : form.id ? 'Criar nova versão' : 'Criar casa'}
                  </button>

                  <button type="button" style={ghostButton} onClick={resetForm}>
                    Limpar
                  </button>
                </div>

                {message && <p style={messageStyle}>{message}</p>}
              </form>
            </section>
          </aside>
        </section>
      </div>
    </LayoutShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
  padding: '24px',
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

const gridSection: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.3fr 1fr',
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

const formStack: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
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

const formActions: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  marginTop: '6px',
  flexWrap: 'wrap',
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
  lineHeight: 1.4,
}

const messageStyle: React.CSSProperties = {
  margin: 0,
  color: '#bbf7d0',
  fontSize: '14px',
}