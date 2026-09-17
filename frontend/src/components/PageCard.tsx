import { memo, type CSSProperties } from 'react'
import { ChevronDown, ZoomIn } from 'lucide-react'
import { Checkbox } from './ui/Controls'
import { cn, formatRelative } from '@/lib/utils'
import type { MasterPage } from '@/types'

export interface PageCardProps {
  page: MasterPage
  selected: boolean
  active: boolean
  onToggle: (page: MasterPage) => void
  /** 缩略图点击：直接进全屏查看 */
  onOpen: (groupId: string) => void
  /** 文字区点击：只把信息送到右侧详情，不弹全屏，方便连续浏览右栏 */
  onOpenDetail: (groupId: string) => void
  style?: CSSProperties
  className?: string
}

/**
 * 页面池里的一张卡片 = 一个 revision_group 的最新版。
 * 不同版本不会被摊成多张卡片，历史版本收在右下角的版本入口里。
 * 点击分两个热区：缩略图进全屏查看，文字区只开右侧详情。
 */
export const PageCard = memo(function PageCard({
  page,
  selected,
  active,
  onToggle,
  onOpen,
  onOpenDetail,
  style,
  className,
}: PageCardProps) {
  const hasHistory = page.revision_count > 1

  return (
    <article
      style={style}
      className={cn(
        'relative flex flex-col overflow-hidden rounded-card bg-surface',
        'border border-line shadow-card transition-[box-shadow,border-color] duration-150',
        'hover:shadow-card-hover',
        active && !selected && 'border-line2 ring-1 ring-ink/15',
        selected && 'border-blueprint ring-2 ring-blueprint/25',
        className,
      )}
    >
      {/* 16:9 缩略图区：悬停浮出放大镜，点击进全屏查看 */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`放大查看 ${page.title}`}
        onClick={() => onOpen(page.revision_group_id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen(page.revision_group_id)
          }
        }}
        className={cn(
          'group/thumb relative ratio-slide w-full cursor-zoom-in overflow-hidden bg-raised',
          // 外层卡片 overflow-hidden 会裁掉 outline，焦点环改用内圈 ring
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blueprint',
        )}
      >
        <img
          src={page.image_url}
          alt={`${page.title} 第 ${page.revision_no} 版缩略图`}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-full w-full object-cover"
        />

        {/* 放大镜提示：只在悬停缩略图时出现，文字区不触发 */}
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-150',
            'bg-ink/0 group-hover/thumb:bg-ink/10 group-hover/thumb:opacity-100 group-focus-visible/thumb:opacity-100',
          )}
        >
          <span
            className={cn(
              'grid h-9 w-9 scale-90 place-items-center rounded-full bg-surface/95 text-ink shadow-lift',
              'transition-transform duration-150 group-hover/thumb:scale-100',
            )}
          >
            <ZoomIn size={16} strokeWidth={2} />
          </span>
        </div>

        <div className="absolute left-2 top-2">
          <Checkbox
            checked={selected}
            onChange={() => onToggle(page)}
            label={selected ? `取消选择 ${page.title}` : `选择 ${page.title}`}
          />
        </div>

        {/* 版本入口：告知当前版本与历史数量，切版本在全屏查看和右栏里都能做 */}
        <div className="absolute bottom-2 right-2">
          <span
            title={hasHistory ? `共 ${page.revision_count} 个版本，点开可切换` : '当前只有一个版本'}
            className={cn(
              'inline-flex items-baseline gap-0.5 rounded-full bg-ink/80 py-0.5 pl-1.5 pr-1.5 text-white',
              'backdrop-blur-[2px] tnum',
            )}
          >
            <span className="text-[9px] font-medium leading-none opacity-70">V</span>
            <span className="text-caption font-semibold leading-none">{page.revision_no}</span>
            {hasHistory ? (
              <ChevronDown size={11} strokeWidth={2.4} className="ml-0.5 self-center opacity-70" />
            ) : null}
          </span>
        </div>
      </div>

      {/* 文字区：点击只打开右侧详情，不弹全屏遮罩 */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`查看 ${page.title} 的详情与版本历史`}
        onClick={() => onOpenDetail(page.revision_group_id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpenDetail(page.revision_group_id)
          }
        }}
        className={cn(
          'flex min-w-0 cursor-pointer flex-col gap-1 px-3 py-2.5',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blueprint',
        )}
      >
        <h3 className="truncate text-base font-semibold leading-5 text-ink" title={page.title}>
          {page.title}
        </h3>
        <p className="flex min-w-0 items-baseline gap-1.5 text-caption text-mute">
          <span className="min-w-0 truncate" title={page.source_file_name}>
            {page.source_file_name}
          </span>
          <span className="tnum shrink-0 text-faint">第 {page.source_page_no} 页</span>
        </p>
        <p className="tnum text-micro text-faint">{formatRelative(page.created_at)}</p>
      </div>
    </article>
  )
})
