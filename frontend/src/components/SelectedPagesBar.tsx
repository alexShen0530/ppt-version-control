import { useState } from 'react'
import { FileDown, X } from 'lucide-react'
import { Button } from './ui/Button'
import { selectEntries, useSelectionStore } from '@/store/useSelectionStore'
import { useNavStore } from '@/store/useNavStore'
import { useExportStore } from '@/store/useExportStore'
import { cn } from '@/lib/utils'
import type { SelectedEntry } from '@/store/useSelectionStore'

/**
 * 已选页面浮条。
 * 缩略图条的顺序就是导出后 PPT 的页序，直接拖动调整。
 */
export function SelectedPagesBar() {
  const topicId = useNavStore((s) => s.activeTopicId)
  const openPage = useNavStore((s) => s.openPage)
  const setExportOpen = useNavStore((s) => s.setExportOpen)
  const clearExport = useExportStore((s) => s.clear)

  const entries = useSelectionStore(selectEntries(topicId))
  const remove = useSelectionStore((s) => s.remove)
  const move = useSelectionStore((s) => s.move)
  const clear = useSelectionStore((s) => s.clearAll)

  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  if (!topicId || entries.length === 0) return null

  const count = entries.length
  const topicCount = new Set(entries.map((entry) => entry.topic_id)).size
  const dragging = dragIndex !== null

  function resetDrag() {
    setDragIndex(null)
    setOverIndex(null)
  }

  // 松手才落位：拖动过程中实时重排会让指针下的元素来回抖动
  function handleDrop() {
    if (dragIndex === null || overIndex === null || dragIndex === overIndex) {
      resetDrag()
      return
    }
    move(dragIndex, overIndex)
    resetDrag()
  }

  function handleKeyMove(index: number, delta: number) {
    const to = index + delta
    if (to < 0 || to >= count) return
    move(index, to)
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-5 pb-4">
      <div
        className={cn(
          'pointer-events-auto flex w-full max-w-[880px] items-center gap-3 rounded-card',
          'border border-line bg-surface/95 px-3 py-2.5 shadow-lift backdrop-blur-sm animate-rise-in',
        )}
      >
        <div className="shrink-0 pl-0.5">
          <p className="text-body font-semibold text-ink">
            已选择 <span className="tnum">{count}</span> 页
          </p>
          <p className="mt-0.5 text-micro text-faint">
            {dragging ? '松手放到这个位置' : `${topicCount} 个主题 · 拖动缩略图调整页序`}
          </p>
        </div>

        <ul className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1">
          {entries.map((entry, index) => (
            <BarThumb
              key={entry.revision_group_id}
              entry={entry}
              index={index}
              isSource={dragIndex === index}
              isTarget={dragging && overIndex === index && dragIndex !== index}
              onDragStart={() => setDragIndex(index)}
              onDragEnter={() => setOverIndex(index)}
              onDrop={handleDrop}
              onDragEnd={resetDrag}
              onOpen={() => openPage(entry.revision_group_id, entry.revision_no)}
              onRemove={() => remove(entry.revision_group_id)}
              onKeyMove={(delta) => handleKeyMove(index, delta)}
            />
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-1.5 border-l border-line pl-3">
          <Button variant="ghost" size="sm" onClick={clear}>
            清空
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              clearExport()
              setExportOpen(true)
            }}
          >
            <FileDown size={14} strokeWidth={2} />
            导出 PPT
          </Button>
        </div>
      </div>
    </div>
  )
}

interface BarThumbProps {
  entry: SelectedEntry
  index: number
  /** 正在被拖动的这一张 */
  isSource: boolean
  /** 松手后会落到这个位置 */
  isTarget: boolean
  onDragStart: () => void
  onDragEnter: () => void
  onDrop: () => void
  onDragEnd: () => void
  onOpen: () => void
  onRemove: () => void
  onKeyMove: (delta: number) => void
}

function BarThumb({
  entry,
  index,
  isSource,
  isTarget,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
  onOpen,
  onRemove,
  onKeyMove,
}: BarThumbProps) {
  return (
    <li
      className="group relative shrink-0"
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={(e) => {
        e.preventDefault()
        onDragEnter()
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop()
      }}
    >
      {/* 用 div + role 而不是 button：Firefox 下 button 的原生拖拽不可靠 */}
      <div
        role="button"
        tabIndex={0}
        draggable
        aria-label={`第 ${index + 1} 页 ${entry.title}，V${entry.revision_no}。左右方向键调整顺序，回车查看`}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', entry.revision_group_id)
          onDragStart()
        }}
        onDragEnd={onDragEnd}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen()
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            onKeyMove(-1)
          } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            onKeyMove(1)
          }
        }}
        className={cn(
          'block w-[86px] cursor-grab overflow-hidden rounded-thumb bg-raised transition',
          'ring-1 active:cursor-grabbing',
          isSource && 'opacity-35',
          isTarget ? 'ring-2 ring-blueprint' : 'ring-line hover:ring-line2',
        )}
      >
        <span className="ratio-slide block w-full">
          <img
            src={entry.image_url}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-full w-full object-cover"
          />
        </span>
        <span className="tnum absolute left-1 top-1 grid h-[16px] min-w-[16px] place-items-center rounded-[4px] bg-ink/75 px-1 text-[10px] font-semibold leading-none text-white">
          {index + 1}
        </span>
        <span className="tnum absolute bottom-1 right-1 rounded-[4px] bg-surface/90 px-1 text-[10px] font-semibold leading-[15px] text-inksoft">
          V{entry.revision_no}
        </span>
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`移除 ${entry.title}`}
        className={cn(
          'absolute -right-1.5 -top-1.5 grid h-[18px] w-[18px] place-items-center rounded-full',
          'bg-ink text-white opacity-0 shadow-card transition-opacity',
          'group-hover:opacity-100 group-focus-within:opacity-100',
        )}
      >
        <X size={10} strokeWidth={3} />
      </button>
    </li>
  )
}
