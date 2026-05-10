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

    const {
      user_id,
      period_year,
      period_month,
      notes
    } = await req.json()

    if (!user_id || !period_year || !period_month) {
      return NextResponse.json(
        { error: 'Dados obrigatórios ausentes' },
        { status: 400 }
      )
    }

    const startDate = `${period_year}-${String(period_month).padStart(2, '0')}-01`

    const nextMonth =
      period_month === 12
        ? `${period_year + 1}-01-01`
        : `${period_year}-${String(period_month + 1).padStart(2, '0')}-01`

    const { data: splits, error: splitsError } = await supabaseAdmin
        .from('commission_splits')
        .select(`
            amount,
            conversions!inner (
            data
            )
        `)
        .eq('receiver_user_id', user_id)
        .gte('conversions.data', startDate)
        .lt('conversions.data', nextMonth)

        if (splitsError) {
        return NextResponse.json(
            { error: splitsError.message },
            { status: 400 }
        )
        }

    const amount = (splits || []).reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    )

    const payload = {
      user_id,
      period_year,
      period_month,
      amount_snapshot: amount,
      status: 'paid',
      invoice_status: 'approved',
      paid_at: new Date().toISOString(),
      notes: notes || null,
      created_by: currentUser.id
    }

    const { data: existing } = await supabaseAdmin
      .from('financial_payouts')
      .select('id')
      .eq('user_id', user_id)
      .eq('period_year', period_year)
      .eq('period_month', period_month)
      .maybeSingle()

    let result

    if (existing?.id) {
      result = await supabaseAdmin
        .from('financial_payouts')
        .update(payload)
        .eq('id', existing.id)
    } else {
      result = await supabaseAdmin
        .from('financial_payouts')
        .insert(payload)
    }

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      amount
    })
  } catch {
    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 }
    )
  }
}