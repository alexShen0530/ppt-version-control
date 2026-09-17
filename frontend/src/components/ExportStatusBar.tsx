import { CheckCircle2, Download, Eye, X, XCircle } from 'lucide-react'
import { Spinner } from './ui/Controls'
import { useExportTask } from '@/hooks/useQueries'
import { useExportStore, type ActiveExport } from '@/store/useExportStore'
import { useNavStore } from '@/store/useNavStore'
import { cn, stampName } from '@/lib/utils'

export function ExportStatusBar() {
  const tasks = useExportStore((s) => s.tasks)
  if (!tasks.length) return null

  return (
    <div className="fixed bottom-5 right-5 z-30 flex max-h-[min(65vh,440px)] w-[min(320px,calc(100vw-32px))] flex-col gap-2 overflow-y-auto">
      {tasks.map((task) => <ExportStatusItem key={task.exportId} entry={task} />)}
    </div>
  )
}

function ExportStatusItem({ entry }: { entry: ActiveExport }) {
  const dismiss = useExportStore((s) => s.dismiss)
  const view = useExportStore((s) => s.view)
  const setExportOpen = useNavStore((s) => s.setExportOpen)
  const { data: task } = useExportTask(entry.exportId)
  const completed = task?.status === 'completed'
  const failed = task?.status === 'failed'

  return (
    <aside className={cn(
      'rounded-card border bg-surface p-3 shadow-lift',
      failed ? 'border-danger/25' : completed ? 'border-success/25' : 'border-line2',
    )}>
      <div className="flex items-start gap-2.5">
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
          <p className="tnum mt-0.5 truncate text-caption text-mute" title={task?.error}>
            {entry.entries.length} 页 · {failed ? task?.error ?? '请查看任务详情' : completed ? '文件已生成' : '后台合成中'}
          </p>
        </div>
        {(completed || failed) && (
          <button
            type="button"
            onClick={() => dismiss(entry.exportId)}
            aria-label="关闭导出状态"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-field text-faint hover:bg-ink/5 hover:text-ink"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            view(entry.exportId)
            setExportOpen(true)
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-field px-2.5 text-caption font-medium text-inksoft hover:bg-ink/5 hover:text-ink"
        >
          <Eye size={13} /> 查看
        </button>
        {completed && task?.download_url && (
          <a
            href={task.download_url}
            download={stampName('希迪PPT_组合导出')}
            className="inline-flex h-8 items-center gap-1.5 rounded-field bg-ink px-2.5 text-caption font-medium text-white hover:bg-ink/90"
          >
            <Download size={13} /> 下载
          </a>
        )}
      </div>
    </aside>
  )
}
