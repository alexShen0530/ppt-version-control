import { useEffect } from 'react'
import { TopicSidebar } from './components/TopicSidebar'
import { PagePool } from './components/PagePool'
import { PagePreview } from './components/PagePreview'
import { PageLightbox } from './components/PageLightbox'
import { SelectedPagesBar } from './components/SelectedPagesBar'
import { UploadDialog } from './components/UploadDialog'
import { ExportDialog } from './components/ExportDialog'
import { ExportStatusBar } from './components/ExportStatusBar'
import { ExportHistoryDialog } from './components/ExportHistoryDialog'
import { useTopics, useUploadResultWatcher } from '@/hooks/useQueries'
import { useNavStore } from '@/store/useNavStore'

/**
 * 三栏布局：主题导航 / 页面池 / 页面详情。
 * 详情区在窄屏收成抽屉，由 PagePreview 自己按断点切换。
 */
export default function App() {
  const { data: topics } = useTopics()
  const activeTopicId = useNavStore((s) => s.activeTopicId)
  const setActiveTopic = useNavStore((s) => s.setActiveTopic)
  const activeUploadId = useNavStore((s) => s.activeUploadId)

  // 解析完成后把新页面和新版本合并进页面池缓存，不整池重拉
  useUploadResultWatcher(activeUploadId)

  // 首次进来落在第一个主题上
  useEffect(() => {
    if (activeTopicId != null || !topics || topics.length === 0) return
    setActiveTopic(topics[0]!.topic_id)
  }, [topics, activeTopicId, setActiveTopic])

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-paper text-ink antialiased">
      <TopicSidebar />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <PagePool />
        <SelectedPagesBar />
      </main>

      <PagePreview />
      <PageLightbox />

      <UploadDialog />
      <ExportDialog />
      <ExportStatusBar />
      <ExportHistoryDialog />
    </div>
  )
}
