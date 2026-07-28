import { NextResponse } from 'next/server'
import { getRequester, isValidPeriod, supabaseAdmin } from '@/lib/api-auth'

const INVOICE_BUCKET = 'financial-invoices'
const MAX_SIZE_BYTES = 10 * 1024 * 1024

function sanitizeFileName(name: string) {
  const base = name.split(/[/\\]/).pop() || 'nota-fiscal.pdf'
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-150)
}

export async function POST(req: Request) {
  try {
    const auth = await getRequester(req)
    if (!auth.ok) return auth.response
    const { requester: currentUser } = auth

    if (currentUser.status !== 'active') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file')
    const periodYear = Number(formData.get('period_year'))
    const periodMonth = Number(formData.get('period_month'))

    if (!(file instanceof File) || !isValidPeriod(periodYear, periodMonth)) {
      return NextResponse.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Envie um arquivo em PDF.' }, { status: 400 })
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'Arquivo excede o limite de 10MB.' }, { status: 400 })
    }

    const path = `${currentUser.id}/${periodYear}-${String(periodMonth).padStart(2, '0')}/${Date.now()}_${sanitizeFileName(file.name)}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from(INVOICE_BUCKET)
      .upload(path, file, { contentType: 'application/pdf', upsert: false })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 })
    }

    const { data: existing } = await supabaseAdmin
      .from('financial_payouts')
      .select('id, invoice_file_path')
      .eq('user_id', currentUser.id)
      .eq('period_year', periodYear)
      .eq('period_month', periodMonth)
      .maybeSingle()

    let result

    if (existing?.id) {
      if (existing.invoice_file_path && existing.invoice_file_path !== path) {
        await supabaseAdmin.storage.from(INVOICE_BUCKET).remove([existing.invoice_file_path])
      }

      result = await supabaseAdmin
        .from('financial_payouts')
        .update({ invoice_file_path: path, invoice_status: 'sent' })
        .eq('id', existing.id)
    } else {
      result = await supabaseAdmin.from('financial_payouts').insert({
        user_id: currentUser.id,
        period_year: periodYear,
        period_month: periodMonth,
        status: 'open',
        invoice_status: 'sent',
        invoice_file_path: path,
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
