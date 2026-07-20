import type { ButtonHTMLAttributes, ReactNode } from 'react'

// Small set of styled primitives so every page looks like one system.

export function Card({
  title,
  actions,
  children,
  className = '',
}: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-xl border border-panel-border bg-panel-surface ${className}`}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between border-b border-panel-border px-4 py-3">
          <h2 className="text-sm font-semibold tracking-wide text-panel-text">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

type Variant = 'primary' | 'ghost' | 'danger' | 'warn'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-panel-accent/90 hover:bg-panel-accent text-black font-medium',
  ghost: 'bg-panel-surface-2 hover:bg-panel-border text-panel-text border border-panel-border',
  danger: 'bg-panel-bad/90 hover:bg-panel-bad text-black font-medium',
  warn: 'bg-panel-warn/90 hover:bg-panel-warn text-black font-medium',
}

export function Button({
  variant = 'ghost',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Badge({ tone, children }: { tone: 'good' | 'bad' | 'warn' | 'muted'; children: ReactNode }) {
  const tones = {
    good: 'bg-panel-good/15 text-panel-good',
    bad: 'bg-panel-bad/15 text-panel-bad',
    warn: 'bg-panel-warn/15 text-panel-warn',
    muted: 'bg-panel-surface-2 text-panel-muted',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-lg border border-panel-border bg-panel-surface-2 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-panel-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-panel-text">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-panel-muted">{sub}</div>}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-panel-muted">{label}</span>
      {children}
    </label>
  )
}

export const inputClass =
  'w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-accent'

export function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-panel-muted border-t-transparent" />
  )
}
