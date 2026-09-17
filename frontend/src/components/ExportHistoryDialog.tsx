import { CheckCircle2, Download, FileClock, XCircle } from 'lucide-react'
import { Dialog } from './ui/Dialog'
import { Spinner } from './ui/Controls'
import { useExportHistory } from '@/hooks/useQueries'
import { useNavStore } from '@/store/useNavStore'
import { cn, formatDateTime, formatRelative, stampName } from '@/lib/utils'


export function ExportHistoryDialog() {
  const open = useNavStore((s) => s.exportHistoryOpen)
  const setOpen = useNavStore((s) => s.setExportHistoryOpen)
  const { data: tasks, isPending, isError } = useExportHistory(open)

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="导出记录"
      description="导出文件保留 24 小时，可在有效期内重复下载。"
      className="max-w-xl"
    >
      <div className="pb-4">
        {isPending ? (
          <div className="flex items-center justify-center gap-2 py-12 text-caption text-mute">
            <Spinner /> 正在加载导出记录
          </div>
        ) : isError ? (
          <p className="py-12 text-center text-caption text-danger">导出记录加载失败，请稍后重试。</p>
        ) : tasks?.length ? (
          <ol className="space-y-2">
            {tasks.map((task) => {
              const completed = task.status === 'completed'
              const failed = task.status === 'failed'
              return (
                <li key={task.export_id} className="flex items-center gap-3 rounded-card border border-line bg-raised px-3.5 py-3">
                  <span className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-full',
                    failed ? 'bg-danger/10 text-danger' : completed ? 'bg-success/10 text-success' : 'bg-blueprint/10 text-blueprint',
                  )}>
                    {failed ? <XCircle size={15} /> : completed ? <CheckCircle2 size={15} /> : <Spinner />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-medium text-ink">
                      {failed ? '导出失败' : completed ? '导出完成' : '正在导出'}
                      <span className="tnum ml-2 text-caption font-normal text-mute">{task.page_count} 页</span>
                    </p>
                    <p className="tnum mt-0.5 truncate text-micro text-faint">
                      {task.created_at ? formatRelative(task.created_at) : '刚刚创建'}
                      {completed && task.expires_at ? ` · 有效至 ${formatDateTime(task.expires_at)}` : ''}
                      {failed && task.error ? ` · ${task.error}` : ''}
                    </p>
                  </div>
                  {completed && task.download_url ? (
                    <a
                      href={task.download_url}
                      download={stampName('希迪PPT_组合导出')}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-field bg-ink px-2.5 text-caption font-medium text-white hover:bg-ink/90"
                    >
                      <Download size={13} /> 下载
                    </a>
                  ) : null}
                </li>
              )
            })}
          </ol>
        ) : (
          <div className="flex flex-col items-center py-12 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-ink/5 text-mute">
              <FileClock size={19} strokeWidth={1.7} />
            </span>
            <p className="mt-3 text-body font-medium text-ink">暂无导出记录</p>
            <p className="mt-1 text-caption text-mute">从页面池选择页面并导出后，任务会显示在这里。</p>
          </div>
        )}
      </div>
    </Dialog>
  )
}
