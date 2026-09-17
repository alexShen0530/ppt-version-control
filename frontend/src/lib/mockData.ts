/**
 * Mock 数据源。
 *
 * 这里刻意做成「离线自洽」：页面截图由 mockSlide 用内联 SVG 现画，
 * 不依赖任何外链图片，npm run dev 之后立刻是真实观感。
 *
 * 数据规模刻意做到 100+ 个 revision_group / 200+ 个 page，
 * 用来验证页面池的虚拟滚动与版本缓存是否真的流畅。
 */

import { makeSlideUrl, type SlideLayout } from './mockSlide'
import type { MasterPage, RevisionGroupDetail, RevisionVersion, Topic } from '@/types'

/* ------------------------------------------------------------------ 主题 */

interface Deck {
  topic_id: string
  name: string
  /** 该套 slide 自己的品牌色。内容可以有颜色，界面外壳只有一种强调色。 */
  accent: string
  sources: string[]
  slides: SlideSeed[]
}

interface SlideSeed {
  title: string
  subtitle: string
  layout: SlideLayout
}

/** 周期性页面：这类工具用久了，页面池里自然会沉淀大量同系列页面 */
function weekly(prefix: string, from: number, to: number, layouts: SlideLayout[], subtitle: (w: number) => string): SlideSeed[] {
  const out: SlideSeed[] = []
  for (let w = from; w <= to; w++) {
    out.push({
      title: `${prefix} W${w}`,
      subtitle: subtitle(w),
      layout: layouts[w % layouts.length]!,
    })
  }
  return out
}

function monthly(prefix: string, months: number[], layout: SlideLayout): SlideSeed[] {
  return months.map((m) => ({
    title: `${prefix} ${m} 月`,
    subtitle: `2026 年 ${m} 月经营数据`,
    layout,
  }))
}

const DECKS: Deck[] = [
  {
    topic_id: 't-funding',
    name: '融资材料',
    accent: '#2D46B9',
    sources: ['星驰智能_A轮路演_0612.pptx', '星驰智能_A轮路演_0730.pptx', '星驰智能_A轮路演_0908.pptx'],
    slides: [
      { title: '星驰智能 A 轮融资', subtitle: '2026 年 9 月 · 机密', layout: 'cover' },
      { title: '关键业务指标', subtitle: '截至 2026 年 8 月', layout: 'kpi' },
      { title: '近三年营收增长', subtitle: '单位：人民币百万元', layout: 'bars' },
      { title: '技术壁垒总览', subtitle: '数据、算法与工程三层护城河', layout: 'stack' },
      { title: '市场规模与机会', subtitle: 'L2+ 乘用车前装市场', layout: 'text' },
      { title: '竞品对比矩阵', subtitle: '按量产能力与成本维度', layout: 'table' },
      { title: '发展里程碑', subtitle: '2021 至 2026', layout: 'timeline' },
      { title: '本轮资金使用规划', subtitle: '总额 3.2 亿元', layout: 'bars' },
      { title: '核心团队', subtitle: '研发占比 71%', layout: 'text' },
      { title: '产品路线图', subtitle: '三代平台演进', layout: 'stack' },
      { title: '单位经济模型', subtitle: '单车毛利测算', layout: 'kpi' },
      { title: '已量产客户清单', subtitle: '含定点未量产项目', layout: 'table' },
      { title: '附录：三年财务预测', subtitle: '基准情形', layout: 'cover' },
    ],
  },
  {
    topic_id: 't-perception',
    name: '感知算法',
    accent: '#0F6E63',
    sources: [
      '感知算法周报_W34.pptx',
      '感知算法周报_W36.pptx',
      '感知算法周报_W37.pptx',
      '感知算法周报_W38.pptx',
    ],
    slides: [
      { title: '感知系统总体架构', subtitle: '前融合方案 V2', layout: 'stack' },
      { title: '多传感器时间同步', subtitle: '硬同步与软补偿', layout: 'stack' },
      { title: 'BEV 特征提取网络', subtitle: '主干与颈部结构', layout: 'stack' },
      { title: '目标检测精度评测', subtitle: 'nuScenes 与内部集', layout: 'table' },
      { title: '夜间场景召回率', subtitle: '按光照分桶', layout: 'bars' },
      { title: '误检来源分布', subtitle: 'Top 6 类别', layout: 'bars' },
      { title: '关键指标看板', subtitle: 'mAP / NDS / 时延', layout: 'kpi' },
      { title: '数据闭环流程', subtitle: '挖掘到回流', layout: 'timeline' },
      { title: '长尾场景挖掘策略', subtitle: '主动学习采样', layout: 'text' },
      { title: '模型量化与部署', subtitle: 'INT8 精度损失', layout: 'table' },
      { title: '车道线拓扑推理', subtitle: '分叉与合流处理', layout: 'stack' },
      { title: '占用网络评测', subtitle: 'IoU 与召回', layout: 'bars' },
      { title: '本周问题与结论', subtitle: '需要决策的三项', layout: 'text' },
      ...weekly('感知周会进展', 22, 38, ['bars', 'table', 'kpi', 'text'], (w) => `第 ${w} 周 · 感知一组`),
    ],
  },
  {
    topic_id: 't-driving',
    name: '自动驾驶',
    accent: '#1F4E79',
    sources: ['自动驾驶路测月报_07.pptx', '自动驾驶路测月报_08.pptx', '自动驾驶路测月报_09.pptx'],
    slides: [
      { title: '自动驾驶路测总览', subtitle: '2026 年累计里程', layout: 'cover' },
      { title: '接管率趋势', subtitle: '按城市与路段类型', layout: 'bars' },
      { title: '规划决策模块架构', subtitle: '分层设计', layout: 'stack' },
      { title: '典型接管场景归类', subtitle: 'Top 8', layout: 'table' },
      { title: '安全指标看板', subtitle: 'MPI 与严重事件', layout: 'kpi' },
      { title: '仿真测试覆盖度', subtitle: '场景库规模', layout: 'bars' },
      { title: '高精地图更新节奏', subtitle: '城市级刷新', layout: 'timeline' },
      { title: '车辆平台适配进度', subtitle: '三款车型', layout: 'table' },
      { title: '极端天气应对策略', subtitle: '雨雪雾', layout: 'text' },
      { title: '远程协助介入流程', subtitle: '人机职责边界', layout: 'stack' },
      { title: '法规与准入进展', subtitle: '试点城市清单', layout: 'text' },
      ...weekly('路测里程周报', 26, 38, ['bars', 'kpi', 'table'], (w) => `第 ${w} 周 · 路测车队`),
    ],
  },
  {
    topic_id: 't-finance',
    name: '财务汇报',
    accent: '#8C3A2B',
    sources: ['财务经营分析_2026H1.pptx', '财务经营分析_2026Q3.pptx'],
    slides: [
      { title: '2026 年经营概览', subtitle: '集团口径', layout: 'cover' },
      { title: '收入与毛利结构', subtitle: '按业务线拆分', layout: 'bars' },
      { title: '费用率变化', subtitle: '研发 / 销售 / 管理', layout: 'bars' },
      { title: '现金流状况', subtitle: '经营与投资活动', layout: 'kpi' },
      { title: '预算执行进度', subtitle: '按部门', layout: 'table' },
      { title: '应收账款账龄', subtitle: '风险敞口', layout: 'table' },
      { title: '成本优化举措', subtitle: '已落地与规划中', layout: 'text' },
      { title: '季度结账时间表', subtitle: '关键节点', layout: 'timeline' },
      ...monthly('月度经营分析', [3, 4, 5, 6, 7, 8], 'kpi'),
    ],
  },
]

