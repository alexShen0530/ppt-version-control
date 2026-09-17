import { useEffect, useState, type ReactNode } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, Download, XCircle } from 'lucide-react'
import { Button } from './ui/Button'
import { Dialog } from './ui/Dialog'
import { Spinner } from './ui/Controls'
import { startExport, useExportTask, useTopics } from '@/hooks/useQueries'
import { useNavStore } from '@/store/useNavStore'
import { useExportStore } from '@/store/useExportStore'
import { selectEntries, useSelectionStore } from '@/store/useSelectionStore'
import { cn, stampName } from '@/lib/utils'

/**
 * 导出确认与进度。
 * 提交的只有 page_ids，顺序即最终 PPT 的页序，所以这里把顺序摊开让用户确认。
 */
export function ExportDialog() {
  const open = useNavStore((s) => s.exportOpen)
  const setOpen = useNavStore((s) => s.setExportOpen)
  const topicId = useNavStore((s) => s.activeTopicId)

  const { data: topics } = useTopics()
  const topicName = topics?.find((t) => t.topic_id === topicId)?.name

  const entries = useSelectionStore(selectEntries(topicId))
  const move = useSelectionStore((s) => s.move)
  const activeExport = useExportStore((s) => s.tasks.find((task) => task.exportId === s.viewedId))
  const addExport = useExportStore((s) => s.add)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { data: task } = useExportTask(activeExport?.exportId ?? null)

  useEffect(() => {
    if (open) return
    setSubmitting(false)
    setError(null)
  }, [open])

  const processing = submitting || task?.status === 'processing'
  const done = task?.status === 'completed'
  const failed = task?.status === 'failed'
  const displayEntries = activeExport?.entries ?? entries
  const exportTopicId = activeExport?.topicId ?? topicId
  const count = displayEntries.length
  const topicCount = new Set(displayEntries.map((entry) => entry.topic_id)).size

  async function handleExport() {
    if (!exportTopicId || count === 0 || processing) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await startExport(
        displayEntries.map((e) => e.page_id),
        exportTopicId,
      )
      if (result) {
        addExport({
          exportId: result.export_id,
          topicId: exportTopicId,
          entries: displayEntries.map((entry) => ({ ...entry })),
        })
        setOpen(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出没有成功，请重试一次')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="导出 PPT"
      description={
        activeExport
          ? undefined
          : topicCount > 1
            ? `下面的顺序就是导出后的页序，所选页面来自 ${topicCount} 个主题。`
            : `下面的顺序就是导出后的页序，来自「${topicName ?? '当前主题'}」。`
      }
      className="max-w-xl"
      footer={
        activeExport ? (
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>关闭</Button>
            {failed ? (
              <Button variant="primary" onClick={handleExport} disabled={submitting}>
                {submitting ? <Spinner /> : <Download size={15} strokeWidth={2} />}
                重新导出
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={processing}>
              取消
            </Button>
            <Button variant="primary" onClick={handleExport} disabled={count === 0 || submitting}>
              {processing ? <Spinner /> : <Download size={15} strokeWidth={2} />}
              导出 {count} 页
            </Button>
          </>
        )
      }
    >
      <div className="space-y-3 pb-4">
        {done && task ? (
          <div className="rounded-card border border-line bg-raised px-4 py-6 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-success/10 text-success">
              <CheckCircle2 size={20} strokeWidth={1.8} />
            </span>
            <h3 className="mt-3 text-base font-semibold text-ink">导出完成</h3>
            <p className="tnum mt-1 text-caption text-mute">
              {task.page_count} 页已按你排的顺序合成一份 PPT。
            </p>
            {/* 演示环境下载到的是页面清单；接后端后 download_url 直接指向 .pptx，这里不用改 */}
            <a
              href={task.download_url}
              download={stampName('希迪PPT_组合导出')}
              className={cn(
                'mt-4 inline-flex h-9 select-none items-center gap-2 rounded-field px-3.5 text-body',
                'font-medium text-white transition-colors duration-150',
                'bg-ink hover:bg-ink/90 active:translate-y-px',
              )}
            >
              <Download size={15} strokeWidth={2} />
              下载文件
            </a>
          </div>
        ) : null}

        {failed ? (
          <div className="flex items-start gap-2.5 rounded-card border border-danger/25 bg-danger/5 px-3.5 py-3">
            <XCircle size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-danger" />
            <p className="text-caption leading-5 text-inksoft">
              {task?.error ?? '合成中断了。'}页面选择还在，可以直接重新导出。
            </p>
          </div>
        ) : null}

        {activeExport && processing ? (
          <div className="flex items-center gap-2.5 rounded-card border border-line bg-raised px-3.5 py-3">
            <Spinner className="shrink-0 text-blueprint" />
            <p className="tnum text-caption text-inksoft">正在合成 {count} 页…</p>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-caption leading-5 text-danger">
            {error}
          </p>
        ) : null}

        {count === 0 ? (
          <p className="py-6 text-center text-caption leading-5 text-mute">
            还没有选择页面。回到页面池勾选需要的页面，再打开这里导出。
          </p>
        ) : (
          <ol className={cn('space-y-0.5', processing && 'pointer-events-none opacity-60')}>
            {displayEntries.map((entry, index) => (
              <li
                key={entry.revision_group_id}
                className="flex items-center gap-2.5 rounded-field px-1.5 py-1.5 transition-colors hover:bg-raised"
              >
                <span className="tnum w-4 shrink-0 text-right text-caption text-faint">{index + 1}</span>

                <span className="ratio-slide w-[52px] shrink-0 overflow-hidden rounded-thumb bg-raised ring-1 ring-line">
                  <img
                    src={entry.image_url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium text-ink">{entry.title}</span>
                  <span className="block truncate text-micro text-mute">
                    {entry.source_file_name} 第 {entry.source_page_no} 页
                  </span>
                </span>

                <span className="tnum shrink-0 text-caption font-semibold text-blueprint">
                  V{entry.revision_no}
                </span>

                <span className="flex shrink-0 flex-col">
                  <OrderButton
                    label="上移一页"
                    disabled={activeExport != null || index === 0 || processing}
                    onClick={() => move(index, index - 1)}
                  >
                    <ChevronUp size={12} strokeWidth={2.4} />
                  </OrderButton>
                  <OrderButton
                    label="下移一页"
                    disabled={activeExport != null || index === displayEntries.length - 1 || processing}
                    onClick={() => move(index, index + 1)}
                  >
                    <ChevronDown size={12} strokeWidth={2.4} />
                  </OrderButton>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Dialog>
  )
}

function OrderButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid h-[15px] w-5 place-items-center rounded-[4px] text-faint transition-colors',
        'hover:bg-ink/5 hover:text-ink disabled:pointer-events-none disabled:opacity-30',
      )}
    >
      {children}
    </button>
  )
}
