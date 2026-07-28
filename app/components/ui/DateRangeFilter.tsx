'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { color, radius, shadow } from '@/lib/design-tokens'
import { Calendar, ChevronDown, Check, X } from '../icons'
import { Input } from './Input'

function toISO(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfLastMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 0)
}

function startOfLastMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1)
}

function formatBR(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function buildPresets() {
  const today = new Date()
  const todayISO = toISO(today)

  return [
    { label: 'Hoje', start: todayISO, end: todayISO },
    { label: 'Ontem', start: toISO(addDays(today, -1)), end: toISO(addDays(today, -1)) },
    { label: 'Últimos 7 dias', start: toISO(addDays(today, -6)), end: todayISO },
    { label: 'Últimos 30 dias', start: toISO(addDays(today, -29)), end: todayISO },
    { label: 'Este mês', start: toISO(startOfMonth(today)), end: todayISO },
    { label: 'Mês passado', start: toISO(startOfLastMonth(today)), end: toISO(endOfLastMonth(today)) },
  ]
}

export default function DateRangeFilter({
  startDate,
  endDate,
  onChange,
  label = 'Período',
}: {
  startDate: string
  endDate: string
  onChange: (start: string, end: string) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [customStart, setCustomStart] = useState(startDate)
  const [customEnd, setCustomEnd] = useState(endDate)
  const containerRef = useRef<HTMLDivElement>(null)

  const presets = useMemo(buildPresets, [])

  useEffect(() => {
    setCustomStart(startDate)
    setCustomEnd(endDate)
  }, [startDate, endDate])

  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const activePreset = presets.find((p) => p.start === startDate && p.end === endDate)

  const summary = !startDate && !endDate
    ? 'Todo período'
    : activePreset
      ? activePreset.label
      : `${startDate ? formatBR(startDate) : '…'} – ${endDate ? formatBR(endDate) : '…'}`

  function applyPreset(start: string, end: string) {
    onChange(start, end)
    setOpen(false)
  }

  function applyCustom() {
    onChange(customStart, customEnd)
    setOpen(false)
  }

  function clear() {
    onChange('', '')
    setOpen(false)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: color.textTertiary }}>{label}</span>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="az-input"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
          padding: '14px 16px',
          background: color.inputBg,
          color: color.textPrimary,
          border: `1px solid ${open ? color.inputBorderFocus : color.inputBorder}`,
          borderRadius: radius.md,
          fontSize: '14px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <Calendar size={16} color={color.greenSoft} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
        <ChevronDown size={15} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s ease', color: color.textSecondary }} />
      </button>

      {open && (
        <div
          className="az-animate-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 100,
            width: 'min(320px, 90vw)',
            borderRadius: radius.lg,
            border: `1px solid ${color.cardBorderStrong}`,
            background: color.cardBgHeader,
            boxShadow: shadow.cardFeatured,
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {presets.map((preset) => {
            const active = preset.start === startDate && preset.end === endDate
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.start, preset.end)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: radius.sm,
                  border: 'none',
                  background: active ? color.infoBg : 'transparent',
                  color: active ? color.greenSofter : color.textPrimary,
                  fontSize: '14px',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {preset.label}
                {active && <Check size={15} />}
              </button>
            )
          })}

          <div style={{ height: '1px', background: 'rgba(34,197,94,0.12)', margin: '6px 0' }} />

          <div style={{ padding: '4px 12px 8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: color.greenSoft, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Personalizado
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ padding: '9px 10px', fontSize: '13px' }} />
              <span style={{ color: color.textSecondary }}>–</span>
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ padding: '9px 10px', fontSize: '13px' }} />
            </div>
            <button
              type="button"
              onClick={applyCustom}
              style={{
                border: `1px solid ${color.cardBorderStrong}`,
                background: color.infoBg,
                color: color.greenSofter,
                borderRadius: radius.sm,
                padding: '9px 12px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Aplicar período
            </button>
          </div>

          {(startDate || endDate) && (
            <button
              type="button"
              onClick={clear}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                border: 'none',
                background: 'transparent',
                color: color.textSecondary,
                borderRadius: radius.sm,
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <X size={13} /> Limpar período
            </button>
          )}
        </div>
      )}
    </div>
  )
}
