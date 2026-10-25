import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { ConfirmDialog, Modal } from '../ui/Modal'
import { Button } from '../ui/primitives'
import { RetroInfoFields, RetroVoteFields, validateRetroSettings, type RetroSettingsValues } from './RetroSettingsFields'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import { fromDateTimeLocal, toDateTimeLocal } from '../../lib/format'
import type { Board } from '../../hooks/useRetroBoard'

export function SettingsDialog({ open, onClose, board }: { open: boolean; onClose: () => void; board: Board }) {
  const toast = useToast()
  const navigate = useNavigate()
  const retro = board.retro!
  const [values, setValues] = useState<RetroSettingsValues>(() => fromRetro())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function fromRetro(): RetroSettingsValues {
    return {
      sprint_name: retro.sprint_name,
      retro_date: retro.retro_date,
      facilitator_name: retro.facilitator_name,
      goal: retro.goal,
      closes_at: toDateTimeLocal(retro.closes_at),
      max_votes: retro.max_votes,
      allow_multiple_votes: retro.allow_multiple_votes,
      confidential_votes: retro.confidential_votes,
      allow_anonymous: retro.allow_anonymous,
      participants_can_add: retro.participants_can_add,
    }
  }

  useEffect(() => {
    if (open) {
      setValues(fromRetro())
      setErrors({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onChange = <K extends keyof RetroSettingsValues>(k: K, v: RetroSettingsValues[K]) => setValues((s) => ({ ...s, [k]: v }))

  async function save() {
    const errs = validateRetroSettings(values)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      await board.mutations.updateRetro({
        sprint_name: values.sprint_name.trim(),
        retro_date: values.retro_date,
        facilitator_name: values.facilitator_name.trim(),
        goal: values.goal.trim(),
        closes_at: fromDateTimeLocal(values.closes_at),
        max_votes: values.max_votes,
        allow_multiple_votes: values.allow_multiple_votes,
        confidential_votes: values.confidential_votes,
        allow_anonymous: values.allow_anonymous,
        participants_can_add: values.participants_can_add,
      })
      toast.success('Paramètres enregistrés')
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Modal
        open={open && !confirmDelete}
        onClose={onClose}
        title="Paramètres de la rétrospective"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={save} loading={saving}>
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Informations</h3>
            <RetroInfoFields values={values} errors={errors} onChange={onChange} />
          </section>
          <section className="border-t border-slate-100 pt-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Vote et contributions</h3>
            <RetroVoteFields values={values} errors={errors} onChange={onChange} />
          </section>
          <section className="border-t border-slate-100 pt-5">
            <h3 className="mb-1 text-sm font-semibold text-rose-700">Zone sensible</h3>
            <p className="mb-3 text-xs text-slate-500">Supprime la rétrospective, ses cartes, commentaires, votes et actions.</p>
            <Button variant="secondary" className="text-rose-600" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" /> Supprimer la rétrospective
            </Button>
          </section>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer définitivement ?"
        message={`La rétrospective « ${retro.sprint_name} » et toutes ses données seront supprimées pour tous les participants.`}
        confirmLabel="Supprimer"
        danger
        loading={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setDeleting(true)
          try {
            const { error } = await supabase.from('retros').delete().eq('id', retro.id)
            if (error) throw error
            toast.success('Rétrospective supprimée')
            navigate('/admin/retros')
          } catch (e) {
            toast.error(e)
            setDeleting(false)
          }
        }}
      />
    </>
  )
}
