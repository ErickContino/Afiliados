'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import LayoutShell from './components/LayoutShell'
import { color, radius } from '@/lib/design-tokens'
import { Card, Field, Input, Select, StatCard, DataTable, Column, LoadingState, AccessBlockedState } from './components/ui'
import { Star } from './components/icons'

type UserRole = 'admin_master' | 'admin_partner' | 'gerente' | 'afiliado'

type LoggedUser = {
  email?: string
  db?: {
    id: string
    nome: string
    role: UserRole | null
    status?: 'pending' | 'active' | 'inactive'
  }
}

type CommissionSplit = {
  id: string
  amount: number
  receiver_role: UserRole
  lead_owner_role: UserRole
  house_id: string | null
  conversion_id: string
  receiver_user_id: string
  created_at?: string
}

type ConversionRow = {
  id: string
  data: string
  afiliado: string | null
  clicks: number | null
  registros: number | null
  depositos: number | null
  ftd: number | null
  qftd: number | null
  cpa: number | null
  rev: number | null
  casa_aposta: string | null
  house_id: string | null
  lead_owner_user_id?: string | null
}

type UserRow = {
  id: string
  nome: string
  email: string
  role: UserRole
  parent_id: string | null
}

type HouseRow = {
  id: string
  name: string
  active?: boolean
}

