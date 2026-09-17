import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Check, Clock3, FileText, GitBranch, Plus, X } from 'lucide-react'
import { Button } from './ui/Button'
import { Select } from './ui/Controls'
import { useActiveVersion, useMasterPages, useRevisionGroup } from '@/hooks/useQueries'
import { useNavStore } from '@/store/useNavStore'
import { selectIsSelected, useSelectionStore } from '@/store/useSelectionStore'
import { formatDateTime, preloadImages } from '@/lib/utils'

const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

export function PageLightbox() {
  const open = useNavStore((s) => s.viewerOpen)
  const groupId = useNavStore((s) => s.activeGroupId)
  const requestedRevisionNo = useNavStore((s) => s.activeRevisionNo)
  const setRevisionNo = useNavStore((s) => s.setRevisionNo)
  const closeViewer = useNavStore((s) => s.closeViewer)
  const topicId = useNavStore((s) => s.activeTopicId)
  const { data: detail } = useRevisionGroup(groupId)
  const version = useActiveVersion(detail, requestedRevisionNo)
  const { data: pool } = useMasterPages(topicId)
  const master = useMemo(
    () => pool?.pages.find((p) => p.revision_group_id === groupId),
    [pool, groupId],
  )
  const ordered = useMemo(
    () => (detail?.versions ?? []).slice().sort((a, b) => a.revision_no - b.revision_no),
    [detail],
  )

  const selected = useSelectionStore(selectIsSelected(topicId, groupId ?? ''))
  const toggle = useSelectionStore((s) => s.toggle)
  const applyVersion = useSelectionStore((s) => s.applyVersion)
  const rootRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (detail) preloadImages(detail.versions.map((item) => item.image_url))
  }, [detail])

  function choose(revisionNo: number) {
    setRevisionNo(revisionNo)
    if (selected && topicId && detail) {
      const next = detail.versions.find((item) => item.revision_no === revisionNo)
      if (next) applyVersion(detail.revision_group_id, next)
    }
  }

  function step(delta: number) {
    if (!version) return
    const index = ordered.findIndex((item) => item.revision_no === version.revision_no)
    const next = ordered[index + delta]
    if (next) choose(next.revision_no)
  }

  function toggleSelection() {
    if (!topicId || !master || !version || !detail) return
    toggle(topicId, master)
    if (!selected) applyVersion(detail.revision_group_id, version)
  }

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null
    rootRef.current?.focus()
    return () => restoreRef.current?.focus?.()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        closeViewer()
        return
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        step(event.key === 'ArrowLeft' ? -1 : 1)
        return
      }
      if (event.key !== 'Tab') return
      const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
      if (items.length === 0) return
      const first = items[0]!
      const last = items[items.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ordered, version?.revision_no, selected, topicId, detail])

  if (!open || !groupId || !version) return null

  const title = detail?.title ?? master?.title ?? '页面查看'
  const changeNote = version.change_note || (version.revision_no === 1 ? '初始版本' : '本版本暂无变更说明')

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} 版本预览`}
      tabIndex={-1}
      onMouseDown={(event) => event.target === event.currentTarget && closeViewer()}
      className="fixed inset-0 z-40 grid place-items-center bg-ink/65 px-4 py-5 outline-none backdrop-blur-[2px] animate-fade-in"
    >
      <section className="flex max-h-[calc(100vh-64px)] w-full max-w-[900px] flex-col overflow-hidden rounded-card border border-white/40 bg-surface shadow-lift">
        <header className="relative border-b border-line px-6 pb-4 pt-5">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-blueprint" />
          <button
            type="button"
            onClick={closeViewer}
            aria-label="关闭预览"
            className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-field text-mute transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <X size={17} strokeWidth={2} />
          </button>

          <h2 className="truncate pr-12 text-lg font-semibold text-ink" title={title}>{title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-mute">
            <span className="inline-flex items-center gap-1.5 font-medium text-blueprint">
              <GitBranch size={13} strokeWidth={2} />
              V{version.revision_no} / {ordered.length}
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <FileText size={13} strokeWidth={1.8} />
              <span className="max-w-[360px] truncate">{version.source_file_name} · 第 {version.source_page_no} 页</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={13} strokeWidth={1.8} />
              {formatDateTime(version.created_at)}
            </span>
          </div>
          <p className="mt-3 border-l-2 border-blueprint bg-blueprint/5 px-3 py-2 text-caption leading-5 text-inksoft">
            {changeNote}
          </p>
        </header>

        <div className="flex min-h-0 flex-1 items-center justify-center bg-raised px-5 py-4">
          <div className="ratio-slide max-h-full w-full overflow-hidden rounded-card bg-ink shadow-card ring-1 ring-line2">
            <img
              key={version.page_id}
              src={version.image_url}
              alt={`${title} 第 ${version.revision_no} 版`}
              className="h-full w-full object-contain animate-fade-in"
            />
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="text-caption font-medium text-inksoft">查看版本</span>
            <Select
              value={version.revision_no}
              onChange={(event) => choose(Number(event.target.value))}
              aria-label="选择页面版本"
              className="w-[112px]"
            >
              {ordered.map((item) => (
                <option key={item.page_id} value={item.revision_no}>V{item.revision_no}</option>
              ))}
            </Select>
            <span className="text-micro text-faint">可使用左右方向键切换</span>
          </div>

          <Button variant={selected ? 'secondary' : 'primary'} onClick={toggleSelection} disabled={!master}>
            {selected ? <Check size={15} strokeWidth={2.4} /> : <Plus size={15} strokeWidth={2.4} />}
            {selected ? '已加入勾选篮' : '加入勾选篮'}
          </Button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
