import { NextResponse } from 'next/server'
import { getRequester, supabaseAdmin } from '@/lib/api-auth'

export async function POST(req: Request) {
  try {
    const auth = await getRequester(req, ['admin_master'])
    if (!auth.ok) return auth.response

    const { id } = await req.json()

    if (!id) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('training_videos').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
