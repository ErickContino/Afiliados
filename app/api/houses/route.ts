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
      return NextResponse.json({ error: 'Token ausente.' }, { status: 401 })
    }

    const { data: authData, error: authError } = await supabasePublic.auth.getUser(token)

    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('auth_id', authData.user.id)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 403 })
    }

    if (user.role !== 'admin_master') {
      return NextResponse.json({ error: 'Apenas admin_master pode alterar casas.' }, { status: 403 })
    }

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
        gross_value,
        michael_box_value,
        commission_pool_value,
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