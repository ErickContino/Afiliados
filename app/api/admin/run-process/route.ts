import { NextResponse } from 'next/server'
import { getRequester, supabaseAdmin } from '@/lib/api-auth'

const PROCESSES = {
  pending_conversions: 'process_pending_conversions',
  pending_commissions: 'generate_pending_commission_splits',
} as const

type ProcessKey = keyof typeof PROCESSES

export async function POST(req: Request) {
  try {
    const auth = await getRequester(req, ['admin_master'], 'Apenas admin_master pode rodar processos administrativos.')
    if (!auth.ok) return auth.response

    const body = await req.json()
    const process = body?.process as ProcessKey | undefined

    if (!process || !(process in PROCESSES)) {
      return NextResponse.json({ error: 'Processo inválido.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.rpc(PROCESSES[process], {})

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, processed: data ?? 0 })
  } catch {
    return NextResponse.json({ error: 'Erro interno ao rodar processo.' }, { status: 500 })
  }
}
