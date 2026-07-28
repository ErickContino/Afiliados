import { NextResponse } from 'next/server'
import { getRequester, supabaseAdmin } from '@/lib/api-auth'

export async function POST(req: Request) {
  try {
    const auth = await getRequester(req, ['admin_master'], 'Apenas admin_master pode criar usuários.')
    if (!auth.ok) return auth.response

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
      // Reverte o usuário criado no Auth para não deixar uma conta órfã
      // (sem linha em `users`) ocupando o e-mail e impedindo nova tentativa.
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)

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