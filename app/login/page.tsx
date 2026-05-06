'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type AuthMode = 'login' | 'signup'

export default function LoginPage() {
  const router = useRouter()

  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function bootstrapUser() {
    const { data: authData } = await supabase.auth.getUser()

    if (!authData?.user) {
      throw new Error('Usuário autenticado não encontrado.')
    }

    const res = await fetch('/api/users/bootstrap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_id: authData.user.id,
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
    setMessage('')

    if (!email || !password) {
      setMessage('Preencha email e senha.')
      return
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setMessage('As senhas não conferem.')
      return
    }

    setLoading(true)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          setLoading(false)
          setMessage(`Erro ao entrar: ${error.message}`)
          return
        }
      }

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })

        if (error) {
          setLoading(false)
          setMessage(`Erro ao criar conta: ${error.message}`)
          return
        }
      }

      await bootstrapUser()

      setLoading(false)
      router.push('/')
    } catch (err) {
      setLoading(false)
      setMessage(
        err instanceof Error
          ? err.message
          : 'Erro inesperado no processo de autenticação.'
      )
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode)
    setMessage('')
    setConfirmPassword('')
  }

  return (
    <main style={pageBg}>
      <div style={loginCard}>
        <div style={{ marginBottom: '24px' }}>
          <div style={loginLogoBox}>GA</div>

          <p style={eyebrow}>
            {mode === 'login' ? 'Acesso' : 'Cadastro'}
          </p>

          <h1 style={pageTitle}>
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </h1>

          <p style={pageSubtitle}>
            {mode === 'login'
              ? 'Acesse o painel de gestão de afiliados.'
              : 'Crie sua conta. O acesso será liberado após aprovação do administrador.'}
          </p>
        </div>

        <div style={modeSwitch}>
          <button
            type="button"
            onClick={() => switchMode('login')}
            style={mode === 'login' ? modeButtonActive : modeButton}
          >
            Entrar
          </button>

          <button
            type="button"
            onClick={() => switchMode('signup')}
            style={mode === 'signup' ? modeButtonActive : modeButton}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={handleSubmit} style={formStack}>
          <Field label="Email">
            <input
              type="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Senha">
            <input
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </Field>

          {mode === 'signup' && (
            <Field label="Confirmar senha">
              <input
                type="password"
                placeholder="Repita sua senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={inputStyle}
              />
            </Field>
          )}

          {mode === 'signup' && (
            <div style={warningBox}>
              Após criar a conta, seu cadastro ficará pendente até o administrador
              concluir sua liberação.
            </div>
          )}

          <button type="submit" style={primaryButton} disabled={loading}>
            {loading
              ? mode === 'login'
                ? 'Entrando...'
                : 'Criando...'
              : mode === 'login'
                ? 'Entrar'
                : 'Criar conta'}
          </button>

          {message && <p style={messageStyle}>{message}</p>}
        </form>
      </div>
    </main>
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

const pageBg: React.CSSProperties = {
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
  maxWidth: '460px',
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

const eyebrow: React.CSSProperties = {
  margin: 0,
  color: '#86efac',
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const pageTitle: React.CSSProperties = {
  margin: '10px 0 8px',
  fontSize: '30px',
  fontWeight: 800,
  letterSpacing: '-0.04em',
}

const pageSubtitle: React.CSSProperties = {
  margin: 0,
  color: '#94a3b8',
  fontSize: '14px',
  lineHeight: 1.5,
}

const modeSwitch: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '8px',
  padding: '6px',
  borderRadius: '16px',
  background: 'rgba(2, 6, 23, 0.7)',
  border: '1px solid rgba(34,197,94,0.12)',
  marginBottom: '22px',
}

const modeButton: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#94a3b8',
  padding: '10px 12px',
  borderRadius: '12px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '14px',
}

const modeButtonActive: React.CSSProperties = {
  border: '1px solid rgba(34,197,94,0.18)',
  background: 'rgba(34,197,94,0.12)',
  color: '#bbf7d0',
  padding: '10px 12px',
  borderRadius: '12px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '14px',
}

const formStack: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
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

const primaryButton: React.CSSProperties = {
  marginTop: '4px',
  border: '1px solid rgba(34,197,94,0.25)',
  background: 'linear-gradient(180deg, #16a34a, #15803d)',
  color: '#f0fdf4',
  padding: '13px 16px',
  borderRadius: '14px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '15px',
  boxShadow: '0 0 24px rgba(34,197,94,0.18)',
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

const messageStyle: React.CSSProperties = {
  margin: '4px 0 0',
  color: '#bbf7d0',
  fontSize: '14px',
  lineHeight: 1.4,
}