/* --------------------------------------------------------- 确定性随机 */

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CHANGE_NOTES = [
  '替换为最新一期数据',
  '更新了统计口径',
  '重画了架构示意图',
  '精简为三条要点',
  '补充了对比实验',
  '修正单位与错别字',
  '调整版式与配色',
  '合并了重复段落',
  '按评审意见改写结论',
]

/* 基准时间：2026-09-15 10:00 */
const BASE_TS = Date.UTC(2026, 8, 15, 10, 0, 0)
const DAY = 86_400_000

function isoDaysBefore(days: number, hourOffset = 0): string {
  const d = new Date(BASE_TS - days * DAY + hourOffset * 3_600_000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:00`
}

/* ------------------------------------------------------------ 构建数据 */

const masterByTopic = new Map<string, MasterPage[]>()
const groupIndex = new Map<string, RevisionGroupDetail>()
const groupTopic = new Map<string, string>()
const topics: Topic[] = []

let pageSeq = 0
const pad = (n: number, len = 3) => String(n).padStart(len, '0')

for (const deck of DECKS) {
  const masters: MasterPage[] = []

  deck.slides.forEach((slide, slideIdx) => {
    const groupId = `${deck.topic_id}-g${pad(slideIdx + 1)}`
    const rand = rng(hashStr(groupId))

    // 版本数：大部分 1~2 版，少数 3~4 版，符合真实沉淀规律
    const roll = rand()
    const revisionCount = roll < 0.34 ? 1 : roll < 0.66 ? 2 : roll < 0.9 ? 3 : 4

    const versions: RevisionVersion[] = []
    let daysAgo = Math.floor(rand() * 6) + (revisionCount - 1) * 14

    for (let rev = 1; rev <= revisionCount; rev++) {
      pageSeq += 1
      const pageId = `p${pad(pageSeq, 4)}`
      // 越新的版本越可能来自越新的上传文件
      const sourceIdx = Math.min(rev - 1 + Math.floor(rand() * 1.4), deck.sources.length - 1)
      const sourceFile = deck.sources[sourceIdx]!
      const sourcePageNo = slideIdx + 1 + (rev > 1 && rand() > 0.7 ? 1 : 0)
      const createdAt = isoDaysBefore(daysAgo, -Math.floor(rand() * 8))

      versions.push({
        page_id: pageId,
        revision_no: rev,
        image_url: makeSlideUrl({
          layout: slide.layout,
          title: slide.title,
          subtitle: slide.subtitle,
          accent: deck.accent,
          seed: slideIdx + 1,
          revision: rev,
          sourceLabel: sourceFile.replace(/\.pptx$/, ''),
          pageNo: sourcePageNo,
        }),
        source_file_name: sourceFile,
        source_page_no: sourcePageNo,
        created_at: createdAt,
        change_note: rev === 1 ? undefined : CHANGE_NOTES[Math.floor(rand() * CHANGE_NOTES.length)],
      })

      daysAgo -= 12 + Math.floor(rand() * 26)
    }

    groupIndex.set(groupId, {
      revision_group_id: groupId,
      title: slide.title,
      versions,
    })
    groupTopic.set(groupId, deck.topic_id)

    const latest = versions[versions.length - 1]!
    masters.push({
      page_id: latest.page_id,
      revision_group_id: groupId,
      revision_no: latest.revision_no,
      revision_count: revisionCount,
      title: slide.title,
      image_url: latest.image_url,
      source_file_name: latest.source_file_name,
      source_page_no: latest.source_page_no,
      created_at: latest.created_at,
    })
  })

  masterByTopic.set(deck.topic_id, masters)
  topics.push({ topic_id: deck.topic_id, name: deck.name, page_count: masters.length })
}

export const MOCK_TOPICS: Topic[] = topics
export const MOCK_MASTER_BY_TOPIC = masterByTopic
export const MOCK_GROUPS = groupIndex
export const MOCK_GROUP_TOPIC = groupTopic

/**
 * 上传解析完成后「新发现」的页面。
 * 同时把对应的 revision_group 注册进索引，这样新卡片点开也能看到版本轨道。
 */
export function makeUploadedPages(topicId: string, fileName: string, count: number): MasterPage[] {
  const deck = DECKS.find((d) => d.topic_id === topicId) ?? DECKS[0]!
  const base = Date.now()
  const created: MasterPage[] = []
  const layouts: SlideLayout[] = ['bars', 'table', 'kpi', 'text', 'stack']

  for (let i = 0; i < count; i++) {
    const groupId = `${topicId}-u${pad(base % 100000)}${pad(i)}`
    const rand = rng(hashStr(groupId + fileName))
    const layout = layouts[i % layouts.length]!
    const title = `${fileName.replace(/\.pptx$/, '')} 第 ${i + 1} 页`
    const sourceLabel = fileName.replace(/\.pptx$/, '')

    // 上传的这份文件里，有 1/3 的页面系统判定为「已有页面的新版本」
    const isExisting = rand() > 0.66
    const knownGroup = isExisting ? pickExistingGroup(topicId, rand) : null
    const finalGroupId = knownGroup ?? groupId

    const existingVersions = knownGroup ? (groupIndex.get(knownGroup)?.versions.length ?? 0) : 0
    const revisionNo = existingVersions + 1

    pageSeq += 1
    const pageId = `p${pad(pageSeq, 4)}`
    const imageUrl = makeSlideUrl({
      layout,
      title: knownGroup ? (groupIndex.get(knownGroup)?.title ?? title) : title,
      subtitle: knownGroup ? '来自本次上传的新版本' : '本次上传新解析的页面',
      accent: deck.accent,
      seed: knownGroup ? hashStr(knownGroup) % 9973 : i + 101,
      revision: revisionNo,
      sourceLabel,
      pageNo: i + 1,
    })

    const version: RevisionVersion = {
      page_id: pageId,
      revision_no: revisionNo,
      image_url: imageUrl,
      source_file_name: fileName,
      source_page_no: i + 1,
      created_at: isoDaysBefore(0, -i),
      change_note: knownGroup ? CHANGE_NOTES[Math.floor(rand() * CHANGE_NOTES.length)] : undefined,
    }

    if (knownGroup) {
      const detail = groupIndex.get(knownGroup)!
      detail.versions = [...detail.versions, version]
    } else {
      groupIndex.set(finalGroupId, {
        revision_group_id: finalGroupId,
        title,
        versions: [version],
      })
      groupTopic.set(finalGroupId, topicId)
    }

    created.push({
      page_id: pageId,
      revision_group_id: finalGroupId,
      revision_no: revisionNo,
      revision_count: revisionNo,
      title: knownGroup ? (groupIndex.get(knownGroup)?.title ?? title) : title,
      image_url: imageUrl,
      source_file_name: fileName,
      source_page_no: i + 1,
      created_at: version.created_at,
    })
  }

  return created
}

function pickExistingGroup(topicId: string, rand: () => number): string | null {
  const pool = (masterByTopic.get(topicId) ?? []).filter((m) => {
    const detail = groupIndex.get(m.revision_group_id)
    return detail != null && detail.versions.length < 4
  })
  if (pool.length === 0) return null
  return pool[Math.floor(rand() * pool.length)]!.revision_group_id
}
