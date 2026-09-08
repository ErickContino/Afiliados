import { NextResponse } from 'next/server'
import { getRequester, isValidPeriod, supabaseAdmin } from '@/lib/api-auth'

export async function POST(req: Request) {
  try {
    const auth = await getRequester(req, ['admin_master'])
    if (!auth.ok) return auth.response
    const { requester: currentUser } = auth

    const {
      user_id,
      period_year,
      period_month,
      fraud_amount,
      tax_rate_percent,
      notes
    } = await req.json()

    if (!user_id || !isValidPeriod(period_year, period_month)) {
      return NextResponse.json(
        { error: 'Dados obrigatórios ausentes' },
        { status: 400 }
      )
    }

    const fraudAmount = Number(fraud_amount) || 0
    const taxRatePercent = Number(tax_rate_percent) || 0

    if (fraudAmount < 0) {
      return NextResponse.json(
        { error: 'Valor de fraude inválido.' },
        { status: 400 }
      )
    }

    if (taxRatePercent < 0 || taxRatePercent > 100) {
      return NextResponse.json(
        { error: 'Taxa de imposto inválida.' },
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

    if (fraudAmount > amount) {
      return NextResponse.json(
        { error: 'O valor de fraude não pode ser maior que o valor total.' },
        { status: 400 }
      )
    }

    const amountAfterFraud = amount - fraudAmount
    const taxAmount = Math.round(amountAfterFraud * (taxRatePercent / 100) * 100) / 100
    const netAmount = Math.round((amountAfterFraud - taxAmount) * 100) / 100

    const payload = {
      user_id,
      period_year,
      period_month,
      amount_snapshot: netAmount,
      fraud_amount: fraudAmount,
      tax_rate_percent: taxRatePercent,
      tax_amount: taxAmount,
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
      amount: netAmount,
      gross_amount: amount,
      fraud_amount: fraudAmount,
      tax_rate_percent: taxRatePercent,
      tax_amount: taxAmount
    })
  } catch {
    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 }
    )
  }
}