import type { Turn } from '../types'
import type { Heat } from './model'
import { heat } from './model'

// Pure SVG builders. The desktop draws an Svg as an isolated image without the theme's variables,
// so the colors are mid tones that read on light and dark themes. Text goes in Text elements, not the SVG.

export const COLORS: Record<Heat, string> = { calm: '#00C853', warn: '#FF9800', hot: '#FF3D00' }
export const TRACK = '#888780'
export const CHART = '#378ADD'

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))
const f = (n: number): string => n.toFixed(2)
// An interactive Svg is a framed document: without a color scheme it takes the light one and, on a dark theme, the
// frame is painted white behind it. Following the page's scheme keeps the frame transparent on both.
export const SCHEME = '<style>:root,svg{color-scheme:light dark}</style>'

const open = (width: number, height: number): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${SCHEME}`

// A level change moves the liquid, the arc and its head together: past the target by OVERSHOOT, then back, like a slosh.
const MOVE = 'keyTimes="0;0.72;1" calcMode="spline" keySplines="0.25 0.8 0.35 1;0.45 0 0.55 1" dur="1.5s" fill="freeze"'
const OVERSHOOT = 0.07

// The fuller the ring, the faster and higher its waves and the more bubbles rise (fewer on a band-sized ring).
type Motion = { front: number; back: number; amp: number; bubbles: number; climb: number }
const MOTION: Record<Heat, Motion> = {
  calm: { front: 2.6, back: 4, amp: 0.045, bubbles: 2, climb: 3.4 },
  warn: { front: 1.9, back: 3, amp: 0.06, bubbles: 3, climb: 2.6 },
  hot: { front: 1.25, back: 2.1, amp: 0.08, bubbles: 5, climb: 1.8 },
}

const level = (p: number, cy: number, inner: number): number => cy + inner - (2 * inner * p) / 100

// The color moved toward white (255) or black (0) by t.
const shade = (hex: string, t: number, to: 0 | 255): string => {
  const n = parseInt(hex.slice(1), 16)
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + (to - v) * t).toString(16).padStart(2, '0')).join('')}`
}

// Seven half waves from the left edge: shifted by ±w, the inner circle stays covered at every moment.
const crest = (x0: number, y: number, w: number, amp: number): string => {
  const half = f(w / 2)
  const rest = Array.from({ length: 6 }, () => ` t${half} 0`).join('')
  return `M${f(x0)} ${f(y)} q${f(w / 4)} ${f(-amp)} ${half} 0${rest}`
}
const wavePath = (x0: number, y: number, w: number, amp: number, bottom: number): string =>
  `${crest(x0, y, w, amp)} V${f(bottom)} H${f(x0)} Z`

const slide = (from: number, to: number, dur: number): string =>
  `<animateTransform attributeName="transform" type="translate" from="${f(from)} 0" to="${f(to)} 0" dur="${dur}s" repeatCount="indefinite"/>`

// Bubbles at fixed spots (the same source on every redraw), each rising from the bottom to just under the surface.
const bubbles = (count: number, h: number, inner: number, y: number, size: number, climb: number): string =>
  Array.from({ length: count }, (_, i) => {
    const x = h - inner * 0.55 + inner * 1.1 * ((i * 0.618 + 0.2) % 1)
    const r = size * (0.016 + 0.008 * (i % 3))
    const dur = climb + (i % 3) * 0.45
    const begin = `begin="${f((-i * dur) / count)}s" repeatCount="indefinite"`
    const y0 = h + inner - r - 1
    return (
      `<circle cx="${f(x)}" cy="${f(y0)}" r="${f(r)}" fill="#fff" opacity="0">` +
      `<animate attributeName="cy" values="${f(y0)};${f(y)}" dur="${f(dur)}s" ${begin}/>` +
      `<animate attributeName="opacity" values="0;0.7;0.7;0" keyTimes="0;0.15;0.8;1" dur="${f(dur)}s" ${begin}/>` +
      `<animate attributeName="cx" values="${f(x)};${f(x + r * 1.4)};${f(x - r * 1.4)};${f(x)}" dur="${f(dur * 0.6)}s" repeatCount="indefinite"/></circle>`
    )
  }).join('')

