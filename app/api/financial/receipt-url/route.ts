import { NextResponse } from 'next/server'
import { getRequester, isValidPeriod, supabaseAdmin } from '@/lib/api-auth'

const RECEIPT_BUCKET = 'payment-receipts'

export async function GET(req: Request) {
  try {
    const auth = await getRequester(req)
    if (!auth.ok) return auth.response
    const { requester: currentUser } = auth

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user_id')
    const periodYear = Number(searchParams.get('period_year'))
    const periodMonth = Number(searchParams.get('period_month'))

    if (!userId || !isValidPeriod(periodYear, periodMonth)) {
      return NextResponse.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 })
    }

    if (currentUser.id !== userId && currentUser.role !== 'admin_master') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { data: payout, error } = await supabaseAdmin
      .from('financial_payouts')
      .select('receipt_file_path')
      .eq('user_id', userId)
      .eq('period_year', periodYear)
      .eq('period_month', periodMonth)
      .maybeSingle()

    if (error || !payout?.receipt_file_path) {
      return NextResponse.json({ error: 'Comprovante não encontrado.' }, { status: 404 })
    }

    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from(RECEIPT_BUCKET)
      .createSignedUrl(payout.receipt_file_path, 60)

    if (signedError || !signed?.signedUrl) {
      return NextResponse.json({ error: signedError?.message || 'Erro ao gerar link do comprovante.' }, { status: 400 })
    }

    return NextResponse.json({ url: signed.signedUrl })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
