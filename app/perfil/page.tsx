'use client'

import { useEffect, useState } from 'react'
import LayoutShell from '../components/LayoutShell'
import { supabase } from '@/lib/supabase'
import { color, radius } from '@/lib/design-tokens'
import { Card, Field, Input, Button, LoadingState, useToast } from '../components/ui'

type UserRole = 'admin_master' | 'admin_partner' | 'gerente' | 'afiliado'

type UserRow = {
  id: string
  nome: string | null
  email: string | null
  role: UserRole | null
  parent_id: string | null
  afiliado_nome: string | null
}

type LinkRow = {
  id: string
  tracking_link: string
  baseline_value: number | null
  house_id: string
  houses:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null
}

export default function PerfilPage() {
  const toast = useToast()
  const [userDb, setUserDb] = useState<UserRow | null>(null)
  const [parentName, setParentName] = useState('-')
  const [links, setLinks] = useState<LinkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

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

    const { data: userData, error } = await supabase
      .from('users')
      .select('id, nome, email, role, parent_id, afiliado_nome')
      .eq('auth_id', authData.user.id)
      .single()

    if (error || !userData) {
      toast.error('Erro ao carregar perfil.')
      setLoading(false)
      return
    }

    const currentUser = userData as UserRow
    setUserDb(currentUser)

    if (currentUser.parent_id) {
      const { data: parentData } = await supabase
        .from('users')
        .select('nome, email')
        .eq('id', currentUser.parent_id)
        .maybeSingle()

      setParentName(parentData?.nome || parentData?.email || '-')
    }

    const { data: linksData } = await supabase
      .from('user_house_links')
      .select(`
        id,
        tracking_link,
        baseline_value,
        active,
        house_id,
        houses:user_house_links_house_id_fkey (
          id,
          name
        )
      `)
      .eq('user_id', currentUser.id)
      .eq('active', true)

    setLinks((linksData || []) as LinkRow[])
    setLoading(false)
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link)
    toast.success('Link copiado.')
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()

    if (!currentPassword.trim()) {
      toast.error('Digite sua senha atual.')
      return
    }

    if (!newPassword.trim() || newPassword.length < 6) {
      toast.error('A nova senha precisa ter pelo menos 6 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não conferem.')
      return
    }

    setSavingPassword(true)

    const { data: authData } = await supabase.auth.getUser()

    if (!authData.user?.email) {
      setSavingPassword(false)
      toast.error('Erro ao validar sessão.')
      return
    }

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: authData.user.email,
      password: currentPassword,
    })

    if (reauthError) {
      setSavingPassword(false)
      toast.error('Senha atual incorreta.')
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    setSavingPassword(false)

    if (error) {
      toast.error(`Erro ao alterar senha: ${error.message}`)
      return
    }

    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    toast.success('Senha alterada com sucesso.')
  }

  function formatMoney(value?: number | null) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
  }

  function formatRole(role: UserRole | null) {
    if (!role) return '-'
    const map = {
      admin_master: 'Admin Master',
      admin_partner: 'Admin Partner',
      gerente: 'Gerente',
      afiliado: 'Afiliado',
    }
    return map[role]
  }

  if (loading) {
    return <LoadingState fullPage label="Carregando perfil..." />
  }

  if (!userDb) {
    return (
      <div style={{ minHeight: '100vh', background: color.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.greenSofter }}>
        Perfil não encontrado.
      </div>
    )
  }

  return (
    <LayoutShell
      active="perfil"
      user={{ nome: userDb.nome || '', email: userDb.email || '', role: userDb.role || '' }}
    >
      <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
        <Card variant="header" style={{ marginBottom: '24px' }}>
          <p style={eyebrowStyle}>Conta</p>
          <h1 style={{ margin: '10px 0 8px', fontSize: '34px', fontWeight: 800, letterSpacing: '-0.04em' }}>Meu Perfil</h1>
          <p style={{ margin: 0, color: color.textSecondary, fontSize: '15px' }}>
            Consulte seus dados, links por casa e altere sua senha.
          </p>
        </Card>

        <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.8fr] gap-6 items-start">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Card>
              <h2 style={panelTitleStyle}>Dados básicos</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5" style={{ marginTop: '18px' }}>
                <Info label="Nome" value={userDb.nome || '-'} />
                <Info label="Email" value={userDb.email || '-'} />
                <Info label="Role" value={formatRole(userDb.role)} />
                <Info label="Gerente" value={parentName} />
                <Info label="Nome CSV" value={userDb.afiliado_nome || 'Sem vínculo'} />
              </div>
            </Card>

            <Card>
              <h2 style={panelTitleStyle}>Meus links</h2>
              <p style={panelSubtitleStyle}>Estes são seus links ativos por casa. Os links são gerenciados pelo administrador.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '18px' }}>
                {links.length === 0 ? (
                  <div
                    style={{
                      padding: '24px',
                      borderRadius: radius.lg,
                      border: '1px dashed rgba(34,197,94,0.18)',
                      color: color.textSecondary,
                      textAlign: 'center',
                    }}
                  >
                    Nenhum link cadastrado ainda.
                  </div>
                ) : (
                  links.map((item) => {
                    const house = Array.isArray(item.houses) ? item.houses[0] : item.houses
                    return (
                      <div
                        key={item.id}
                        className="grid grid-cols-1 sm:grid-cols-[1fr_auto] items-center gap-3.5"
                        style={{
                          padding: '16px',
                          borderRadius: radius.lg,
                          border: '1px solid rgba(34,197,94,0.1)',
                          background: 'rgba(2, 6, 23, 0.72)',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, color: color.greenSofter, fontWeight: 800 }}>{house?.name || 'Casa sem nome'}</p>
                          <p style={{ margin: '6px 0 0', color: color.greenSofter, fontSize: '13px', fontWeight: 700 }}>
                            Baseline: {item.baseline_value !== null && item.baseline_value !== undefined ? formatMoney(item.baseline_value) : 'não informada'}
                          </p>
                          <p style={{ margin: '6px 0 0', color: color.textSecondary, fontSize: '13px', overflowWrap: 'anywhere' }}>
                            {item.tracking_link}
                          </p>
                        </div>
                        <Button variant="secondary" size="sm" onClick={() => copyLink(item.tracking_link)}>
                          Copiar
                        </Button>
                      </div>
                    )
                  })
                )}
              </div>
            </Card>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Card>
              <h2 style={panelTitleStyle}>Alterar senha</h2>
              <p style={panelSubtitleStyle}>Defina uma nova senha para sua conta.</p>

              <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '18px' }}>
                <Field label="Senha atual">
                  <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Digite sua senha atual" />
                </Field>
                <Field label="Nova senha">
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Digite a nova senha" />
                </Field>
                <Field label="Confirmar nova senha">
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha" />
                </Field>
                <Button type="submit" loading={savingPassword} fullWidth>
                  Alterar senha
                </Button>
              </form>
            </Card>
          </aside>
        </section>
      </div>
    </LayoutShell>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '16px', borderRadius: radius.lg, border: '1px solid rgba(34,197,94,0.1)', background: 'rgba(34,197,94,0.04)' }}>
      <p style={{ margin: 0, color: color.greenSoft, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
      <p style={{ margin: '8px 0 0', color: color.textPrimary, fontSize: '15px', fontWeight: 700, overflowWrap: 'anywhere' }}>{value}</p>
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

const panelSubtitleStyle: React.CSSProperties = { margin: '8px 0 0', color: color.textSecondary, fontSize: '14px' }
