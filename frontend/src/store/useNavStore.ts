import { create } from 'zustand'
import type { PoolFilters, SortKey } from '@/types'

interface NavState {
  activeTopicId: string | null
  /** 右侧详情正在看的 revision_group */
  activeGroupId: string | null
  /**
   * 详情里正在预览的版本号。
   * null 表示跟随该组最新版，切换 Topic / 卡片时自动回到最新。
   */
  activeRevisionNo: number | null
  filters: PoolFilters
  uploadOpen: boolean
  exportOpen: boolean
  exportHistoryOpen: boolean
  /** 全屏查看器：点卡片直接看大图，里面可以切版本 */
  viewerOpen: boolean
  /** 正在跑的上传任务，侧边和弹窗共用同一条进度 */
  activeUploadId: string | null
  topicCreateRequest: number

  setActiveTopic: (topicId: string) => void
  /** 当前主题被删除后落空，App 会自动落到剩余的第一个主题 */
  dropActiveTopic: () => void
  /** 卡片缩略图 / 已选缩略图点击：打开详情的同时直接进全屏查看 */
  openPage: (groupId: string, revisionNo?: number) => void
  /** 卡片文字区点击：只打开右侧详情，不弹全屏查看，方便连续浏览右栏信息 */
  openDetail: (groupId: string) => void
  closeGroup: () => void
  closeViewer: () => void
  setViewerOpen: (open: boolean) => void
  setRevisionNo: (revisionNo: number | null) => void
  setKeyword: (keyword: string) => void
  setSource: (source: string | 'all') => void
  setSort: (sort: SortKey) => void
  resetFilters: () => void
  setUploadOpen: (open: boolean) => void
  setExportOpen: (open: boolean) => void
  setExportHistoryOpen: (open: boolean) => void
  setActiveUploadId: (uploadId: string | null) => void
  requestTopicCreate: () => void
}

const DEFAULT_FILTERS: PoolFilters = { keyword: '', source: 'all', sort: 'updated_desc' }

/**
 * 导航与界面状态。
 * 选择状态放在 useSelectionStore，避免勾选一张卡片时详情区域跟着重渲染。
 */
export const useNavStore = create<NavState>((set) => ({
  activeTopicId: null,
  activeGroupId: null,
  activeRevisionNo: null,
  filters: DEFAULT_FILTERS,
  uploadOpen: false,
  exportOpen: false,
  exportHistoryOpen: false,
  viewerOpen: false,
  activeUploadId: null,
  topicCreateRequest: 0,

  setActiveTopic: (topicId) =>
    set((s) =>
      s.activeTopicId === topicId
        ? s
        : {
            activeTopicId: topicId,
            activeGroupId: null,
            activeRevisionNo: null,
            filters: { ...DEFAULT_FILTERS },
          },
    ),

  dropActiveTopic: () =>
    set({
      activeTopicId: null,
      activeGroupId: null,
      activeRevisionNo: null,
      viewerOpen: false,
      filters: { ...DEFAULT_FILTERS },
    }),

  openPage: (groupId, revisionNo) =>
    set({
      activeGroupId: groupId,
      activeRevisionNo: revisionNo ?? null,
      viewerOpen: true,
    }),

  openDetail: (groupId) => set({ activeGroupId: groupId, viewerOpen: false }),

  closeGroup: () => set({ activeGroupId: null, activeRevisionNo: null, viewerOpen: false }),

  closeViewer: () => set({ viewerOpen: false }),

  setViewerOpen: (viewerOpen) => set({ viewerOpen }),

  setRevisionNo: (revisionNo) => set({ activeRevisionNo: revisionNo }),

  setKeyword: (keyword) => set((s) => ({ filters: { ...s.filters, keyword } })),
  setSource: (source) => set((s) => ({ filters: { ...s.filters, source } })),
  setSort: (sort) => set((s) => ({ filters: { ...s.filters, sort } })),
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  setUploadOpen: (uploadOpen) => set({ uploadOpen }),
  setExportOpen: (exportOpen) => set({ exportOpen }),
  setExportHistoryOpen: (exportHistoryOpen) => set({ exportHistoryOpen }),
  setActiveUploadId: (activeUploadId) => set({ activeUploadId }),
  requestTopicCreate: () => set((s) => ({ topicCreateRequest: s.topicCreateRequest + 1 })),
}))
