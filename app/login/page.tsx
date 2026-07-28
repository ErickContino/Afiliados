'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { color, radius, shadow } from '@/lib/design-tokens'
import { Card, Field, Input, Button, Callout } from '../components/ui'

type AuthMode = 'login' | 'signup'

export default function LoginPage() {
  const router = useRouter()

  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function bootstrapUser() {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const { data: authData } = await supabase.auth.getUser()

    if (!authData?.user || !token) {
      throw new Error('Usuário autenticado não encontrado.')
    }

    const res = await fetch('/api/users/bootstrap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: authData.user.email,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Erro ao preparar cadastro do usuário.')
    }

    return data
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Preencha email e senha.')
      return
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('As senhas não conferem.')
      return
    }

    setLoading(true)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          setLoading(false)
          setError(`Erro ao entrar: ${error.message}`)
          return
        }
      }

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) {
          setLoading(false)
          setError(`Erro ao criar conta: ${error.message}`)
          return
        }
      }

      await bootstrapUser()

      setLoading(false)
      router.push('/')
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : 'Erro inesperado no processo de autenticação.')
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode)
    setError('')
    setConfirmPassword('')
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: color.bgAppGradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <Card
        variant="header"
        style={{ width: '100%', maxWidth: '460px', borderRadius: radius.xxl, boxShadow: shadow.card, padding: '32px' }}
      >
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: radius.md,
                background: color.brandGradientDiagonal,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                color: color.textOnLogo,
                boxShadow: shadow.logo,
              }}
            >
              AZ
            </div>
            <h1 style={{ margin: 0, color: color.textPrimary, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em' }}>
              AffiliaZap
            </h1>
          </div>

          <p
            style={{
              margin: 0,
              color: color.greenSoft,
              fontSize: '13px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {mode === 'login' ? 'Acesso' : 'Cadastro'}
          </p>

          <h2 style={{ margin: '10px 0 8px', fontSize: '30px', fontWeight: 800, letterSpacing: '-0.04em', color: color.textPrimary }}>
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </h2>

          <p style={{ margin: 0, color: color.textSecondary, fontSize: '14px', lineHeight: 1.5 }}>
            {mode === 'login'
              ? 'Acesse o painel de AffiliaZap.'
              : 'Crie sua conta. O acesso será liberado após aprovação do administrador.'}
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            padding: '6px',
            borderRadius: radius.lg,
            background: 'rgba(2, 6, 23, 0.7)',
            border: `1px solid ${color.cardBorder}`,
            marginBottom: '22px',
          }}
        >
          <Button
            type="button"
            variant={mode === 'login' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => switchMode('login')}
            style={{ border: mode === 'login' ? undefined : 'none', background: mode === 'login' ? undefined : 'transparent' }}
          >
            Entrar
          </Button>
          <Button
            type="button"
            variant={mode === 'signup' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => switchMode('signup')}
            style={{ border: mode === 'signup' ? undefined : 'none', background: mode === 'signup' ? undefined : 'transparent' }}
          >
            Criar conta
          </Button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="Email">
            <Input
              type="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="Senha">
            <Input
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          {mode === 'signup' && (
            <Field label="Confirmar senha">
              <Input
                type="password"
                placeholder="Repita sua senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </Field>
          )}

          {mode === 'signup' && (
            <Callout variant="warning">
              Após criar a conta, seu cadastro ficará pendente até o administrador concluir sua liberação.
            </Callout>
          )}

          <Button type="submit" loading={loading} fullWidth style={{ marginTop: '4px' }}>
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </Button>

          {error && <Callout variant="error">{error}</Callout>}
        </form>
      </Card>
    </main>
  )
}
