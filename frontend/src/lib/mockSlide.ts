/**
 * Mock 幻灯片截图生成器。
 *
 * 真实环境里 image_url 由后端渲染好的 PNG 提供（/files/page_101.png）。
 * 这里用代码画出 960×540 的内联 SVG 假页面，好处是：
 *   1. 完全离线，npm run dev 后立刻有真实观感，不是一堆灰色占位块；
 *   2. 同一 revision_group 的不同版本内容确实不一样，版本切换看得见差异；
 *   3. data URI 体积很小，100+ 张也不影响性能。
 */

export type SlideLayout = 'cover' | 'bars' | 'stack' | 'table' | 'kpi' | 'timeline' | 'text'

const W = 960
const H = 540

const INK = '#171A20'
const MUTE = '#6B7482'
const FAINT = '#A7AEB9'
const RULE = '#E5E8ED'
const BLOCK = '#D9DDE3'

const FONT = "'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif"

/** 确定性伪随机：同样的 seed 永远画出同一张图 */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 中日韩字符按 1 个宽度算，拉丁字符按 0.55 算 */
function units(s: string) {
  let n = 0
  for (const ch of s) n += /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(ch) ? 1 : 0.55
  return n
}

function wrap(text: string, maxUnits: number, maxLines = 2): string[] {
  const chars = Array.from(text)
  const lines: string[] = []
  let cur = ''
  for (const ch of chars) {
    if (units(cur + ch) > maxUnits && cur) {
      lines.push(cur)
      cur = ch
      if (lines.length === maxLines) break
    } else {
      cur += ch
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur)
  // 超出行数则截断并加省略号
  if (lines.length === maxLines && units(text) > maxUnits * maxLines) {
    const last = lines[maxLines - 1]
    lines[maxLines - 1] = Array.from(last).slice(0, Math.max(1, Array.from(last).length - 1)).join('') + '…'
  }
  return lines
}

function textEl(
  x: number,
  y: number,
  content: string,
  size: number,
  fill: string,
  weight = 400,
  anchor: 'start' | 'middle' | 'end' = 'start',
) {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(content)}</text>`
}

/** 用圆角短条代表正文文字：缩略图尺寸下比真文字更易读 */
function lineRect(x: number, y: number, w: number, h = 8, fill = BLOCK, r = 4) {
  return `<rect x="${x}" y="${y}" width="${Math.max(6, Math.round(w))}" height="${h}" rx="${r}" fill="${fill}"/>`
}

export interface SlideSpec {
  layout: SlideLayout
  title: string
  subtitle: string
  accent: string
  seed: number
  revision: number
  sourceLabel: string
  pageNo: number
}

export function makeSlideUrl(spec: SlideSpec): string {
  const svg = renderSlide(spec)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function renderSlide(spec: SlideSpec): string {
  const { layout, title, subtitle, accent, seed, revision, sourceLabel, pageNo } = spec
  const rand = mulberry32(seed * 977 + revision * 131)
  const isCover = layout === 'cover'

  let body = ''
  switch (layout) {
    case 'cover':
      body = drawCover(title, subtitle, accent)
      break
    case 'bars':
      body = drawBars(rand, accent)
      break
    case 'stack':
      body = drawStack(rand, accent)
      break
    case 'table':
      body = drawTable(rand, accent)
      break
    case 'kpi':
      body = drawKpi(rand, accent)
      break
    case 'timeline':
      body = drawTimeline(rand, accent)
      break
    default:
      body = drawText(rand, accent)
  }

  const head = isCover
    ? ''
    : `<g>
        ${drawTitle(title, accent)}
       </g>`

  const chrome = `<rect x="0" y="0" width="8" height="${H}" fill="${accent}"/>
    <rect x="0" y="${H - 1}" width="${W}" height="1" fill="${RULE}"/>
    ${textEl(72, H - 34, sourceLabel, 15, FAINT)}
    ${textEl(W - 72, H - 34, String(pageNo), 15, FAINT, 500, 'end')}`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#FFFFFF"/>
    ${chrome}
    ${head}
    ${body}
  </svg>`
}

function drawTitle(title: string, accent: string) {
  const lines = wrap(title, 24, 2)
  const top = lines.length > 1 ? 66 : 82
  return `${lines
    .map((l, i) => textEl(72, top + i * 40, l, 30, INK, 600))
    .join('')}
    <rect x="72" y="${top + lines.length * 40 - 18}" width="44" height="3" rx="1.5" fill="${accent}"/>`
}

