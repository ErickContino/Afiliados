// Design tokens centrais do AffiliaZap. Paleta "dark fintech" verde,
// extraída dos estilos inline duplicados que existiam em cada página.

export const color = {
  bgApp: '#030712',
  bgAppGradient:
    'radial-gradient(circle at top left, rgba(34,197,94,0.16), transparent 30%), radial-gradient(circle at bottom right, rgba(16,185,129,0.12), transparent 28%), #030712',

  brand: '#22c55e',
  brandStrong: '#16a34a',
  brandDeep: '#15803d',
  brandGradient: 'linear-gradient(180deg, #16a34a, #15803d)',
  brandGradientDiagonal: 'linear-gradient(135deg, #22c55e, #15803d)',

  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  textTertiary: '#cbd5e1',
  textOnBrand: '#f0fdf4',
  textOnBrandMuted: '#dcfce7',
  textOnLogo: '#02100a',

  greenSoft: '#86efac',
  greenSofter: '#bbf7d0',

  amber: '#facc15',
  amberText: '#fde68a',
  red: '#ef4444',
  redText: '#fecaca',
  blue: '#3b82f6',
  blueText: '#bfdbfe',

  cardBorder: 'rgba(34,197,94,0.12)',
  cardBorderStrong: 'rgba(34,197,94,0.24)',
  cardBg: 'linear-gradient(180deg, rgba(9,14,12,0.96), rgba(4,8,7,0.96))',
  cardBgHeader: 'linear-gradient(180deg, rgba(10,18,14,0.94), rgba(4,9,7,0.94))',
  cardShadow: '0 12px 40px rgba(0,0,0,0.25)',

  inputBg: 'rgba(2, 6, 23, 0.85)',
  inputBorder: 'rgba(34,197,94,0.14)',
  inputBorderFocus: 'rgba(34,197,94,0.45)',

  warningBg: 'rgba(250,204,21,0.08)',
  warningBorder: 'rgba(250,204,21,0.18)',
  infoBg: 'rgba(34,197,94,0.08)',
  infoBorder: 'rgba(34,197,94,0.16)',
  errorBg: 'rgba(239,68,68,0.08)',
  errorBorder: 'rgba(239,68,68,0.18)',
  limitBg: 'rgba(59,130,246,0.08)',
  limitBorder: 'rgba(59,130,246,0.18)',
  successBg: 'rgba(34,197,94,0.1)',
  successBorder: 'rgba(34,197,94,0.28)',

  tableHeadBg: 'rgba(34,197,94,0.05)',
  tableRowBorder: 'rgba(34,197,94,0.08)',
} as const

export const radius = {
  sm: '10px',
  md: '14px',
  lg: '20px',
  xl: '24px',
  xxl: '28px',
  pill: '999px',
} as const

export const shadow = {
  card: '0 12px 40px rgba(0,0,0,0.25)',
  cardHeader: '0 12px 40px rgba(0,0,0,0.28)',
  cardFeatured: '0 16px 48px rgba(0,0,0,0.3)',
  button: '0 0 24px rgba(34,197,94,0.2)',
  logo: '0 0 24px rgba(34,197,94,0.22)',
  hover: '0 10px 30px rgba(34,197,94,0.15)',
} as const

export const space = {
  xs: '6px',
  sm: '10px',
  md: '16px',
  lg: '22px',
  xl: '28px',
} as const

export const statusColor = {
  active: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.28)', text: '#bbf7d0' },
  pending: { bg: 'rgba(250,204,21,0.12)', border: 'rgba(250,204,21,0.28)', text: '#fde68a' },
  inactive: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.28)', text: '#fecaca' },
  paid: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.28)', text: '#bbf7d0' },
  blocked: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.28)', text: '#fecaca' },
  neutral: { bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.24)', text: '#cbd5e1' },
  info: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.28)', text: '#bfdbfe' },
} as const

export type StatusColorKey = keyof typeof statusColor
