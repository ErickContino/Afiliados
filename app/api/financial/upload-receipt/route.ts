import { NextResponse } from 'next/server'
import { getRequester, isValidPeriod, supabaseAdmin } from '@/lib/api-auth'

const RECEIPT_BUCKET = 'payment-receipts'
const MAX_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

function sanitizeFileName(name: string) {
  const base = name.split(/[/\\]/).pop() || 'comprovante'
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-150)
}

export async function POST(req: Request) {
  try {
    const auth = await getRequester(req, ['admin_master'])
    if (!auth.ok) return auth.response
    const { requester: currentUser } = auth

    const formData = await req.formData()
    const file = formData.get('file')
    const userId = formData.get('user_id')
    const periodYear = Number(formData.get('period_year'))
    const periodMonth = Number(formData.get('period_month'))

    if (!(file instanceof File) || typeof userId !== 'string' || !userId || !isValidPeriod(periodYear, periodMonth)) {
      return NextResponse.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Envie um arquivo em PDF, JPG ou PNG.' }, { status: 400 })
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'Arquivo excede o limite de 10MB.' }, { status: 400 })
    }

    const path = `${userId}/${periodYear}-${String(periodMonth).padStart(2, '0')}/${Date.now()}_${sanitizeFileName(file.name)}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from(RECEIPT_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 })
    }

    const { data: existing } = await supabaseAdmin
      .from('financial_payouts')
      .select('id, receipt_file_path')
      .eq('user_id', userId)
      .eq('period_year', periodYear)
      .eq('period_month', periodMonth)
      .maybeSingle()

    let result

    if (existing?.id) {
      if (existing.receipt_file_path && existing.receipt_file_path !== path) {
        await supabaseAdmin.storage.from(RECEIPT_BUCKET).remove([existing.receipt_file_path])
      }

      result = await supabaseAdmin
        .from('financial_payouts')
        .update({ receipt_file_path: path })
        .eq('id', existing.id)
    } else {
      result = await supabaseAdmin.from('financial_payouts').insert({
        user_id: userId,
        period_year: periodYear,
        period_month: periodMonth,
        status: 'open',
        receipt_file_path: path,
        created_by: currentUser.id,
      })
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
