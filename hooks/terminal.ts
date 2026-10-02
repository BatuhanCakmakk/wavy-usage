import type { Reading } from '../types'
import type { Strings } from './i18n'
import type { CacheState } from './model'
import { bandLayout, heat, percentText, tokens } from './model'

// The terminal has no Svg: quarter-circle glyphs instead of rings, one line, text colored by heat.

export type Part = { text: string; color?: string; dim?: boolean; bold?: boolean }

const HEAT_COLOR = { calm: 'green', warn: 'yellow', hot: 'red' } as const

export const glyph = (percent: number | undefined): string => {
  const p = percent ?? 0
  return p < 12.5 ? '○' : p < 37.5 ? '◔' : p < 62.5 ? '◑' : p < 87.5 ? '◕' : '●'
}

const metric = (label: string, percent: number | undefined, value?: string, color?: string, extra?: string): Part[] => {
  const c = color ?? (percent === undefined ? undefined : HEAT_COLOR[heat(percent)])
  return [
    { text: `${glyph(percent)} `, color: c, dim: c === undefined },
    { text: `${label} `, dim: true },
    { text: value ?? percentText(percent), bold: true, color: c },
    ...(extra !== undefined ? [{ text: ` ${extra}`, dim: true }] : []),
  ]
}

export const terminalParts = (r: Reading | null, cache: CacheState | null, columns: number, t: Strings): Part[] => {
  const layout = bandLayout(columns)
  const cacheParts = cache === null ? [] : [metric(t.cache, cache.percent, cache.text, cache.isWarm ? (cache.percent > 20 ? 'green' : 'yellow') : undefined)]
  const groups: Part[][] =
    r === null
      ? [metric(t.win5h, undefined), metric(t.win7d, undefined), metric(t.ctx, undefined), ...cacheParts, [{ text: t.waitingBand, dim: true }]]
      : [
          ...(r.fiveHour !== undefined ? [metric(t.win5h, r.fiveHour)] : []),
          ...(r.sevenDay !== undefined ? [metric(t.win7d, r.sevenDay)] : []),
          metric(t.ctx, r.ctxPercent, undefined, undefined, layout.showCtxTokens && r.ctxTokens !== undefined ? tokens(r.ctxTokens) : undefined),
          ...cacheParts,
          ...(layout.showCost && r.usd !== undefined ? [[{ text: `$${r.usd.toFixed(2)}`, dim: true }]] : []),
        ]
  return groups.flatMap((g, i) => (i === 0 ? g : [{ text: '  ' }, ...g]))
}
