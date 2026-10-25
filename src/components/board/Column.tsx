import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button, cx } from '../ui/primitives'
import { RetroCard } from './RetroCard'
import { CardForm } from './CardForm'
import { useToast } from '../../context/ToastContext'
import type { CategoryConfig } from '../../lib/constants'
import type { Board } from '../../hooks/useRetroBoard'
import type { Card } from '../../lib/types'

export function Column({
  board,
  category,
  cards,
  totalInCategory,
  rankOf,
  onOpen,
  onConvert,
  className,
}: {
  board: Board
  category: CategoryConfig
  cards: Card[]
  totalInCategory: number
  rankOf: Map<string, number>
  onOpen: (id: string) => void
  onConvert: (card: Card) => void
  className?: string
}) {
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const Icon = category.icon

  return (
    <section
      className={cx('card-premium relative isolate flex min-h-0 min-w-0 flex-col rounded-[22px] border border-slate-200', className)}
      aria-labelledby={`col-${category.id}`}
    >
      {/* Halo dégradé dans le coin, aux couleurs de la catégorie */}
      <span className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[22px]" aria-hidden>
        <span className={cx('absolute -top-16 -right-16 size-40 rounded-full opacity-25 blur-3xl', category.dot)} />
      </span>
      <header className="relative px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <span className={cx('flex size-9 shrink-0 items-center justify-center rounded-xl', category.soft, category.text)}>
            <Icon className="size-[18px]" />
          </span>
          <h2 id={`col-${category.id}`} className="min-w-0 flex-1 text-[15px] leading-tight font-bold tracking-[-0.02em] text-slate-900">
            {category.label}
          </h2>
          <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', category.soft, category.text)}>
            {totalInCategory}
          </span>
          {board.canContribute && !adding && (
            <Button
              variant="secondary"
              size="icon-sm"
              className={cx('rounded-lg', category.text)}
              onClick={() => setAdding(true)}
              aria-label={`Ajouter dans ${category.label}`}
            >
              <Plus className="size-4" />
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">{category.question}</p>
      </header>

      <div className="relative flex flex-1 flex-col gap-2.5 px-3 pb-3">
        {adding && (
          <CardForm
            category={category}
            allowAnonymous={Boolean(board.retro?.allow_anonymous)}
            submitLabel="Ajouter"
            onCancel={() => setAdding(false)}
            onSubmit={async (v) => {
              try {
                await board.mutations.createCard({ category: category.id, ...v })
                setAdding(false)
              } catch (e) {
                toast.error(e)
              }
            }}
          />
        )}

        {cards.map((card) => (
          <RetroCard
            key={card.id}
            board={board}
            card={card}
            rank={rankOf.get(card.id) ?? null}
            onOpen={onOpen}
            onConvert={onConvert}
          />
        ))}

        {cards.length === 0 && !adding && (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-surface/60 px-3 py-6 text-center">
            <p className="text-xs text-slate-400">
              {totalInCategory > 0 ? 'Aucune carte ne correspond aux filtres.' : 'Aucune carte pour le moment.'}
            </p>
            {board.canContribute && totalInCategory === 0 && (
              <Button variant="ghost" size="sm" className={cx('mt-2', category.text)} onClick={() => setAdding(true)}>
                <Plus className="size-3.5" /> Ajouter une carte
              </Button>
            )}
          </div>
        )}

        {board.canContribute && !adding && cards.length > 0 && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-surface/60 py-2 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-surface hover:text-slate-800"
          >
            <Plus className="size-3.5" /> Ajouter une carte
          </button>
        )}
      </div>
    </section>
  )
}
