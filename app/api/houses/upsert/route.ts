import { NextResponse } from 'next/server'
import { getRequester, supabaseAdmin } from '@/lib/api-auth'

export async function POST(req: Request) {
  try {
    const auth = await getRequester(req, ['admin_master'], 'Apenas admin_master pode alterar casas.')
    if (!auth.ok) return auth.response
    const { requester: user } = auth

    const body = await req.json()

    const {
      name,
      gross_value,
      michael_box_value,
      commission_pool_value,
      rules,
    } = body

    if (
      !name ||
      gross_value === undefined ||
      michael_box_value === undefined ||
      commission_pool_value === undefined ||
      !Array.isArray(rules) ||
      rules.length === 0
    ) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    }

    const grossValue = Number(gross_value)
    const boxValue = Number(michael_box_value)
    const poolValue = Number(commission_pool_value)

    if (
      Number.isNaN(grossValue) ||
      Number.isNaN(boxValue) ||
      Number.isNaN(poolValue)
    ) {
      return NextResponse.json({ error: 'Valores numéricos inválidos.' }, { status: 400 })
    }

    if (grossValue !== boxValue + poolValue) {
      return NextResponse.json(
        { error: 'O valor bruto deve ser igual à Taxa de Operação + Pool de Comissão.' },
        { status: 400 }
      )
    }

    const adminPartnerRule = rules.find(
      (r: any) =>
        r.receiver_role === 'admin_partner' &&
        ['gerente', 'afiliado'].includes(r.lead_owner_role)
    )

    const adminPartnerAmount = adminPartnerRule ? Number(adminPartnerRule.amount) : 0

    const { count: activePartnerCount, error: partnerCountError } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin_partner')
      .eq('status', 'active')

    if (partnerCountError) {
      return NextResponse.json({ error: partnerCountError.message }, { status: 400 })
    }

    const totalAdminPartners = (activePartnerCount || 0) * adminPartnerAmount

    if (poolValue < totalAdminPartners) {
      return NextResponse.json(
        {
          error:
            'Pool de Comissão insuficiente para pagar todos os admin_partners ativos.',
        },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    const { data: currentHouse } = await supabaseAdmin
      .from('houses')
      .select('*')
      .ilike('name', name)
      .eq('active', true)
      .maybeSingle()

    let oldHouseId: string | null = currentHouse?.id || null

    if (currentHouse) {
      const { error: closeHouseError } = await supabaseAdmin
        .from('houses')
        .update({
          active: false,
          valid_to: now,
        })
        .eq('id', currentHouse.id)

      if (closeHouseError) {
        return NextResponse.json({ error: closeHouseError.message }, { status: 400 })
      }

      const { error: closeRulesError } = await supabaseAdmin
        .from('commission_rules')
        .update({
          active: false,
          valid_to: now,
        })
        .eq('house_id', currentHouse.id)
        .eq('active', true)

      if (closeRulesError) {
        return NextResponse.json({ error: closeRulesError.message }, { status: 400 })
      }
    }

    const { data: newHouse, error: houseError } = await supabaseAdmin
      .from('houses')
      .insert({
        name,
        gross_value: grossValue,
        michael_box_value: boxValue,
        commission_pool_value: poolValue,
        active: true,
        valid_from: now,
        valid_to: null,
      })
      .select()
      .single()

    if (houseError || !newHouse) {
      return NextResponse.json(
        { error: houseError?.message || 'Erro ao criar casa.' },
        { status: 400 }
      )
    }

    const newHouseId = newHouse.id

    const rulesToInsert = rules.map((r: any) => ({
      house_id: newHouseId,
      lead_owner_role: r.lead_owner_role,
      receiver_role: r.receiver_role,
      amount: Number(r.amount),
      active: true,
      valid_from: now,
      valid_to: null,
      created_by: user.id,
    }))

    const { error: rulesError } = await supabaseAdmin
      .from('commission_rules')
      .insert(rulesToInsert)

    if (rulesError) {
      return NextResponse.json({ error: rulesError.message }, { status: 400 })
    }

    // Se esta for uma nova versão de uma casa existente,
    // copia as comissões ativas dos afiliados para o novo house_id.
    if (oldHouseId) {
      const { data: oldAffiliateSettings, error: oldSettingsError } = await supabaseAdmin
        .from('affiliate_commission_settings')
        .select('manager_user_id, affiliate_user_id, affiliate_amount')
        .eq('house_id', oldHouseId)
        .eq('active', true)

      if (oldSettingsError) {
        return NextResponse.json({ error: oldSettingsError.message }, { status: 400 })
      }

      if (oldAffiliateSettings && oldAffiliateSettings.length > 0) {
        const newSettings = oldAffiliateSettings.map((setting) => ({
          manager_user_id: setting.manager_user_id,
          affiliate_user_id: setting.affiliate_user_id,
          house_id: newHouseId,
          affiliate_amount: setting.affiliate_amount,
          active: true,
          valid_from: now,
          valid_to: null,
          created_by: user.id,
        }))

        const { error: cloneSettingsError } = await supabaseAdmin
          .from('affiliate_commission_settings')
          .insert(newSettings)

        if (cloneSettingsError) {
          return NextResponse.json({ error: cloneSettingsError.message }, { status: 400 })
        }
      }
    }

    return NextResponse.json({
      success: true,
      houseId: newHouseId,
      previousHouseId: oldHouseId,
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno ao salvar casa.' }, { status: 500 })
  }
}