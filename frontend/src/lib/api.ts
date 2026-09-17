/**
 * API 层。
 *
 * 组件只认这一层的函数签名，不认数据来源。
 * 接真实后端时把 USE_MOCK 置为 false，并在 vite.config.ts 打开 /api 代理即可，
 * 页面组件、hooks、store 全部不用改。
 */

import {
  MOCK_GROUPS,
  MOCK_GROUP_TOPIC,
  MOCK_MASTER_BY_TOPIC,
  MOCK_TOPICS,
  makeUploadedPages,
} from './mockData'
import { clamp } from './utils'
import type {
  ExportTask,
  MasterPage,
  RevisionGroupDetail,
  Topic,
  UploadTask,
  UploadRecord,
} from '@/types'

/** 置为 false 即切到真实后端，其余代码不需要改动 */
export const USE_MOCK: boolean = false

const BASE = '/api'

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { message?: string } | null
    throw new Error(body?.message ?? `请求失败：${res.status} ${res.statusText}`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/* ------------------------------------------------------------------ 主题 */

export async function listTopics(): Promise<Topic[]> {
  if (!USE_MOCK) return http<Topic[]>('/topics')
  await wait(120)
  // 计数跟着页面池实时变化（上传后会增加）
  return MOCK_TOPICS.map((t) => ({
    ...t,
    page_count: MOCK_MASTER_BY_TOPIC.get(t.topic_id)?.length ?? t.page_count,
  }))
}

let topicSeq = 0

export async function createTopic(name: string): Promise<Topic> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('主题名称不能为空')
  if (!USE_MOCK) {
    return http<Topic>('/topics', { method: 'POST', body: JSON.stringify({ name: trimmed }) })
  }
  await wait(160)
  // 造一个不和现有 id 撞的新 id
  let id = ''
  do {
    topicSeq += 1
    id = `t-new-${topicSeq}`
  } while (MOCK_TOPICS.some((t) => t.topic_id === id))
  const topic: Topic = { topic_id: id, name: trimmed, page_count: 0 }
  MOCK_TOPICS.push(topic)
  MOCK_MASTER_BY_TOPIC.set(id, [])
  return { ...topic }
}

