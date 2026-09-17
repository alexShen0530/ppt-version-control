import { CheckCircle2, FileUp, XCircle } from 'lucide-react'
import { Progress, Spinner, StatusPill, type PillTone } from './ui/Controls'
import { cn } from '@/lib/utils'
import type { UploadTask, UploadStatus } from '@/types'

const STATUS_TEXT: Record<UploadStatus, string> = {
  pending: '排队中',
  processing: '正在解析',
  completed: '解析完成',
  failed: '解析失败',
}

const STATUS_TONE: Record<UploadStatus, PillTone> = {
  pending: 'neutral',
  processing: 'blueprint',
  completed: 'success',
  failed: 'danger',
}

function ratio(task: UploadTask) {
  return task.total_pages === 0 ? 0 : task.processed_pages / task.total_pages
}

/**
 * 上传解析进度。
 * compact 用在左侧栏常驻，full 用在上传弹窗里。
 */
export function UploadProgress({
  task,
  variant = 'compact',
  className,
}: {
  task: UploadTask | undefined
  variant?: 'compact' | 'full'
  className?: string
}) {
  if (!task) return null

  const done = task.status === 'completed'
  const failed = task.status === 'failed'
  const pct = Math.round(ratio(task) * 100)

  if (variant === 'compact') {
    return (
      <div className={cn('rounded-card border border-line bg-raised p-3', className)}>
        <div className="flex items-center gap-2">
          {done ? (
            <CheckCircle2 size={14} className="shrink-0 text-success" strokeWidth={2} />
          ) : failed ? (
            <XCircle size={14} className="shrink-0 text-danger" strokeWidth={2} />
          ) : (
            <Spinner className="shrink-0 text-blueprint" />
          )}
          <span className="min-w-0 flex-1 truncate text-caption font-medium text-ink">{task.file_name}</span>
          <span className="tnum shrink-0 text-micro text-mute">{pct}%</span>
        </div>

        <Progress
          value={ratio(task)}
          tone={failed ? 'danger' : done ? 'success' : 'blueprint'}
          className="mt-2.5"
        />

        <p className="tnum mt-2 text-micro text-mute">
          {failed
            ? (task.error ?? '解析中断，请检查文件后重新上传')
            : done
              ? `新增 ${task.new_pages.length} 页，更新 ${task.updated_groups.length} 组`
              : `${STATUS_TEXT[task.status]} ${task.processed_pages} / ${task.total_pages} 页`}
        </p>
      </div>
    )
  }

  return (
    <div className={cn('rounded-card border border-line bg-raised p-4', className)}>
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-field bg-surface text-mute">
          <FileUp size={16} strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-body font-medium text-ink">{task.file_name}</p>
            <StatusPill tone={STATUS_TONE[task.status]}>{STATUS_TEXT[task.status]}</StatusPill>
          </div>

          <Progress
            value={ratio(task)}
            tone={failed ? 'danger' : done ? 'success' : 'blueprint'}
            className="mt-3"
          />

          <div className="tnum mt-2 flex items-baseline justify-between text-caption text-mute">
            <span>
              {failed
                ? (task.error ?? '解析中断')
                : done
                  ? `新增 ${task.new_pages.length} 页，更新 ${task.updated_groups.length} 组`
                  : `已处理 ${task.processed_pages} / ${task.total_pages} 页`}
            </span>
            <span>{pct}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
