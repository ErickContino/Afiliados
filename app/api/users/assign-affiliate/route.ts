import { NextResponse } from 'next/server'
import { getRequester, supabaseAdmin } from '@/lib/api-auth'

export async function POST(req: Request) {
  try {
    const auth = await getRequester(req, ['admin_master'])
    if (!auth.ok) return auth.response

    const { user_id, afiliado_nome } = await req.json()

    if (!user_id || !afiliado_nome) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    // verificar se já existe
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('afiliado_nome', afiliado_nome)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Afiliado já vinculado a outro usuário' },
        { status: 400 }
      )
    }

    // atualizar
    const { error } = await supabaseAdmin
      .from('users')
      .update({ afiliado_nome })
      .eq('id', user_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
