import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
const supabasePublic = createClient(supabaseUrl, anonKey)

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

    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('auth_id', authData.user.id)
      .single()

    if (!currentUser || currentUser.role !== 'admin_master') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { user_id } = await req.json()

    if (!user_id) {
      return NextResponse.json({ error: 'user_id obrigatório' }, { status: 400 })
    }

    if (user_id === currentUser.id) {
      return NextResponse.json(
        { error: 'Você não pode desativar seu próprio usuário.' },
        { status: 400 }
      )
    }

    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from('users')
      .select('id, role, status')
      .eq('id', user_id)
      .single()

    if (targetError || !targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    if (targetUser.role === 'admin_master') {
      return NextResponse.json(
        { error: 'Não é permitido desativar outro admin_master por esta tela.' },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        status: 'inactive',
      })
      .eq('id', user_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}