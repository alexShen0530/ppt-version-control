import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * 轻量对话框：Portal + Esc 关闭 + 焦点圈定。
 * 不引第三方组件库，接 shadcn/ui 时把这一层换掉即可，调用方不变。
 */
export function Dialog({ open, onClose, title, description, children, footer, className }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null

    const timer = window.setTimeout(() => {
      const panel = panelRef.current
      if (!panel) return
      const first = panel.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? panel).focus()
    }, 0)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      )
      if (items.length === 0) return
      const first = items[0]!
      const last = items[items.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKeyDown, true)
      restoreRef.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/35 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative w-full max-w-lg rounded-card bg-surface shadow-lift animate-rise-in',
          'flex max-h-[86vh] flex-col outline-none',
          className,
        )}
      >
        <header className="flex items-start gap-4 px-5 pt-5 pb-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold leading-6 text-ink">{title}</h2>
            {description ? <p className="mt-1 text-caption text-mute">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-field text-mute transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-1">{children}</div>

        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-4">{footer}</footer>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
