import { useState } from 'react'
import { cx } from '../ui/primitives'
import { useToast } from '../../context/ToastContext'
import { ACTION_STATUS_BADGE, ACTION_STATUS_LABEL } from '../../lib/constants'
import type { ActionStatus } from '../../lib/types'

/** Sélecteur de statut compact, stylé comme un badge. */
export function ActionStatusSelect({
  value,
  onChange,
  disabled,
}: {
  value: ActionStatus
  onChange: (s: ActionStatus) => Promise<void>
  disabled?: boolean
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (disabled) {
    return (
      <span className={cx('inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset', ACTION_STATUS_BADGE[value])}>
        {ACTION_STATUS_LABEL[value]}
      </span>
    )
  }
  return (
    <select
      value={value}
      disabled={busy}
      aria-label="Statut de l’action"
      onChange={async (e) => {
        setBusy(true)
        try {
          await onChange(e.target.value as ActionStatus)
        } catch (err) {
          toast.error(err)
        } finally {
          setBusy(false)
        }
      }}
      className={cx(
        'cursor-pointer rounded-md border-0 py-0.5 pr-7 pl-2 text-xs font-medium ring-1 ring-inset focus:ring-2 focus:ring-indigo-500 disabled:opacity-60',
        ACTION_STATUS_BADGE[value],
      )}
    >
      {(Object.keys(ACTION_STATUS_LABEL) as ActionStatus[]).map((s) => (
        <option key={s} value={s}>
          {ACTION_STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  )
}
