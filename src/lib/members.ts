import type { MemberProfile } from './types'

/** « Fatima Zahra El Malki », ou la partie locale de l'e-mail à défaut de nom. */
export function memberDisplayName(m: Pick<MemberProfile, 'first_name' | 'last_name' | 'email'>): string {
  const full = [m.first_name, m.last_name].map((s) => s.trim()).filter(Boolean).join(' ')
  return (full || m.email.split('@')[0]).slice(0, 40)
}

/** Formule d'accueil : « Bienvenue Mme El Malki », « Bienvenue M. Martin » ou « Bienvenue Fatima ». */
export function welcomeLine(m: Pick<MemberProfile, 'civility' | 'first_name' | 'last_name' | 'email'>): string {
  if (m.civility && m.last_name.trim()) return `Bienvenue ${m.civility} ${m.last_name.trim()}`
  const name = m.first_name.trim() || memberDisplayName(m)
  return `Bienvenue ${name}`
}

export const PHOTO_BUCKET = 'member-photos'
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024
