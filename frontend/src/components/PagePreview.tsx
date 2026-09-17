import { useEffect, useMemo, useState } from 'react'
import { Check, Maximize2, Plus, Trash2, X } from 'lucide-react'
import { Button } from './ui/Button'
import { Dialog } from './ui/Dialog'
import { RevisionRail } from './RevisionRail'
import { useActiveVersion, useDeleteRevision, useMasterPages, useRevisionGroup } from '@/hooks/useQueries'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useNavStore } from '@/store/useNavStore'
import { selectIsSelected, useSelectionStore } from '@/store/useSelectionStore'
import { cn, formatDateTime, formatRelative, preloadImages } from '@/lib/utils'
import type { RevisionVersion } from '@/types'

/**
 * 右侧详情区。
 * 宽屏常驻第三栏，窄屏收成抽屉。
 */
export function PagePreview() {
  const topicId = useNavStore((s) => s.activeTopicId)
  const groupId = useNavStore((s) => s.activeGroupId)
  const requestedRevisionNo = useNavStore((s) => s.activeRevisionNo)
  const setRevisionNo = useNavStore((s) => s.setRevisionNo)
  const closeGroup = useNavStore((s) => s.closeGroup)
  const setViewerOpen = useNavStore((s) => s.setViewerOpen)
  const requestDeleteGroup = useNavStore((s) => s.requestDeleteGroup)
  const isDesktop = useMediaQuery('(min-width: 1280px)')

  const { data: detail, isPending } = useRevisionGroup(groupId)
  const version = useActiveVersion(detail, requestedRevisionNo)

  // 版本列表一到手就把所有历史图片预热，之后切换不再等网络
  useEffect(() => {
    if (detail) preloadImages(detail.versions.map((v) => v.image_url))
  }, [detail])

  const { data: pool } = useMasterPages(topicId)
  const master = useMemo(
    () => pool?.pages.find((p) => p.revision_group_id === groupId),
    [pool, groupId],
  )

  const selected = useSelectionStore(selectIsSelected(topicId, groupId ?? ''))
  const toggle = useSelectionStore((s) => s.toggle)
  const applyVersion = useSelectionStore((s) => s.applyVersion)

  const deleteRevisionMut = useDeleteRevision()
  const [pendingVersion, setPendingVersion] = useState<RevisionVersion | null>(null)

  const title = detail?.title ?? master?.title ?? '页面详情'

  // 整组删除：与卡片入口共用 nav store 驱动的确认弹窗，本处只负责投递
  function handleDeleteGroup() {
    if (!topicId || !groupId) return
    requestDeleteGroup({ groupId, topicId, title })
  }

  function handleSelectVersion(revisionNo: number) {
    setRevisionNo(revisionNo)
    // 已选的页面在详情里换了版本，导出就用这一版
    if (selected && topicId && detail) {
      const next = detail.versions.find((v) => v.revision_no === revisionNo)
      if (next) applyVersion(detail.revision_group_id, next)
    }
  }

  function handleToggleSelect() {
    if (!topicId || !master) return
    toggle(topicId, master)
  }

  function confirmDeleteVersion() {
    const target = pendingVersion
    if (!target || !groupId || !detail || deleteRevisionMut.isPending) return
    const deletedIndex = detail.versions.findIndex((v) => v.page_id === target.page_id)
    if (deletedIndex === -1) {
      setPendingVersion(null)
      return
    }
    const requested = requestedRevisionNo

    deleteRevisionMut.mutate(
      { groupId, pageId: target.page_id },
      {
        onSuccess: (res) => {
          // 顺排后号码会平移：删除位之后的前移一位；正在看的这版被删就跟回最新版
          if (requested != null) {
            const i = requested - 1
            if (i === deletedIndex) setRevisionNo(null)
            else if (i > deletedIndex) setRevisionNo(requested - 1)
          }

          // 导出清单同步：选中的版本还在就跟着新号码走，被删了就落到最新版，整组没了就移除
          if (topicId) {
            const sel = useSelectionStore.getState()
            const entry = sel.entries.find((e) => e.revision_group_id === groupId)
            if (entry) {
              if (!res.detail) {
                sel.remove(groupId)
              } else {
                const kept = res.detail.versions.find((v) => v.page_id === entry.page_id)
                const fallback = res.detail.versions[res.detail.versions.length - 1]
                if (fallback) sel.applyVersion(groupId, kept ?? fallback)
              }
            }
          }

          // 最后一个版本被删：这一页不再存在，关掉详情避免空壳
          if (!res.detail) closeGroup()
          setPendingVersion(null)
        },
      },
    )
  }

  if (!groupId) return null

  return (
    <>
      {!isDesktop && groupId ? (
        <div
          className="fixed inset-0 z-20 bg-ink/30 animate-fade-in xl:hidden"
          onClick={closeGroup}
          aria-hidden="true"
        />
      ) : null}

      <aside
        aria-label="页面详情"
        className={cn(
          'z-30 flex w-full shrink-0 flex-col border-l border-line bg-surface',
          'max-xl:fixed max-xl:inset-y-0 max-xl:right-0 max-xl:w-[min(400px,92vw)] max-xl:shadow-lift',
          'xl:static xl:w-[372px] xl:shadow-none',
        )}
      >
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-ink" title={title}>
            {title}
          </h2>
          {groupId ? (
            <button
              type="button"
              onClick={handleDeleteGroup}
              aria-label="删除这一页"
              title="删除这一页（含全部版本）"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-field text-mute transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 size={14} strokeWidth={2} />
            </button>
          ) : null}
          {groupId ? (
            <button
              type="button"
              onClick={() => setViewerOpen(true)}
              aria-label="放大查看"
              title="放大查看"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-field text-mute transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <Maximize2 size={14} strokeWidth={2} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={closeGroup}
            aria-label="关闭详情"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-field text-mute transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </header>

        {!groupId ? (
          <EmptyDetail />
        ) : (
          <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4">
            {/* 大图：严格保持 16:9，图内用 contain 兜住后端可能给出的其他比例 */}
            <div className="ratio-slide relative w-full overflow-hidden rounded-card bg-raised ring-1 ring-line">
              {version ? (
                <img
                  key={version.page_id}
                  src={version.image_url}
                  alt={`${title} 第 ${version.revision_no} 版`}
                  decoding="async"
                  className="h-full w-full animate-fade-in object-contain"
                />
              ) : (
                <div className="h-full w-full animate-pulse bg-ink/5" />
              )}
            </div>

            <div className="mt-3.5 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {version ? (
                  <p className="flex items-baseline gap-0.5 text-ink">
                    <span className="text-[15px] font-medium leading-none text-mute">V</span>
                    <span className="tnum text-[30px] font-semibold leading-none tracking-[-0.02em]">
                      {version.revision_no}
                    </span>
                    <span className="ml-2 self-center text-caption text-mute">
                      {detail && detail.versions.length > 1 ? `共 ${detail.versions.length} 版` : '首个版本'}
                    </span>
                  </p>
                ) : (
                  <div className="h-7 w-24 animate-pulse rounded bg-ink/5" />
                )}
              </div>

              <Button
                variant={selected ? 'secondary' : 'primary'}
                size="sm"
                onClick={handleToggleSelect}
                disabled={!master}
                className="shrink-0"
                title={selected ? '从导出清单中移除' : '加入导出清单'}
              >
                {selected ? <Check size={14} strokeWidth={2.4} /> : <Plus size={14} strokeWidth={2.4} />}
                {selected ? '已选择' : '选择这一页'}
              </Button>
            </div>

            {selected && version ? (
              <p className="mt-2 text-micro text-mute">
                导出时使用 V{version.revision_no}
                {version.revision_no !== (detail?.versions.length ?? 0) ? '，不是最新版' : ''}
              </p>
            ) : null}

            <dl className="mt-4 border-t border-line">
              <MetaRow label="来源文件" value={version?.source_file_name} />
              <MetaRow
                label="原始页码"
                value={version ? `第 ${version.source_page_no} 页` : undefined}
              />
              <MetaRow
                label="更新时间"
                value={version ? formatDateTime(version.created_at) : undefined}
                hint={version ? formatRelative(version.created_at) : undefined}
              />
              <MetaRow label="页面 ID" value={version?.page_id} />
              <MetaRow
                label="差异详情"
                value={version?.change_note ?? (version?.revision_no === 1 ? '初始版本' : '暂无差异说明')}
                multiline
              />
            </dl>

            <div className="mt-5">
              <RevisionRail
                versions={detail?.versions ?? []}
                currentRevisionNo={version?.revision_no ?? 0}
                onSelect={handleSelectVersion}
                onDelete={setPendingVersion}
                deleting={deleteRevisionMut.isPending}
                loading={isPending && !!groupId}
              />
            </div>
          </div>
        )}
      </aside>

      <Dialog
        open={pendingVersion != null}
        onClose={() => setPendingVersion(null)}
        title={`删除第 ${pendingVersion?.revision_no ?? ''} 版？`}
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPendingVersion(null)}
              disabled={deleteRevisionMut.isPending}
            >
              取消
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={confirmDeleteVersion}
              disabled={deleteRevisionMut.isPending}
            >
              {deleteRevisionMut.isPending ? '删除中…' : '删除'}
            </Button>
          </>
        }
      >
        <p className="text-caption leading-6 text-mute">
          {(detail?.versions.length ?? 0) <= 1
            ? '这是最后一个版本。删除后这一页会从页面池移除，导出清单里对它的勾选也会清掉。'
            : `删除后其余版本会重新顺排为 V1 到 V${(detail?.versions.length ?? 1) - 1}，不留空号；导出清单里对这一页的勾选会跟着对应版本走。`}
        </p>
      </Dialog>
    </>
  )
}

function MetaRow({
  label,
  value,
  hint,
  multiline = false,
}: {
  label: string
  value?: string
  hint?: string
  multiline?: boolean
}) {
  return (
    <div className="flex items-baseline gap-3 border-b border-line py-2">
      <dt className="w-[64px] shrink-0 text-caption text-faint">{label}</dt>
      <dd className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-caption text-ink',
            multiline ? 'whitespace-pre-wrap break-words leading-5' : 'truncate',
          )}
          title={value}
        >
          {value ?? <span className="inline-block h-3 w-20 animate-pulse rounded bg-ink/5 align-middle" />}
        </span>
        {hint ? <span className="tnum mt-0.5 block text-micro text-faint">{hint}</span> : null}
      </dd>
    </div>
  )
}

function EmptyDetail() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <div className="ratio-slide w-[104px] rounded-thumb border border-dashed border-line2" aria-hidden="true" />
      <h3 className="mt-4 text-base font-semibold text-ink">选择一张页面</h3>
      <p className="mt-1.5 max-w-[28ch] text-caption leading-5 text-mute">
        点开页面池里的任意卡片会直接打开大图，这里保留来源信息和完整版本历史。
      </p>
    </div>
  )
}
