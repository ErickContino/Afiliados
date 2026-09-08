import { NextResponse } from 'next/server'
import { getRequester, supabaseAdmin } from '@/lib/api-auth'

export async function POST(req: Request) {
  try {
    const auth = await getRequester(req, ['admin_master'])
    if (!auth.ok) return auth.response
    const { requester: currentUser } = auth

    const { id, title, description, video_url } = await req.json()

    if (!title?.trim() || !video_url?.trim()) {
      return NextResponse.json({ error: 'Preencha título e link do vídeo.' }, { status: 400 })
    }

    if (id) {
      const { error } = await supabaseAdmin
        .from('training_videos')
        .update({
          title: title.trim(),
          description: description?.trim() || null,
          video_url: video_url.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ success: true })
    }

    const { error } = await supabaseAdmin.from('training_videos').insert({
      title: title.trim(),
      description: description?.trim() || null,
      video_url: video_url.trim(),
      created_by: currentUser.id,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
