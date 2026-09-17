import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Layers3, Plus, Search, SearchX, TriangleAlert, X } from 'lucide-react'
import { PageCard } from './PageCard'
import { Button } from './ui/Button'
import { Select } from './ui/Controls'
import { useMasterPages, useTopics } from '@/hooks/useQueries'
import { useNavStore } from '@/store/useNavStore'
import { selectCount, selectIsSelected, useSelectionStore } from '@/store/useSelectionStore'
import { clamp, cn } from '@/lib/utils'
import type { MasterPage, SortKey } from '@/types'

const GAP = 16
const MIN_CARD = 208
const MAX_COLS = 6
/**
 * 卡片除缩略图以外的固定高度：
 * 文字区 20（标题）+ 16（来源）+ 14（时间）+ 8（两道 gap-1）+ 20（py-2.5）+ 2（上下边框）
 * 这只是首屏估算值，真实行高由 virtualizer.measureElement 实测，避免累计漂移。
 */
const TEXT_HEIGHT = 80

const SORT_LABELS: Record<SortKey, string> = {
  updated_desc: '最近更新',
  updated_asc: '最早更新',
  title_asc: '标题 A 到 Z',
  revision_desc: '版本数最多',
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

export function PagePool() {
  const topicId = useNavStore((s) => s.activeTopicId)
  const filters = useNavStore((s) => s.filters)
  const setKeyword = useNavStore((s) => s.setKeyword)
  const setSource = useNavStore((s) => s.setSource)
  const setSort = useNavStore((s) => s.setSort)
  const resetFilters = useNavStore((s) => s.resetFilters)
  const openPage = useNavStore((s) => s.openPage)
  const openDetail = useNavStore((s) => s.openDetail)
  const activeGroupId = useNavStore((s) => s.activeGroupId)
  const setUploadOpen = useNavStore((s) => s.setUploadOpen)
  const requestTopicCreate = useNavStore((s) => s.requestTopicCreate)
  const requestDeleteGroup = useNavStore((s) => s.requestDeleteGroup)

  const { data: topics } = useTopics()
  const { data, isPending, isError, error } = useMasterPages(topicId)
  const pages = useMemo(() => data?.pages ?? [], [data])
  const toggle = useSelectionStore((s) => s.toggle)
  const selectedCount = useSelectionStore(selectCount(topicId))

  const topicName = topics?.find((t) => t.topic_id === topicId)?.name

  /* ---------------------------------------------------- 筛选、排序（纯派生） */

  const sources = useMemo(() => {
    const set = new Set(pages.map((p) => p.source_file_name))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
  }, [pages])

  const visible = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase()
    const list = pages.filter((p) => {
      if (filters.source !== 'all' && p.source_file_name !== filters.source) return false
      if (!keyword) return true
      return p.title.toLowerCase().includes(keyword) || p.source_file_name.toLowerCase().includes(keyword)
    })

    const byTimeDesc = (a: MasterPage, b: MasterPage) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

    switch (filters.sort) {
      case 'updated_asc':
        return list.slice().sort((a, b) => -byTimeDesc(a, b))
      case 'title_asc':
        return list.slice().sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'))
      case 'revision_desc':
        return list.slice().sort((a, b) => b.revision_count - a.revision_count || byTimeDesc(a, b))
      default:
        return list.slice().sort(byTimeDesc)
    }
  }, [pages, filters])

  /* ----------------------------------------------------- 自适应列数与虚拟化 */

  const scrollRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(4)
  const [cardWidth, setCardWidth] = useState(MIN_CARD)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const measure = () => {
      // 减去左右内边距（px-5，各 20px）
      const available = Math.max(MIN_CARD, el.clientWidth - 40)
      const cols = clamp(Math.floor((available + GAP) / (MIN_CARD + GAP)), 1, MAX_COLS)
      setColumns(cols)
      setCardWidth((available - GAP * (cols - 1)) / cols)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const rows = useMemo(() => chunk(visible, columns), [visible, columns])
  const rowHeight = Math.round(cardWidth * (9 / 16)) + TEXT_HEIGHT + GAP

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 2,
  })

  // 换筛选条件或换主题后回到顶部，避免停在空白区
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [filters.keyword, filters.source, filters.sort, topicId])

  const handleToggle = useCallback(
    (page: MasterPage) => {
      if (topicId) toggle(topicId, page)
    },
    [toggle, topicId],
  )

  const handleOpen = useCallback((groupId: string) => openPage(groupId), [openPage])
  const handleOpenDetail = useCallback((groupId: string) => openDetail(groupId), [openDetail])
  const handleDelete = useCallback(
    (page: MasterPage) => {
      if (topicId) {
        requestDeleteGroup({ groupId: page.revision_group_id, topicId, title: page.title })
      }
    },
    [requestDeleteGroup, topicId],
  )

  const filtering = filters.keyword.trim() !== '' || filters.source !== 'all'

  if (!topicId) {
    const loadingTopics = topics == null
    return (
      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-paper" aria-label="页面池">
        <div className="flex min-h-0 flex-1 items-center justify-center px-8 py-16">
          {loadingTopics ? (
            <p className="text-caption text-mute">正在载入页面工作区…</p>
          ) : (
            <div className="flex max-w-[460px] flex-col items-center text-center">
              <span className="grid h-12 w-12 place-items-center rounded-card border border-line2 bg-surface text-blueprint shadow-card">
                <Layers3 size={21} strokeWidth={1.7} />
              </span>
              <h1 className="mt-5 text-xl font-semibold text-ink">开始建立页面资产库</h1>
              <p className="mt-2 max-w-[44ch] text-caption leading-6 text-mute">
                当前工作区尚未创建主题。请先建立一个主题，再上传 PPT；系统会自动拆分页面、识别重复内容并持续维护版本关系。
              </p>
              <Button variant="primary" className="mt-5" onClick={requestTopicCreate}>
                <Plus size={15} strokeWidth={2.2} />
                创建第一个主题
              </Button>
            </div>
          )}
        </div>
      </section>
    )
  }

  return (
    /* min-h-0 必带：flex 子项默认 min-height:auto 会被内容撑到全高，
       里面的 overflow-y-auto 就永远不溢出、不出滚动条，
       超出视口的部分会被最外层 overflow-hidden 裁掉 */
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-paper" aria-label="页面池">
      <header className="px-5 pb-3 pt-5">
        <h1 className="truncate text-[22px] font-semibold leading-7 tracking-[-0.015em] text-ink">
          {topicName ?? '页面池'}
        </h1>
        <p className="tnum mt-0.5 text-caption text-mute">
          {filtering ? `${visible.length} / ${pages.length} 页` : `${pages.length} 页`}
          {sources.length > 0 ? `，来自 ${sources.length} 个文件` : ''}
          {selectedCount > 0 ? `，已选 ${selectedCount} 页` : ''}
        </p>
      </header>

      <div className="flex items-center gap-2 border-b border-line px-5 py-2.5">
        <div className="relative min-w-0 flex-1">
          <Search
            size={14}
            strokeWidth={2}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            type="search"
            value={filters.keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索页面标题或来源文件"
            aria-label="搜索页面"
            className={cn(
              'h-8 w-full rounded-field border border-line bg-surface pl-8 pr-7 text-caption text-ink',
              'placeholder:text-faint transition-colors hover:border-line2 focus:border-line2 focus:outline-none',
              '[&::-webkit-search-cancel-button]:hidden',
            )}
          />
          {filters.keyword ? (
            <button
              type="button"
              onClick={() => setKeyword('')}
              aria-label="清除搜索"
              className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-faint transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <X size={12} strokeWidth={2.2} />
            </button>
          ) : null}
        </div>

        <Select
          value={filters.source}
          onChange={(e) => setSource(e.target.value)}
          aria-label="按来源文件筛选"
          className="w-[168px] shrink-0"
        >
          <option value="all">全部来源文件</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>

        <Select
          value={filters.sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="排序方式"
          className="w-[124px] shrink-0"
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <option key={key} value={key}>
              {SORT_LABELS[key]}
            </option>
          ))}
        </Select>

        {filtering ? (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="shrink-0">
            清除筛选
          </Button>
        ) : null}
      </div>

      {/* 网格：100+ 页时靠虚拟化保持流畅，只渲染视口内的行 */}
      <div ref={scrollRef} className="scroll-area min-h-0 flex-1 overflow-y-auto">
        {isPending ? (
          <SkeletonGrid columns={columns} />
        ) : isError ? (
          <Message
            icon={<TriangleAlert size={20} strokeWidth={1.6} />}
            title="页面没能加载出来"
            body={error instanceof Error ? error.message : '请稍后重试。'}
          />
        ) : visible.length === 0 ? (
          filtering ? (
            <Message
              icon={<SearchX size={20} strokeWidth={1.6} />}
              title="没有匹配的页面"
              body="换个关键词，或者清除筛选条件看看全部页面。"
              action={
                <Button variant="secondary" size="sm" onClick={resetFilters}>
                  清除筛选
                </Button>
              }
            />
          ) : (
            <Message
              icon={<Search size={20} strokeWidth={1.6} />}
              title="这个主题下还没有页面"
              body="上传一份 PPT，系统会把它拆成单页，并自动识别哪些页面属于同一页的不同版本。"
              action={
                <Button variant="primary" size="sm" onClick={() => setUploadOpen(true)}>
                  上传 PPT
                </Button>
              }
            />
          )
        ) : (
          <div className="px-5 pt-4">
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map((vRow) => {
                const row = rows[vRow.index]
                if (!row) return null
                return (
                  <div
                    key={vRow.key}
                    ref={virtualizer.measureElement}
                    data-index={vRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${vRow.start}px)`,
                    }}
                  >
                    <div
                      className="grid"
                      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: GAP }}
                    >
                      {row.map((page) => (
                        <PoolCard
                          key={page.revision_group_id}
                          page={page}
                          topicId={topicId}
                          active={page.revision_group_id === activeGroupId}
                          onToggle={handleToggle}
                          onOpen={handleOpen}
                          onOpenDetail={handleOpenDetail}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            {/* 给底部「已选页面」浮条留出空间 */}
            <div className="h-28" />
          </div>
        )}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ 局部件 */

function SkeletonGrid({ columns }: { columns: number }) {
  return (
    <div className="px-5 pt-4" aria-busy="true" aria-label="正在加载页面池">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: GAP }}>
        {Array.from({ length: columns * 2 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-card border border-line bg-surface">
            <div className="ratio-slide w-full animate-pulse bg-ink/5" />
            <div className="space-y-2 px-3 py-3">
              <div className="h-3.5 w-3/4 animate-pulse rounded bg-ink/5" />
              <div className="h-2.5 w-1/2 animate-pulse rounded bg-ink/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Message({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-20 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-ink/5 text-mute">{icon}</div>
      <h2 className="mt-4 text-base font-semibold text-ink">{title}</h2>
      <p className="mt-1.5 max-w-[42ch] text-caption leading-5 text-mute">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

/**
 * 单张卡片：只订阅「这一组有没有被勾选」。
 * 勾选任意一张卡片时，其余卡片的 props 不变，memo 直接跳过重渲染。
 */
function PoolCard({
  page,
  topicId,
  active,
  onToggle,
  onOpen,
  onOpenDetail,
  onDelete,
}: {
  page: MasterPage
  topicId: string | null
  active: boolean
  onToggle: (page: MasterPage) => void
  onOpen: (groupId: string) => void
  onOpenDetail: (groupId: string) => void
  onDelete: (page: MasterPage) => void
}) {
  const selected = useSelectionStore(selectIsSelected(topicId, page.revision_group_id))
  return (
    <PageCard
      page={page}
      selected={selected}
      active={active}
      onToggle={onToggle}
      onOpen={onOpen}
      onOpenDetail={onOpenDetail}
      onDelete={onDelete}
    />
  )
}
