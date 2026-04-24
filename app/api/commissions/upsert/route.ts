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

    if (requester.role !== 'admin_master' && requester.role !== 'gerente') {
      return NextResponse.json(
        { error: 'Apenas admin_master ou gerente podem editar comissões.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { manager_user_id, affiliate_user_id, house_id, affiliate_amount } = body

    if (!affiliate_user_id || !house_id || affiliate_amount === undefined || affiliate_amount === null) {
      return NextResponse.json(
        { error: 'Dados obrigatórios faltando.' },
        { status: 400 }
      )
    }

    const amountNumber = Number(affiliate_amount)

    if (Number.isNaN(amountNumber) || amountNumber < 0) {
      return NextResponse.json(
        { error: 'Valor de comissão inválido.' },
        { status: 400 }
      )
    }

    const { data: affiliate, error: affiliateError } = await supabaseAdmin
      .from('users')
      .select('id, parent_id, role')
      .eq('id', affiliate_user_id)
      .single()

    if (affiliateError || !affiliate) {
      return NextResponse.json(
        { error: 'Afiliado não encontrado.' },
        { status: 404 }
      )
    }

    if (affiliate.role !== 'afiliado') {
      return NextResponse.json(
        { error: 'Usuário selecionado não é afiliado.' },
        { status: 400 }
      )
    }

    const finalManagerId =
      requester.role === 'admin_master'
        ? manager_user_id || affiliate.parent_id
        : requester.id

    if (!finalManagerId) {
      return NextResponse.json(
        { error: 'Gerente responsável não definido.' },
        { status: 400 }
      )
    }

    if (affiliate.parent_id !== finalManagerId) {
      return NextResponse.json(
        { error: 'Afiliado não pertence ao gerente informado.' },
        { status: 403 }
      )
    }

    if (requester.role === 'gerente' && affiliate.parent_id !== requester.id) {
      return NextResponse.json(
        { error: 'Gerente só pode editar afiliados diretos.' },
        { status: 403 }
      )
    }

    const { data: managerRule, error: managerRuleError } = await supabaseAdmin
      .from('commission_rules')
      .select('amount')
      .eq('house_id', house_id)
      .eq('lead_owner_role', 'gerente')
      .eq('receiver_role', 'gerente')
      .single()

    if (managerRuleError || !managerRule) {
      return NextResponse.json(
        { error: 'Regra de gerente não encontrada para essa casa.' },
        { status: 400 }
      )
    }

    const managerBaseAmount = Number(managerRule.amount)

    if (amountNumber > managerBaseAmount) {
      return NextResponse.json(
        { error: `A comissão do afiliado não pode passar de R$ ${managerBaseAmount.toFixed(2)}.` },
        { status: 400 }
      )
    }

    const { error: closeError } = await supabaseAdmin
      .from('affiliate_commission_settings')
      .update({
        active: false,
        valid_to: new Date().toISOString(),
      })
      .eq('manager_user_id', finalManagerId)
      .eq('affiliate_user_id', affiliate_user_id)
      .eq('house_id', house_id)
      .eq('active', true)

    if (closeError) {
      return NextResponse.json(
        { error: closeError.message },
        { status: 400 }
      )
    }

    const { error: insertError } = await supabaseAdmin
      .from('affiliate_commission_settings')
      .insert({
        manager_user_id: finalManagerId,
        affiliate_user_id,
        house_id,
        affiliate_amount: amountNumber,
        active: true,
        valid_from: new Date().toISOString(),
        valid_to: null,
        created_by: requester.id,
      })

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Erro interno ao salvar comissão.' },
      { status: 500 }
    )
  }
}