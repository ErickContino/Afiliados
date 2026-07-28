import { NextResponse } from 'next/server'
import { getRequester, supabaseAdmin } from '@/lib/api-auth'

export async function POST(req: Request) {
  try {
    const auth = await getRequester(req, ['admin_master'], 'Apenas admin_master pode gerenciar dados.')
    if (!auth.ok) return auth.response

    const body = await req.json()
    const id = body?.id as string | undefined

    if (!id) {
      return NextResponse.json({ error: 'Nenhum registro informado.' }, { status: 400 })
    }

    const { error: deleteSplitsError } = await supabaseAdmin
      .from('commission_splits')
      .delete()
      .eq('conversion_id', id)

    if (deleteSplitsError) {
      return NextResponse.json({ error: deleteSplitsError.message }, { status: 400 })
    }

    const { error: deleteConversionError } = await supabaseAdmin
      .from('conversions')
      .delete()
      .eq('id', id)

    if (deleteConversionError) {
      return NextResponse.json({ error: deleteConversionError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno ao excluir registro.' }, { status: 500 })
  }
}
