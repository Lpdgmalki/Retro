import { CheckCircle2, AlertTriangle, Lightbulb, Rocket, type LucideIcon } from 'lucide-react'
import type { ActionPriority, ActionStatus, CardCategory, RetroStatus } from './types'

export interface CategoryConfig {
  id: CardCategory
  label: string
  short: string
  question: string
  placeholder: string
  icon: LucideIcon
  // Classes Tailwind complètes (pas de concaténation dynamique, pour le scan de Tailwind).
  dot: string
  text: string
  soft: string
  border: string
  ring: string
  button: string
  accentBar: string
  chip: string
}

export const CATEGORIES: CategoryConfig[] = [
  {
    id: 'positive',
    label: 'Points positifs',
    short: 'Positif',
    question: 'Qu’est-ce qui s’est bien passé ?',
    placeholder: 'Ex. : la revue de code en binôme a accéléré les livraisons',
    icon: CheckCircle2,
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    soft: 'bg-emerald-50',
    border: 'border-emerald-200',
    ring: 'focus-visible:ring-emerald-500',
    button: 'bg-emerald-600 hover:bg-emerald-700',
    accentBar: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  {
    id: 'negative',
    label: 'Points négatifs',
    short: 'Négatif',
    question: 'Qu’est-ce qui n’a pas bien fonctionné ?',
    placeholder: 'Ex. : les tickets arrivaient sans critères d’acceptation',
    icon: AlertTriangle,
    dot: 'bg-rose-500',
    text: 'text-rose-700',
    soft: 'bg-rose-50',
    border: 'border-rose-200',
    ring: 'focus-visible:ring-rose-500',
    button: 'bg-rose-600 hover:bg-rose-700',
    accentBar: 'bg-rose-500',
    chip: 'bg-rose-50 text-rose-700 ring-rose-200',
  },
  {
    id: 'improvement',
    label: 'Idées d’amélioration',
    short: 'Idée',
    question: 'Que pouvons-nous améliorer ?',
    placeholder: 'Ex. : instaurer un atelier d’affinage chaque mardi',
    icon: Lightbulb,
    dot: 'bg-sky-500',
    text: 'text-sky-700',
    soft: 'bg-sky-50',
    border: 'border-sky-200',
    ring: 'focus-visible:ring-sky-500',
    button: 'bg-sky-600 hover:bg-sky-700',
    accentBar: 'bg-sky-500',
    chip: 'bg-sky-50 text-sky-700 ring-sky-200',
  },
  {
    id: 'action',
    label: 'Actions à mettre en place',
    short: 'Action',
    question: 'Quelles actions prioriser au prochain sprint ?',
    placeholder: 'Ex. : définir une Definition of Ready avec le PO',
    icon: Rocket,
    dot: 'bg-violet-500',
    text: 'text-violet-700',
    soft: 'bg-violet-50',
    border: 'border-violet-200',
    ring: 'focus-visible:ring-violet-500',
    button: 'bg-violet-600 hover:bg-violet-700',
    accentBar: 'bg-violet-500',
    chip: 'bg-violet-50 text-violet-700 ring-violet-200',
  },
]

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CardCategory,
  CategoryConfig
>

export const STATUS_ORDER: RetroStatus[] = ['draft', 'open', 'voting', 'closed']

export const STATUS_LABEL: Record<RetroStatus, string> = {
  draft: 'Brouillon',
  open: 'En cours',
  voting: 'Vote en cours',
  closed: 'Terminée',
}

export const STATUS_HINT: Record<RetroStatus, string> = {
  draft: 'Préparation : seul le facilitateur peut ajouter des cartes.',
  open: 'Tout le monde peut ajouter des cartes et commenter.',
  voting: 'Contributions fermées. Chacun répartit ses votes.',
  closed: 'Session terminée : consultation et suivi des actions.',
}

export const STATUS_BADGE: Record<RetroStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  open: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  voting: 'bg-amber-50 text-amber-800 ring-amber-200',
  closed: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
}

export const PRIORITY_LABEL: Record<ActionPriority, string> = {
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse',
}

export const PRIORITY_BADGE: Record<ActionPriority, string> = {
  high: 'bg-rose-50 text-rose-700 ring-rose-200',
  medium: 'bg-amber-50 text-amber-800 ring-amber-200',
  low: 'bg-slate-100 text-slate-700 ring-slate-200',
}

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminée',
}

export const ACTION_STATUS_BADGE: Record<ActionStatus, string> = {
  todo: 'bg-slate-100 text-slate-700 ring-slate-200',
  in_progress: 'bg-sky-50 text-sky-700 ring-sky-200',
  done: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
}

export const PRIORITY_RANK: Record<ActionPriority, number> = { high: 0, medium: 1, low: 2 }

export const LIMITS = {
  teamName: 80,
  sprintName: 80,
  facilitatorName: 60,
  displayName: 40,
  goal: 1000,
  cardTitle: 140,
  cardDescription: 2000,
  comment: 2000,
  actionTitle: 200,
  ownerName: 60,
  summaryNotes: 5000,
}
