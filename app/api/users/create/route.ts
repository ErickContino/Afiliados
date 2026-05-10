import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
const supabasePublic = createClient(supabaseUrl, supabaseAnonKey)

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json(
        { error: 'Token de autenticação ausente.' },
        { status: 401 }
      )
    }

    const { data: authData, error: authError } = await supabasePublic.auth.getUser(token)

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'Usuário não autenticado.' },
        { status: 401 }
      )
    }

    const { data: requester, error: requesterError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('auth_id', authData.user.id)
      .single()

    if (requesterError || !requester) {
      return NextResponse.json(
        { error: 'Usuário não encontrado na tabela users.' },
        { status: 403 }
      )
    }

    if (requester.role !== 'admin_master') {
      return NextResponse.json(
        { error: 'Apenas admin_master pode criar usuários.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { nome, email, senha, role, parent_id, afiliado_nome } = body

    if (!nome || !email || !senha || !role) {
      return NextResponse.json(
        { error: 'Dados obrigatórios faltando.' },
        { status: 400 }
      )
    }

    const { data: authUser, error: createAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
      })

    if (createAuthError || !authUser.user) {
      return NextResponse.json(
        { error: createAuthError?.message || 'Erro ao criar usuário no Auth.' },
        { status: 400 }
      )
    }

    const { error: userError } = await supabaseAdmin.from('users').insert({
      nome,
      email,
      role,
      parent_id: parent_id || null,
      afiliado_nome: afiliado_nome || nome,
      auth_id: authUser.user.id,
    })

    if (userError) {
      const errorMessage =
        userError.message?.includes('users_nome_unique_normalized') ||
        userError.message?.includes('users_email_unique_normalized') ||
        userError.message?.includes('users_afiliado_nome_unique_normalized') ||
        userError.message?.includes('duplicate key value')
          ? 'Já existe um usuário com esse nome, e-mail ou nome de afiliado.'
          : userError.message

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Erro interno ao criar usuário.' },
      { status: 500 }
    )
  }
}