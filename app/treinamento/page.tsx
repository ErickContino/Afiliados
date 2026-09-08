'use client'

import { useEffect, useState } from 'react'
import LayoutShell from '../components/LayoutShell'
import { supabase } from '@/lib/supabase'
import { color, radius, shadow } from '@/lib/design-tokens'
import {
  Card,
  Button,
  Callout,
  Field,
  Input,
  Textarea,
  LoadingState,
  AccessBlockedState,
  useConfirmDialog,
  useToast,
} from '../components/ui'
import { PlayCircle, GraduationCap, Trash2, X } from '../components/icons'

type UserRole = 'admin_master' | 'admin_partner' | 'gerente' | 'afiliado'
type UserStatus = 'pending' | 'active' | 'inactive'

type UserRow = {
  id: string
  nome: string | null
  email: string | null
  role: UserRole | null
  status: UserStatus
}

type TrainingVideo = {
  id: string
  title: string
  description: string | null
  video_url: string
  created_at: string
}

type VideoFormState = {
  id: string | null
  title: string
  description: string
  video_url: string
}

const emptyVideoForm: VideoFormState = { id: null, title: '', description: '', video_url: '' }

function parseVideoUrl(url: string): { embedUrl?: string; thumbnailUrl?: string; kind: 'youtube' | 'vimeo' | 'file' | 'external' } {
  const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/)
  if (youtubeMatch) {
    const id = youtubeMatch[1]
    return {
      embedUrl: `https://www.youtube.com/embed/${id}`,
      thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      kind: 'youtube',
    }
  }

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) {
    return { embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`, kind: 'vimeo' }
  }

  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
    return { kind: 'file' }
  }

  return { kind: 'external' }
}

export default function TreinamentoPage() {
  const toast = useToast()
  const { confirm, dialog } = useConfirmDialog()

  const [userDb, setUserDb] = useState<UserRow | null>(null)
  const [videos, setVideos] = useState<TrainingVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<VideoFormState>(emptyVideoForm)
  const [watchingVideo, setWatchingVideo] = useState<TrainingVideo | null>(null)

  useEffect(() => {
    init()
  }, [])

  async function init() {
    setLoading(true)

    const { data: authData } = await supabase.auth.getUser()

    if (!authData.user) {
      window.location.href = '/login'
      return
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, nome, email, role, status')
      .eq('auth_id', authData.user.id)
      .single()

    if (userError || !userData) {
      toast.error('Usuário não encontrado.')
      setLoading(false)
      return
    }

    setUserDb(userData as UserRow)

    if ((userData as UserRow).status === 'active') {
      await loadVideos()
    }

    setLoading(false)
  }

  async function loadVideos() {
    const { data, error } = await supabase
      .from('training_videos')
      .select('id, title, description, video_url, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error(`Erro ao carregar vídeos: ${error.message}`)
      return
    }

    setVideos((data || []) as TrainingVideo[])
  }

  function openCreateForm() {
    setForm(emptyVideoForm)
    setFormOpen(true)
  }

  function openEditForm(video: TrainingVideo) {
    setForm({ id: video.id, title: video.title, description: video.description || '', video_url: video.video_url })
    setFormOpen(true)
  }

  async function handleSaveVideo(e: React.FormEvent) {
    e.preventDefault()

    if (!form.title.trim() || !form.video_url.trim()) {
      toast.error('Preencha título e link do vídeo.')
      return
    }

    setSaving(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        toast.error('Sessão inválida. Faça login novamente.')
        setSaving(false)
        return
      }

      const res = await fetch('/api/training-videos/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: form.id,
          title: form.title.trim(),
          description: form.description.trim() || null,
          video_url: form.video_url.trim(),
        }),
      })

      const data = await res.json()
      setSaving(false)

      if (!res.ok) {
        toast.error(data.error || 'Erro ao salvar vídeo.')
        return
      }

      toast.success(form.id ? 'Vídeo atualizado com sucesso.' : 'Vídeo adicionado com sucesso.')
      setFormOpen(false)
      setForm(emptyVideoForm)
      await loadVideos()
    } catch {
      setSaving(false)
      toast.error('Erro inesperado ao salvar vídeo.')
    }
  }

  async function handleDeleteVideo(video: TrainingVideo) {
    const confirmed = await confirm({
      title: 'Excluir vídeo',
      description: `Tem certeza que deseja excluir "${video.title}"? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!confirmed) return

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        toast.error('Sessão inválida. Faça login novamente.')
        return
      }

      const res = await fetch('/api/training-videos/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: video.id }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erro ao excluir vídeo.')
        return
      }

      toast.success('Vídeo excluído com sucesso.')
      await loadVideos()
    } catch {
      toast.error('Erro inesperado ao excluir vídeo.')
    }
  }

  const isAdminMaster = userDb?.role === 'admin_master'

  if (loading) {
    return <LoadingState fullPage label="Carregando treinamento..." />
  }

  if (!userDb) {
    return (
      <div style={{ minHeight: '100vh', background: color.bgApp, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.textSecondary }}>
        Treinamento indisponível.
      </div>
    )
  }

  if (userDb.status === 'pending') {
    return (
      <LayoutShell active="treinamento" user={{ nome: userDb.nome || '', email: userDb.email || '', role: userDb.role || '' }}>
        <AccessBlockedState kind="pending" />
      </LayoutShell>
    )
  }

  if (userDb.status === 'inactive') {
    return (
      <LayoutShell active="treinamento" user={{ nome: userDb.nome || '', email: userDb.email || '', role: userDb.role || '' }}>
        <AccessBlockedState kind="inactive" />
      </LayoutShell>
    )
  }

  return (
    <LayoutShell active="treinamento" user={{ nome: userDb.nome || '', email: userDb.email || '', role: userDb.role || '' }}>
      {dialog}
      {watchingVideo && <WatchVideoModal video={watchingVideo} onClose={() => setWatchingVideo(null)} />}
      {formOpen && (
        <VideoFormModal
          form={form}
          saving={saving}
          onChange={setForm}
          onClose={() => {
            setFormOpen(false)
            setForm(emptyVideoForm)
          }}
          onSubmit={handleSaveVideo}
        />
      )}

      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <Card variant="header" style={{ marginBottom: '24px' }}>
          <p style={eyebrowStyle}>Treinamento</p>
          <h1 style={{ margin: '10px 0 8px', fontSize: '34px', fontWeight: 800, letterSpacing: '-0.04em' }}>Área de Treinamento</h1>
          <p style={{ margin: 0, color: color.textSecondary, fontSize: '15px' }}>
            Vídeos tutoriais para te ajudar a trabalhar como afiliado.
          </p>
        </Card>

        {isAdminMaster && (
          <div style={{ marginBottom: '24px' }}>
            <Button onClick={openCreateForm}>Adicionar vídeo</Button>
          </div>
        )}

        {videos.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '40px 20px', color: color.textSecondary }}>
              <GraduationCap size={32} color={color.greenSoft} style={{ marginBottom: '12px' }} />
              <p style={{ margin: 0 }}>Nenhum vídeo de treinamento disponível ainda.</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {videos.map((video) => {
              const { thumbnailUrl } = parseVideoUrl(video.video_url)

              return (
                <Card key={video.id} style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                  <button
                    onClick={() => setWatchingVideo(video)}
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '16/9',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      background: thumbnailUrl ? `center / cover no-repeat url(${thumbnailUrl})` : 'rgba(34,197,94,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PlayCircle size={48} color="#fff" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }} />
                  </button>

                  <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{video.title}</h3>
                    {video.description && (
                      <p style={{ margin: 0, color: color.textSecondary, fontSize: '13px', lineHeight: 1.5 }}>{video.description}</p>
                    )}

                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '12px', flexWrap: 'wrap' }}>
                      <Button size="sm" onClick={() => setWatchingVideo(video)}>
                        Assistir
                      </Button>
                      {isAdminMaster && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => openEditForm(video)}>
                            Editar
                          </Button>
                          <Button variant="danger" size="sm" leftIcon={<Trash2 size={14} />} onClick={() => handleDeleteVideo(video)}>
                            Excluir
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </LayoutShell>
  )
}

