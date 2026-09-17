# PPT 页面级版本管理 · 后端接口契约

> 状态：前端已按本文档完成开发（当前跑在 mock 上）。
> 切换方式：`src/lib/api.ts` 中 `USE_MOCK = false`，并在 `vite.config.ts` 打开 `/api` 代理，前端组件层零改动。
> 前端 API 层唯一入口：`src/lib/api.ts`——本文档与之一一对应，有分歧以联调时修订本文档为准。

---

## 1. 通用约定

| 项 | 约定 |
|---|---|
| Base path | `/api`（开发环境经 Vite 代理转发） |
| 数据格式 | JSON，字段一律 `snake_case` |
| 时间字段 | ISO 8601 字符串，建议带时区，如 `2026-09-25T07:00:00+08:00`；前端用 `new Date()` 解析 |
| `image_url` | 可直接用于 `<img src>` 的同源路径或 CDN 绝对地址。前端会对版本图做**长期缓存与预加载**，建议响应头给长缓存（内容不变 URL 不变） |
| 错误响应 | 非 2xx 状态码 + body `{ "message": "人话错误信息" }`；前端目前以状态码判失败，`message` 留作展示扩展 |
| ID | 不透明字符串（`topic_id` / `page_id` / `revision_group_id` / `upload_id` / `export_id`），前端不做解析 |
| 删除语义 | 资源不存在或已删除返回 404；并发冲突（如删除已不存在的版本）建议 409 |

### 1.1 两个核心领域概念（务必先读）

**revision_group（版本组）**：同一张逻辑页面的所有版本归为一组。组内 `revision_no` 为**从 1 开始的连续整数、不允许空号**；版本按时间升序排列时第 i 个版本的 `revision_no = i`。任何删除操作后由**后端**负责重新顺排。

**页面池（master pages）**：一个主题下的页面池 = 该主题下所有版本组、**每组只取最新版**构成的卡片列表。一张卡片 = 一个组的最新版，`revision_no` 为当前最新号、`revision_count` 为组内版本总数。**不同版本不允许作为多条记录返回**。

---

## 2. 接口清单

### 2.1 `GET /topics` — 主题列表

响应：`Topic[]`

```json
[
  { "topic_id": "t-perception", "name": "感知算法", "page_count": 30 }
]
```

- `page_count` = 该主题下版本组数量（即页面池卡片数），需实时准确（上传 / 删除后会变）。

### 2.2 `POST /topics` — 新建主题

请求：`{ "name": "新主题" }`（trim 后非空，否则 400）
响应：`Topic`（含后端生成的 `topic_id`，`page_count` 为 0）

### 2.3 `PATCH /topics/{topic_id}` — 重命名主题

请求：`{ "name": "改名后" }`
响应：更新后的 `Topic`

### 2.4 `DELETE /topics/{topic_id}` — 删除主题

响应：204 无 body。

**级联契约**：主题下的页面池、全部版本组与版本一并删除。前端会同步清理本地缓存与导出勾选，后端无需额外通知。

### 2.5 `GET /topics/{topic_id}/master-pages` — 页面池

响应：

```json
{
  "total": 2,
  "pages": [
    {
      "page_id": "p0089",
      "revision_group_id": "g0036",
      "revision_no": 3,
      "revision_count": 3,
      "title": "感知周会进展 W36",
      "image_url": "/files/pages/p0089.png",
      "source_file_name": "感知算法周报_W37.pptx",
      "source_page_no": 28,
      "created_at": "2026-10-17T06:00:00+08:00"
    }
  ]
}
```

- **每组一条、只给最新版**（见 1.1）。
- 第一版契约为**全量返回**：前端做客户端虚拟化滚动，千级卡片无压力；排序 / 筛选 / 搜索均在前端完成。若后端后续要分页，属于契约变更，需另行评审。
- `created_at` 取该**最新版**的创建时间（前端默认排序依据）。

### 2.6 `GET /revision-groups/{revision_group_id}` — 版本历史

响应：