const liquid = (p: number, from: number | undefined, h: number, inner: number, size: number, color: string, m: Motion): string => {
  const w = 2 * inner
  const y = level(p, h, inner)
  const amp = Math.max(0.8, size * m.amp)
  const bottom = h + inner + 1
  const dy = from === undefined ? 0 : level(from, h, inner) - y
  const rise =
    Math.abs(dy) > 0.01
      ? `<animateTransform attributeName="transform" type="translate" values="0 ${f(dy)};0 ${f(-dy * OVERSHOOT)};0 0" ${MOVE}/>`
      : ''
  // Lighter at the surface, deeper at the bottom.
  const depth = `<linearGradient id="dep" gradientUnits="userSpaceOnUse" x1="0" y1="${f(y - amp)}" x2="0" y2="${f(bottom)}"><stop offset="0" stop-color="${shade(color, 0.4, 255)}"/><stop offset="0.45" stop-color="${color}"/><stop offset="1" stop-color="${shade(color, 0.35, 0)}"/></linearGradient>`
  const back = `<path d="${wavePath(h - inner - w / 2, y, w, amp * 0.8, bottom)}" fill="${color}" fill-opacity="0.3">${slide(-w, 0, m.back)}</path>`
  const front = `<path d="${wavePath(h - inner, y, w, amp, bottom)}" fill="url(#dep)" fill-opacity="0.92">${slide(0, -w, m.front)}</path>`
  const surface = `<path d="${crest(h - inner, y, w, amp)}" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="${f(Math.max(0.6, size * 0.014))}">${slide(0, -w, m.front)}</path>`
  const rising = p > 8 ? bubbles(size < 50 ? Math.ceil(m.bubbles * 0.6) : m.bubbles, h, inner, y + amp * 0.5, size, m.climb) : ''
  return `<defs><clipPath id="liq"><circle cx="${h}" cy="${h}" r="${f(inner)}"/></clipPath>${depth}</defs><g clip-path="url(#liq)"><g>${rise}${back}${front}${surface}${rising}</g></g>`
}

// A glass shine on the inner circle's upper left.
const glass = (h: number, inner: number, size: number): string => {
  const at = (deg: number): [string, string] => {
    const a = (deg * Math.PI) / 180
    return [f(h + inner * 0.74 * Math.cos(a)), f(h + inner * 0.74 * Math.sin(a))]
  }
  const [x1, y1] = at(200)
  const [x2, y2] = at(248)
  const [dx, dy] = at(265)
  return (
    `<path d="M${x1} ${y1} A${f(inner * 0.74)} ${f(inner * 0.74)} 0 0 1 ${x2} ${y2}" fill="none" stroke="#fff" stroke-opacity="0.3" stroke-width="${f(size * 0.04)}" stroke-linecap="round"/>` +
    `<circle cx="${dx}" cy="${dy}" r="${f(size * 0.022)}" fill="#fff" fill-opacity="0.3"/>`
  )
}

