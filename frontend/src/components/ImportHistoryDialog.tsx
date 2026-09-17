import { CheckCircle2, FileInput, XCircle } from 'lucide-react'
import { Dialog } from './ui/Dialog'
import { Spinner } from './ui/Controls'
import { useUploadHistory } from '@/hooks/useQueries'
import { useNavStore } from '@/store/useNavStore'
import { cn, formatDateTime } from '@/lib/utils'

export function ImportHistoryDialog() {
  const open = useNavStore((s) => s.importHistoryOpen)
  const setOpen = useNavStore((s) => s.setImportHistoryOpen)
  const setActiveUploadId = useNavStore((s) => s.setActiveUploadId)
  const setUploadOpen = useNavStore((s) => s.setUploadOpen)
  const { data: tasks, isPending, isError } = useUploadHistory(open)

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="导入记录"
      description="查看 PPT 解析进度及页面入库结果。"
      className="max-w-xl"
    >
      <div className="pb-4">
        {isPending ? (
          <div className="flex items-center justify-center gap-2 py-12 text-caption text-mute">
            <Spinner /> 正在加载导入记录
          </div>
        ) : isError ? (
          <p className="py-12 text-center text-caption text-danger">导入记录加载失败，请稍后重试。</p>
        ) : tasks?.length ? (
          <ol className="space-y-2">
            {tasks.map((task) => {
              const completed = task.status === 'completed'
              const failed = task.status === 'failed'
              return (
                <li key={task.upload_id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      setActiveUploadId(task.upload_id)
                      setUploadOpen(true)
                    }}
                    className="flex w-full items-center gap-3 rounded-card border border-line bg-raised px-3.5 py-3 text-left transition-colors hover:border-line2 hover:bg-surface"
                  >
                    <span className={cn(
                      'grid h-8 w-8 shrink-0 place-items-center rounded-full',
                      failed ? 'bg-danger/10 text-danger' : completed ? 'bg-success/10 text-success' : 'bg-blueprint/10 text-blueprint',
                    )}>
                      {failed ? <XCircle size={15} /> : completed ? <CheckCircle2 size={15} /> : <Spinner />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink" title={task.file_name}>
                        {task.file_name}
                      </span>
                      <span className="mt-0.5 block truncate text-micro text-mute">
                        {task.topic_name ?? '原主题已删除'} · {formatDateTime(task.created_at)}
                      </span>
                      {failed && task.error ? (
                        <span className="mt-1 block break-words text-micro text-danger">{task.error}</span>
                      ) : null}
                    </span>
                    <span className="tnum shrink-0 text-right text-caption text-inksoft">
                      <span className="block font-medium">
                        {failed ? '解析失败' : completed ? '已完成' : task.status === 'pending' ? '排队中' : '解析中'}
                      </span>
                      <span className="mt-0.5 block text-micro text-mute">
                        {completed
                          ? `新增 ${task.new_pages_count} · 更新 ${task.updated_groups_count}`
                          : `${task.processed_pages} / ${task.total_pages} 页`}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        ) : (
          <div className="flex flex-col items-center py-12 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-ink/5 text-mute">
              <FileInput size={19} strokeWidth={1.7} />
            </span>
            <p className="mt-3 text-body font-medium text-ink">暂无导入记录</p>
            <p className="mt-1 text-caption text-mute">上传 PPT 后，处理状态会显示在这里。</p>
          </div>
        )}
      </div>
    </Dialog>
  )
}
