import { NextResponse } from 'next/server'
import { getRequester, supabaseAdmin } from '@/lib/api-auth'

export async function POST(req: Request) {
  try {
    const auth = await getRequester(req, ['admin_master', 'gerente'])
    if (!auth.ok) return auth.response
    const { requester: currentUser } = auth

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

    let finalRole = role
    let finalParentId = parent_id

    if (currentUser.role === 'gerente') {
      const { data: targetUser, error: targetError } = await supabaseAdmin
        .from('users')
        .select('id, status, parent_id')
        .eq('id', user_id)
        .single()

      if (targetError || !targetUser) {
        return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
      }

      const isOwnAffiliate = targetUser.parent_id === currentUser.id
      const isClaimablePending = targetUser.status === 'pending'

      if (!isOwnAffiliate && !isClaimablePending) {
        return NextResponse.json(
          { error: 'Você só pode aceitar cadastros pendentes ou editar afiliados da sua própria equipe.' },
          { status: 403 }
        )
      }

      // Gerente só pode aceitar/editar afiliados sob a própria hierarquia, nunca mudar role ou responsável.
      finalRole = 'afiliado'
      finalParentId = currentUser.id
    }

    // 1. Atualizar usuário
    const { error: userError } = await supabaseAdmin
      .from('users')
      .update({
        nome,
        role: finalRole,
        parent_id: finalParentId,
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