function WatchVideoModal({ video, onClose }: { video: TrainingVideo; onClose: () => void }) {
  const { embedUrl, kind } = parseVideoUrl(video.video_url)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2,6,23,0.8)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '860px' }}>
        <Card variant="header" style={{ borderRadius: radius.xl, boxShadow: shadow.cardFeatured }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{video.title}</h2>
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: color.textSecondary, cursor: 'pointer' }}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {kind === 'youtube' || kind === 'vimeo' ? (
            <iframe
              src={embedUrl}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              style={{ width: '100%', aspectRatio: '16/9', border: 'none', borderRadius: radius.lg }}
            />
          ) : kind === 'file' ? (
            <video controls src={video.video_url} style={{ width: '100%', borderRadius: radius.lg, background: '#000' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Callout variant="info">Não conseguimos exibir este link diretamente aqui. Abra em uma nova aba para assistir.</Callout>
              <a href={video.video_url} target="_blank" rel="noopener noreferrer">
                <Button type="button">Abrir vídeo em nova aba</Button>
              </a>
            </div>
          )}

          {video.description && (
            <p style={{ margin: '16px 0 0', color: color.textSecondary, fontSize: '14px', lineHeight: 1.5 }}>{video.description}</p>
          )}
        </Card>
      </div>
    </div>
  )
}

function VideoFormModal({
  form,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  form: VideoFormState
  saving: boolean
  onChange: (form: VideoFormState) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2,6,23,0.7)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '480px' }}>
        <Card variant="header" style={{ borderRadius: radius.xl, boxShadow: shadow.cardFeatured }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{form.id ? 'Editar vídeo' : 'Adicionar vídeo'}</h2>
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: color.textSecondary, cursor: 'pointer' }}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Field label="Título">
              <Input
                type="text"
                value={form.title}
                onChange={(e) => onChange({ ...form, title: e.target.value })}
                placeholder="Ex: Como configurar seu link de tracking"
              />
            </Field>

            <Field label="Link do vídeo (YouTube, Vimeo ou link direto)">
              <Input
                type="text"
                value={form.video_url}
                onChange={(e) => onChange({ ...form, video_url: e.target.value })}
                placeholder="https://youtube.com/watch?v=..."
              />
            </Field>

            <Field label="Descrição geral (opcional)">
              <Textarea
                value={form.description}
                onChange={(e) => onChange({ ...form, description: e.target.value })}
                placeholder="Sobre o que é esse vídeo..."
                style={{ minHeight: '90px' }}
              />
            </Field>

            <Callout variant="info">Dica: no YouTube, use &quot;Não listado&quot; para o vídeo não aparecer em buscas públicas — só quem tem o link acessa.</Callout>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" loading={saving}>
                {form.id ? 'Salvar alterações' : 'Adicionar vídeo'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}

const eyebrowStyle: React.CSSProperties = {
  margin: 0,
  color: color.greenSoft,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}
