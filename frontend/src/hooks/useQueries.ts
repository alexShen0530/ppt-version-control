import { useEffect, useMemo, useRef } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  createTopic,
  deleteRevision,
  deleteRevisionGroup,
  deleteTopic,
  exportPpt,
  getExportStatus,
  getRevisionGroup,
  getUploadStatus,
  listMasterPages,
  listUploads,
  listExports,
  listTopics,
  renameTopic,
  uploadPpt,
  type MasterPageResponse,
} from '@/lib/api'
import { useSelectionStore } from '@/store/useSelectionStore'
import type { ExportTask, MasterPage, RevisionGroupDetail, Topic, UploadTask } from '@/types'

/* ------------------------------------------------------------- query keys */

export const qk = {
  topics: ['topics'] as const,
  masterPages: (topicId: string) => ['master-pages', topicId] as const,
  group: (groupId: string) => ['revision-group', groupId] as const,
  upload: (uploadId: string) => ['upload', uploadId] as const,
  uploads: ['uploads'] as const,
  export: (exportId: string) => ['export', exportId] as const,
  exports: ['exports'] as const,
}

/* ------------------------------------------------------------------ 主题 */

export function useTopics() {
  return useQuery({
    queryKey: qk.topics,
    queryFn: listTopics,
    staleTime: 60_000,
  })
}

/** 新建主题：成功后就地追加进主题缓存，不整列表重拉 */
export function useCreateTopic() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createTopic(name),
    onSuccess: (topic) => {
      qc.setQueryData<Topic[]>(qk.topics, (old) => (old ? [...old, topic] : [topic]))
    },
  })
}

export function useRenameTopic() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ topicId, name }: { topicId: string; name: string }) => renameTopic(topicId, name),
    onSuccess: (topic) => {
      qc.setQueryData<Topic[]>(qk.topics, (old) =>
        old?.map((t) => (t.topic_id === topic.topic_id ? topic : t)),
      )
    },
  })
}

/** 删除主题：清缓存里的主题、页面池；版本缓存不可达后由 gc 回收 */
export function useDeleteTopic() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (topicId: string) => deleteTopic(topicId),
    onSuccess: (_res, topicId) => {
      qc.setQueryData<Topic[]>(qk.topics, (old) => old?.filter((t) => t.topic_id !== topicId))
      qc.removeQueries({ queryKey: qk.masterPages(topicId) })
    },
  })
}

/* ---------------------------------------------------------------- 页面池 */

export function useMasterPages(topicId: string | null) {
  return useQuery({
    queryKey: qk.masterPages(topicId ?? ''),
    queryFn: () => listMasterPages(topicId as string),
    enabled: topicId != null,
    // 页面池的数据由上传流程做增量 patch，不靠轮询重拉
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  })
}

/* -------------------------------------------------------------- 版本历史 */

/**
 * 第一次打开某个 revision_group 时取全部历史版本，之后由 React Query 缓存。
 * 用户来回切 V1/V2/V3 不会再发请求。
 */
export function useRevisionGroup(groupId: string | null) {
  return useQuery({
    queryKey: qk.group(groupId ?? ''),
    queryFn: () => getRevisionGroup(groupId as string),
    enabled: groupId != null,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  })
}

/** 详情当前应该展示哪一版：用户手动选过的优先，否则跟随最新版 */
export function useActiveVersion(
  detail: RevisionGroupDetail | undefined,
  requestedRevisionNo: number | null,
) {
  return useMemo(() => {
    if (!detail || detail.versions.length === 0) return undefined
    const wanted = detail.versions.find((v) => v.revision_no === requestedRevisionNo)
    return wanted ?? detail.versions[detail.versions.length - 1]
  }, [detail, requestedRevisionNo])
}

/* ------------------------------------------------------------------ 上传 */

export function useUploadTask(uploadId: string | null) {
  return useQuery({
    queryKey: qk.upload(uploadId ?? ''),
    queryFn: () => getUploadStatus(uploadId as string),
    enabled: uploadId != null,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'completed' || status === 'failed' ? false : 500
    },
    staleTime: 0,
    gcTime: 10 * 60_000,
  })
}

/** 触发一次上传，返回 upload_id */
export async function startUpload(file: File, topicId: string) {
  return uploadPpt(file, topicId)
}

/**
 * 解析完成后做增量更新：
 *   - 全新页面 → 直接插到页面池缓存最前面
 *   - 已有页面的新版本 → 只补拉这几个 revision_group，就地替换对应卡片
 * 任何情况下都不重拉整个页面池。
 */
