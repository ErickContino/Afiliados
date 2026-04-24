'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LayoutShell from './components/LayoutShell'

type UserRole = 'admin_master' | 'admin_partner' | 'gerente' | 'afiliado'

type LoggedUser = {
  email?: string
  db?: {
    id: string
    nome: string
    role: UserRole
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
}

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState<LoggedUser | null>(null)
  const [message, setMessage] = useState('')
  const [splits, setSplits] = useState<CommissionSplit[]>([])
  const [conversions, setConversions] = useState<ConversionRow[]>([])
  const [allUsers, setAllUsers] = useState<UserRow[]>([])
  const [houses, setHouses] = useState<HouseRow[]>([])
  const [loading, setLoading] = useState(true)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedHouse, setSelectedHouse] = useState('')
  const [selectedPerson, setSelectedPerson] = useState('')
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})

  useEffect(() => {
    checkUser()
  }, [])

  async function loadDashboardData(currentUserDb?: {
    id: string
    nome: string
    role: string
  }) {
    const [splitsResponse, housesResponse, conversionsResponse, usersResponse] =
      await Promise.all([
        supabase
          .from('commission_splits')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('houses').select('id, name').order('name'),
        supabase.from('conversions').select('*').order('data', { ascending: false }),
        supabase.from('users').select('id, nome, email, role, parent_id'),
      ])

    if (housesResponse.data) {
      setHouses(housesResponse.data as HouseRow[])
    } else {
      setHouses([])
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
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authData.user.id)
      .single()

    const loggedUser: LoggedUser = {
      email: authData.user.email,
      db: data
        ? {
            id: data.id,
            nome: data.nome,
            role: data.role,
          }
        : undefined,
    }

    setUser(loggedUser)

    if (data) {
      await loadDashboardData(data)
    }

    setLoading(false)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setMessage('Entrando...')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(`Erro: ${error.message}`)
      return
    }

    setMessage('Login realizado com sucesso!')
    await checkUser()
  }

  const isAdminMaster = user?.db?.role === 'admin_master'
  const isAdminPartner = user?.db?.role === 'admin_partner'

  const usersByParentId = useMemo(() => {
    const map: Record<string, UserRow[]> = {}

    for (const dbUser of allUsers) {
      const parentKey = dbUser.parent_id || '__root__'

      if (!map[parentKey]) {
        map[parentKey] = []
      }

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
    return allUsers
      .filter((dbUser) => visibleUserIds.includes(dbUser.id))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [allUsers, visibleUserIds])

  const splitsByConversionId = useMemo(() => {
    const map: Record<string, CommissionSplit[]> = {}

    for (const split of splits) {
      if (!map[split.conversion_id]) {
        map[split.conversion_id] = []
      }

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
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const filteredConversions = useMemo(() => {
    return conversions.filter((item) => {
      const matchesVisibility = canSeeConversion(item)
      const matchesHouse = selectedHouse ? item.house_id === selectedHouse : true
      const matchesPerson = selectedPerson
        ? item.lead_owner_user_id === selectedPerson
        : true

      const conversionDate = item.data ? new Date(`${item.data}T00:00:00`) : null

      const matchesStartDate =
        startDate && conversionDate
          ? conversionDate >= new Date(`${startDate}T00:00:00`)
          : true

      const matchesEndDate =
        endDate && conversionDate
          ? conversionDate <= new Date(`${endDate}T23:59:59`)
          : true

      return (
        matchesVisibility &&
        matchesHouse &&
        matchesPerson &&
        matchesStartDate &&
        matchesEndDate
      )
    })
  }, [
    conversions,
    selectedHouse,
    selectedPerson,
    startDate,
    endDate,
    visibleUserIds,
    isAdminMaster,
  ])

  const tableRows = useMemo(() => {
    return filteredConversions.map((conversion) => {
      const leadOwner = conversion.lead_owner_user_id
        ? allUsers.find((item) => item.id === conversion.lead_owner_user_id)
        : undefined

      const allSplitsForRow = splitsByConversionId[conversion.id] || []
      const visibleSplitsForRow = allSplitsForRow.filter(canSeeSplit)

      const mySplit = allSplitsForRow.find(
        (split) => split.receiver_user_id === user?.db?.id
      )

      const revReal = Number(conversion.rev || 0)
      const revVisible = isAdminMaster ? revReal : 0

      const cpaBruto = Number(conversion.cpa || 0)

      const cpaVisible = isAdminMaster
        ? cpaBruto
        : Number(mySplit?.amount || 0)

      const comissaoOperacional = isAdminMaster
        ? cpaBruto + revReal
        : cpaVisible

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
  }, [filteredConversions, allUsers, splitsByConversionId, isAdminMaster, user?.db?.id, houses])

  const totalRegistros = useMemo(() => {
    return filteredConversions.reduce((acc, item) => acc + Number(item.registros || 0), 0)
  }, [filteredConversions])

  const totalFTD = useMemo(() => {
    return filteredConversions.reduce((acc, item) => acc + Number(item.ftd || 0), 0)
  }, [filteredConversions])

  const totalDepositos = useMemo(() => {
    return filteredConversions.reduce((acc, item) => acc + Number(item.depositos || 0), 0)
  }, [filteredConversions])

  const totalCPAVisible = useMemo(() => {
    return tableRows.reduce((acc, item) => acc + Number(item.cpa || 0), 0)
  }, [tableRows])

  const totalREVVisible = useMemo(() => {
    return tableRows.reduce((acc, item) => acc + Number(item.revVisible || 0), 0)
  }, [tableRows])

  const totalComissao = useMemo(() => {
    return tableRows.reduce(
      (acc, item) => acc + Number(item.comissaoOperacional || 0),
      0
    )
  }, [tableRows])

  const visibleCards = useMemo(() => {
    return [
      { title: 'Registros', value: String(totalRegistros) },
      { title: 'FTD', value: String(totalFTD) },
      { title: 'Depósitos', value: `R$ ${totalDepositos.toFixed(2)}` },
      { title: 'CPA', value: `R$ ${totalCPAVisible.toFixed(2)}` },
      { title: 'REV', value: `R$ ${totalREVVisible.toFixed(2)}` },
      { title: 'Comissão', value: `R$ ${totalComissao.toFixed(2)}` },
    ]
  }, [
    totalRegistros,
    totalFTD,
    totalDepositos,
    totalCPAVisible,
    totalREVVisible,
    totalComissao,
  ])

  if (loading) {
    return (
      <main style={loginPageBg}>
        <div style={centerBox}>
          <p style={{ color: '#bbf7d0', fontSize: '16px' }}>Carregando...</p>
        </div>
      </main>
    )
  }

  if (user?.db) {
    return (
      <LayoutShell
        active="dashboard"
        user={{
          nome: user.db.nome,
          email: user.email || '',
          role: user.db.role,
        }}
      >
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <header style={headerCard}>
            <div>
              <p style={eyebrow}>Overview</p>
              <h1 style={pageTitle}>Dashboard</h1>
              <p style={pageSubtitle}>
                Visão operacional das conversões com ganho pessoal do usuário logado
              </p>
            </div>
          </header>

          <section style={filtersCard}>
            <div style={panelHeader}>
              <div>
                <h2 style={panelTitle}>Filtros</h2>
                <p style={panelSubtitle}>Refine os dados exibidos.</p>
              </div>
            </div>

            <div style={filtersGrid}>
              <FilterField label="Data início">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={inputStyle}
                />
              </FilterField>

              <FilterField label="Data fim">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={inputStyle}
                />
              </FilterField>

              <FilterField label="Casa">
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
              </FilterField>

              <FilterField label="Pessoa">
                <select
                  value={selectedPerson}
                  onChange={(e) => setSelectedPerson(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Todas</option>
                  {visiblePeopleOptions.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.nome} ({person.role})
                    </option>
                  ))}
                </select>
              </FilterField>
            </div>
          </section>

          <section
            style={{
              display: 'grid',
              gridTemplateColumns: isAdminMaster
                ? 'repeat(auto-fit, minmax(180px, 1fr))'
                : 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            {visibleCards.map((card) => (
              <KpiCard key={card.title} title={card.title} value={card.value} />
            ))}
          </section>

          <section
            style={{
              borderRadius: '24px',
              border: '1px solid rgba(34,197,94,0.12)',
              background:
                'linear-gradient(180deg, rgba(9,14,12,0.96), rgba(4,8,7,0.96))',
              overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
            }}
          >
            <div
              style={{
                padding: '22px 24px',
                borderBottom: '1px solid rgba(34,197,94,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: 700,
                  }}
                >
                  Conversões visíveis
                </h2>
                <p
                  style={{
                    margin: '6px 0 0',
                    color: '#94a3b8',
                    fontSize: '14px',
                  }}
                >
                  Operação visível com coluna de ganho pessoal do usuário logado
                </p>
              </div>

              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '999px',
                  background: 'rgba(34,197,94,0.08)',
                  border: '1px solid rgba(34,197,94,0.14)',
                  color: '#bbf7d0',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {tableRows.length} registros
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: 'rgba(34,197,94,0.05)',
                      textAlign: 'left',
                    }}
                  >
                    <Th>Data</Th>
                    <Th>Casa</Th>
                    <Th>Afiliado</Th>
                    <Th>Clicks</Th>
                    <Th>Registros</Th>
                    <Th>Depósitos</Th>
                    <Th>REV</Th>
                    <Th>FTD</Th>
                    <Th>QFTD</Th>
                    <Th>CPA</Th>
                    <Th>Comissão</Th>
                    <Th>Meu ganho</Th>
                  </tr>
                </thead>

                <tbody>
                  {tableRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={12}
                        style={{
                          padding: '28px',
                          textAlign: 'center',
                          color: '#94a3b8',
                        }}
                      >
                        Nenhuma conversão encontrada.
                      </td>
                    </tr>
                  ) : (
                    tableRows.slice(0, 50).map((row) => (
                      <Fragment key={row.id}>
                        <tr
                          onClick={() => toggleRow(row.id)}
                          style={{
                            borderTop: '1px solid rgba(34,197,94,0.08)',
                            cursor: 'pointer',
                          }}
                        >
                          <Td>
                            {row.data
                              ? new Date(`${row.data}T00:00:00`).toLocaleDateString(
                                  'pt-BR'
                                )
                              : '-'}
                          </Td>
                          <Td>{row.casaNome}</Td>
                          <Td>
                            {row.vendedorNome} ({row.vendedorRole})
                          </Td>
                          <Td>{row.clicks}</Td>
                          <Td>{row.registros}</Td>
                          <Td>R$ {row.depositos.toFixed(2)}</Td>
                          <Td>R$ {row.revVisible.toFixed(2)}</Td>
                          <Td>{row.ftd}</Td>
                          <Td>{row.qftd}</Td>
                          <Td>R$ {row.cpa.toFixed(2)}</Td>
                          <Td>R$ {row.comissaoOperacional.toFixed(2)}</Td>
                          <Td>R$ {row.meuGanho.toFixed(2)}</Td>
                        </tr>

                        {expandedRows[row.id] && row.visibleSplits.length > 0 && (
                          <tr>
                            <td colSpan={12} style={{ padding: '0 24px' }}>
                              <div
                                style={{
                                  background: 'rgba(34,197,94,0.04)',
                                  borderTop: '1px solid rgba(34,197,94,0.08)',
                                  padding: '8px 16px',
                                }}
                              >
                                {row.visibleSplits.map((split) => {
                                  const splitUser = allUsers.find(
                                    (u) => u.id === split.receiver_user_id
                                  )

                                  const isLeadOwner =
                                    split.receiver_user_id === row.leadOwnerUserId

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
                                      <div>
                                        {splitUser?.nome || 'Desconhecido'} (
                                        {split.receiver_role})
                                        {isLeadOwner && ' ⭐'}
                                      </div>

                                      <div
                                        style={{
                                          textAlign: 'right',
                                          fontWeight: 700,
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        R$ {Number(split.amount).toFixed(2)}
                                      </div>
                                    </div>
                                  )
                                })}
                                </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </LayoutShell>
    )
  }

  return (
    <main style={loginPageBg}>
      <div style={loginCard}>
        <div style={{ marginBottom: '24px' }}>
          <div style={loginLogoBox}>GA</div>

          <h1
            style={{
              margin: 0,
              fontSize: '30px',
              fontWeight: 800,
              letterSpacing: '-0.04em',
            }}
          >
            Entrar
          </h1>

          <p
            style={{
              marginTop: '10px',
              color: '#94a3b8',
              fontSize: '14px',
            }}
          >
            Acesse o painel de gestão de afiliados
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />

          <button
            type="submit"
            style={{
              marginTop: '8px',
              border: '1px solid rgba(34,197,94,0.25)',
              background: 'linear-gradient(180deg, #16a34a, #15803d)',
              color: '#f0fdf4',
              padding: '13px 16px',
              borderRadius: '14px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '15px',
              boxShadow: '0 0 24px rgba(34,197,94,0.18)',
            }}
          >
            Entrar
          </button>
        </form>

        {message && (
          <p
            style={{
              marginTop: '18px',
              color: '#bbf7d0',
              fontSize: '14px',
            }}
          >
            {message}
          </p>
        )}
      </div>
    </main>
  )
}

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: '20px',
        border: '1px solid rgba(34,197,94,0.12)',
        background:
          'linear-gradient(180deg, rgba(9,14,12,0.96), rgba(4,8,7,0.96))',
        padding: '20px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.22)',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: '13px',
          color: '#86efac',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {title}
      </p>

      <h3
        style={{
          margin: '12px 0 0',
          fontSize: '28px',
          fontWeight: 800,
          letterSpacing: '-0.04em',
          color: '#f0fdf4',
        }}
      >
        {value}
      </h3>
    </div>
  )
}

function FilterField({
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
  return (
    <th
      style={{
        padding: '14px 16px',
        color: '#bbf7d0',
        fontSize: '12px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
    >
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: '16px',
        color: '#f8fafc',
        fontSize: '14px',
      }}
    >
      {children}
    </td>
  )
}

const centerBox: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  padding: '24px',
}

const loginPageBg: React.CSSProperties = {
  minHeight: '100vh',
  background:
    'radial-gradient(circle at top left, rgba(34,197,94,0.16), transparent 30%), radial-gradient(circle at bottom right, rgba(16,185,129,0.12), transparent 28%), #030712',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
}

const loginCard: React.CSSProperties = {
  width: '100%',
  maxWidth: '430px',
  borderRadius: '28px',
  border: '1px solid rgba(34,197,94,0.14)',
  background: 'linear-gradient(180deg, rgba(10,18,14,0.96), rgba(4,9,7,0.96))',
  boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
  padding: '32px',
  color: '#f8fafc',
}

const loginLogoBox: React.CSSProperties = {
  width: '52px',
  height: '52px',
  borderRadius: '14px',
  background: 'linear-gradient(135deg, #22c55e, #15803d)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  color: '#02100a',
  marginBottom: '16px',
  boxShadow: '0 0 30px rgba(34,197,94,0.24)',
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

const filtersCard: React.CSSProperties = {
  borderRadius: '24px',
  border: '1px solid rgba(34,197,94,0.12)',
  background: 'linear-gradient(180deg, rgba(9,14,12,0.96), rgba(4,8,7,0.96))',
  overflow: 'hidden',
  boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
  padding: '22px 24px',
  marginBottom: '24px',
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
  gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))',
  gap: '14px',
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  background: 'rgba(2, 6, 23, 0.85)',
  color: '#f8fafc',
  border: '1px solid rgba(34,197,94,0.14)',
  borderRadius: '14px',
  outline: 'none',
  fontSize: '14px',
  colorScheme: 'dark',
}