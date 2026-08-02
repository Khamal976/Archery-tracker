import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'ghost' | 'danger' | 'plain'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-bg font-semibold border border-accent',
  ghost: 'bg-surface2 text-ink border border-line',
  danger: 'bg-transparent text-danger border border-danger/60',
  plain: 'bg-transparent text-muted border border-transparent',
}

export function Button({
  variant = 'ghost',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={`tap inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-[15px] transition-opacity active:opacity-70 disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Card({
  children,
  className = '',
  title,
  action,
}: {
  children: ReactNode
  className?: string
  title?: ReactNode
  action?: ReactNode
}) {
  return (
    <section className={`card p-4 ${className}`}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {typeof title === 'string' ? (
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>
          ) : (
            title
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function Stat({
  label,
  value,
  sub,
  muted,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  muted?: boolean
}) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xs text-muted">{label}</div>
      <div className={`num text-xl font-semibold ${muted ? 'text-muted' : 'text-ink'}`}>{value}</div>
      {sub !== undefined && <div className="num truncate text-xs text-muted">{sub}</div>}
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted/80">{hint}</span>}
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={`flex rounded-xl border border-line bg-surface2 p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`tap flex-1 rounded-lg px-3 text-sm transition-colors ${
            o.value === value ? 'bg-accent font-semibold text-bg' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  hint?: string
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="tap flex w-full items-center justify-between gap-3 rounded-xl px-1 py-2 text-left"
    >
      <span className="min-w-0">
        <span className="block text-[15px]">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
          checked ? 'border-accent bg-accent' : 'border-line bg-surface2'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${
            checked ? 'left-6 bg-bg' : 'left-0.5 bg-muted'
          }`}
        />
      </span>
    </button>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted">{children}</p>
}

export function Note({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'warn' }) {
  return (
    <p
      className={`rounded-lg px-3 py-2 text-xs ${
        tone === 'warn' ? 'bg-danger/10 text-danger' : 'bg-surface2 text-muted'
      }`}
    >
      {children}
    </p>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div
        className={`card flex max-h-[90vh] w-full flex-col overflow-hidden rounded-b-none sm:rounded-b-xl ${
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
        }`}
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-semibold">{title}</h2>
          <Button variant="plain" onClick={onClose} aria-label="Закрыть">
            ✕
          </Button>
        </header>
        <div className="safe-bottom overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}
