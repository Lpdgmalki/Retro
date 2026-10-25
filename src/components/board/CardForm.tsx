import { useState, type FormEvent } from 'react'
import { EyeOff } from 'lucide-react'
import { Button, Field, Input, Textarea } from '../ui/primitives'
import { LIMITS, type CategoryConfig } from '../../lib/constants'

export interface CardFormValues {
  title: string
  description: string
  anonymous: boolean
}

export function validateCard(v: { title: string; description: string }): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!v.title.trim()) errors.title = 'Le titre est obligatoire.'
  else if (v.title.trim().length > LIMITS.cardTitle) errors.title = `Maximum ${LIMITS.cardTitle} caractères.`
  if (v.description.length > LIMITS.cardDescription) errors.description = `Maximum ${LIMITS.cardDescription} caractères.`
  return errors
}

export function CardForm({
  category,
  initial,
  allowAnonymous,
  submitLabel,
  onSubmit,
  onCancel,
  compact,
}: {
  category: CategoryConfig
  initial?: Partial<CardFormValues>
  allowAnonymous: boolean
  submitLabel: string
  onSubmit: (values: CardFormValues) => Promise<void>
  onCancel: () => void
  compact?: boolean
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [anonymous, setAnonymous] = useState(initial?.anonymous ?? false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    const errs = validateCard({ title, description })
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      await onSubmit({ title: title.trim(), description: description.trim(), anonymous })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className={compact ? 'space-y-3' : 'animate-pop-in space-y-3 rounded-xl border border-slate-200 bg-surface p-3 shadow-sm'}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel()
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
      }}
    >
      <Field label="Titre" required error={errors.title} counter={{ value: title.length, max: LIMITS.cardTitle }}>
        {(id, d) => (
          <Input
            id={id}
            aria-describedby={d}
            data-autofocus
            autoFocus
            value={title}
            invalid={Boolean(errors.title)}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={category.placeholder}
            maxLength={LIMITS.cardTitle + 20}
          />
        )}
      </Field>
      <Field
        label="Description"
        optional
        error={errors.description}
        counter={description.length > 200 ? { value: description.length, max: LIMITS.cardDescription } : undefined}
      >
        {(id, d) => (
          <Textarea
            id={id}
            aria-describedby={d}
            value={description}
            invalid={Boolean(errors.description)}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contexte, exemple, impact…"
            rows={3}
          />
        )}
      </Field>
      {allowAnonymous && initial?.anonymous === undefined && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 select-none">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <EyeOff className="size-3.5 text-slate-400" />
          Publier anonymement
        </label>
      )}
      <div className="flex items-center justify-end gap-2">
        <span className="mr-auto hidden text-[11px] text-slate-400 sm:inline">Ctrl + Entrée pour valider</span>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" size="sm" loading={saving} className={`${category.button} text-white`}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
