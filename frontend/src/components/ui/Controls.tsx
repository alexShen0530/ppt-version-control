import { memo, type ReactNode, type SelectHTMLAttributes } from 'react'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/* --------------------------------------------------------------- Checkbox */

export interface CheckboxProps {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
  className?: string
}

/**
 * 卡片上的勾选框。视觉要明显，但不能盖过缩略图。
 */
export const Checkbox = memo(function Checkbox({ checked, onChange, label, disabled, className }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          e.stopPropagation()
          onChange(!checked)
        }
      }}
      className={cn(
        'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition-all duration-150',
        checked
          ? 'border-blueprint bg-blueprint text-white shadow-[0_1px_3px_rgba(45,70,185,0.35)]'
          : 'border-line2 bg-surface/90 text-transparent hover:border-mute',
        disabled && 'cursor-not-allowed opacity-40',
        className,
      )}
    >
      <Check size={12} strokeWidth={3.2} />
    </button>
  )
})

/* ----------------------------------------------------------------- Select */

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode
}

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(
          'h-8 w-full appearance-none rounded-field border border-line bg-surface pl-2.5 pr-7',
          'text-caption text-inksoft transition-colors hover:border-line2 hover:text-ink',
          'cursor-pointer',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={13}
        strokeWidth={2}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-faint"
      />
    </div>
  )
}

/* --------------------------------------------------------------- Progress */

export interface ProgressProps {
  /** 0 ~ 1 */
  value: number
  tone?: 'blueprint' | 'success' | 'danger'
  className?: string
}

export function Progress({ value, tone = 'blueprint', className }: ProgressProps) {
  const fill = tone === 'success' ? 'bg-success' : tone === 'danger' ? 'bg-danger' : 'bg-blueprint'
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)

  return (
    <div
      className={cn('relative h-1 w-full overflow-hidden rounded-full bg-line', className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-300 ease-out', fill)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/* ---------------------------------------------------------------- Spinner */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 size={14} strokeWidth={2.2} className={cn('animate-spin', className)} />
}

/* ------------------------------------------------------------- StatusPill */

const PILL_TONES = {
  neutral: 'bg-ink/5 text-mute',
  blueprint: 'bg-blueprint/10 text-blueprint',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
  warn: 'bg-warn/10 text-warn',
} as const

export type PillTone = keyof typeof PILL_TONES

export function StatusPill({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: PillTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-micro font-medium',
        PILL_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
