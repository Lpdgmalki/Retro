import { useState, type ReactNode } from 'react'
import {
  ArrowRight,
  BellRing,
  ChevronDown,
  EyeOff,
  FileText,
  Lock,
  MessagesSquare,
  MousePointerClick,
  Radio,
  ShieldCheck,
  Sparkles,
  Target,
  ThumbsUp,
  Trophy,
  UserCheck,
  Zap,
} from 'lucide-react'
import { MemberIdentify, WelcomeCard } from '../MemberIdentify'
import { cx } from '../ui/primitives'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { CATEGORIES } from '../../lib/constants'

function scrollToAccess() {
  document.getElementById('acces')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setTimeout(() => document.querySelector<HTMLInputElement>('#acces input')?.focus(), 500)
}

function Kicker({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-600/10 px-4 py-1.5 text-xs font-semibold tracking-[0.18em] text-indigo-700 uppercase">
      {children}
    </span>
  )
}

function SectionHeading({ kicker, title, subtitle }: { kicker: string; title: ReactNode; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <Kicker>{kicker}</Kicker>
      <h2 className="mt-5 text-3xl leading-tight font-extrabold text-slate-900 sm:text-5xl">{title}</h2>
      {subtitle && <p className="mt-4 text-lg text-slate-500">{subtitle}</p>}
    </div>
  )
}

const STATS = [
  { value: '4', label: 'colonnes pour structurer les retours' },
  { value: '100 %', label: 'synchronisé en temps réel' },
  { value: '0', label: 'mot de passe à retenir' },
  { value: '1', label: 'rapport automatique en fin de session' },
]

const STEPS = [
  { icon: UserCheck, title: 'Identifiez-vous', text: 'Saisissez votre e-mail professionnel : nous vous reconnaissons et vous accueillons avec votre profil.' },
  { icon: MousePointerClick, title: 'Contribuez et votez', text: 'Partagez vos retours, commentez ceux de vos collègues et répartissez vos votes sur les idées clés.' },
  { icon: Trophy, title: 'Recevez le rapport', text: 'À la clôture, un rapport clair présente les décisions et le plan d’actions du prochain sprint.' },
]

const FEATURES = [
  { icon: Radio, title: 'Temps réel', text: 'Chaque carte, commentaire et vote apparaît instantanément chez tous les participants.' },
  { icon: Lock, title: 'Vote confidentiel', text: 'Votez librement : les choix individuels restent privés, seuls les résultats sont publiés.' },
  { icon: EyeOff, title: 'Contributions anonymes', text: 'Abordez les sujets sensibles sans crainte grâce à l’option d’anonymat.' },
  { icon: MessagesSquare, title: 'Échanges ciblés', text: 'Commentez et répondez directement sur chaque idée, sans quitter le tableau.' },
  { icon: Target, title: 'Plan d’actions', text: 'Les idées gagnantes deviennent des actions suivies, avec responsable et échéance.' },
  { icon: FileText, title: 'Rapport PDF', text: 'Un compte rendu élégant, prêt à partager, généré à la fin de chaque rétrospective.' },
]

const FAQ = [
  {
    q: 'Dois-je créer un compte ?',
    a: 'Non. Vous êtes déjà enregistré dans l’annuaire de votre organisation : il suffit de saisir votre adresse e-mail professionnelle.',
  },
  {
    q: 'Comment rejoindre une rétrospective ?',
    a: 'Après votre identification, vous êtes conduit directement à la rétrospective à laquelle l’administrateur vous a invité. Vous pouvez aussi utiliser le lien reçu par e-mail.',
  },
  {
    q: 'Mes votes sont-ils visibles par les autres ?',
    a: 'Cela dépend du réglage choisi par l’animateur. En vote confidentiel, personne ne voit pour quoi vous avez voté : seuls les totaux sont publiés à la clôture.',
  },
  {
    q: 'Puis-je proposer une idée anonymement ?',
    a: 'Oui, lorsque l’option est activée pour la session : cochez « Publier anonymement » en ajoutant votre carte.',
  },
  {
    q: 'Que se passe-t-il à la fin de la session ?',
    a: 'Dès que l’animateur clôture la rétrospective, un rapport s’affiche avec les idées retenues, les décisions et le plan d’actions. Vous pouvez le télécharger en PDF.',
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card-premium rounded-2xl border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className="text-base font-semibold text-slate-900">{q}</span>
        <span className={cx('flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-600/15 text-indigo-700 transition-transform', open && 'rotate-180')}>
          <ChevronDown className="size-4" />
        </span>
      </button>
      {open && <p className="animate-fade-in px-6 pb-5 text-[15px] leading-relaxed text-slate-600">{a}</p>}
    </div>
  )
}

