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

    // quem está fazendo a ação
    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('auth_id', authData.user.id)
      .single()

    if (!currentUser || currentUser.role !== 'admin_master') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()

    const {
      user_id,
      nome,
      role,
      parent_id,
      afiliado_nome,
      links // array
    } = body

    if (!user_id || !role) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    // 1. Atualizar usuário
    const { error: userError } = await supabaseAdmin
      .from('users')
      .update({
        nome,
        role,
        parent_id,
        afiliado_nome,
        status: 'active'
      })
      .eq('id', user_id)

    if (userError) {
      const errorMessage =
        userError.message?.includes('users_nome_unique_normalized') ||
        userError.message?.includes('users_email_unique_normalized') ||
        userError.message?.includes('users_afiliado_nome_unique_normalized') ||
        userError.message?.includes('duplicate key value')
          ? 'Já existe um usuário com esse nome, e-mail ou nome de afiliado.'
          : userError.message

      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    // 2. Inserir links (se existirem)
    if (Array.isArray(links) && links.length > 0) {
      for (const link of links) {
        const {
          house_id,
          tracking_link,
          baseline_value
        } = link

        if (!house_id || !tracking_link) continue

        // encerra antigo (versionamento)
        await supabaseAdmin
          .from('user_house_links')
          .update({
            active: false,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user_id)
          .eq('house_id', house_id)
          .eq('active', true)

        // cria novo
        await supabaseAdmin
          .from('user_house_links')
          .insert({
            user_id,
            house_id,
            tracking_link,
            baseline_value:
              baseline_value === '' ||
              baseline_value === null ||
              baseline_value === undefined
                ? null
                : Number(baseline_value),
            active: true,
            created_by: currentUser.id
          })
      }
    }

    return NextResponse.json({ success: true })

  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}