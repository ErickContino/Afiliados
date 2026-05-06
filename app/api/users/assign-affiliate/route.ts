import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { user_id, afiliado_nome } = await req.json()

    if (!user_id || !afiliado_nome) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    // verificar se já existe
    const { data: existing } = await supabase
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
    const { error } = await supabase
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