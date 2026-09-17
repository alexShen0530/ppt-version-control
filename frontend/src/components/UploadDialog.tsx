import { useEffect, useRef, useState } from 'react'
import { FileUp, FolderOpen, TriangleAlert, UploadCloud } from 'lucide-react'
import { Button } from './ui/Button'
import { Dialog } from './ui/Dialog'
import { Select, Spinner } from './ui/Controls'
import { UploadProgress } from './UploadProgress'
import { startUpload, useTopics, useUploadTask } from '@/hooks/useQueries'
import { useNavStore } from '@/store/useNavStore'
import { useUploadStore } from '@/store/useUploadStore'
import { cn } from '@/lib/utils'

const ACCEPT_EXTENSIONS = ['.ppt', '.pptx']
const ACCEPT_ATTR =
  '.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation'

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * 上传弹窗。
 * 解析是异步的：提交后拿到 upload_id 就交给轮询，用户可以关掉窗口，
 * 左侧栏会继续显示同一条进度。解析完成后由 useUploadResultWatcher 做增量合并。
 */
export function UploadDialog() {
  const open = useNavStore((s) => s.uploadOpen)
  const setOpen = useNavStore((s) => s.setUploadOpen)
  const activeTopicId = useNavStore((s) => s.activeTopicId)
  const activeUploadId = useNavStore((s) => s.activeUploadId)
  const setActiveUploadId = useNavStore((s) => s.setActiveUploadId)
  const addUpload = useUploadStore((s) => s.add)

  const { data: topics } = useTopics()
  const { data: task } = useUploadTask(activeUploadId)

  const [file, setFile] = useState<File | null>(null)
  const [topicId, setTopicId] = useState('')
  const [dragging, setDragging] = useState(false)
  const [rejected, setRejected] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 关掉窗口就清空表单，下次打开是干净的；进度本身存在 store 里，不受影响
  useEffect(() => {
    if (open) return
    setFile(null)
    setDragging(false)
    setRejected(null)
    setSubmitting(false)
    if (inputRef.current) inputRef.current.value = ''
  }, [open])

  // 主题列表到位后给一个默认值，优先当前正在看的主题
  useEffect(() => {
    if (topicId || !topics || topics.length === 0) return
    setTopicId(activeTopicId ?? topics[0]!.topic_id)
  }, [topics, topicId, activeTopicId])

  const running = task != null && (task.status === 'pending' || task.status === 'processing')
  const duplicateName = rejected?.includes('同名 PPT') ?? false

  function pickFile(next: File | null | undefined) {
    if (!next) return
    const name = next.name.toLowerCase()
    if (!ACCEPT_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      setRejected(`「${next.name}」不是 PPT 文件，请选择 .ppt 或 .pptx`)
      setFile(null)
      return
    }
    setRejected(null)
    setFile(next)
  }

  async function handleSubmit() {
    if (!file || !topicId || submitting) return
    setSubmitting(true)
    try {
      const { upload_id } = await startUpload(file, topicId)
      addUpload(upload_id)
      setActiveUploadId(upload_id)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      setRejected(err instanceof Error ? err.message : '上传没有成功，请重试一次')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="上传 PPT"
      description="上传后系统会逐页拆分，并把和已有页面相同的内容接到对应的版本线上。"
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {running ? '关闭' : '取消'}
          </Button>
          {running ? null : (
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!file || !topicId || submitting}
            >
              {submitting ? <Spinner /> : <UploadCloud size={15} strokeWidth={2} />}
              {submitting ? '正在上传' : '开始上传'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 pb-4">
        {task ? <UploadProgress task={task} variant="full" /> : null}

        {running ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-caption leading-5 text-mute">解析在后台继续，关闭弹窗也不会中断。</p>
            <Button variant="secondary" size="sm" onClick={() => setActiveUploadId(null)}>
              上传另一份
            </Button>
          </div>
        ) : (
          <>
            <div>
              <label className="mb-1.5 block text-caption font-medium text-inksoft" htmlFor="upload-topic">
                归入主题
              </label>
              <Select
                id="upload-topic"
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                disabled={!topics || topics.length === 0}
                className="h-9"
              >
                {(topics ?? []).map((topic) => (
                  <option key={topic.topic_id} value={topic.topic_id}>
                    {topic.name}
                  </option>
                ))}
              </Select>
            </div>

            <label
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center rounded-card px-4 py-8 text-center',
                'border transition-colors duration-150',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blueprint/30',
                dragging
                  ? 'border-blueprint bg-blueprint/5'
                  : file
                    ? 'border-line2 bg-raised'
                    : 'border-dashed border-line2 bg-raised hover:border-mute hover:bg-ink/5',
              )}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                pickFile(e.dataTransfer.files?.[0])
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT_ATTR}
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => pickFile(e.target.files?.[0])}
              />

              {file ? (
                <>
                  <span className="grid h-9 w-9 place-items-center rounded-field bg-surface text-inksoft ring-1 ring-line">
                    <FileUp size={16} strokeWidth={1.8} />
                  </span>
                  <span className="mt-2.5 max-w-full truncate text-body font-medium text-ink">{file.name}</span>
                  <span className="tnum mt-0.5 text-micro text-mute">
                    {formatSize(file.size)}，点击可以换一个文件
                  </span>
                </>
              ) : (
                <>
                  <span className="grid h-9 w-9 place-items-center rounded-field bg-surface text-mute ring-1 ring-line">
                    <UploadCloud size={16} strokeWidth={1.8} />
                  </span>
                  <span className="mt-2.5 text-body font-medium text-ink">把 PPT 拖到这里</span>
                  <span className="mt-0.5 text-micro text-mute">或者点击选择文件，支持 .ppt 和 .pptx</span>
                </>
              )}
            </label>

            {rejected ? (
              duplicateName ? (
                <div role="alert" className="flex items-start gap-3 rounded-card border border-warn/25 bg-warn/5 px-3.5 py-3">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-warn/10 text-warn">
                    <TriangleAlert size={14} strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-medium text-ink">该文件已上传过</p>
                    <p className="mt-0.5 text-caption leading-5 text-mute">
                      当前主题中已有同名 PPT。请修改文件名后重新选择，以便正确区分不同版本。
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => inputRef.current?.click()}
                      className="mt-2 -ml-2"
                    >
                      <FolderOpen size={14} strokeWidth={2} />
                      重新选择文件
                    </Button>
                  </div>
                </div>
              ) : (
                <p role="alert" className="text-caption leading-5 text-danger">
                  {rejected}
                </p>
              )
            ) : null}
          </>
        )}
      </div>
    </Dialog>
  )
}
