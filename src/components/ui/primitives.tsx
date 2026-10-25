import { forwardRef, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { avatarColor, initials } from '../../lib/format'

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

const VARIANTS: Record<Variant, string> = {
  primary: 'btn-glow text-white disabled:opacity-50 disabled:shadow-none',
  secondary:
    'bg-white/[0.04] text-slate-800 ring-1 ring-inset ring-slate-300/70 hover:bg-white/[0.08] hover:text-slate-900 hover:ring-slate-400/60 disabled:text-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-300',
  subtle: 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:text-slate-400',
  danger: 'bg-rose-600 text-white shadow-[0_8px_24px_-10px_rgb(225_29_72/0.8)] hover:bg-rose-500 disabled:opacity-50',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3.5 text-[13px] gap-1.5',
  md: 'h-10 px-4.5 text-sm gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2',
  icon: 'size-9',
  'icon-sm': 'size-7',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold whitespace-nowrap transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

const fieldBase =
  'block w-full rounded-xl border-0 bg-surface-2 px-3.5 text-sm text-slate-900 ring-1 ring-inset ring-slate-300/70 placeholder:text-slate-400 transition focus:ring-2 focus:ring-inset focus:ring-indigo-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cx(fieldBase, 'h-10', invalid && 'ring-rose-400 focus:ring-rose-500', className)}
        {...rest}
      />
    )
  },
)

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx(fieldBase, 'min-h-20 resize-y py-2', invalid && 'ring-rose-400 focus:ring-rose-500', className)}
      {...rest}
    />
  )
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={cx(fieldBase, 'h-10 pr-8', className)} {...rest}>
      {children}
    </select>
  )
})

interface FieldProps {
  label: string
  hint?: ReactNode
  error?: string | null
  required?: boolean
  optional?: boolean
  counter?: { value: number; max: number }
  children: (id: string, describedBy: string | undefined) => ReactNode
  className?: string
}

export function Field({ label, hint, error, required, optional, counter, children, className }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errId = `${id}-err`
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
          {optional && <span className="ml-1.5 font-normal text-slate-400">facultatif</span>}
        </label>
        {counter && (
          <span
            className={cx(
              'text-[11px] tabular-nums',
              counter.value > counter.max ? 'text-rose-600' : 'text-slate-400',
            )}
          >
            {counter.value}/{counter.max}
          </span>
        )}
      </div>
      {children(id, describedBy)}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="mt-1.5 text-xs font-medium text-rose-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-indigo-600' : 'bg-slate-300',
        )}
      >
        <span
          className={cx(
            'pointer-events-none mt-0.5 ml-0.5 inline-block size-4 rounded-full bg-surface shadow transition-transform',
            checked && 'translate-x-4',
          )}
        />
      </button>
    </div>
  )
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Spinner({ className, label = 'Chargement…' }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cx('inline-flex items-center gap-2 text-sm text-slate-500', className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span>{label}</span>
    </span>
  )
}

export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner label={label} />
    </div>
  )
}

export function Avatar({
  name,
  seed,
  src,
  size = 'md',
  className,
}: {
  name: string
  seed?: string
  src?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const sizes = { xs: 'size-5 text-[9px]', sm: 'size-6 text-[10px]', md: 'size-8 text-xs', lg: 'size-12 text-base', xl: 'size-20 text-2xl' }
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        title={name}
        onError={() => setFailed(true)}
        className={cx('inline-block shrink-0 rounded-full bg-slate-100 object-cover', sizes[size], className)}
      />
    )
  }
  return (
    <span
      title={name}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none',
        sizes[size],
        avatarColor(seed ?? name),
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      {icon && <div className="mb-3 text-slate-300">{icon}</div>}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('card-premium rounded-2xl border border-slate-200', className)}>{children}</div>
}

export function ProgressBar({ value, className, tone = 'bg-indigo-500' }: { value: number; className?: string; tone?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div
      className={cx('h-1.5 w-full overflow-hidden rounded-full bg-slate-100', className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cx('h-full rounded-full transition-all duration-500', tone)} style={{ width: `${pct}%` }} />
    </div>
  )
}
