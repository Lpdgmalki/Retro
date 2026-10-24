import { useState } from 'react'
import { Check, Copy, Link2, Mail } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button, Input } from '../ui/primitives'
import type { Retro } from '../../lib/types'

export function shareUrl(retro: Pick<Retro, 'share_token'>): string {
  return `${window.location.origin}/join/${retro.share_token}`
}

export function ShareDialog({ open, onClose, retro, teamName }: { open: boolean; onClose: () => void; retro: Retro; teamName: string }) {
  const [copied, setCopied] = useState(false)
  const url = shareUrl(retro)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const el = document.getElementById('share-url') as HTMLInputElement | null
      el?.select()
      document.execCommand('copy')
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const subject = encodeURIComponent(`Rétrospective ${teamName} — ${retro.sprint_name}`)
  const body = encodeURIComponent(
    `Bonjour,\n\nRejoignez notre rétrospective de sprint « ${retro.sprint_name} » :\n${url}\n\nIl suffit de choisir un pseudo pour participer.\n`,
  )

  return (
    <Modal open={open} onClose={onClose} title="Inviter l’équipe" description="Toute personne disposant de ce lien peut rejoindre la rétrospective." size="md">
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input id="share-url" readOnly value={url} className="pl-9 font-mono text-xs" onFocus={(e) => e.target.select()} />
          </div>
          <Button onClick={copy} data-autofocus>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Copié' : 'Copier'}
          </Button>
        </div>
        <a
          href={`mailto:?subject=${subject}&body=${body}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          <Mail className="size-4" /> Envoyer l’invitation par e-mail
        </a>
        <ul className="space-y-1.5 rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
          <li>• Les participants choisissent simplement un pseudo, sans création de compte.</li>
          <li>• Ils rejoignent aussi l’équipe et pourront consulter l’historique de ses rétrospectives.</li>
          <li>• Seuls les facilitateurs peuvent changer le statut, les paramètres et les actions.</li>
        </ul>
      </div>
    </Modal>
  )
}