export async function renameTopic(topicId: string, name: string): Promise<Topic> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('主题名称不能为空')
  if (!USE_MOCK) {
    return http<Topic>(`/topics/${topicId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: trimmed }),
    })
  }
  await wait(140)
  const topic = MOCK_TOPICS.find((t) => t.topic_id === topicId)
  if (!topic) throw new Error('主题不存在或已删除')
  topic.name = trimmed
  return { ...topic }
}

export async function deleteTopic(topicId: string): Promise<void> {
  if (!USE_MOCK) {
    await http<unknown>(`/topics/${topicId}`, { method: 'DELETE' })
    return
  }
  await wait(180)
  const idx = MOCK_TOPICS.findIndex((t) => t.topic_id === topicId)
  if (idx === -1) throw new Error('主题不存在或已删除')
  MOCK_TOPICS.splice(idx, 1)
  // 主题下的页面池和版本索引一起清掉，避免留下孤儿数据
  const pool = MOCK_MASTER_BY_TOPIC.get(topicId) ?? []
  for (const page of pool) {
    MOCK_GROUPS.delete(page.revision_group_id)
    MOCK_GROUP_TOPIC.delete(page.revision_group_id)
  }
  MOCK_MASTER_BY_TOPIC.delete(topicId)
}

/* -------------------------------------------------------------- 页面池 */

export interface MasterPageResponse {
  total: number
  pages: MasterPage[]
}

export async function listMasterPages(topicId: string): Promise<MasterPageResponse> {
  if (!USE_MOCK) return http<MasterPageResponse>(`/topics/${topicId}/master-pages`)
  await wait(240)
  const pages = MOCK_MASTER_BY_TOPIC.get(topicId) ?? []
  return { total: pages.length, pages: pages.map((p) => ({ ...p })) }
}

/* ------------------------------------------------------------ 版本历史 */

export async function getRevisionGroup(groupId: string): Promise<RevisionGroupDetail> {
  if (!USE_MOCK) return http<RevisionGroupDetail>(`/revision-groups/${groupId}`)
  await wait(220)
  const detail = MOCK_GROUPS.get(groupId)
  if (!detail) throw new Error('找不到这个页面的版本记录，它可能已被删除')
  return { ...detail, versions: detail.versions.map((v) => ({ ...v })) }
}

/* ------------------------------------------------------------ 删除版本 */

export interface DeleteRevisionResult {
  /** null 表示最后一个版本被删，整个 revision_group 已移除 */
  detail: RevisionGroupDetail | null
  topic_id: string
}

/**
 * 删除某一版。剩下的版本重新顺排为 V1..Vn，不留空号；
 * 页面池里那张卡片始终指向该组最新的版本。
 */
export async function deleteRevision(groupId: string, pageId: string): Promise<DeleteRevisionResult> {
  if (!USE_MOCK) {
    return http<DeleteRevisionResult>(`/revision-groups/${groupId}/versions/${pageId}`, {
      method: 'DELETE',
    })
  }
  await wait(160)
  const detail = MOCK_GROUPS.get(groupId)
  if (!detail) throw new Error('找不到这个页面的版本记录，它可能已被删除')
  const idx = detail.versions.findIndex((v) => v.page_id === pageId)
  if (idx === -1) throw new Error('这个版本不存在或已删除')

  const topicId = MOCK_GROUP_TOPIC.get(groupId) ?? ''
  detail.versions.splice(idx, 1)
  // 版本号顺排：删除后不允许出现空号
  detail.versions.forEach((v, i) => {
    v.revision_no = i + 1
  })

  const pool = MOCK_MASTER_BY_TOPIC.get(topicId)

  if (detail.versions.length === 0) {
    MOCK_GROUPS.delete(groupId)
    MOCK_GROUP_TOPIC.delete(groupId)
    if (pool) {
      const at = pool.findIndex((p) => p.revision_group_id === groupId)
      if (at !== -1) pool.splice(at, 1)
    }
    return { detail: null, topic_id: topicId }
  }

  const latest = detail.versions[detail.versions.length - 1]!
  if (pool) {
    const at = pool.findIndex((p) => p.revision_group_id === groupId)
    if (at !== -1) {
      pool[at] = {
        page_id: latest.page_id,
        revision_group_id: groupId,
        revision_no: latest.revision_no,
        revision_count: detail.versions.length,
        title: detail.title,
        image_url: latest.image_url,
        source_file_name: latest.source_file_name,
        source_page_no: latest.source_page_no,
        created_at: latest.created_at,
      }
    }
  }

  return {
    detail: { ...detail, versions: detail.versions.map((v) => ({ ...v })) },
    topic_id: topicId,
  }
}

/* ------------------------------------------------------------ 删除整页 */

export interface DeleteRevisionGroupResult {
  topic_id: string
}

/** 删除整个 revision_group（该页全部版本）。 */
export async function deleteRevisionGroup(groupId: string): Promise<DeleteRevisionGroupResult> {
  if (!USE_MOCK) {
    return http<DeleteRevisionGroupResult>(`/revision-groups/${groupId}`, { method: 'DELETE' })
  }
  await wait(180)
  if (!MOCK_GROUPS.has(groupId)) throw new Error('找不到这个页面的版本记录，它可能已被删除')
  const topicId = MOCK_GROUP_TOPIC.get(groupId) ?? ''
  MOCK_GROUPS.delete(groupId)
  MOCK_GROUP_TOPIC.delete(groupId)
  const pool = MOCK_MASTER_BY_TOPIC.get(topicId)
  if (pool) {
    const at = pool.findIndex((p) => p.revision_group_id === groupId)
    if (at !== -1) pool.splice(at, 1)
  }
  const topic = MOCK_TOPICS.find((t) => t.topic_id === topicId)
  if (topic) topic.page_count = pool?.length ?? topic.page_count
  return { topic_id: topicId }
}

/* ---------------------------------------------------------------- 上传 */

interface MockUploadRecord {
  task: UploadTask
  startedAt: number
  msPerPage: number
  materialized: boolean
}

const uploads = new Map<string, MockUploadRecord>()
let uploadSeq = 0

export interface UploadReceipt {
  upload_id: string
}

export async function uploadPpt(file: File, topicId: string): Promise<UploadReceipt> {
  if (!USE_MOCK) {
    const form = new FormData()
    form.append('file', file)
    form.append('topic_id', topicId)
    const res = await fetch(`${BASE}/ppt/upload`, { method: 'POST', body: form })
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { message?: string } | null
      throw new Error(body?.message ?? `上传失败：${res.status}`)
    }
    return (await res.json()) as UploadReceipt
  }

  await wait(320)
  uploadSeq += 1
  const uploadId = `up${String(uploadSeq).padStart(4, '0')}`
  // 页数按文件大小估一个，真实场景由后端解析后回填
  const totalPages = clamp(Math.round(file.size / 90_000) + 8, 6, 26)

  uploads.set(uploadId, {
    task: {
      upload_id: uploadId,
      file_name: file.name,
      topic_id: topicId,
      status: 'pending',
      total_pages: totalPages,
      processed_pages: 0,
      new_pages: [],
      updated_groups: [],
    },
    startedAt: Date.now(),
    msPerPage: 340,
    materialized: false,
  })

  return { upload_id: uploadId }
}

export async function getUploadStatus(uploadId: string): Promise<UploadTask> {
  if (!USE_MOCK) return http<UploadTask>(`/uploads/${uploadId}`)
  await wait(90)

  const record = uploads.get(uploadId)
  if (!record) throw new Error('上传记录不存在或已过期')

  const elapsed = Date.now() - record.startedAt
  const total = record.task.total_pages
  // 前 500ms 停留在 pending，模拟排队
  const processed = elapsed < 500 ? 0 : clamp(Math.floor((elapsed - 500) / record.msPerPage), 0, total)

  record.task.processed_pages = processed
  record.task.status = processed === 0 ? 'pending' : processed < total ? 'processing' : 'completed'

  // 完成的那一刻才真正落库，并且只算一次
  if (record.task.status === 'completed' && !record.materialized) {
    record.materialized = true
    const newPages = makeUploadedPages(record.task.topic_id, record.task.file_name, total)

    const brandNew: MasterPage[] = []
    const updatedGroups: string[] = []

    for (const page of newPages) {
      const pool = MOCK_MASTER_BY_TOPIC.get(record.task.topic_id)
      if (!pool) continue
      const idx = pool.findIndex((m) => m.revision_group_id === page.revision_group_id)
      if (idx === -1) {
        pool.unshift(page)
        brandNew.push(page)
      } else {
        // 同一页面出现了新版本：就地替换那张卡片，不整池重排
        pool[idx] = { ...page }
        updatedGroups.push(page.revision_group_id)
      }
    }

    const topic = MOCK_TOPICS.find((t) => t.topic_id === record.task.topic_id)
    if (topic) topic.page_count = MOCK_MASTER_BY_TOPIC.get(topic.topic_id)?.length ?? topic.page_count

    record.task.new_pages = brandNew
    record.task.updated_groups = updatedGroups
    // 让 React Query 侧能拿到稳定引用
    uploads.set(uploadId, { ...record, task: { ...record.task } })
  }

  return { ...uploads.get(uploadId)!.task }
}

/* ---------------------------------------------------------------- 导出 */

interface ExportRecord {
  task: ExportTask
  startedAt: number
  pageIds: string[]
  topicId: string
  materialized: boolean
}

const exportTasks = new Map<string, ExportRecord>()
let exportSeq = 0

export interface ExportReceipt {
  export_id: string
}

export async function exportPpt(pageIds: string[], topicId: string): Promise<ExportReceipt> {
  if (!USE_MOCK) {
    return http<ExportReceipt>('/ppt/export', {
      method: 'POST',
      body: JSON.stringify({ page_ids: pageIds, topic_id: topicId }),
    })
  }

  await wait(200)
  exportSeq += 1
  const exportId = `ex${String(exportSeq).padStart(4, '0')}`
  exportTasks.set(exportId, {
    task: { export_id: exportId, status: 'processing', page_count: pageIds.length },
    startedAt: Date.now(),
    pageIds,
    topicId,
    materialized: false,
  })
  return { export_id: exportId }
}

export async function getExportStatus(exportId: string): Promise<ExportTask> {
  if (!USE_MOCK) return http<ExportTask>(`/ppt/exports/${exportId}`)
  await wait(90)

  const record = exportTasks.get(exportId)
  if (!record) throw new Error('导出记录不存在或已过期')

  const elapsed = Date.now() - record.startedAt
  const done = elapsed > 900 + record.pageIds.length * 90

  if (done && !record.materialized) {
    record.materialized = true
    record.task.status = 'completed'
    record.task.download_url = buildMockDownload(record.pageIds, record.topicId)
  } else if (!done) {
    record.task.status = 'processing'
  }

  return { ...record.task }
}

export async function listUploads(): Promise<UploadRecord[]> {
  if (!USE_MOCK) return http<UploadRecord[]>('/uploads')
  return Array.from(uploads.values()).map(({ task, startedAt }) => ({
    upload_id: task.upload_id,
    file_name: task.file_name,
    topic_id: task.topic_id,
    topic_name: MOCK_TOPICS.find((topic) => topic.topic_id === task.topic_id)?.name ?? null,
    status: task.status,
    total_pages: task.total_pages,
    processed_pages: task.processed_pages,
    new_pages_count: task.new_pages.length,
    updated_groups_count: task.updated_groups.length,
    error: task.error ?? null,
    created_at: new Date(startedAt).toISOString(),
  })).sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function listExports(): Promise<ExportTask[]> {
  if (!USE_MOCK) return http<ExportTask[]>('/ppt/exports')
  return Array.from(exportTasks.values()).map((record) => ({ ...record.task }))
}

/**
 * 演示环境没有真的 PPT 渲染服务，这里生成一份「页面清单」文本文件。
 * 接后端后 download_url 会直接指向 .pptx，前端下载逻辑不变。
 */
function buildMockDownload(pageIds: string[], topicId: string): string {
  const topicName = MOCK_TOPICS.find((t) => t.topic_id === topicId)?.name ?? topicId
  const lines = pageIds.map((pid, i) => {
    const found = findPageById(pid)
    return `${String(i + 1).padStart(2, '0')}. ${found?.title ?? pid}  (${found?.source_file_name ?? '-'} 第 ${found?.source_page_no ?? '-'} 页, V${found?.revision_no ?? '-'})`
  })
  const content = [
    `希迪PPT智能版本管理 组合导出清单`,
    `主题：${topicName}`,
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
    `页面数：${pageIds.length}`,
    ``,
    `说明：演示环境生成的是清单文件；接入后端后此处为 .pptx 下载链接。`,
    ``,
    ...lines,
  ].join('\n')

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  return URL.createObjectURL(blob)
}

function findPageById(pageId: string): MasterPage | undefined {
  for (const detail of MOCK_GROUPS.values()) {
    const version = detail.versions.find((v) => v.page_id === pageId)
    if (!version) continue
    return {
      page_id: version.page_id,
      revision_group_id: detail.revision_group_id,
      revision_no: version.revision_no,
      revision_count: detail.versions.length,
      title: detail.title,
      image_url: version.image_url,
      source_file_name: version.source_file_name,
      source_page_no: version.source_page_no,
      created_at: version.created_at,
    }
  }
  return undefined
}

export { findPageById }
