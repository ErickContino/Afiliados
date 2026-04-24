import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mjygitijmiauscpefihb.supabase.co'
const supabaseKey = 'sb_publishable_oYabDGwVTZdG7scJenalRQ_fCQECObv'

export const supabase = createClient(supabaseUrl, supabaseKey)