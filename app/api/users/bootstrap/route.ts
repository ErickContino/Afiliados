import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { auth_id, email } = body

    if (!auth_id || !email) {
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