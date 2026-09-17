import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * 项目自定义了 micro / caption / body 三档字号。
 * 不登记给 tailwind-merge 的话，它会把 text-caption 误判成文字颜色，
 * 进而在同一次 cn() 里把 text-white 这类真颜色当冲突删掉
 * （表现为主按钮黑底黑字、完全看不见）。
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['micro', 'caption', 'body'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** 后端返回 "2026-09-15T10:00:00"，浏览器按本地时间解析 */
function toDate(iso: string) {
  return new Date(iso)
}

export function formatDateTime(iso: string) {
  const d = toDate(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function formatDate(iso: string) {
  const d = toDate(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/**
 * 相对时间。列表里用它扫得快，详情里给绝对时间。
 */
export function formatRelative(iso: string, now = Date.now()) {
  const d = toDate(iso)
  if (Number.isNaN(d.getTime())) return iso
  const diff = now - d.getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 2 * day) return '昨天'
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`
  return formatDate(iso)
}

export function formatClock(ts: number) {
  const d = new Date(ts)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

export function stampName(prefix: string) {
  const d = new Date()
  return `${prefix}_${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
}

const preloaded = new Set<string>()

/**
 * 预加载图片。切换历史版本时不应该等网络，
 * 所以版本列表一拿到就把所有 image_url 预热一遍。
 */
export function preloadImages(urls: string[]) {
  for (const url of urls) {
    if (!url || preloaded.has(url)) continue
    preloaded.add(url)
    const img = new Image()
    img.decoding = 'async'
    img.src = url
  }
}

/** 拖动排序：把 from 位置的元素插到 to 位置 */
export function reorder<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice()
  const [moved] = next.splice(from, 1)
  if (moved === undefined) return list
  next.splice(to, 0, moved)
  return next
}
