import { useEffect, useState, type FormEvent } from 'react'
import { Check, FileClock, Layers, MoreHorizontal, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import { Button } from './ui/Button'
import { Dialog } from './ui/Dialog'
import { UploadProgress } from './UploadProgress'
import {
  useCreateTopic,
  useDeleteTopic,
  useRenameTopic,
  useTopics,
  useUploadTask,
} from '@/hooks/useQueries'
import { useNavStore } from '@/store/useNavStore'
import { useSelectionStore } from '@/store/useSelectionStore'
import { cn } from '@/lib/utils'
import type { Topic } from '@/types'

/**
 * CIDI 字标：方块 C 与 D，第一个 i 空心点、第二个 i 实心点。
 * 品牌蓝独立于界面色板，logo 保持自己的颜色。
 */
function CidiMark() {
  return (
    <svg
      width="50"
      height="18"
      viewBox="0 0 110 40"
      fill="none"
      role="img"
      aria-label="CIDI"
      className="shrink-0"
    >
      <g stroke="#0E6EB8" strokeWidth="10" strokeLinejoin="round">
        <path d="M34 5 H10 V35 H34" />
        <path d="M46 13 V40" />
        <circle cx="46" cy="6" r="3.4" strokeWidth="3.6" />
        <path d="M60 5 H70 C80 5 84 11 84 20 C84 29 80 35 70 35 H60 Z" />
        <path d="M100 13 V40" />
      </g>
      <circle cx="100" cy="6" r="5" fill="#0E6EB8" />
    </svg>
  )
}

interface TopicRowProps {
  topic: Topic
  active: boolean
  onSelect: (topicId: string) => void
  onRename: () => void
  onDelete: () => void
}

function TopicRow({ topic, active, onSelect, onRename, onDelete }: TopicRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={() => onSelect(topic.topic_id)}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'relative flex w-full items-center gap-2 rounded-field py-2 pl-3 pr-2.5 text-left',
          'transition-colors duration-150',
          active ? 'bg-blueprint/10 text-ink' : 'text-inksoft hover:bg-ink/5',
        )}
      >
        {active ? (
          <span className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-r-full bg-blueprint" />
        ) : null}
        <span className={cn('min-w-0 flex-1 truncate text-body', active ? 'font-semibold' : 'font-medium')}>
          {topic.name}
        </span>
        {/* 悬停时让位给管理按钮，避免行宽跳动 */}
        <span
          className={cn(
            'tnum shrink-0 text-micro transition-opacity',
            active ? 'text-blueprint' : 'text-faint',
            'group-hover:opacity-0',
          )}
        >
          {topic.page_count}
        </span>
      </button>

      <div
        className={cn(
          'absolute right-1.5 top-1/2 -translate-y-1/2 transition-opacity',
          menuOpen ? 'opacity-100' : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
        )}
      >
        <button
          type="button"
          aria-label={`管理主题 ${topic.name}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          className="grid h-6 w-6 place-items-center rounded-field text-mute transition-colors hover:bg-ink/10 hover:text-ink"
        >
          <MoreHorizontal size={14} strokeWidth={2} />
        </button>
      </div>

      {menuOpen ? (
        <>
          {/* 透明罩：点别处收菜单 */}
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            aria-label={`${topic.name} 的操作`}
            className="absolute right-1.5 top-9 z-50 w-[104px] overflow-hidden rounded-field border border-line bg-surface py-1 shadow-lift animate-fade-in"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                onRename()
              }}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-caption text-inksoft transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <Pencil size={12} strokeWidth={2} />
              重命名
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                onDelete()
              }}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-caption text-danger transition-colors hover:bg-danger/10"
            >
              <Trash2 size={12} strokeWidth={2} />
              删除
            </button>
          </div>
        </>
      ) : null}
    </li>
  )
}

export function TopicSidebar() {
  const { data: topics, isPending } = useTopics()
  const activeTopicId = useNavStore((s) => s.activeTopicId)
  const setActiveTopic = useNavStore((s) => s.setActiveTopic)
  const setUploadOpen = useNavStore((s) => s.setUploadOpen)
  const setExportHistoryOpen = useNavStore((s) => s.setExportHistoryOpen)
  const activeUploadId = useNavStore((s) => s.activeUploadId)
  const topicCreateRequest = useNavStore((s) => s.topicCreateRequest)
  const { data: uploadTask } = useUploadTask(activeUploadId)

  const addTopic = useCreateTopic()
  const renameTopic = useRenameTopic()
  const removeTopic = useDeleteTopic()

  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Topic | null>(null)

  function startCreate() {
    setCreating(true)
    setDraft('')
  }

  useEffect(() => {
    if (topicCreateRequest > 0) startCreate()
  }, [topicCreateRequest])

  function submitCreate(e: FormEvent) {
    e.preventDefault()
    const name = draft.trim()
    if (!name || addTopic.isPending) return
    addTopic.mutate(name, {
      onSuccess: (topic) => {
        setCreating(false)
        setDraft('')
        // 直接落到新主题上，用户马上能往里面传 PPT
        setActiveTopic(topic.topic_id)
      },
    })
  }

  function submitRename(e: FormEvent) {
    e.preventDefault()
    if (!renamingId) return
    const id = renamingId
    const name = renameDraft.trim()
    setRenamingId(null)
    if (!name) return
    const original = topics?.find((t) => t.topic_id === id)
    if (!original || original.name === name) return
    renameTopic.mutate({ topicId: id, name })
  }

  function confirmDelete() {
    const target = pendingDelete
    if (!target || removeTopic.isPending) return
    removeTopic.mutate(target.topic_id, {
      onSuccess: () => {
        // 导出清单里这个主题的勾选一起清掉
        useSelectionStore.getState().clearTopic(target.topic_id)
        if (useNavStore.getState().activeTopicId === target.topic_id) {
          useNavStore.getState().dropActiveTopic()
        }
        setPendingDelete(null)
      },
    })
  }

  const list = topics ?? []

  return (
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="px-4 pb-4 pt-4">
        <CidiMark />
        <p className="mt-2 text-micro text-faint">希迪PPT智能版本管理</p>
      </div>

      <div className="px-3">
        <Button variant="primary" className="w-full justify-center" onClick={() => setUploadOpen(true)}>
          <Upload size={15} strokeWidth={2} />
          上传 PPT
        </Button>
        <Button
          variant="ghost"
          className="mt-1.5 w-full justify-center"
          onClick={() => setExportHistoryOpen(true)}
        >
          <FileClock size={15} strokeWidth={2} />
          导出记录
        </Button>
      </div>

      <div className="flex items-center justify-between px-4 pb-1.5 pt-5">
        <h2 className="text-micro text-faint">主题</h2>
        <button
          type="button"
          onClick={startCreate}
          aria-label="新建主题"
          title="新建主题"
          className="grid h-5 w-5 place-items-center rounded text-faint transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <Plus size={13} strokeWidth={2.2} />
        </button>
      </div>

      <nav className="scroll-area min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label="主题列表">
        {creating ? (
          <form
            onSubmit={submitCreate}
            className="mb-1 flex items-center gap-0.5 rounded-field border border-blueprint/50 bg-surface py-1 pl-2.5 pr-1"
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setCreating(false)
                }
              }}
              placeholder="主题名称"
              aria-label="新主题名称"
              className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-faint"
            />
            <button
              type="submit"
              disabled={!draft.trim() || addTopic.isPending}
              aria-label="确认新建"
              className="grid h-6 w-6 shrink-0 place-items-center rounded text-mute transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-40"
            >
              <Check size={13} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              aria-label="取消新建"
              className="grid h-6 w-6 shrink-0 place-items-center rounded text-faint transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <X size={13} strokeWidth={2.2} />
            </button>
          </form>
        ) : null}

        {isPending ? (
          <ul className="space-y-1 px-1" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="h-9 animate-pulse rounded-field bg-ink/5" />
            ))}
          </ul>
        ) : list.length === 0 && !creating ? (
          <div className="px-3 py-6 text-center">
            <p className="text-caption text-mute">还没有主题</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={startCreate}>
              <Plus size={13} strokeWidth={2.2} />
              新建主题
            </Button>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {list.map((topic) =>
              renamingId === topic.topic_id ? (
                <li key={topic.topic_id}>
                  <form
                    onSubmit={submitRename}
                    className="flex items-center gap-0.5 rounded-field border border-blueprint/50 bg-surface py-1 pl-2.5 pr-1"
                  >
                    <input
                      autoFocus
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          setRenamingId(null)
                        }
                      }}
                      aria-label="主题名称"
                      className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!renameDraft.trim() || renameTopic.isPending}
                      aria-label="确认重命名"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded text-mute transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-40"
                    >
                      <Check size={13} strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingId(null)}
                      aria-label="取消重命名"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded text-faint transition-colors hover:bg-ink/5 hover:text-ink"
                    >
                      <X size={13} strokeWidth={2.2} />
                    </button>
                  </form>
                </li>
              ) : (
                <TopicRow
                  key={topic.topic_id}
                  topic={topic}
                  active={topic.topic_id === activeTopicId}
                  onSelect={setActiveTopic}
                  onRename={() => {
                    setRenamingId(topic.topic_id)
                    setRenameDraft(topic.name)
                  }}
                  onDelete={() => setPendingDelete(topic)}
                />
              ),
            )}
          </ul>
        )}
      </nav>

      {uploadTask ? (
        <div className="border-t border-line p-3">
          <UploadProgress task={uploadTask} variant="compact" />
        </div>
      ) : (
        <div className="flex items-center gap-2 border-t border-line px-4 py-3 text-micro text-faint">
          <Layers size={13} strokeWidth={1.8} />
          <span>同一页面的多个版本会自动归为一组</span>
        </div>
      )}

      <Dialog
        open={pendingDelete != null}
        onClose={() => setPendingDelete(null)}
        title={`删除主题「${pendingDelete?.name ?? ''}」？`}
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPendingDelete(null)}
              disabled={removeTopic.isPending}
            >
              取消
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDelete} disabled={removeTopic.isPending}>
              {removeTopic.isPending ? '删除中…' : '删除'}
            </Button>
          </>
        }
      >
        <p className="text-caption leading-6 text-mute">
          这个主题下的 {pendingDelete?.page_count ?? 0} 页和它们的版本历史会一起移除，
          导出清单里属于它的勾选也会清掉。删除后不能恢复。
        </p>
      </Dialog>
    </aside>
  )
}