```json
{
  "revision_group_id": "g0036",
  "title": "感知周会进展 W36",
  "versions": [
    {
      "page_id": "p0021",
      "revision_no": 1,
      "image_url": "/files/pages/p0021.png",
      "source_file_name": "感知算法周报_W34.pptx",
      "source_page_no": 28,
      "created_at": "2026-08-13T09:00:00+08:00",
      "change_note": null
    },
    {
      "page_id": "p0089",
      "revision_no": 3,
      "image_url": "/files/pages/p0089.png",
      "source_file_name": "感知算法周报_W37.pptx",
      "source_page_no": 28,
      "created_at": "2026-10-17T06:00:00+08:00",
      "change_note": "补充了对比实验"
    }
  ]
}
```

- `versions` **按时间升序**（V1 在前）；`revision_no` 连续无空号。
- `change_note` 可选，描述这一版相对上一版改了什么。
- 前端对该响应做**长期缓存**（打开一次后切版本不再请求），请保证同一 `page_id` 的内容不可变。

### 2.7 `DELETE /revision-groups/{revision_group_id}/versions/{page_id}` — 删除某个版本

响应：

```json
{
  "detail": {
    "revision_group_id": "g0036",
    "title": "感知周会进展 W36",
    "versions": [ "…顺排后的剩余版本，结构同 2.6…" ]
  },
  "topic_id": "t-perception"
}
```

**顺排契约（重点）**：

1. 删除后剩余版本由后端重排为 `1..n`，连续无空号；响应 `detail` 返回**顺排后**的完整版本列表。
2. 页面池中该组卡片此后应指向新的最新版（前端据 `detail` 自行 patch，无需后端额外接口）。
3. 若被删的是**最后一个版本**：整个版本组移除，响应为

   ```json
   { "detail": null, "topic_id": "t-perception" }
   ```

   此后 `GET /topics/{topic_id}/master-pages` 不再包含该组卡片。
4. `topic_id` 必返：前端用它定位需要 patch 的页面池缓存。

### 2.8 `POST /ppt/upload` — 上传 PPT（异步）

请求：`multipart/form-data`，字段 `file`（.ppt / .pptx）、`topic_id`
响应：`{ "upload_id": "up0001" }`

- 接收后立即返回，解析在后台进行；前端以 500ms 间隔轮询 2.9。
- 建议：文件大小 / 类型不合法在**本接口**直接 400，不要等到轮询里 failed。

### 2.9 `GET /uploads/{upload_id}` — 上传进度

响应：

```json
{
  "upload_id": "up0001",
  "file_name": "感知算法周报_W38.pptx",
  "topic_id": "t-perception",
  "status": "processing",
  "total_pages": 26,
  "processed_pages": 14,
  "new_pages": [],
  "updated_groups": [],
  "error": null
}
```

- `status`：`pending`（排队）→ `processing` → `completed` / `failed`。
- **仅当 `completed` 时**返回增量结果，且此后保持不变：
  - `new_pages: MasterPage[]`——本次新发现的页面（全新版本组），元素结构同 2.5 的卡片；
  - `updated_groups: string[]`——「已有页面出现了新版本」的版本组 id 列表。
- 前端拿 `new_pages` 直接插卡片、拿 `updated_groups` 逐组补拉 2.6 后就地替换卡片，**不会重拉整个页面池**。
- `failed` 时 `error` 给人话原因。

> **优化建议（待确认）**：`updated_groups` 目前只给 id，前端要对每个 id 调一次 2.6。若后端能在 `completed` 响应里直接带上这些组的最新版卡片（如增补 `updated_pages: MasterPage[]`），可省掉这轮请求；前端只需改 `useQueries.ts` 的 `applyUploadResult` 一个函数。

### 2.10 `POST /ppt/export` — 导出组合 PPT（异步）

请求：

```json
{ "page_ids": ["p0089", "p0021"], "topic_id": "t-perception" }
```

响应：`{ "export_id": "ex0001" }`

- **`page_ids` 的顺序即最终 PPT 的页序**，后端不得重排。
- 前端已保证同一版本组在列表中至多出现一个 `page_id`（一页只入一版）；后端无需去重，但应对不存在的 `page_id` 返回 400。

### 2.11 `GET /ppt/exports/{export_id}` — 导出进度

响应：

```json
{
  "export_id": "ex0001",
  "status": "completed",
  "page_count": 2,
  "download_url": "https://cdn.example.com/exports/ex0001.pptx",
  "error": null
}
```

- `status`：`processing` → `completed` / `failed`；前端以 450ms 间隔轮询。
- `completed` 时 `download_url` 必返，指向可直接下载的 .pptx。**请说明链接有效期**（前端拿到即展示下载按钮，不做二次校验）。