function drawCover(title: string, subtitle: string, accent: string) {
  const lines = wrap(title, 15, 2)
  const blockHeight = lines.length * 66
  const y0 = 190 - (blockHeight - 66) / 2
  return `
    <rect x="72" y="${y0 - 46}" width="56" height="4" rx="2" fill="${accent}"/>
    ${lines.map((l, i) => textEl(72, y0 + i * 66, l, 52, INK, 700)).join('')}
    ${textEl(72, y0 + blockHeight + 26, subtitle, 21, MUTE)}
    <g opacity="0.9">
      <rect x="${W - 250}" y="${H - 170}" width="178" height="106" rx="6" fill="none" stroke="${RULE}" stroke-width="2"/>
      ${lineRect(W - 226, H - 138, 92, 9)}
      ${lineRect(W - 226, H - 116, 130, 9)}
      ${lineRect(W - 226, H - 94, 64, 9, accent)}
    </g>`
}

function drawBars(rand: () => number, accent: string) {
  const baseY = 424
  const left = 88
  const right = W - 88
  const count = 5 + Math.floor(rand() * 3)
  const gap = (right - left) / count
  const barW = Math.min(64, gap * 0.52)
  const values = Array.from({ length: count }, () => 0.28 + rand() * 0.72)
  const peak = values.indexOf(Math.max(...values))

  const grid = [0.25, 0.5, 0.75, 1]
    .map((g) => {
      const y = baseY - g * 250
      return `<rect x="${left - 12}" y="${y}" width="${right - left + 12}" height="1" fill="${RULE}"/>
              ${lineRect(left - 60, y - 4, 34, 7, '#EDEFF2')}`
    })
    .join('')

  const bars = values
    .map((v, i) => {
      const h = Math.round(v * 250)
      const x = left + i * gap + (gap - barW) / 2
      const isPeak = i === peak
      return `<rect x="${x}" y="${baseY - h}" width="${barW}" height="${h}" rx="3" fill="${isPeak ? accent : '#DDE1E7'}"/>
              ${lineRect(x + barW / 2 - 16, baseY + 18, 32, 7, isPeak ? accent : '#E7E9ED')}`
    })
    .join('')

  const legend = `<g>
      <rect x="${right - 168}" y="128" width="12" height="12" rx="2" fill="${accent}"/>
      ${lineRect(right - 148, 131, 56, 7)}
      <rect x="${right - 78}" y="128" width="12" height="12" rx="2" fill="#DDE1E7"/>
      ${lineRect(right - 58, 131, 56, 7)}
    </g>`

  return `${grid}<rect x="${left - 12}" y="${baseY}" width="${right - left + 12}" height="2" fill="#C9CED6"/>${bars}${legend}`
}

