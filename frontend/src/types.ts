/**
 * 领域模型。字段命名与后端接口保持一致，接真实 API 时无需改动组件层。
 */

export interface Topic {
  topic_id: string
  name: string
  /** 该 Topic 下的 revision_group 数量（页面池只展示每组最新版） */
  page_count: number
}

/** 页面池中的一张卡片 = 某个 revision_group 的最新版本 */
export interface MasterPage {
  page_id: string
  revision_group_id: string
  revision_no: number
  /** 该组一共有多少个版本，用于卡片上的版本入口提示 */
  revision_count: number
  title: string
  image_url: string
  source_file_name: string
  source_page_no: number
  created_at: string
}

/** 同一 revision_group 下的某一版 */
export interface RevisionVersion {
  page_id: string
  revision_no: number
  image_url: string
  source_file_name: string
  source_page_no: number
  created_at: string
  /** 这一版相对上一版改了什么，后端可由文本 diff 生成 */
  change_note?: string
}

export interface RevisionGroupDetail {
  revision_group_id: string
  title: string
  versions: RevisionVersion[]
}

export type UploadStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface UploadTask {
  upload_id: string
  file_name: string
  topic_id: string
  status: UploadStatus
  total_pages: number
  processed_pages: number
  /** completed 时返回，前端据此做增量更新，不整池重拉 */
  new_pages: MasterPage[]
  updated_groups: string[]
  error?: string
}

export type ExportStatus = 'processing' | 'completed' | 'failed'

export interface ExportTask {
  export_id: string
  status: ExportStatus
  page_count: number
  download_url?: string
  error?: string
  created_at?: string
  expires_at?: string
}

export interface UploadRecord {
  upload_id: string
  file_name: string
  topic_id: string
  topic_name: string | null
  status: UploadStatus
  total_pages: number
  processed_pages: number
  new_pages_count: number
  updated_groups_count: number
  error: string | null
  created_at: string
}

export type SortKey = 'updated_desc' | 'updated_asc' | 'title_asc' | 'revision_desc'

export interface PoolFilters {
  keyword: string
  source: string | 'all'
  sort: SortKey
}
