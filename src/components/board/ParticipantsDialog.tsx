import { useState } from 'react'
import { Crown, MoreHorizontal, Pencil, UserMinus, UserCog } from 'lucide-react'
import { ConfirmDialog, Modal } from '../ui/Modal'
import { Avatar, Badge, Button, Input, cx } from '../ui/primitives'
import { Menu } from '../ui/Menu'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { LIMITS } from '../../lib/constants'
import type { Board } from '../../hooks/useRetroBoard'
import type { Participant } from '../../lib/types'

export function ParticipantsDialog({
  open,
  onClose,
  board,
  online,
}: {
  open: boolean
  onClose: () => void
  board: Board
  online: Set<string>
}) {
  const toast = useToast()
  const { setDisplayName } = useAuth()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')
  const [toRemove, setToRemove] = useState<Participant | null>(null)
  const retro = board.retro!
  const showUsage = retro.status === 'voting' || retro.status === 'closed'

  const sorted = [...board.participants].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'facilitator' ? -1 : 1
    const oa = online.has(a.user_id) ? 0 : 1
    const ob = online.has(b.user_id) ? 0 : 1
    return oa - ob || a.display_name.localeCompare(b.display_name)
  })
  const votedCount = board.participants.filter((p) => (board.usage.get(p.user_id) ?? 0) > 0).length

  async function saveName() {
    const clean = name.trim()
    if (!clean || clean.length > LIMITS.displayName) {
      toast.error(`Le pseudo doit contenir entre 1 et ${LIMITS.displayName} caractères.`)
      return
    }
    try {
      await board.mutations.renameMe(clean)
      setDisplayName(clean)
      setRenaming(false)
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <>
      <Modal
        open={open && !toRemove}
        onClose={onClose}
        title={`Participants (${board.participants.length})`}
        description={
          showUsage ? `${votedCount} sur ${board.participants.length} ont commencé à voter` : `${online.size} en ligne actuellement`
        }
      >
        <ul className="-mx-2 divide-y divide-slate-100">
          {sorted.map((p) => {
            const isMe = p.user_id === board.me?.user_id
            const used = board.usage.get(p.user_id) ?? 0
            return (
              <li key={p.user_id} className="flex items-center gap-3 px-2 py-2.5">
                <div className="relative">
                  <Avatar name={p.display_name} seed={p.user_id} />
                  <span
                    className={cx(
                      'absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-white',
                      online.has(p.user_id) ? 'bg-emerald-500' : 'bg-slate-300',
                    )}
                    title={online.has(p.user_id) ? 'En ligne' : 'Hors ligne'}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  {isMe && renaming ? (
                    <div className="flex gap-2">
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoFocus
                        aria-label="Nouveau pseudo"
                        onKeyDown={(e) => e.key === 'Enter' && saveName()}
                      />
                      <Button size="sm" onClick={saveName}>
                        OK
                      </Button>
                    </div>
                  ) : (
                    <p className="truncate text-sm font-medium text-slate-800">
                      {p.display_name}
                      {isMe && <span className="font-normal text-slate-400"> (vous)</span>}
                    </p>
                  )}
                  {showUsage && (
                    <p className="text-xs text-slate-500">
                      {used}/{retro.max_votes} votes utilisés
                    </p>
                  )}
                </div>
                {p.role === 'facilitator' && (
                  <Badge className="bg-amber-50 text-amber-800 ring-amber-200">
                    <Crown className="size-3" /> Facilitateur
                  </Badge>
                )}
                {isMe && !renaming && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Modifier mon pseudo"
                    onClick={() => {
                      setName(p.display_name)
                      setRenaming(true)
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                )}
                {board.isFacilitator && !isMe && (
                  <Menu
                    label={`Gérer ${p.display_name}`}
                    items={[
                      p.role === 'facilitator'
                        ? {
                            label: 'Retirer le rôle de facilitateur',
                            icon: <UserCog className="size-4" />,
                            onSelect: () => board.mutations.setRole(p.user_id, 'participant').catch(toast.error),
                          }
                        : {
                            label: 'Nommer co-facilitateur',
                            icon: <Crown className="size-4" />,
                            onSelect: () => board.mutations.setRole(p.user_id, 'facilitator').catch(toast.error),
                          },
                      {
                        label: 'Retirer de la rétrospective',
                        icon: <UserMinus className="size-4" />,
                        danger: true,
                        onSelect: () => setToRemove(p),
                      },
                    ]}
                    trigger={(t) => (
                      <Button variant="ghost" size="icon-sm" {...t}>
                        <MoreHorizontal className="size-4" />
                      </Button>
                    )}
                  />
                )}
              </li>
            )
          })}
        </ul>
      </Modal>
      <ConfirmDialog
        open={Boolean(toRemove)}
        title="Retirer ce participant ?"
        message={`${toRemove?.display_name ?? ''} n’aura plus accès à cette rétrospective, sauf s’il rejoint à nouveau via le lien. Ses cartes sont conservées.`}
        confirmLabel="Retirer"
        danger
        onCancel={() => setToRemove(null)}
        onConfirm={async () => {
          try {
            await board.mutations.removeParticipant(toRemove!.user_id)
            toast.success('Participant retiré')
          } catch (e) {
            toast.error(e)
          }
          setToRemove(null)
        }}
      />
    </>
  )
}
