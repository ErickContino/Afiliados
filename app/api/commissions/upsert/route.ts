import { NextResponse } from 'next/server'
import { getRequester, supabaseAdmin } from '@/lib/api-auth'

export async function POST(req: Request) {
  try {
    const auth = await getRequester(
      req,
      ['admin_master', 'gerente'],
      'Apenas admin_master ou gerente podem editar comissões.'
    )
    if (!auth.ok) return auth.response
    const { requester } = auth

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

    const { data: house, error: houseError } = await supabaseAdmin
      .from('houses')
      .select('commission_pool_value')
      .eq('id', house_id)
      .eq('active', true)
      .single()

    if (houseError || !house) {
      return NextResponse.json(
        { error: 'Casa ativa não encontrada.' },
        { status: 400 }
      )
    }

    const { data: adminPartnerRule, error: adminPartnerRuleError } = await supabaseAdmin
      .from('commission_rules')
      .select('amount')
      .eq('house_id', house_id)
      .eq('receiver_role', 'admin_partner')
      .eq('lead_owner_role', 'afiliado')
      .eq('active', true)
      .single()

    if (adminPartnerRuleError || !adminPartnerRule) {
      return NextResponse.json(
        { error: 'Regra de admin_partner para afiliado não encontrada nessa casa.' },
        { status: 400 }
      )
    }

    const { count: activePartnerCount, error: partnerCountError } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin_partner')
      .eq('status', 'active')

    if (partnerCountError) {
      return NextResponse.json(
        { error: partnerCountError.message },
        { status: 400 }
      )
    }

    const poolValue = Number(house.commission_pool_value)
    const adminPartnerAmount = Number(adminPartnerRule.amount)
    const totalAdminPartners = (activePartnerCount || 0) * adminPartnerAmount
    const maxAffiliateAmount = poolValue - totalAdminPartners

    if (maxAffiliateAmount < 0) {
      return NextResponse.json(
        { error: 'Pool da casa insuficiente para pagar os admin_partners.' },
        { status: 400 }
      )
    }

    if (amountNumber > maxAffiliateAmount) {
      return NextResponse.json(
        {
          error: `A comissão do afiliado não pode passar de R$ ${maxAffiliateAmount.toFixed(2)} para essa casa.`,
        },
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