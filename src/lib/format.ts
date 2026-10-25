const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const shortDateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' })
const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

/** Parse une date « YYYY-MM-DD » en date locale (évite le décalage UTC). */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return dateFmt.format(value.length === 10 ? parseDateOnly(value) : new Date(value))
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '—'
  return shortDateFmt.format(value.length === 10 ? parseDateOnly(value) : new Date(value))
}

export function formatDateTime(value: string): string {
  return dateTimeFmt.format(new Date(value))
}

export function formatRelative(value: string): string {
  const diff = (new Date(value).getTime() - Date.now()) / 1000
  const abs = Math.abs(diff)
  if (abs < 45) return 'à l’instant'
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day')
  return formatDateTime(value)
}

export function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Convertit un ISO en valeur pour <input type="datetime-local">. */
export function toDateTimeLocal(value: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromDateTimeLocal(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

export function isOverdue(due: string | null, done: boolean): boolean {
  if (!due || done) return false
  return parseDateOnly(due).getTime() < parseDateOnly(todayIso()).getTime()
}

export function initials(name: string): string {
  const parts = name
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
]

export function avatarColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function pluralize(n: number, singular: string, plural?: string): string {
  return `${n} ${n > 1 ? (plural ?? singular + 's') : singular}`
}