/** Page d'accueil du site vitrine (avant identification). */
export function Landing({ onContinue }: { onContinue: () => void }) {
  const { member } = useAuth()
  const { settings } = useSettings()

  return (
    <div className="relative overflow-hidden">
      {/* ───────────── Hero ───────────── */}
      <section className="relative">
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="animate-glow pointer-events-none absolute top-[-240px] left-[-140px] h-[560px] w-[760px] rounded-full bg-indigo-600/25 blur-[140px]" aria-hidden />
        <div
          className="animate-glow pointer-events-none absolute top-[120px] right-[-200px] h-[480px] w-[640px] rounded-full bg-violet-600/20 blur-[140px]"
          aria-hidden
          style={{ animationDelay: '2s' }}
        />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:px-8 lg:pt-24 lg:pb-28">
          <div className="animate-rise">
            <Kicker>
              <Zap className="size-3.5" /> {settings.org_name}
            </Kicker>
            <h1 className="mt-6 text-4xl leading-[1.05] font-extrabold text-slate-900 sm:text-6xl lg:text-7xl">
              <span className="text-gradient">{settings.welcome_title}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed whitespace-pre-line text-slate-600">{settings.welcome_message}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <button type="button" onClick={scrollToAccess} className="btn-glow inline-flex h-13 items-center gap-2 rounded-full px-7 text-[15px] font-semibold text-white">
                Rejoindre ma rétrospective <ArrowRight className="size-4" />
              </button>
              <a
                href="#fonctionnement"
                className="inline-flex h-13 items-center gap-2 rounded-full bg-white/[0.04] px-7 text-[15px] font-semibold text-slate-800 ring-1 ring-slate-300/70 ring-inset hover:bg-white/[0.08]"
              >
                Comment ça marche
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-500" /> Accès réservé aux invités
              </span>
              <span className="inline-flex items-center gap-2">
                <Sparkles className="size-4 text-indigo-400" /> Collaboration en temps réel
              </span>
              <span className="inline-flex items-center gap-2">
                <BellRing className="size-4 text-amber-500" /> Rapport automatique
              </span>
            </div>
          </div>

          <div id="acces" className={cx('animate-rise relative scroll-mt-24', member && 'order-first lg:order-none')} style={{ animationDelay: '200ms' }}>
            <div className="absolute -inset-px rounded-[2rem] bg-gradient-to-br from-indigo-500/70 via-violet-500/25 to-transparent" aria-hidden />
            <div className="card-premium relative rounded-[2rem] p-7 sm:p-10">
              {member ? (
                <WelcomeCard member={member} onContinue={onContinue} continueLabel="Accéder à ma rétrospective" />
              ) : (
                <>
                  <p className="text-xs font-semibold tracking-[0.18em] text-indigo-400 uppercase">Espace invité</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">Identifiez-vous</h2>
                  <p className="mt-1 mb-6 text-sm text-slate-500">Commencez à saisir votre e-mail, puis choisissez votre adresse.</p>
                  <MemberIdentify />
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── Chiffres ───────────── */}
      <section className="relative border-y border-slate-200/70 bg-surface/40 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
          {STATS.map((s) => (
            <div key={s.label} className="px-4 py-10 text-center">
              <p className="text-gradient text-4xl font-extrabold sm:text-5xl">{s.value}</p>
              <p className="mt-2 text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── Fonctionnement ───────────── */}
      <section id="fonctionnement" className="relative mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6 lg:px-8">
        <SectionHeading
          kicker="Fonctionnement"
          title={
            <>
              Trois étapes, <span className="text-gradient">zéro friction</span>
            </>
          }
          subtitle="De votre première contribution au plan d’actions, tout se passe au même endroit."
        />
        <div className="relative mt-16 grid gap-6 md:grid-cols-3">
          <div className="pointer-events-none absolute top-12 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent md:block" aria-hidden />
          {STEPS.map((s, i) => (
            <div key={s.title} className="card-premium relative rounded-3xl border border-slate-200 p-8 text-center">
              <span className="btn-glow relative mx-auto flex size-16 items-center justify-center rounded-2xl text-white">
                <s.icon className="size-7" />
              </span>
              <p className="mt-6 text-xs font-semibold tracking-[0.18em] text-indigo-400 uppercase">Étape {i + 1}</p>
              <h3 className="mt-2 text-xl font-bold text-slate-900">{s.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-500">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── Les 4 questions ───────────── */}
      <section className="relative mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <SectionHeading
          kicker="La méthode"
          title={
            <>
              Quatre questions pour <span className="text-gradient">avancer ensemble</span>
            </>
          }
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <div key={c.id} className="card-premium group relative overflow-hidden rounded-3xl border border-slate-200 p-7 transition hover:-translate-y-1">
              <span className={cx('absolute -top-12 -right-12 size-36 rounded-full opacity-30 blur-3xl transition group-hover:opacity-60', c.dot)} aria-hidden />
              <span className={cx('flex size-12 items-center justify-center rounded-2xl', c.soft, c.text)}>
                <c.icon className="size-6" />
              </span>
              <h3 className="mt-6 text-lg font-bold text-slate-900">{c.label}</h3>
              <p className="mt-2 text-sm text-slate-500">{c.question}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── Avantages ───────────── */}
      <section id="avantages" className="relative scroll-mt-20 border-t border-slate-200/70 bg-gradient-to-b from-indigo-600/[0.06] to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <SectionHeading
            kicker="Avantages"
            title={
              <>
                Pensé pour des équipes <span className="text-gradient">exigeantes</span>
              </>
            }
            subtitle="Une expérience simple pour les participants, des résultats exploitables pour l’équipe."
          />
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card-premium rounded-3xl border border-slate-200 p-7">
                <span className="flex size-11 items-center justify-center rounded-xl bg-indigo-600/15 text-indigo-700">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-500">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── FAQ ───────────── */}
      <section id="faq" className="relative mx-auto max-w-3xl scroll-mt-20 px-4 py-24 sm:px-6">
        <SectionHeading kicker="FAQ" title="Questions fréquentes" />
        <div className="mt-12 space-y-3">
          {FAQ.map((f) => (
            <FaqItem key={f.q} {...f} />
          ))}
        </div>
      </section>

      {/* ───────────── Appel à l'action ───────────── */}
      <section className="relative mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-indigo-300/30 px-6 py-16 text-center sm:px-16">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/40 via-violet-600/25 to-sky-500/20" aria-hidden />
          <div className="bg-grid absolute inset-0 opacity-60" aria-hidden />
          <div className="relative">
            <ThumbsUp className="mx-auto size-10 text-indigo-700" />
            <h2 className="mt-5 text-3xl font-extrabold text-slate-900 sm:text-5xl">Votre avis compte.</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">Rejoignez votre rétrospective en quelques secondes et faites avancer votre équipe.</p>
            <button type="button" onClick={scrollToAccess} className="btn-glow mt-8 inline-flex h-13 items-center gap-2 rounded-full px-8 text-[15px] font-semibold text-white">
              Accéder à mon espace <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