---

## 3. 数据模型（与前端 `src/types.ts` 一致）

```ts
interface Topic {
  topic_id: string
  name: string
  page_count: number          // 版本组数量 = 页面池卡片数
}

interface MasterPage {        // 页面池卡片 = 某版本组的最新版
  page_id: string
  revision_group_id: string
  revision_no: number         // 当前最新号
  revision_count: number      // 组内版本总数
  title: string
  image_url: string
  source_file_name: string
  source_page_no: number
  created_at: string          // 最新版的创建时间
}

interface RevisionVersion {   // 版本组内的某一版
  page_id: string
  revision_no: number         // 1..n 连续
  image_url: string
  source_file_name: string
  source_page_no: number
  created_at: string
  change_note?: string | null
}

interface RevisionGroupDetail {
  revision_group_id: string
  title: string
  versions: RevisionVersion[] // 时间升序
}

interface UploadTask {
  upload_id: string
  file_name: string
  topic_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  total_pages: number
  processed_pages: number
  new_pages: MasterPage[]     // 仅 completed 时有值
  updated_groups: string[]    // 仅 completed 时有值
  error?: string | null
}

interface ExportTask {
  export_id: string
  status: 'processing' | 'completed' | 'failed'
  page_count: number
  download_url?: string       // completed 时必返
  error?: string | null
}

// DELETE 版本接口的响应
interface DeleteRevisionResult {
  detail: RevisionGroupDetail | null  // null = 最后一个版本被删，整组移除
  topic_id: string
}
```

---

## 4. 前端缓存策略 → 对后端的要求

前端使用 React Query，以下两点决定了后端的行为边界：

1. **页面池与版本历史 `staleTime: Infinity`**：不轮询、不聚焦重拉。所有数据变化必须通过**写接口的返回值**或**上传增量字段**传达（本文档各写接口均返回更新后的实体，即为此设计）。后端不要依赖「前端过会儿会自己重拉」来收敛状态。
2. **增量更新**：上传完成不重拉页面池；删除版本不重拉页面池；主题增删改不重拉列表。后端返回的实体将被前端**就地 patch 进缓存**，因此返回体必须是完整、可直接渲染的实体（不要返回 diff 或部分字段）。

其余行为边界：

- 轮询频率：上传 500ms、导出 450ms，任务终态后停止。若后端希望降载，后续可换 SSE / WebSocket，属契约扩展。
- 同一 `page_id` 的图片内容不可变（前端长缓存 + 预加载）；版本更新必须产生新 `page_id`。

---

## 5. 待确认问题清单

| # | 问题 | 前端现状 |
|---|---|---|
| 1 | `updated_groups` 能否直接携带最新版卡片数据（`updated_pages`） | 前端逐组补拉 `GET /revision-groups/{id}`，可接受但多一轮请求 |
| 2 | 错误 body 是否统一 `{ message }` | 前端暂只读状态码 |
| 3 | `download_url` 有效期与鉴权方式 | 拿到即展示下载按钮 |
| 4 | 上传大小上限、是否接受 .ppt（老格式） | 前端仅校验扩展名 .ppt / .pptx |
| 5 | 时间是否统一带时区 | 前端 `new Date()` 解析，无时区按本地时间处理 |
| 6 | 是否需要主题级权限 / 协作 | 本版不含，预留拦截位 |
| 7 | 页面池是否需要服务端分页 | 当前契约全量返回，前端虚拟化支撑千级 |

---

## 6. 联调检查清单（后端自测用）

- [ ] `master-pages` 每个 `revision_group_id` 只出现一次，且 `revision_no` = 该组最大号、`revision_count` = 组内版本数
- [ ] `revision-groups` 的 `versions` 升序且 `revision_no` 连续无空号
- [ ] 删除中间版本后，剩余版本顺排正确，且 `master-pages` 中该组卡片指向新最新版
- [ ] 删除最后一个版本后，`detail = null`，且 `master-pages` 不再含该组
- [ ] 上传 `completed` 响应中 `new_pages` 与 `updated_groups` 不重叠（一个组要么全新、要么更新）
- [ ] 导出 PPT 的页序与请求 `page_ids` 顺序一致
- [ ] 删除主题后，其下 `master-pages` / `revision-groups` 均 404