function drawStack(rand: () => number, accent: string) {
  const box = (x: number, y: number, w: number, h: number, labelW: number, fill: string, stroke: string) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
     ${lineRect(x + 18, y + h / 2 - 4, labelW, 8, stroke === accent ? accent : BLOCK)}`

  const midY = 210 + Math.floor(rand() * 14)
  const cols = 3
  const gap = 24
  const totalW = W - 176
  const colW = (totalW - gap * (cols - 1)) / cols
  const mid = Array.from({ length: cols }, (_, i) =>
    box(88 + i * (colW + gap), midY, colW, 86, colW * (0.4 + rand() * 0.3), '#FAFBFC', '#D3D8E0'),
  ).join('')

  const connectors = Array.from({ length: cols }, (_, i) => {
    const cx = 88 + i * (colW + gap) + colW / 2
    return `<rect x="${cx - 1}" y="${midY - 34}" width="2" height="34" fill="#DDE1E7"/>
            <rect x="${cx - 1}" y="${midY + 86}" width="2" height="34" fill="#DDE1E7"/>`
  }).join('')

  return `
    ${box(88 + totalW * 0.18, 152, totalW * 0.64, 46, totalW * 0.22, '#FFFFFF', '#D3D8E0')}
    ${connectors}
    ${mid}
    ${box(88 + totalW * 0.08, midY + 120, totalW * 0.84, 52, totalW * 0.2, accent, accent)}
    ${lineRect(88 + totalW * 0.08 + 18, midY + 120 + 22, totalW * 0.2, 8, '#FFFFFF')}`
}

function drawTable(rand: () => number, accent: string) {
  const left = 88
  const right = W - 88
  const top = 158
  const cols = [0.34, 0.2, 0.2, 0.26]
  const rowH = 46
  const rows = 5 + Math.floor(rand() * 2)
  const xs: number[] = []
  let acc = left
  for (const c of cols) {
    xs.push(acc)
    acc += (right - left) * c
  }

  const header = `<rect x="${left}" y="${top}" width="${right - left}" height="${rowH}" rx="5" fill="${accent}" opacity="0.08"/>
    ${cols
      .map((_c, i) => lineRect(xs[i] + 16, top + rowH / 2 - 4, (right - left) * cols[i] * 0.5, 8, accent))
      .join('')}`

  const body = Array.from({ length: rows }, (_, r) => {
    const y = top + rowH * (r + 1)
    return `<rect x="${left}" y="${y + rowH - 1}" width="${right - left}" height="1" fill="${RULE}"/>
      ${cols
        .map((c, i) => {
          const w = (right - left) * c * (i === cols.length - 1 ? 0.32 : 0.3 + rand() * 0.42)
          const fill = r === 0 && i === cols.length - 1 ? accent : BLOCK
          return lineRect(xs[i] + 16, y + rowH / 2 - 4, Math.min(w, (right - left) * c - 32), 8, fill)
        })
        .join('')}`
  }).join('')

  return `${header}${body}`
}

function drawKpi(rand: () => number, accent: string) {
  const left = 88
  const right = W - 88
  const cols = 3
  const colW = (right - left) / cols
  const items = Array.from({ length: cols }, () => ({
    value: Math.round(rand() * 880 + 40),
    unit: rand() > 0.5 ? '%' : 'M',
    delta: Math.round(rand() * 40 - 12),
  }))

  const dividers = Array.from({ length: cols - 1 }, (_, i) =>
    `<rect x="${left + colW * (i + 1)}" y="196" width="1" height="180" fill="${RULE}"/>`,
  ).join('')

  const cells = items
    .map((it, i) => {
      const x = left + colW * i + (i === 0 ? 0 : 34)
      const positive = it.delta >= 0
      return `
        ${textEl(x, 258, String(it.value), 66, INK, 700)}
        ${textEl(x + String(it.value).length * 40 + 6, 258, it.unit, 24, MUTE, 500)}
        ${lineRect(x, 288, colW * 0.42, 9)}
        <g>
          <path d="M ${x} ${338 + (positive ? 8 : 0)} l 7 ${positive ? -10 : 10} l 7 ${positive ? 10 : -10} z" fill="${positive ? accent : '#B4342A'}"/>
          ${textEl(x + 22, 340, `${positive ? '+' : ''}${it.delta}%`, 17, positive ? accent : '#B4342A', 600)}
        </g>`
    })
    .join('')

  return `<rect x="${left}" y="176" width="${right - left}" height="220" rx="8" fill="#FAFBFC" stroke="${RULE}"/>${dividers}${cells}`
}

function drawTimeline(rand: () => number, accent: string) {
  const left = 100
  const right = W - 100
  const y = 300
  const nodes = 5
  const step = (right - left) / (nodes - 1)
  const active = 1 + Math.floor(rand() * (nodes - 1))

  const rail = `<rect x="${left}" y="${y - 1}" width="${right - left}" height="2" fill="${RULE}"/>
    <rect x="${left}" y="${y - 1}" width="${step * active}" height="2" fill="${accent}"/>`

  const dots = Array.from({ length: nodes }, (_, i) => {
    const cx = left + step * i
    const done = i <= active
    const above = i % 2 === 0
    const ly = above ? y - 76 : y + 44
    return `
      <circle cx="${cx}" cy="${y}" r="${done ? 9 : 7}" fill="${done ? accent : '#FFFFFF'}" stroke="${done ? accent : '#C9CED6'}" stroke-width="2"/>
      ${lineRect(cx - 42, ly, 84, 9, done ? INK : BLOCK)}
      ${lineRect(cx - 28, ly + 20, 56, 7, '#E7E9ED')}`
  }).join('')

  return `${rail}${dots}`
}

function drawText(rand: () => number, accent: string) {
  const colW = 340
  const left = 88
  const top = 176
  const column = (x: number, n: number) =>
    Array.from({ length: n }, (_, i) => {
      const w = i === n - 1 ? colW * (0.4 + rand() * 0.3) : colW * (0.78 + rand() * 0.22)
      return lineRect(x, top + i * 34, w, 9)
    }).join('')

  const bullet = (x: number, n: number) =>
    Array.from({ length: n }, (_, i) => {
      const y = top + i * 62
      return `<rect x="${x}" y="${y + 2}" width="6" height="6" rx="3" fill="${accent}"/>
              ${lineRect(x + 22, y - 2, colW * (0.5 + rand() * 0.4), 9, '#C9CED6')}
              ${lineRect(x + 22, y + 20, colW * (0.7 + rand() * 0.3), 8)}`
    }).join('')

  return `${bullet(left, 4)}${column(left + colW + 108, 8)}`
}
