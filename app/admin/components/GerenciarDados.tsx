'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { color, radius, shadow } from '@/lib/design-tokens'
import { Card, Field, Input, Select, Button, DataTable, Column, LoadingState, useToast, useConfirmDialog } from '../../components/ui'
import { Upload } from '../../components/icons'

type HouseRow = {
  id: string
  name: string
}

type AffiliateRow = {
  id: string
  nome: string
  email?: string | null
}

type ConversionRow = {
  id: string
  data: string
  afiliado: string | null
  campanha: string | null
  clicks: number | null
  registros: number | null
  depositos: number | null
  rev: number | null
  ftd: number | null
  qftd: number | null
  cpa: number | null
  comissao: number | null
  casa_aposta: string | null
  house_id: string | null
  lead_owner_user_id: string | null
}

type FormRow = {
  id?: string
  data: string
  afiliado: string
  campanha: string
  casa_aposta: string
  house_id: string
  lead_owner_user_id: string
  clicks: string
  registros: string
  depositos: string
  rev: string
  ftd: string
  qftd: string
  cpa: string
  comissao: string
}

type PreviewRow = FormRow & {
  rowNumber: number
}

const emptyForm: FormRow = {
  data: '',
  afiliado: '',
  campanha: '',
  casa_aposta: '',
  house_id: '',
  lead_owner_user_id: '',
  clicks: '0',
  registros: '0',
  depositos: '0',
  rev: '0',
  ftd: '0',
  qftd: '0',
  cpa: '0',
  comissao: '0',
}

const PAGE_SIZE = 25