async function applyUploadResult(qc: QueryClient, task: UploadTask) {
  const details = await Promise.all(
    task.updated_groups.map((groupId) =>
      qc.fetchQuery({
        queryKey: qk.group(groupId),
        queryFn: () => getRevisionGroup(groupId),
        staleTime: 0,
      }).catch(() => null),
    ),
  )

  const refreshed: MasterPage[] = []
  const previousLatest = new Map<string, string>()

  details.forEach((detail, i) => {
    if (!detail) return
    const groupId = task.updated_groups[i]!
    const versions = detail.versions
    const latest = versions[versions.length - 1]
    const prev = versions[versions.length - 2]
    if (!latest) return
    if (prev) previousLatest.set(groupId, prev.page_id)

    refreshed.push({
      page_id: latest.page_id,
      revision_group_id: groupId,
      revision_no: latest.revision_no,
      revision_count: versions.length,
      title: detail.title,
      image_url: latest.image_url,
      source_file_name: latest.source_file_name,
      source_page_no: latest.source_page_no,
      created_at: latest.created_at,
    })
  })

  qc.setQueryData<MasterPageResponse>(qk.masterPages(task.topic_id), (old) => {
    if (!old) return old
    const byGroup = new Map<string, MasterPage>(old.pages.map((p) => [p.revision_group_id, p]))
    for (const page of refreshed) byGroup.set(page.revision_group_id, page)
    for (const page of task.new_pages) byGroup.set(page.revision_group_id, page)

    const pages = Array.from(byGroup.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    return { total: pages.length, pages }
  })

  qc.setQueryData<Topic[]>(qk.topics, (old) =>
    old
      ? old.map((t) =>
          t.topic_id === task.topic_id ? { ...t, page_count: t.page_count + task.new_pages.length } : t,
        )
      : old,
  )

  // 用户原本选中的就是「上一版最新」时，让选择跟着走到新版本；
  // 如果用户是刻意挑的旧版本，保持不动。
  const selection = useSelectionStore.getState()
  for (const page of refreshed) {
    const prevId = previousLatest.get(page.revision_group_id)
    if (!prevId) continue
    const entries = selection.entries.filter((entry) => entry.topic_id === task.topic_id)
    if (entries.some((e) => e.revision_group_id === page.revision_group_id && e.page_id === prevId)) {
      selection.syncLatest(task.topic_id, page)
    }
  }
}

/** 整组移除的缓存收尾：删版本缓存、把卡片从页面池摘掉、刷新主题计数 */
function dropGroupFromCache(qc: QueryClient, topicId: string, groupId: string) {
  qc.removeQueries({ queryKey: qk.group(groupId) })
  qc.setQueryData<MasterPageResponse>(qk.masterPages(topicId), (old) => {
    if (!old) return old
    const pages = old.pages.filter((p) => p.revision_group_id !== groupId)
    return { total: pages.length, pages }
  })
  qc.invalidateQueries({ queryKey: qk.topics })
}

/**
 * 删除某一版：版本缓存就地替换成顺排后的结果，页面池卡片同步指向新最新版；
 * 整组被删时移除卡片和版本缓存。
 */
export function useDeleteRevision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, pageId }: { groupId: string; pageId: string }) =>
      deleteRevision(groupId, pageId),
    onSuccess: (res, vars) => {
      const { detail, topic_id } = res
      if (!detail) {
        dropGroupFromCache(qc, topic_id, vars.groupId)
        return
      }

      qc.setQueryData<RevisionGroupDetail>(qk.group(vars.groupId), detail)
      const latest = detail.versions[detail.versions.length - 1]!
      qc.setQueryData<MasterPageResponse>(qk.masterPages(topic_id), (old) => {
        if (!old) return old
        const pages = old.pages
          .map((p) =>
            p.revision_group_id === vars.groupId
              ? {
                  ...p,
                  page_id: latest.page_id,
                  revision_no: latest.revision_no,
                  revision_count: detail.versions.length,
                  title: detail.title,
                  image_url: latest.image_url,
                  source_file_name: latest.source_file_name,
                  source_page_no: latest.source_page_no,
                  created_at: latest.created_at,
                }
              : p,
          )
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        return { total: pages.length, pages }
      })
    },
  })
}

/** 删除整个 revision_group（该页全部版本） */
export function useDeleteRevisionGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (groupId: string) => deleteRevisionGroup(groupId),
    onSuccess: (res, groupId) => dropGroupFromCache(qc, res.topic_id, groupId),
  })
}

/** 挂在应用根部：只要有上传任务在跑就监听，完成后自动做增量合并 */
export function useUploadResultWatcher(uploadId: string | null) {
  const qc = useQueryClient()
  const { data } = useUploadTask(uploadId)
  const applied = useRef<Set<string>>(new Set())

  useEffect(() => {
    const task = data
    if (!task || task.status !== 'completed') return
    if (applied.current.has(task.upload_id)) return
    applied.current.add(task.upload_id)
    void applyUploadResult(qc, task)
  }, [data, qc])
}

/* ------------------------------------------------------------------ 导出 */

export function useExportTask(exportId: string | null) {
  return useQuery({
    queryKey: qk.export(exportId ?? ''),
    queryFn: () => getExportStatus(exportId as string),
    enabled: exportId != null,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'completed' || status === 'failed' ? false : 450
    },
    staleTime: 0,
    gcTime: 10 * 60_000,
  })
}

export function useUploadHistory(enabled: boolean) {
  return useQuery({
    queryKey: qk.uploads,
    queryFn: listUploads,
    enabled,
    refetchInterval: (query) => query.state.data?.some((task) =>
      task.status === 'pending' || task.status === 'processing') ? 2000 : false,
    staleTime: 0,
  })
}

export function useExportHistory(open: boolean) {
  return useQuery({
    queryKey: qk.exports,
    queryFn: listExports,
    enabled: open,
    refetchInterval: (query) =>
      query.state.data?.some((task) => task.status === 'processing') ? 1000 : false,
    staleTime: 0,
  })
}

export async function startExport(pageIds: string[], topicId: string): Promise<ExportTask | null> {
  const { export_id } = await exportPpt(pageIds, topicId)
  return { export_id, status: 'processing', page_count: pageIds.length }
}