// Paleta categórica validada (dataviz skill) — slots 1/2/3 do tema padrão,
// passam CVD/contraste all-pairs no modo escuro.
const CHART_COLORS = {
  registros: '#3987e5',
  ftd: '#d95926',
  depositos: '#199e70',
  rev: '#3987e5',
  cpa: '#d95926',
  house: '#199e70',
}

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<LoggedUser | null>(null)
  const [splits, setSplits] = useState<CommissionSplit[]>([])
  const [conversions, setConversions] = useState<ConversionRow[]>([])
  const [allUsers, setAllUsers] = useState<UserRow[]>([])
  const [houses, setHouses] = useState<HouseRow[]>([])
  const [houseOptions, setHouseOptions] = useState<HouseRow[]>([])
  const [loading, setLoading] = useState(true)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedHouse, setSelectedHouse] = useState('')
  const [selectedPerson, setSelectedPerson] = useState('')
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})

  useEffect(() => {
    checkUser()
  }, [])

  async function loadDashboardData(currentUserDb?: { id: string; nome: string; role: string }) {
    const [splitsResponse, housesResponse, conversionsResponse, usersResponse] = await Promise.all([
      supabase.from('commission_splits').select('*').order('created_at', { ascending: false }),
      supabase.from('houses').select('id, name, active').order('name'),
      supabase.from('conversions').select('*').order('data', { ascending: false }),
      supabase.from('users').select('id, nome, email, role, parent_id'),
    ])

    if (housesResponse.data) {
      const allHouses = housesResponse.data as HouseRow[]
      setHouses(allHouses)

      const activeUniqueHouses = Array.from(
        new Map(allHouses.filter((house) => house.active).map((house) => [house.name, house])).values()
      )

      setHouseOptions(activeUniqueHouses)
    } else {
      setHouses([])
      setHouseOptions([])
    }

    if (usersResponse.data) {
      setAllUsers(usersResponse.data as UserRow[])
    } else {
      setAllUsers([])
    }

    if (splitsResponse.error || !splitsResponse.data) {
      setSplits([])
    } else {
      setSplits(splitsResponse.data as CommissionSplit[])
    }

    if (conversionsResponse.error || !conversionsResponse.data) {
      setConversions([])
    } else {
      setConversions(conversionsResponse.data as ConversionRow[])
    }
  }

  async function checkUser() {
    setLoading(true)

    const { data: authData } = await supabase.auth.getUser()

    if (!authData.user) {
      router.push('/login')
      return
    }

    let { data } = await supabase.from('users').select('*').eq('auth_id', authData.user.id).maybeSingle()

    if (!data) {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (token) {
        const res = await fetch('/api/users/bootstrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ email: authData.user.email }),
        })

        if (!res.ok) {
          console.error(await res.json().catch(() => null))
          throw new Error('Erro ao criar usuário')
        }

        const refetched = await supabase.from('users').select('*').eq('auth_id', authData.user.id).maybeSingle()
        data = refetched.data
      }
    }

    const loggedUser: LoggedUser = {
      email: authData.user.email,
      db: data ? { id: data.id, nome: data.nome, role: data.role, status: data.status } : undefined,
    }

    setUser(loggedUser)

    if (!data) {
      router.push('/login')
      return
    }

    if (data.status === 'active') {
      await loadDashboardData(data)
    }

    setLoading(false)
  }

  const isAdminMaster = user?.db?.role === 'admin_master'

  const usersByParentId = useMemo(() => {
    const map: Record<string, UserRow[]> = {}

    for (const dbUser of allUsers) {
      const parentKey = dbUser.parent_id || '__root__'
      if (!map[parentKey]) map[parentKey] = []
      map[parentKey].push(dbUser)
    }

    return map
  }, [allUsers])

  const visibleUserIds = useMemo(() => {
    if (!user?.db?.id) return []

    if (isAdminMaster) {
      return allUsers.map((dbUser) => dbUser.id)
    }

    const result = new Set<string>()
    const queue: string[] = [user.db.id]

    while (queue.length > 0) {
      const currentId = queue.shift() as string
      result.add(currentId)

      const children = usersByParentId[currentId] || []

      for (const child of children) {
        if (!result.has(child.id)) {
          queue.push(child.id)
        }
      }
    }

    return Array.from(result)
  }, [allUsers, user?.db?.id, isAdminMaster, usersByParentId])

  const visiblePeopleOptions = useMemo(() => {
    return allUsers.filter((dbUser) => visibleUserIds.includes(dbUser.id)).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [allUsers, visibleUserIds])

  const splitsByConversionId = useMemo(() => {
    const map: Record<string, CommissionSplit[]> = {}

    for (const split of splits) {
      if (!map[split.conversion_id]) map[split.conversion_id] = []
      map[split.conversion_id].push(split)
    }

    return map
  }, [splits])

  function canSeeConversion(conversion: ConversionRow) {
    if (isAdminMaster) return true
    if (!conversion.lead_owner_user_id) return false
    return visibleUserIds.includes(conversion.lead_owner_user_id)
  }

  function canSeeSplit(split: CommissionSplit) {
    if (isAdminMaster) return true
    return visibleUserIds.includes(split.receiver_user_id)
  }

  function getHouseName(houseId: string | null) {
    if (!houseId) return '-'
    return houses.find((house) => house.id === houseId)?.name || houseId
  }

  function toggleRow(id: string) {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const filteredConversions = useMemo(() => {
    return conversions.filter((item) => {
      const matchesVisibility = canSeeConversion(item)
      const conversionHouseName = getHouseName(item.house_id)
      const selectedHouseName = selectedHouse ? houseOptions.find((house) => house.id === selectedHouse)?.name : ''

      const matchesHouse = selectedHouseName ? conversionHouseName === selectedHouseName : true
      const matchesPerson = selectedPerson ? item.lead_owner_user_id === selectedPerson : true

      const conversionDate = item.data ? new Date(`${item.data}T00:00:00`) : null

      const matchesStartDate = startDate && conversionDate ? conversionDate >= new Date(`${startDate}T00:00:00`) : true
      const matchesEndDate = endDate && conversionDate ? conversionDate <= new Date(`${endDate}T23:59:59`) : true

      return matchesVisibility && matchesHouse && matchesPerson && matchesStartDate && matchesEndDate
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversions, selectedHouse, selectedPerson, startDate, endDate, visibleUserIds, isAdminMaster, houseOptions, houses])

  const tableRows = useMemo(() => {
    return filteredConversions.map((conversion) => {
      const leadOwner = conversion.lead_owner_user_id ? allUsers.find((item) => item.id === conversion.lead_owner_user_id) : undefined

      const allSplitsForRow = splitsByConversionId[conversion.id] || []
      const visibleSplitsForRow = allSplitsForRow.filter(canSeeSplit)

      const mySplit = allSplitsForRow.find((split) => split.receiver_user_id === user?.db?.id)

      const revReal = Number(conversion.rev || 0)
      const revVisible = isAdminMaster ? revReal : 0

      const cpaBruto = Number(conversion.cpa || 0)
      const cpaVisible = isAdminMaster ? cpaBruto : Number(mySplit?.amount || 0)
      const comissaoOperacional = isAdminMaster ? cpaBruto + revReal : cpaVisible

      const meuGanhoBase = Number(mySplit?.amount || 0)
      const meuGanho = isAdminMaster ? meuGanhoBase + revReal : meuGanhoBase

      return {
        id: conversion.id,
        data: conversion.data,
        casaNome: getHouseName(conversion.house_id) || conversion.casa_aposta || '-',
        vendedorNome: leadOwner?.nome || conversion.afiliado || 'Sem responsável',
        vendedorRole: leadOwner?.role || 'não cadastrado',
        clicks: Number(conversion.clicks || 0),
        registros: Number(conversion.registros || 0),
        depositos: Number(conversion.depositos || 0),
        revVisible,
        ftd: Number(conversion.ftd || 0),
        qftd: Number(conversion.qftd || 0),
        cpa: cpaVisible,
        comissaoOperacional,
        meuGanho,
        visibleSplits: visibleSplitsForRow,
        leadOwnerUserId: conversion.lead_owner_user_id || null,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredConversions, allUsers, splitsByConversionId, isAdminMaster, user?.db?.id, houses])

  const totalRegistros = useMemo(() => filteredConversions.reduce((acc, item) => acc + Number(item.registros || 0), 0), [filteredConversions])
  const totalFTD = useMemo(() => filteredConversions.reduce((acc, item) => acc + Number(item.ftd || 0), 0), [filteredConversions])
  const totalDepositos = useMemo(() => filteredConversions.reduce((acc, item) => acc + Number(item.depositos || 0), 0), [filteredConversions])
  const totalCPAVisible = useMemo(() => tableRows.reduce((acc, item) => acc + Number(item.cpa || 0), 0), [tableRows])
  const totalREVVisible = useMemo(() => tableRows.reduce((acc, item) => acc + Number(item.revVisible || 0), 0), [tableRows])
  const totalComissao = useMemo(() => tableRows.reduce((acc, item) => acc + Number(item.comissaoOperacional || 0), 0), [tableRows])

  const visibleCards = useMemo(() => {
    return [
      { title: 'Registros', value: String(totalRegistros) },
      { title: 'FTD', value: String(totalFTD) },
      { title: 'Depósitos', value: `R$ ${totalDepositos.toFixed(2)}` },
      { title: 'CPA', value: `R$ ${totalCPAVisible.toFixed(2)}` },
      { title: 'REV', value: `R$ ${totalREVVisible.toFixed(2)}` },
      { title: 'Comissão', value: `R$ ${totalComissao.toFixed(2)}` },
    ]
  }, [totalRegistros, totalFTD, totalDepositos, totalCPAVisible, totalREVVisible, totalComissao])

  const dailySeries = useMemo(() => {
    const map = new Map<string, { date: string; registros: number; ftd: number; depositos: number }>()

    for (const item of filteredConversions) {
      if (!item.data) continue
      const key = item.data.slice(0, 10)
      const entry = map.get(key) || { date: key, registros: 0, ftd: 0, depositos: 0 }
      entry.registros += Number(item.registros || 0)
      entry.ftd += Number(item.ftd || 0)
      entry.depositos += Number(item.depositos || 0)
      map.set(key, entry)
    }

    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({ ...item, label: new Date(`${item.date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }))
  }, [filteredConversions])

  const commissionByHouse = useMemo(() => {
    const map = new Map<string, number>()

    for (const row of tableRows) {
      map.set(row.casaNome, (map.get(row.casaNome) || 0) + row.meuGanho)
    }

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [tableRows])

  const revCpaSeries = useMemo(() => {
    if (!isAdminMaster) return []

    const map = new Map<string, { date: string; rev: number; cpa: number }>()

    for (const row of tableRows) {
      if (!row.data) continue
      const key = row.data.slice(0, 10)
      const entry = map.get(key) || { date: key, rev: 0, cpa: 0 }
      entry.rev += row.revVisible
      entry.cpa += row.cpa
      map.set(key, entry)
    }

    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({ ...item, label: new Date(`${item.date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }))
  }, [tableRows, isAdminMaster])

  if (loading) {
    return <LoadingState fullPage label="Carregando dashboard..." />
  }

  if (user?.db?.status === 'pending') {
    return <AccessBlockedState kind="pending" fullPage />
  }

  if (user?.db?.status === 'inactive') {
    return <AccessBlockedState kind="inactive" description="Sua conta está desativada. Entre em contato com o administrador." fullPage />
  }

  if (!user?.db) {
    return null
  }

  const columns: Column<(typeof tableRows)[number]>[] = [
    { key: 'data', header: 'Data', render: (row) => (row.data ? new Date(`${row.data}T00:00:00`).toLocaleDateString('pt-BR') : '-') },
    { key: 'casa', header: 'Casa', render: (row) => row.casaNome },
    { key: 'afiliado', header: 'Afiliado', render: (row) => `${row.vendedorNome} (${row.vendedorRole})` },
    { key: 'clicks', header: 'Clicks', render: (row) => row.clicks },
    { key: 'registros', header: 'Registros', render: (row) => row.registros },
    { key: 'depositos', header: 'Depósitos', render: (row) => `R$ ${row.depositos.toFixed(2)}` },
    { key: 'rev', header: 'REV', render: (row) => `R$ ${row.revVisible.toFixed(2)}` },
    { key: 'ftd', header: 'FTD', render: (row) => row.ftd },
    { key: 'qftd', header: 'QFTD', render: (row) => row.qftd },
    { key: 'cpa', header: 'CPA', render: (row) => `R$ ${row.cpa.toFixed(2)}` },
    { key: 'comissao', header: 'Comissão', render: (row) => `R$ ${row.comissaoOperacional.toFixed(2)}` },
    { key: 'meuGanho', header: 'Meu ganho', render: (row) => `R$ ${row.meuGanho.toFixed(2)}` },
  ]

  return (
    <LayoutShell active="dashboard" user={{ nome: user.db.nome, email: user.email || '', role: user.db.role || '' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <Card variant="header" style={{ marginBottom: '24px' }}>
          <p style={eyebrowStyle}>Overview</p>
          <h1 style={{ margin: '10px 0 8px', fontSize: '34px', fontWeight: 800, letterSpacing: '-0.04em' }}>Dashboard</h1>
          <p style={{ margin: 0, color: color.textSecondary, fontSize: '15px' }}>
            Visão operacional das conversões com ganho pessoal do usuário logado
          </p>
        </Card>

        <Card style={{ marginBottom: '24px' }}>
          <h2 style={panelTitleStyle}>Filtros</h2>
          <p style={{ ...panelSubtitleStyle, marginBottom: '18px' }}>Refine os dados exibidos.</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <Field label="Data início">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>

            <Field label="Data fim">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>

            <Field label="Casa">
              <Select value={selectedHouse} onChange={(e) => setSelectedHouse(e.target.value)}>
                <option value="">Todas</option>
                {houseOptions.map((house) => (
                  <option key={house.id} value={house.id}>
                    {house.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Pessoa">
              <Select value={selectedPerson} onChange={(e) => setSelectedPerson(e.target.value)}>
                <option value="">Todas</option>
                {visiblePeopleOptions.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.nome} ({person.role})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <section
          className="grid gap-4"
          style={{
            gridTemplateColumns: isAdminMaster ? 'repeat(auto-fit, minmax(160px, 1fr))' : 'repeat(auto-fit, minmax(200px, 1fr))',
            marginBottom: '24px',
          }}
        >
          {visibleCards.map((card) => (
            <StatCard key={card.title} label={card.title} value={card.value} />
          ))}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5" style={{ marginBottom: '24px' }}>
          <Card>
            <h2 style={panelTitleStyle}>Volume ao longo do tempo</h2>
            <p style={{ ...panelSubtitleStyle, marginBottom: '18px' }}>Registros, FTD e depósitos por dia no período filtrado.</p>
            {dailySeries.length === 0 ? (
              <EmptyChart />
            ) : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <AreaChart data={dailySeries} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                    <XAxis dataKey="label" stroke={color.textSecondary} fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke={color.textSecondary} fontSize={12} tickLine={false} axisLine={false} width={40} />
                    <RechartsTooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, color: color.textSecondary }} />
                    <Area type="monotone" dataKey="registros" name="Registros" stroke={CHART_COLORS.registros} fill={CHART_COLORS.registros} fillOpacity={0.18} strokeWidth={2} />
                    <Area type="monotone" dataKey="ftd" name="FTD" stroke={CHART_COLORS.ftd} fill={CHART_COLORS.ftd} fillOpacity={0.18} strokeWidth={2} />
                    <Area type="monotone" dataKey="depositos" name="Depósitos" stroke={CHART_COLORS.depositos} fill={CHART_COLORS.depositos} fillOpacity={0.18} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card>
            <h2 style={panelTitleStyle}>Comissão por casa</h2>
            <p style={{ ...panelSubtitleStyle, marginBottom: '18px' }}>Seu ganho (&quot;Meu ganho&quot;) somado por casa, top 8.</p>
            {commissionByHouse.length === 0 ? (
              <EmptyChart />
            ) : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={commissionByHouse} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(148,163,184,0.12)" horizontal={false} />
                    <XAxis type="number" stroke={color.textSecondary} fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" stroke={color.textSecondary} fontSize={12} tickLine={false} axisLine={false} width={90} />
                    <RechartsTooltip content={<ChartTooltip formatValue={(v) => `R$ ${Number(v).toFixed(2)}`} />} cursor={{ fill: 'rgba(34,197,94,0.06)' }} />
                    <Bar dataKey="value" name="Meu ganho" fill={CHART_COLORS.house} radius={[0, 4, 4, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {isAdminMaster && (
            <Card style={{ gridColumn: '1 / -1' }}>
              <h2 style={panelTitleStyle}>REV vs CPA ao longo do tempo</h2>
              <p style={{ ...panelSubtitleStyle, marginBottom: '18px' }}>Visível apenas para admin master.</p>
              {revCpaSeries.length === 0 ? (
                <EmptyChart />
              ) : (
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <AreaChart data={revCpaSeries} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                      <XAxis dataKey="label" stroke={color.textSecondary} fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke={color.textSecondary} fontSize={12} tickLine={false} axisLine={false} width={50} />
                      <RechartsTooltip content={<ChartTooltip formatValue={(v) => `R$ ${Number(v).toFixed(2)}`} />} />
                      <Legend wrapperStyle={{ fontSize: 12, color: color.textSecondary }} />
                      <Area type="monotone" dataKey="rev" name="REV" stroke={CHART_COLORS.rev} fill={CHART_COLORS.rev} fillOpacity={0.18} strokeWidth={2} />
                      <Area type="monotone" dataKey="cpa" name="CPA" stroke={CHART_COLORS.cpa} fill={CHART_COLORS.cpa} fillOpacity={0.18} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          )}
        </section>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
            <div>
              <h2 style={panelTitleStyle}>Conversões visíveis</h2>
              <p style={panelSubtitleStyle}>Operação visível com coluna de ganho pessoal do usuário logado. Clique numa linha para ver o detalhamento.</p>
            </div>
            <div
              style={{
                padding: '8px 12px',
                borderRadius: radius.pill,
                background: color.infoBg,
                border: `1px solid ${color.infoBorder}`,
                color: color.greenSofter,
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {tableRows.length} registros
            </div>
          </div>

          <DataTable
            columns={columns}
            data={tableRows}
            rowKey={(row) => row.id}
            emptyMessage="Nenhuma conversão encontrada."
            pageSize={50}
            onRowClick={(row) => toggleRow(row.id)}
            isRowExpanded={(row) => Boolean(expandedRows[row.id])}
            renderExpandedRow={(row) =>
              row.visibleSplits.length === 0 ? null : (
                <div style={{ padding: '8px 4px' }}>
                  {row.visibleSplits.map((split) => {
                    const splitUser = allUsers.find((u) => u.id === split.receiver_user_id)
                    const isLeadOwner = split.receiver_user_id === row.leadOwnerUserId

                    return (
                      <div
                        key={split.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(220px, 1fr) 90px',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 0',
                          borderBottom: '1px solid rgba(34,197,94,0.05)',
                          fontSize: '14px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {splitUser?.nome || 'Desconhecido'} ({split.receiver_role})
                          {isLeadOwner && <Star size={13} color={color.amber} fill={color.amber} />}
                        </div>
                        <div style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>R$ {Number(split.amount).toFixed(2)}</div>
                      </div>
                    )
                  })}
                </div>
              )
            }
          />
        </Card>
      </div>
    </LayoutShell>
  )
}

function EmptyChart() {
  return (
    <div
      style={{
        height: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color.textSecondary,
        fontSize: '13px',
        border: '1px dashed rgba(34,197,94,0.18)',
        borderRadius: radius.lg,
      }}
    >
      Sem dados para o período selecionado.
    </div>
  )
}

function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string }[]
  label?: string
  formatValue?: (value: number) => string
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div
      style={{
        background: '#0a0f0c',
        border: `1px solid ${color.cardBorderStrong}`,
        borderRadius: radius.sm,
        padding: '10px 12px',
        fontSize: '12px',
        color: color.textPrimary,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      {label && <div style={{ color: color.textSecondary, marginBottom: '6px' }}>{label}</div>}
      {payload.map((item, index) => (
        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: index === 0 ? 0 : '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: item.color, flexShrink: 0 }} />
          <span style={{ color: color.textSecondary }}>{item.name}:</span>
          <strong>{formatValue ? formatValue(Number(item.value)) : item.value}</strong>
        </div>
      ))}
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
