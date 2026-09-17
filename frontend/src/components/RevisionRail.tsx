import { Trash2 } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import type { RevisionVersion } from '@/types'

export interface RevisionRailProps {
  versions: RevisionVersion[]
  currentRevisionNo: number
  onSelect: (revisionNo: number) => void
  /** 不传则不显示删除入口 */
  onDelete?: (version: RevisionVersion) => void
  deleting?: boolean
  loading?: boolean
}

/**
 * 版本轨道。
 *
 * 这里刻意不做成 V1 / V2 / V3 三个并排按钮：
 * 「同一页的多个版本」是一条有先后顺序的时间线，
 * 每个节点带一张真实的 16:9 微缩略图，扫一眼就能看出哪一版改了什么。
 * 新版本在上，时间向下回溯。
 */
export function RevisionRail({ versions, currentRevisionNo, onSelect, onDelete, deleting, loading }: RevisionRailProps) {
  if (loading) {
    return (
      <div aria-busy="true" aria-label="正在加载版本历史">
        <RailHeading count={0} />
        <ul className="mt-1 space-y-1">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-2.5 py-2 pl-7">
              <span className="ratio-slide w-16 shrink-0 animate-pulse rounded-thumb bg-ink/5" />
              <span className="flex-1 space-y-1.5">
                <span className="block h-3 w-14 animate-pulse rounded bg-ink/5" />
                <span className="block h-2.5 w-28 animate-pulse rounded bg-ink/5" />
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const ordered = versions.slice().sort((a, b) => b.revision_no - a.revision_no)

  return (
    <div>
      <RailHeading count={ordered.length} />

      {ordered.length <= 1 ? (
        <p className="mt-2 text-caption leading-5 text-mute">
          这一页目前只有一个版本。再上传包含它的 PPT，系统会把新版本接到这条时间线上。
        </p>
      ) : null}

      <ol className="relative mt-1 space-y-0.5">
        {ordered.length > 1 ? (
          <span aria-hidden="true" className="absolute bottom-6 left-[9px] top-6 w-px bg-line" />
        ) : null}

        {ordered.map((version) => {
          const current = version.revision_no === currentRevisionNo
          return (
            <li key={version.page_id} className="group/row relative">
              <button
                type="button"
                onClick={() => onSelect(version.revision_no)}
                aria-current={current ? 'true' : undefined}
                aria-label={`查看第 ${version.revision_no} 版`}
                className={cn(
                  'flex w-full items-start rounded-field py-2 pl-7 text-left',
                  'transition-colors duration-150',
                  current ? 'bg-blueprint/5' : 'hover:bg-ink/5',
                  onDelete ? 'pr-8' : 'pr-2',
                )}
              >
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 grid w-[19px] -translate-y-1/2 place-items-center"
                >
                  {current ? (
                    <span className="h-[9px] w-[9px] rounded-full bg-blueprint ring-[3px] ring-blueprint/15" />
                  ) : (
                    <span className="h-[7px] w-[7px] rounded-full bg-surface ring-1 ring-line2 transition-colors group-hover/row:ring-mute" />
                  )}
                </span>

                <span
                  className={cn(
                    'ratio-slide block w-16 shrink-0 overflow-hidden rounded-thumb bg-raised',
                    current ? 'ring-1 ring-blueprint/40' : 'ring-1 ring-line',
                  )}
                >
                  <img
                    src={version.image_url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </span>

                <span className="min-w-0 flex-1 pl-2.5">
                  <span className="flex items-baseline gap-1.5">
                    <span
                      className={cn(
                        'tnum text-body font-semibold leading-5',
                        current ? 'text-blueprint' : 'text-ink',
                      )}
                    >
                      V{version.revision_no}
                    </span>
                    <span className="tnum text-micro text-faint">{formatDate(version.created_at)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-micro text-mute" title={version.source_file_name}>
                    {version.source_file_name}
                  </span>
                </span>
              </button>

              {onDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete(version)}
                  disabled={deleting}
                  aria-label={`删除第 ${version.revision_no} 版`}
                  title="删除这一版"
                  className={cn(
                    'absolute right-1 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-field',
                    'text-faint transition-[opacity,background-color,color] duration-150',
                    'hover:bg-danger/10 hover:text-danger disabled:opacity-30',
                    'opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100',
                  )}
                >
                  <Trash2 size={12} strokeWidth={2} />
                </button>
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function RailHeading({ count }: { count: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <h3 className="text-caption font-semibold text-ink">版本历史</h3>
      {count > 0 ? <span className="tnum text-micro text-faint">{count} 个版本</span> : null}
    </div>
  )
}
