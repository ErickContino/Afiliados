'use client'

import {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  CSSProperties,
} from 'react'
import { color, radius } from '@/lib/design-tokens'

const base: CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  background: color.inputBg,
  color: color.textPrimary,
  border: `1px solid ${color.inputBorder}`,
  borderRadius: radius.md,
  fontSize: '14px',
  colorScheme: 'dark',
}

export function Input({ style, className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`az-input ${className ?? ''}`} style={{ ...base, ...style }} />
}

export function Select({ style, className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...rest} className={`az-input ${className ?? ''}`} style={{ ...base, ...style }} />
}

export function Textarea({ style, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={`az-input ${className ?? ''}`}
      style={{ ...base, resize: 'vertical', minHeight: '90px', fontFamily: 'inherit', ...style }}
    />
  )
}
