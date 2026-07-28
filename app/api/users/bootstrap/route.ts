import { NextResponse } from 'next/server'
import { supabaseAdmin, supabasePublic } from '@/lib/api-auth'

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Token ausente' }, { status: 401 })
    }

    const { data: authData } = await supabasePublic.auth.getUser(token)

    if (!authData?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await req.json()
    const { email } = body
    const auth_id = authData.user.id

    if (!email) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    // verifica se já existe
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth_id', auth_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: true })
    }

    // cria pending
    const { error } = await supabaseAdmin.from('users').insert({
      auth_id,
      email,
      nome: email,
      role: null,
      parent_id: null,
      afiliado_nome: null,
      status: 'pending',
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
