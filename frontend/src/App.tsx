import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { TopicSidebar } from './components/TopicSidebar'
import { PagePool } from './components/PagePool'
import { PagePreview } from './components/PagePreview'
import { PageLightbox } from './components/PageLightbox'
import { SelectedPagesBar } from './components/SelectedPagesBar'
import { UploadDialog } from './components/UploadDialog'
import { ExportDialog } from './components/ExportDialog'
import { ExportStatusBar } from './components/ExportStatusBar'
import { ExportHistoryDialog } from './components/ExportHistoryDialog'
import { DeleteGroupDialog } from './components/DeleteGroupDialog'
import { qk, useTopics, useUploadHistory, useUploadResultWatcher } from '@/hooks/useQueries'
import { useNavStore } from '@/store/useNavStore'
import { useUploadStore } from '@/store/useUploadStore'
import { ImportHistoryDialog } from './components/ImportHistoryDialog'

/**
 * 三栏布局：主题导航 / 页面池 / 页面详情。
 * 详情区在窄屏收成抽屉，由 PagePreview 自己按断点切换。
 */
export default function App() {
  const { data: topics } = useTopics()
  const activeTopicId = useNavStore((s) => s.activeTopicId)
  const activeGroupId = useNavStore((s) => s.activeGroupId)
  const setActiveTopic = useNavStore((s) => s.setActiveTopic)
  const uploadIds = useUploadStore((s) => s.ids)
  const addUpload = useUploadStore((s) => s.add)
  const { data: uploadHistory } = useUploadHistory(true)
  const queryClient = useQueryClient()
  const previousTopic = useRef<string | null>(null)
  const previousGroup = useRef<string | null>(null)

  // 首次进来落在第一个主题上
  useEffect(() => {
    if (activeTopicId != null || !topics || topics.length === 0) return
    setActiveTopic(topics[0]!.topic_id)
  }, [topics, activeTopicId, setActiveTopic])

  useEffect(() => {
    uploadHistory?.forEach((task) => {
      if (task.status === 'pending' || task.status === 'processing') addUpload(task.upload_id)
    })
  }, [uploadHistory, addUpload])

  useEffect(() => {
    if (activeTopicId && previousTopic.current !== activeTopicId &&
        queryClient.getQueryData(qk.masterPages(activeTopicId))) {
      void queryClient.invalidateQueries({ queryKey: qk.masterPages(activeTopicId) })
    }
    previousTopic.current = activeTopicId
  }, [activeTopicId, queryClient])

  useEffect(() => {
    if (activeGroupId && previousGroup.current !== activeGroupId &&
        queryClient.getQueryData(qk.group(activeGroupId))) {
      void queryClient.invalidateQueries({ queryKey: qk.group(activeGroupId) })
    }
    previousGroup.current = activeGroupId
  }, [activeGroupId, queryClient])

  useEffect(() => {
    const refreshVisible = () => {
      const { activeTopicId: topicId, activeGroupId: groupId } = useNavStore.getState()
      if (topicId) void queryClient.invalidateQueries({ queryKey: qk.masterPages(topicId) })
      if (groupId) void queryClient.invalidateQueries({ queryKey: qk.group(groupId) })
      void queryClient.invalidateQueries({ queryKey: qk.topics })
    }
    window.addEventListener('focus', refreshVisible)
    return () => window.removeEventListener('focus', refreshVisible)
  }, [queryClient])

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-paper text-ink antialiased">
      <TopicSidebar />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <PagePool />
        <SelectedPagesBar />
      </main>

      <PagePreview />
      <PageLightbox />

      <DeleteGroupDialog />

      <UploadDialog />
      <ExportDialog />
      <ExportStatusBar />
      <ExportHistoryDialog />
      <ImportHistoryDialog />
      {uploadIds.map((id) => <UploadWatcher key={id} id={id} />)}
    </div>
  )
}

function UploadWatcher({ id }: { id: string }) {
  useUploadResultWatcher(id)
  return null
}
