import type { Turn } from '../types'
import type { Heat } from './model'
import { heat } from './model'

// Pure SVG builders. The desktop draws an Svg as an isolated image without the theme's variables,
// so the colors are mid tones that read on light and dark themes. Text goes in Text elements, not the SVG.

export const COLORS: Record<Heat, string> = { calm: '#1D9E75', warn: '#BA7517', hot: '#E24B4A' }
export const TRACK = '#888780'
export const CHART = '#378ADD'

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))
const f = (n: number): string => n.toFixed(2)
const open = (width: number, height: number): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`

const RISE = '1.2s'

const level = (p: number, cy: number, inner: number): number => cy + inner - (2 * inner * p) / 100

// Seven half waves from the left edge: shifted by ±w, the inner circle stays covered at every moment.
const wavePath = (x0: number, y: number, w: number, amp: number, bottom: number): string => {
  const half = f(w / 2)
  const rest = Array.from({ length: 6 }, () => ` t${half} 0`).join('')
  return `M${f(x0)} ${f(y)} q${f(w / 4)} ${f(-amp)} ${half} 0${rest} V${f(bottom)} H${f(x0)} Z`
}

const liquid = (p: number, h: number, inner: number, size: number, color: string, from?: number): string => {
  const w = 2 * inner
  const y = level(p, h, inner)
  const amp = Math.max(0.8, size * 0.05)
  const bottom = h + inner + 1
  const dy = from === undefined ? 0 : level(clamp(from, 0, 100), h, inner) - y
  const rise =
    Math.abs(dy) > 0.01
      ? `<animateTransform attributeName="transform" type="translate" from="0 ${f(dy)}" to="0 0" dur="${RISE}" fill="freeze"/>`
      : ''
  const back = `<path d="${wavePath(h - inner - w / 2, y, w, amp * 0.8, bottom)}" fill="${color}" fill-opacity="0.35"><animateTransform attributeName="transform" type="translate" from="${f(-w)} 0" to="0 0" dur="3.4s" repeatCount="indefinite"/></path>`
  const front = `<path d="${wavePath(h - inner, y, w, amp, bottom)}" fill="${color}" fill-opacity="0.8"><animateTransform attributeName="transform" type="translate" from="0 0" to="${f(-w)} 0" dur="2.2s" repeatCount="indefinite"/></path>`
  return `<defs><clipPath id="liq"><circle cx="${h}" cy="${h}" r="${f(inner)}"/></clipPath></defs><g clip-path="url(#liq)"><g>${rise}${back}${front}</g></g>`
}

// Ring plus liquid: the outer arc shows the percentage, the inner circle fills with waving liquid to the same level.
// Given a different from, the level slides from there once; draw it as an isInteractive Svg.
// Given an override, it replaces the heat color (for rings whose meaning is inverted, like the cache TTL ring).
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
  const color = override ?? COLORS[heat(p)]
  const base = `<circle cx="${h}" cy="${h}" r="${f(inner)}" fill="${TRACK}" fill-opacity="0.12"/>`
  const fill = p > 0 ? liquid(p, h, inner, size, color, from) : ''
  const track = `<circle cx="${h}" cy="${h}" r="${f(r)}" fill="none" stroke="${TRACK}" stroke-opacity="0.3" stroke-width="${stroke}"/>`
  const arc =
    p > 0
      ? `<circle cx="${h}" cy="${h}" r="${f(r)}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${f((c * p) / 100)} ${f(c)}" transform="rotate(-90 ${h} ${h})"/>`
      : ''
  // When the desktop does reload the frame (a new value), the ring fades in instead of popping.
  return `${open(size, size)}<g><animate attributeName="opacity" from="0" to="1" dur="0.3s"/>${base}${fill}${track}${arc}</g></svg>`
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
