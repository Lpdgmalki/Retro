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
      className={cx('flex min-h-0 flex-col rounded-2xl border bg-slate-50/70', category.border, className)}
      aria-labelledby={`col-${category.id}`}
    >
      <header className={cx('rounded-t-2xl border-b px-4 pt-3.5 pb-3', category.border, category.soft)}>
        <div className="flex items-center justify-between gap-2">
          <h2 id={`col-${category.id}`} className={cx('flex items-center gap-2 text-sm font-semibold', category.text)}>
            <Icon className="size-4" />
            {category.label}
            <span className="rounded-full bg-white/80 px-1.5 text-xs font-medium tabular-nums text-slate-500">{totalInCategory}</span>
          </h2>
          {board.canContribute && !adding && (
            <Button
              variant="ghost"
              size="icon-sm"
              className={cx('hover:bg-white', category.text)}
              onClick={() => setAdding(true)}
              aria-label={`Ajouter dans ${category.label}`}
            >
              <Plus className="size-4" />
            </Button>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-500">{category.question}</p>
      </header>

      <div className="flex flex-1 flex-col gap-2.5 p-2.5">
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
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
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
            className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 py-2 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:bg-white hover:text-slate-700"
          >
            <Plus className="size-3.5" /> Ajouter une carte
          </button>
        )}
      </div>
    </section>
  )
}
