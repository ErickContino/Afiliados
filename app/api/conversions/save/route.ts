import { NextResponse } from 'next/server'
import { getRequester, supabaseAdmin } from '@/lib/api-auth'

type ConversionRowInput = {
  id?: string
  data: string
  afiliado?: string | null
  campanha?: string | null
  clicks?: number | string | null
  registros?: number | string | null
  depositos?: number | string | null
  rev?: number | string | null
  ftd?: number | string | null
  qftd?: number | string | null
  cpa?: number | string | null
  comissao?: number | string | null
  casa_aposta: string
  house_id?: string | null
  lead_owner_user_id?: string | null
}

function toNumber(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export async function POST(req: Request) {
  try {
    const auth = await getRequester(req, ['admin_master'], 'Apenas admin_master pode gerenciar dados.')
    if (!auth.ok) return auth.response

    const body = await req.json()
    const rows = body?.rows as ConversionRowInput[] | undefined

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Nenhum registro enviado.' }, { status: 400 })
    }

    const { data: activeHouses } = await supabaseAdmin
      .from('houses')
      .select('id, name')
      .eq('active', true)

    const houseByName = new Map(
      (activeHouses || []).map((house) => [house.name.trim().toLowerCase(), house.id])
    )

    let saved = 0
    let missingHouse = 0
    let missingAffiliate = 0
    const errors: string[] = []
    let hasChanges = false

    for (const [index, row] of rows.entries()) {
      if (!row.data || !row.casa_aposta) {
        errors.push(`Linha ${index + 1}: data e casa são obrigatórias.`)
        continue
      }

      const houseId =
        row.house_id || houseByName.get(row.casa_aposta.trim().toLowerCase()) || null

      if (!houseId) missingHouse += 1
      if (!row.lead_owner_user_id) missingAffiliate += 1

      const payload = {
        data: row.data,
        afiliado: row.afiliado || null,
        campanha: row.campanha || row.afiliado || null,
        clicks: toNumber(row.clicks),
        registros: toNumber(row.registros),
        depositos: toNumber(row.depositos),
        rev: toNumber(row.rev),
        ftd: toNumber(row.ftd),
        qftd: toNumber(row.qftd),
        cpa: toNumber(row.cpa),
        comissao: toNumber(row.comissao),
        casa_aposta: row.casa_aposta,
        house_id: houseId,
        lead_owner_user_id: row.lead_owner_user_id || null,
        // Zera os snapshots para que process_pending_conversions trate o
        // registro como pendente de novo e recalcule com os dados atuais.
        gross_value_snapshot: null,
        box_value_snapshot: null,
        commission_value_snapshot: null,
        rev_value_snapshot: null,
      }

      let conversionId = row.id

      if (conversionId) {
        const { error: updateError } = await supabaseAdmin
          .from('conversions')
          .update(payload)
          .eq('id', conversionId)

        if (updateError) {
          errors.push(`Linha ${index + 1}: ${updateError.message}`)
          continue
        }

        const { error: deleteSplitsError } = await supabaseAdmin
          .from('commission_splits')
          .delete()
          .eq('conversion_id', conversionId)

        if (deleteSplitsError) {
          errors.push(
            `Linha ${index + 1}: registro salvo, mas erro ao limpar comissões antigas (${deleteSplitsError.message}).`
          )
          saved += 1
          continue
        }
      } else {
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from('conversions')
          .insert(payload)
          .select('id')
          .single()

        if (insertError || !inserted) {
          errors.push(`Linha ${index + 1}: ${insertError?.message || 'erro ao inserir.'}`)
          continue
        }

        conversionId = inserted.id
      }

      if (houseId && conversionId) {
        hasChanges = true
      }

      saved += 1
    }

    if (hasChanges) {
      // Mesmo pipeline em duas etapas que rodávamos manualmente no Supabase:
      // 1) calcula os snapshots (valores da casa) dos registros pendentes;
      // 2) gera as comissões dos registros que já têm snapshot mas ainda não têm split.
      const { error: pendingError } = await supabaseAdmin.rpc('process_pending_conversions', {})

      if (pendingError) {
        errors.push(`Erro ao processar snapshots das conversões: ${pendingError.message}`)
      }

      const { error: splitsError } = await supabaseAdmin.rpc('generate_pending_commission_splits', {})

      if (splitsError) {
        errors.push(`Erro ao gerar comissões pendentes: ${splitsError.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      saved,
      missingHouse,
      missingAffiliate,
      errors,
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno ao salvar dados.' }, { status: 500 })
  }
}