export default function GerenciarDados() {
  const toast = useToast()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()
  const [houses, setHouses] = useState<HouseRow[]>([])
  const [affiliates, setAffiliates] = useState<AffiliateRow[]>([])
  const [conversions, setConversions] = useState<ConversionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [filterHouse, setFilterHouse] = useState('')
  const [filterAffiliate, setFilterAffiliate] = useState('')
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormRow>(emptyForm)

  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [importFileName, setImportFileName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [runningProcess, setRunningProcess] = useState<'pending_conversions' | 'pending_commissions' | null>(null)

  async function loadAll() {
    setLoading(true)

    const [housesRes, affiliatesRes, conversionsRes] = await Promise.all([
      supabase.from('houses').select('id, name').eq('active', true).order('name'),
      supabase.from('users').select('id, nome, email').eq('role', 'afiliado').order('nome'),
      supabase.from('conversions').select('*').order('data', { ascending: false }),
    ])

    if (housesRes.error || affiliatesRes.error || conversionsRes.error) {
      toast.error('Erro ao carregar dados da tela.')
      setLoading(false)
      return
    }

    setHouses((housesRes.data || []) as HouseRow[])
    setAffiliates((affiliatesRes.data || []) as AffiliateRow[])
    setConversions((conversionsRes.data || []) as ConversionRow[])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const houseByName = useMemo(() => {
    const map = new Map<string, string>()
    houses.forEach((house) => map.set(house.name.trim().toLowerCase(), house.id))
    return map
  }, [houses])

  const affiliateByCode = useMemo(() => {
    const map = new Map<string, string>()
    conversions.forEach((row) => {
      const code = row.afiliado?.trim().toLowerCase()
      if (code && row.lead_owner_user_id) {
        map.set(code, row.lead_owner_user_id)
      }
    })
    return map
  }, [conversions])

  function suggestHouseId(casaAposta: string) {
    return houseByName.get(casaAposta.trim().toLowerCase()) || ''
  }

  function suggestAffiliateId(afiliadoCode: string) {
    return affiliateByCode.get(afiliadoCode.trim().toLowerCase()) || ''
  }

  function getHouseName(houseId: string | null) {
    return houses.find((house) => house.id === houseId)?.name || '—'
  }

  function getAffiliateName(userId: string | null) {
    return affiliates.find((affiliate) => affiliate.id === userId)?.nome || '—'
  }

  const filteredConversions = useMemo(() => {
    return conversions.filter((row) => {
      const matchesHouse = filterHouse ? row.house_id === filterHouse : true
      const matchesAffiliate = filterAffiliate ? row.lead_owner_user_id === filterAffiliate : true
      const matchesStart = filterStart ? row.data >= filterStart : true
      const matchesEnd = filterEnd ? row.data <= filterEnd : true
      return matchesHouse && matchesAffiliate && matchesStart && matchesEnd
    })
  }, [conversions, filterHouse, filterAffiliate, filterStart, filterEnd])

  function openNewForm() {
    setForm(emptyForm)
    setFormOpen(true)
  }

  function openEditForm(row: ConversionRow) {
    setForm({
      id: row.id,
      data: row.data,
      afiliado: row.afiliado || '',
      campanha: row.campanha || '',
      casa_aposta: row.casa_aposta || '',
      house_id: row.house_id || '',
      lead_owner_user_id: row.lead_owner_user_id || '',
      clicks: String(row.clicks ?? 0),
      registros: String(row.registros ?? 0),
      depositos: String(row.depositos ?? 0),
      rev: String(row.rev ?? 0),
      ftd: String(row.ftd ?? 0),
      qftd: String(row.qftd ?? 0),
      cpa: String(row.cpa ?? 0),
      comissao: String(row.comissao ?? 0),
    })
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setForm(emptyForm)
  }

  function updateFormField<K extends keyof FormRow>(field: K, value: FormRow[K]) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }

      if (field === 'casa_aposta' && !prev.house_id) {
        next.house_id = suggestHouseId(String(value))
      }

      if (field === 'afiliado' && !prev.lead_owner_user_id) {
        next.lead_owner_user_id = suggestAffiliateId(String(value))
      }

      return next
    })
  }

  async function persistRows(rows: FormRow[]) {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (!token) {
      toast.error('Sessão inválida. Faça login novamente.')
      return null
    }

    const res = await fetch('/api/conversions/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        rows: rows.map((row) => ({
          id: row.id,
          data: row.data,
          afiliado: row.afiliado,
          campanha: row.campanha || row.afiliado,
          casa_aposta: row.casa_aposta,
          house_id: row.house_id || null,
          lead_owner_user_id: row.lead_owner_user_id || null,
          clicks: Number(row.clicks) || 0,
          registros: Number(row.registros) || 0,
          depositos: Number(row.depositos) || 0,
          rev: Number(row.rev) || 0,
          ftd: Number(row.ftd) || 0,
          qftd: Number(row.qftd) || 0,
          cpa: Number(row.cpa) || 0,
          comissao: Number(row.comissao) || 0,
        })),
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error || 'Erro ao salvar dados.')
      return null
    }

    return data as { saved: number; missingHouse: number; missingAffiliate: number; errors: string[] }
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.data || !form.casa_aposta) {
      toast.error('Informe pelo menos a data e a casa.')
      return
    }

    setSaving(true)
    const result = await persistRows([form])
    setSaving(false)

    if (!result) return

    let summary = `Registro salvo com sucesso.`
    if (result.missingHouse > 0) summary += ' Atenção: casa não vinculada — comissão não foi gerada.'
    if (result.missingAffiliate > 0) summary += ' Atenção: afiliado não vinculado a esse registro.'
    if (result.errors.length > 0) summary += ` Erros: ${result.errors.join(' ')}`

    toast.success(summary)
    closeForm()
    await loadAll()
  }

  async function handleDelete(row: ConversionRow) {
    const confirmed = await confirm({
      title: 'Excluir registro',
      description: `Excluir o registro de ${formatDate(row.data)} (${row.casa_aposta || '—'})? Isso remove também as comissões geradas a partir dele. Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!confirmed) return

    setDeletingId(row.id)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (!token) {
      toast.error('Sessão inválida. Faça login novamente.')
      setDeletingId(null)
      return
    }

    const res = await fetch('/api/conversions/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: row.id }),
    })

    const data = await res.json()
    setDeletingId(null)

    if (!res.ok) {
      toast.error(data.error || 'Erro ao excluir registro.')
      return
    }

    toast.success('Registro excluído.')
    await loadAll()
  }

  async function runProcess(process: 'pending_conversions' | 'pending_commissions') {
    setRunningProcess(process)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (!token) {
      toast.error('Sessão inválida. Faça login novamente.')
      setRunningProcess(null)
      return
    }

    const res = await fetch('/api/admin/run-process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ process }),
    })

    const data = await res.json()
    setRunningProcess(null)

    if (!res.ok) {
      toast.error(data.error || 'Erro ao rodar processo.')
      return
    }

    const label =
      process === 'pending_conversions' ? 'conversões processadas' : 'comissões geradas'
    toast.success(`${data.processed} ${label}.`)
    await loadAll()
  }

  function normalizeHeader(value: string) {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
  }

  function parseBrDate(value: string) {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

    const parts = trimmed.split('/')
    if (parts.length === 3) {
      const [day, month, year] = parts
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }

    return trimmed
  }

  function parseNumber(value: string) {
    if (!value) return '0'
    const n = Number(value.replace(',', '.'))
    return Number.isFinite(n) ? String(n) : '0'
  }

  function parseCsv(text: string) {
    const clean = text.replace(/^﻿/, '')
    const lines = clean.split(/\r\n|\n/).filter((line) => line.trim().length > 0)
    if (lines.length < 2) return []

    const delimiter = lines[0].includes(';') ? ';' : ','
    const rawHeaders = lines[0].split(delimiter).map((h) => normalizeHeader(h))

    function findIndex(names: string[], occurrence = 0) {
      let seen = 0
      for (let i = 0; i < rawHeaders.length; i++) {
        if (names.includes(rawHeaders[i])) {
          if (seen === occurrence) return i
          seen += 1
        }
      }
      return -1
    }

    let idx = {
      data: findIndex(['data']),
      afiliado: findIndex(['campanha', 'afiliado'], 0),
      campanha: findIndex(['campanha', 'afiliado'], 1),
      clicks: findIndex(['clicks']),
      registros: findIndex(['registros']),
      depositos: findIndex(['depositos']),
      rev: findIndex(['rev']),
      ftd: findIndex(['ftd']),
      qftd: findIndex(['qftd']),
      cpa: findIndex(['cpa']),
      comissao: findIndex(['comissao']),
      casa_aposta: findIndex(['casa_aposta', 'casa']),
    }

    // Fallback: cabeçalhos não reconhecidos — assume o layout padrão do
    // export (Data;Campanha;Campanha;Clicks;Registros;Depositos;Rev;FTD;QFTD;CPA;Comissao;casa_aposta)
    if (idx.data === -1) {
      idx = {
        data: 0,
        afiliado: 1,
        campanha: 2,
        clicks: 3,
        registros: 4,
        depositos: 5,
        rev: 6,
        ftd: 7,
        qftd: 8,
        cpa: 9,
        comissao: 10,
        casa_aposta: 11,
      }
    }

    if (idx.campanha === -1) idx.campanha = idx.afiliado

    const rows: PreviewRow[] = []

    for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
      const cols = lines[lineIndex].split(delimiter)
      const get = (i: number) => (i >= 0 ? (cols[i] || '').trim() : '')

      const casaAposta = get(idx.casa_aposta)
      const afiliado = get(idx.afiliado)
      const dataValue = parseBrDate(get(idx.data))

      if (!dataValue || !casaAposta) continue

      rows.push({
        rowNumber: lineIndex,
        data: dataValue,
        afiliado,
        campanha: get(idx.campanha) || afiliado,
        casa_aposta: casaAposta,
        house_id: suggestHouseId(casaAposta),
        lead_owner_user_id: suggestAffiliateId(afiliado),
        clicks: parseNumber(get(idx.clicks)),
        registros: parseNumber(get(idx.registros)),
        depositos: parseNumber(get(idx.depositos)),
        rev: parseNumber(get(idx.rev)),
        ftd: parseNumber(get(idx.ftd)),
        qftd: parseNumber(get(idx.qftd)),
        cpa: parseNumber(get(idx.cpa)),
        comissao: parseNumber(get(idx.comissao)),
      })
    }

    return rows
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFileName(file.name)

    const text = await file.text()
    const rows = parseCsv(text)

    if (rows.length === 0) {
      toast.error('Não foi possível ler nenhuma linha desse arquivo. Confira se é um .csv exportado corretamente.')
      setPreviewRows([])
      return
    }

    setPreviewRows(rows)
  }

  function updatePreviewRow(rowNumber: number, field: keyof FormRow, value: string) {
    setPreviewRows((prev) => prev.map((row) => (row.rowNumber === rowNumber ? { ...row, [field]: value } : row)))
  }

  function cancelImport() {
    setPreviewRows([])
    setImportFileName('')
  }

  async function confirmImport() {
    setSaving(true)
    const result = await persistRows(previewRows)
    setSaving(false)

    if (!result) return

    let summary = `${result.saved} de ${previewRows.length} registro(s) importado(s).`
    if (result.missingHouse > 0) summary += ` ${result.missingHouse} sem casa vinculada.`
    if (result.missingAffiliate > 0) summary += ` ${result.missingAffiliate} sem afiliado vinculado.`
    if (result.errors.length > 0) summary += ` Erros: ${result.errors.join(' ')}`

    toast.success(summary)
    cancelImport()
    await loadAll()
  }

  function formatMoney(value: number | null) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
  }

  function formatDate(value: string) {
    return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
  }

  if (loading) {
    return <LoadingState label="Carregando dados..." />
  }

  const previewColumns: Column<PreviewRow>[] = [
    { key: 'data', header: 'Data', render: (row) => formatDate(row.data) },
    { key: 'afiliado', header: 'Afiliado (código)', render: (row) => row.afiliado || '—' },
    { key: 'casa', header: 'Casa', render: (row) => row.casa_aposta },
    {
      key: 'house',
      header: 'Vincular casa',
      render: (row) => (
        <Select
          value={row.house_id}
          onChange={(e) => updatePreviewRow(row.rowNumber, 'house_id', e.target.value)}
          style={{ padding: '8px 10px', borderColor: row.house_id ? undefined : '#f87171' }}
        >
          <option value="">Não identificada</option>
          {houses.map((house) => (
            <option key={house.id} value={house.id}>
              {house.name}
            </option>
          ))}
        </Select>
      ),
    },
    {
      key: 'affiliate',
      header: 'Vincular afiliado',
      render: (row) => (
        <Select value={row.lead_owner_user_id} onChange={(e) => updatePreviewRow(row.rowNumber, 'lead_owner_user_id', e.target.value)} style={{ padding: '8px 10px' }}>
          <option value="">Não vinculado</option>
          {affiliates.map((affiliate) => (
            <option key={affiliate.id} value={affiliate.id}>
              {affiliate.nome}
            </option>
          ))}
        </Select>
      ),
    },
    { key: 'comissao', header: 'Comissão', render: (row) => formatMoney(Number(row.comissao)) },
  ]

  const conversionColumns: Column<ConversionRow>[] = [
    { key: 'data', header: 'Data', render: (row) => formatDate(row.data) },
    {
      key: 'afiliado',
      header: 'Afiliado',
      render: (row) => (
        <>
          {getAffiliateName(row.lead_owner_user_id)}
          {!row.lead_owner_user_id && <span style={warnBadgeStyle}> não vinculado</span>}
        </>
      ),
    },
    {
      key: 'casa',
      header: 'Casa',
      render: (row) => (
        <>
          {getHouseName(row.house_id)}
          {!row.house_id && <span style={warnBadgeStyle}> não vinculada</span>}
        </>
      ),
    },
    { key: 'depositos', header: 'Depósitos', render: (row) => formatMoney(row.depositos) },
    { key: 'ftd', header: 'FTD', render: (row) => row.ftd ?? 0 },
    { key: 'cpa', header: 'CPA', render: (row) => formatMoney(row.cpa) },
    { key: 'comissao', header: 'Comissão', render: (row) => formatMoney(row.comissao) },
    {
      key: 'action',
      header: 'Ação',
      render: (row) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" size="sm" onClick={() => openEditForm(row)}>
            Editar
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={deletingId === row.id}
            onClick={() => handleDelete(row)}
          >
            Excluir
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      {confirmDialog}

      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={panelTitleStyle}>Processos automáticos</h2>
            <p style={panelSubtitleStyle}>
              Os dois passos que antes precisavam ser rodados manualmente no Supabase depois de subir dados novos.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Button
              type="button"
              variant="secondary"
              loading={runningProcess === 'pending_conversions'}
              onClick={() => runProcess('pending_conversions')}
            >
              Processar conversões pendentes
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={runningProcess === 'pending_commissions'}
              onClick={() => runProcess('pending_commissions')}
            >
              Gerar comissões pendentes
            </Button>
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={panelTitleStyle}>Filtros</h2>
            <p style={panelSubtitleStyle}>Refine a listagem de dados de conversão.</p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Button type="button" variant="secondary" leftIcon={<Upload size={14} />} onClick={() => document.getElementById('import-file-input')?.click()}>
              Importar arquivo (CSV)
            </Button>
            <input id="import-file-input" type="file" accept=".csv,text/csv" onChange={handleFileChange} style={{ display: 'none' }} />
            <Button type="button" onClick={openNewForm}>
              Novo registro
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <Field label="Casa">
            <Select value={filterHouse} onChange={(e) => setFilterHouse(e.target.value)}>
              <option value="">Todas</option>
              {houses.map((house) => (
                <option key={house.id} value={house.id}>
                  {house.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Afiliado">
            <Select value={filterAffiliate} onChange={(e) => setFilterAffiliate(e.target.value)}>
              <option value="">Todos</option>
              {affiliates.map((affiliate) => (
                <option key={affiliate.id} value={affiliate.id}>
                  {affiliate.nome}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="De">
            <Input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} />
          </Field>

          <Field label="Até">
            <Input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} />
          </Field>
        </div>
      </Card>

      {previewRows.length > 0 && (
        <Card style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
            <div>
              <h2 style={panelTitleStyle}>Pré-visualização da importação</h2>
              <p style={panelSubtitleStyle}>
                {importFileName} — {previewRows.length} linha(s). Confira casa e afiliado antes de confirmar.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <Button type="button" variant="ghost" onClick={cancelImport}>
                Cancelar
              </Button>
              <Button type="button" loading={saving} onClick={confirmImport}>
                Confirmar importação
              </Button>
            </div>
          </div>

          <DataTable columns={previewColumns} data={previewRows} rowKey={(row) => String(row.rowNumber)} pageSize={PAGE_SIZE} />
        </Card>
      )}

      <Card>
        <h2 style={panelTitleStyle}>Registros de conversão</h2>
        <p style={{ ...panelSubtitleStyle, marginBottom: '18px' }}>{filteredConversions.length} registro(s) encontrado(s)</p>

        <DataTable columns={conversionColumns} data={filteredConversions} rowKey={(row) => row.id} pageSize={PAGE_SIZE} emptyMessage="Nenhum registro encontrado." />
      </Card>

      {formOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,6,23,0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            zIndex: 50,
          }}
          onClick={closeForm}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '760px', maxHeight: '90vh', overflowY: 'auto' }}>
            <Card variant="header" style={{ borderRadius: radius.xl, boxShadow: shadow.cardFeatured, padding: '28px' }}>
              <h2 style={panelTitleStyle}>{form.id ? 'Editar registro' : 'Novo registro'}</h2>

              <form onSubmit={handleFormSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ marginTop: '20px' }}>
                <Field label="Data">
                  <Input type="date" required value={form.data} onChange={(e) => updateFormField('data', e.target.value)} />
                </Field>

                <Field label="Casa (texto do export)">
                  <Input required value={form.casa_aposta} onChange={(e) => updateFormField('casa_aposta', e.target.value)} placeholder="Ex: Superbet" />
                </Field>

                <Field label="Vincular casa">
                  <Select value={form.house_id} onChange={(e) => updateFormField('house_id', e.target.value)}>
                    <option value="">Não identificada</option>
                    {houses.map((house) => (
                      <option key={house.id} value={house.id}>
                        {house.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Código do afiliado (export)">
                  <Input value={form.afiliado} onChange={(e) => updateFormField('afiliado', e.target.value)} placeholder="Ex: 20014-AFFILIAZAP16" />
                </Field>

                <Field label="Vincular afiliado">
                  <Select value={form.lead_owner_user_id} onChange={(e) => updateFormField('lead_owner_user_id', e.target.value)}>
                    <option value="">Não vinculado</option>
                    {affiliates.map((affiliate) => (
                      <option key={affiliate.id} value={affiliate.id}>
                        {affiliate.nome}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Clicks">
                  <Input type="number" value={form.clicks} onChange={(e) => updateFormField('clicks', e.target.value)} />
                </Field>

                <Field label="Registros">
                  <Input type="number" value={form.registros} onChange={(e) => updateFormField('registros', e.target.value)} />
                </Field>

                <Field label="Depósitos">
                  <Input type="number" step="0.01" value={form.depositos} onChange={(e) => updateFormField('depositos', e.target.value)} />
                </Field>

                <Field label="Rev">
                  <Input type="number" step="0.01" value={form.rev} onChange={(e) => updateFormField('rev', e.target.value)} />
                </Field>

                <Field label="FTD">
                  <Input type="number" value={form.ftd} onChange={(e) => updateFormField('ftd', e.target.value)} />
                </Field>

                <Field label="QFTD">
                  <Input type="number" value={form.qftd} onChange={(e) => updateFormField('qftd', e.target.value)} />
                </Field>

                <Field label="CPA">
                  <Input type="number" step="0.01" value={form.cpa} onChange={(e) => updateFormField('cpa', e.target.value)} />
                </Field>

                <Field label="Comissão">
                  <Input type="number" step="0.01" value={form.comissao} onChange={(e) => updateFormField('comissao', e.target.value)} />
                </Field>

                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <Button type="submit" loading={saving}>
                    Salvar
                  </Button>
                  <Button type="button" variant="ghost" onClick={closeForm}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

const panelTitleStyle: React.CSSProperties = { margin: 0, fontSize: '18px', fontWeight: 700, color: color.textPrimary }
const panelSubtitleStyle: React.CSSProperties = { margin: '6px 0 0', color: color.textSecondary, fontSize: '14px' }
const warnBadgeStyle: React.CSSProperties = { color: '#fca5a5', fontSize: '11px', fontWeight: 700 }
