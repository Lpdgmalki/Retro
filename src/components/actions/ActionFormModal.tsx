import { useEffect, useId, useState, type FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { Button, Field, Input, Select } from '../ui/primitives'
import { ACTION_STATUS_LABEL, CATEGORY_BY_ID, LIMITS, PRIORITY_LABEL } from '../../lib/constants'
import type { ActionItem, ActionPriority, ActionStatus, Card } from '../../lib/types'

export interface ActionFormValues {
  title: string
  owner_name: string
  due_date: string | null
  priority: ActionPriority
  status: ActionStatus
  source_card_id: string | null
}

export function ActionFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  sourceCard,
  cards,
  ownerSuggestions,
  title,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (values: ActionFormValues) => Promise<void>
  initial?: ActionItem | null
  sourceCard?: Card | null
  cards: Card[]
  ownerSuggestions: string[]
  title: string
}) {
  const listId = useId()
  const [values, setValues] = useState<ActionFormValues>(() => blank())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  function blank(): ActionFormValues {
    return {
      title: initial?.title ?? sourceCard?.title ?? '',
      owner_name: initial?.owner_name ?? '',
      due_date: initial?.due_date ?? null,
      priority: initial?.priority ?? 'medium',
      status: initial?.status ?? 'todo',
      source_card_id: initial?.source_card_id ?? sourceCard?.id ?? null,
    }
  }

  useEffect(() => {
    if (open) {
      setValues(blank())
      setErrors({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id, sourceCard?.id])

  const set = <K extends keyof ActionFormValues>(k: K, v: ActionFormValues[K]) => setValues((s) => ({ ...s, [k]: v }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!values.title.trim()) errs.title = 'Décrivez l’action à réaliser.'
    else if (values.title.trim().length > LIMITS.actionTitle) errs.title = `Maximum ${LIMITS.actionTitle} caractères.`
    if (values.owner_name.length > LIMITS.ownerName) errs.owner_name = `Maximum ${LIMITS.ownerName} caractères.`
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      await onSubmit({ ...values, title: values.title.trim(), owner_name: values.owner_name.trim() })
      onClose()
    } catch {
      /* erreur affichée par le parent */
    } finally {
      setSaving(false)
    }
  }

  const sourceOptions = cards.filter((c) => c.category !== 'positive')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={sourceCard ? `À partir de « ${sourceCard.title} »` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="action-form" loading={saving}>
            {initial ? 'Enregistrer' : 'Créer l’action'}
          </Button>
        </>
      }
    >
      <form id="action-form" onSubmit={submit} className="space-y-4">
        <Field label="Action à réaliser" required error={errors.title} counter={{ value: values.title.length, max: LIMITS.actionTitle }}>
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              data-autofocus
              value={values.title}
              invalid={Boolean(errors.title)}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Ex. : rédiger la Definition of Ready avec le PO"
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Responsable" optional error={errors.owner_name}>
            {(id, d) => (
              <>
                <Input
                  id={id}
                  aria-describedby={d}
                  list={listId}
                  value={values.owner_name}
                  onChange={(e) => set('owner_name', e.target.value)}
                  placeholder="Nom du responsable"
                />
                <datalist id={listId}>
                  {ownerSuggestions.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Échéance" optional>
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                type="date"
                value={values.due_date ?? ''}
                onChange={(e) => set('due_date', e.target.value || null)}
              />
            )}
          </Field>
          <Field label="Priorité">
            {(id) => (
              <Select id={id} value={values.priority} onChange={(e) => set('priority', e.target.value as ActionPriority)}>
                {(Object.keys(PRIORITY_LABEL) as ActionPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Statut">
            {(id) => (
              <Select id={id} value={values.status} onChange={(e) => set('status', e.target.value as ActionStatus)}>
                {(Object.keys(ACTION_STATUS_LABEL) as ActionStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {ACTION_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Problème ou idée d’origine" optional hint="Relie l’action à la carte qui l’a motivée.">
          {(id, d) => (
            <Select
              id={id}
              aria-describedby={d}
              value={values.source_card_id ?? ''}
              onChange={(e) => set('source_card_id', e.target.value || null)}
            >
              <option value="">— Aucune —</option>
              {sourceOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  [{CATEGORY_BY_ID[c.category].short}] {c.title.slice(0, 80)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </form>
    </Modal>
  )
}