// Ring plus liquid: the outer arc shows the percentage, the inner circle fills with waving liquid to the same level.
// Given a different from, the level, the arc and its head slide from there once; draw it as an isInteractive Svg.
// Given an override, it replaces the heat color and the motion stays calm (for rings whose meaning is inverted, like
// the cache TTL ring).
export const liquidRing = (
  percent: number | undefined,
  size: number,
  stroke: number,
  from?: number,
  override?: string,
): string => {
  const h = size / 2
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const inner = r - stroke / 2 - (size < 30 ? 1 : 2)
  const p = percent === undefined ? 0 : clamp(percent, 0, 100)
  const start = from === undefined ? undefined : clamp(from, 0, 100)
  const mood: Heat = override === undefined ? heat(p) : 'calm'
  const color = override ?? COLORS[heat(p)]
  const base = `<circle cx="${h}" cy="${h}" r="${f(inner)}" fill="${TRACK}" fill-opacity="0.12"/>`
  const track = `<circle cx="${h}" cy="${h}" r="${f(r)}" fill="none" stroke="${TRACK}" stroke-opacity="0.3" stroke-width="${stroke}"/>`
  if (p === 0) return `${open(size, size)}${base}${glass(h, inner, size)}${track}</svg>`
  const moved = start !== undefined && Math.abs(start - p) > 0.01
  const past = start !== undefined && moved ? clamp(p + (p - start) * OVERSHOOT, 0, 100) : p
  const len = (q: number): string => `${f((c * q) / 100)} ${f(c)}`
  const turn = (q: number): string => `${f(3.6 * q)} ${h} ${h}`
  const sweep = start !== undefined && moved ? `<animate attributeName="stroke-dasharray" values="${len(start)};${len(past)};${len(p)}" ${MOVE}/>` : ''
  const arc = `<circle cx="${h}" cy="${h}" r="${f(r)}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${len(p)}" transform="rotate(-90 ${h} ${h})">${sweep}</circle>`
  // The arc's head: a white dot riding its end, with a pulse once the ring runs hot.
  const follow = start !== undefined && moved ? `<animateTransform attributeName="transform" type="rotate" values="${turn(start)};${turn(past)};${turn(p)}" ${MOVE}/>` : ''
  const pulse =
    mood === 'hot'
      ? `<circle cx="${f(h + r)}" cy="${h}" r="${f(stroke * 0.5)}" fill="${color}"><animate attributeName="r" values="${f(stroke * 0.5)};${f(stroke * 0.9)}" dur="1.3s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.7;0" dur="1.3s" repeatCount="indefinite"/></circle>`
      : ''
  const head = `<g transform="rotate(-90 ${h} ${h})"><g transform="rotate(${turn(p)})">${follow}${pulse}<circle cx="${f(h + r)}" cy="${h}" r="${f(stroke * 0.28)}" fill="#fff" fill-opacity="0.9"/></g></g>`
  const fill = liquid(p, start, h, inner, size, color, MOTION[mood])
  return `${open(size, size)}${base}${fill}${glass(h, inner, size)}${track}${arc}${head}</svg>`
}

// Cache TTL ring: calm while plenty is left, the warning color in its last fifth.
export const ttlColor = (percent: number): string => (percent > 20 ? COLORS.calm : COLORS.warn)

export const resetBar = (fraction: number, width: number): string => {
  const height = 8
  const filled = clamp(fraction, 0, 1) * width
  const track = `<rect width="${width}" height="${height}" rx="4" fill="${TRACK}" fill-opacity="0.3"/>`
  const bar = filled > 0 ? `<rect width="${f(Math.max(height, filled))}" height="${height}" rx="4" fill="${CHART}"/>` : ''
  return `${open(width, height)}${track}${bar}</svg>`
}

export const SEGMENTS = { in: '#378ADD', out: '#D85A30', cacheWrite: '#7F77DD', cacheRead: TRACK } as const

// A turn's stacked in/out/cache write/cache read bar. scale: the largest total among the turns shown.
// Cache reads are the largest but cheapest part, so they are muted on purpose.
export const turnBar = (
  t: Pick<Turn, 'in' | 'out' | 'cacheWrite' | 'cacheRead'>,
  scale: number,
  width: number,
  titles?: readonly [string, string, string, string],
): string => {
  const height = 10
  const unit = scale > 0 ? width / scale : 0
  const parts: [number, string, string][] = [
    [t.in, SEGMENTS.in, ''],
    [t.out, SEGMENTS.out, ''],
    [t.cacheWrite, SEGMENTS.cacheWrite, ''],
    [t.cacheRead, SEGMENTS.cacheRead, ' fill-opacity="0.45"'],
  ]
  let x = 0
  // With titles, each segment names itself on hover (the Svg must be interactive).
  const rects = parts
    .map(([n, color, opacity], i) => {
      const w = n * unit
      const title = titles ? `<title>${titles[i].replace(/&/g, '&amp;').replace(/</g, '&lt;')}</title>` : ''
      const rect = w > 0 ? `<rect x="${f(x)}" width="${f(w)}" height="${height}" fill="${color}"${opacity}>${title}</rect>` : ''
      x += w
      return rect
    })
    .join('')
  return `${open(width, height)}<defs><clipPath id="bar"><rect width="${width}" height="${height}" rx="3"/></clipPath></defs><g clip-path="url(#bar)"><rect width="${width}" height="${height}" fill="${TRACK}" fill-opacity="0.1"/>${rects}</g></svg>`
}
