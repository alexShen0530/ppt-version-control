import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'icon'

const VARIANTS: Record<Variant, string> = {
  // 墨黑承担「动作」，靛蓝只承担「状态」
  primary: 'bg-ink text-white hover:bg-ink/90 active:bg-ink disabled:bg-ink/30',
  accent: 'bg-blueprint text-white hover:bg-blueprint/90 active:bg-blueprint/95 disabled:bg-blueprint/40',
  secondary: 'bg-surface text-inksoft border border-line2 hover:bg-raised hover:text-ink disabled:text-faint',
  ghost: 'text-mute hover:bg-ink/5 hover:text-ink disabled:text-faint',
  danger: 'bg-surface text-danger border border-danger/30 hover:bg-danger/5 disabled:text-danger/40',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-caption gap-1.5',
  md: 'h-9 px-3.5 text-body gap-2',
  icon: 'h-8 w-8 justify-center',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex select-none items-center rounded-field font-medium',
        'transition-[background-color,color,box-shadow,transform] duration-150',
        'active:translate-y-px disabled:pointer-events-none disabled:active:translate-y-0',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  )
})
