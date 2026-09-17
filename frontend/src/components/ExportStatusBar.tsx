import { CheckCircle2, Download, Eye, FileDown, X, XCircle } from 'lucide-react'
import { Spinner } from './ui/Controls'
import { useExportTask } from '@/hooks/useQueries'
import { useExportStore } from '@/store/useExportStore'
import { useNavStore } from '@/store/useNavStore'
import { cn, stampName } from '@/lib/utils'


export function ExportStatusBar() {
  const active = useExportStore((s) => s.active)
  const clear = useExportStore((s) => s.clear)
  const setExportOpen = useNavStore((s) => s.setExportOpen)
  const { data: task } = useExportTask(active?.exportId ?? null)

  if (!active) return null

  const status = task?.status ?? 'processing'
  const completed = status === 'completed'
  const failed = status === 'failed'

  return (
    <aside
      aria-live="polite"
      className={cn(
        'fixed bottom-5 right-5 z-30 w-[320px] rounded-card border bg-surface p-3.5 shadow-lift animate-rise-in',
        failed ? 'border-danger/25' : completed ? 'border-success/25' : 'border-line2',
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn(
          'grid h-8 w-8 shrink-0 place-items-center rounded-full',
          failed ? 'bg-danger/10 text-danger' : completed ? 'bg-success/10 text-success' : 'bg-blueprint/10 text-blueprint',
        )}>
          {failed ? <XCircle size={16} /> : completed ? <CheckCircle2 size={16} /> : <Spinner />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold text-ink">
            {failed ? 'PPT 导出失败' : completed ? 'PPT 导出完成' : '正在导出 PPT'}
          </p>
          <p className="tnum mt-0.5 truncate text-caption text-mute">
            {active.entries.length} 页
            {failed && task?.error ? ` · ${task.error}` : completed ? ' · 文件已生成' : ' · 正在后台合成'}
          </p>
        </div>

        <button
          type="button"
          onClick={clear}
          aria-label="关闭导出状态"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-field text-faint hover:bg-ink/5 hover:text-ink"
        >
          <X size={14} />
        </button>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          className="inline-flex h-8 items-center gap-1.5 rounded-field px-2.5 text-caption font-medium text-inksoft hover:bg-ink/5 hover:text-ink"
        >
          <Eye size={13} />
          查看
        </button>
        {completed && task?.download_url ? (
          <a
            href={task.download_url}
            download={stampName('希迪PPT_组合导出')}
            className="inline-flex h-8 items-center gap-1.5 rounded-field bg-ink px-2.5 text-caption font-medium text-white hover:bg-ink/90"
          >
            <Download size={13} />
            下载
          </a>
        ) : (
          <span className="inline-flex h-8 items-center gap-1.5 px-2.5 text-caption text-faint">
            <FileDown size={13} />
            {failed ? '可查看后重试' : '可继续浏览页面'}
          </span>
        )}
      </div>
    </aside>
  )
}
