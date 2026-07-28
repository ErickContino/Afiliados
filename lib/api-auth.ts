import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey)

export type Requester = {
  id: string
  role: 'admin_master' | 'admin_partner' | 'gerente' | 'afiliado' | null
  status: 'pending' | 'active' | 'inactive'
  auth_id: string
}

type RequesterResult =
  | { ok: true; requester: Requester }
  | { ok: false; response: NextResponse }

/**
 * Extracts the bearer token, resolves the authenticated Supabase user and loads
 * the matching row from `users`. Optionally restricts access to a set of roles.
 */
export async function getRequester(
  req: Request,
  allowedRoles?: Requester['role'][],
  forbiddenMessage = 'Você não tem permissão para esta ação.'
): Promise<RequesterResult> {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Token de autenticação ausente.' }, { status: 401 }),
    }
  }

  const { data: authData, error: authError } = await supabasePublic.auth.getUser(token)

  if (authError || !authData.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Usuário não autenticado.' }, { status: 401 }),
    }
  }

  const { data: requester, error: requesterError } = await supabaseAdmin
    .from('users')
    .select('id, role, status, auth_id')
    .eq('auth_id', authData.user.id)
    .single()

  if (requesterError || !requester) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Usuário não encontrado na tabela users.' }, { status: 403 }),
    }
  }

  if (allowedRoles && !allowedRoles.includes(requester.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: forbiddenMessage }, { status: 403 }),
    }
  }

  return { ok: true, requester: requester as Requester }
}

/** Validates a year/month pair used across the financial endpoints. */
export function isValidPeriod(year: unknown, month: unknown): boolean {
  const y = Number(year)
  const m = Number(month)
  return Number.isInteger(y) && y >= 2000 && y <= 2100 && Number.isInteger(m) && m >= 1 && m <= 12
}
