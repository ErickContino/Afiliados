import { NextResponse } from 'next/server'
import { getRequester, supabaseAdmin } from '@/lib/api-auth'

export async function GET(req: Request) {
  try {
    const auth = await getRequester(req, ['admin_master'])
    if (!auth.ok) return auth.response

    const { data, error } = await supabaseAdmin
      .from('payout_settings')
      .select('tax_rate_percent')
      .eq('id', true)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ tax_rate_percent: Number(data?.tax_rate_percent ?? 0) })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getRequester(req, ['admin_master'])
    if (!auth.ok) return auth.response
    const { requester: currentUser } = auth

    const { tax_rate_percent } = await req.json()
    const taxRatePercent = Number(tax_rate_percent)

    if (!Number.isFinite(taxRatePercent) || taxRatePercent < 0 || taxRatePercent > 100) {
      return NextResponse.json({ error: 'Taxa de imposto inválida.' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('payout_settings')
      .update({
        tax_rate_percent: taxRatePercent,
        updated_at: new Date().toISOString(),
        updated_by: currentUser.id,
      })
      .eq('id', true)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, tax_rate_percent: taxRatePercent })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
