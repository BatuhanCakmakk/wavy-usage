import type { SessionMeasureInput } from 'claude-code'

import type { LogEntry, Reading, Turn } from '../types'
import type { Lang, Strings, Units } from './i18n'
import { STRINGS } from './i18n'

// Pure data logic: no $, so it is tested on its own.

export const FIVE_HOURS = 5 * 60 * 60 * 1000

export type Heat = 'calm' | 'warn' | 'hot'

export type Measure = Pick<SessionMeasureInput, 'context' | 'rateLimits' | 'cost'>

export const heat = (percent: number): Heat => (percent >= 75 ? 'hot' : percent >= 50 ? 'warn' : 'calm')

export const takeReading = (m: Measure): Reading => {
  const limit = (kind: string) => m.rateLimits.find(l => l.kind === kind)
  const resetsAt = (kind: string) => {
    const at = Date.parse(limit(kind)?.resetsAt ?? '')
    return Number.isFinite(at) ? at : undefined
  }
  return {
    fiveHour: limit('five_hour')?.percentUsed,
    fiveHourResetsAt: resetsAt('five_hour'),
    sevenDay: limit('seven_day')?.percentUsed,
    sevenDayResetsAt: resetsAt('seven_day'),
    ctxPercent: m.context.percent,
    ctxTokens: m.context.tokens,
    ctxWindow: m.context.window,
    usd: m.cost?.usd,
  }
}

export const tokens = (n: number): string => {
  if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(1))}M`
  return n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`
}

export const percentText = (percent: number | undefined): string =>
  percent === undefined ? '-' : `${Math.round(percent)}%`

// Under a day: hours and minutes; over a day: days and hours (minutes are noise for the 7-day window).
// step: minutes are rounded up to it (5 keeps a long countdown from changing, and redrawing, every minute).
export const countdown = (ms: number, u: Units = STRINGS.tr.units, step = 1): string => {
  const part = (n: number, unit: string) => `${n}${u.numSep}${unit}`
  const m = Math.max(0, Math.ceil(ms / 60000 / step) * step)
  if (m < 60) return part(m, u.m)
  if (m >= 24 * 60) {
    const days = Math.floor(m / (24 * 60))
    const hours = Math.floor((m % (24 * 60)) / 60)
    return hours === 0 ? part(days, u.d) : `${part(days, u.d)}${u.partSep}${part(hours, u.h)}`
  }
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? part(h, u.h) : `${part(h, u.h)}${u.partSep}${part(rest, u.m)}`
}

// The time in the system locale's own format: 16:20 in Turkey, 4:20 PM in the US.
// 24-hour locales keep the leading zero (09:05).
export const clockTime = (ms: number, locale?: string): string => {
  const cycle = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hourCycle
  const hour = cycle === 'h23' || cycle === 'h24' ? '2-digit' : 'numeric'
  return new Intl.DateTimeFormat(locale, { hour, minute: '2-digit' }).format(new Date(ms))
}

// The weekday comes from Intl in that language (Pzt, Mon, lun., 月 ...).
export const dayClock = (ms: number, lang: Lang = 'tr'): string =>
  `${new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(new Date(ms))} ${clockTime(ms)}`

export const windowElapsed = (resetsAt: number, now: number, length = FIVE_HOURS): number =>
  Math.min(1, Math.max(0, 1 - (resetsAt - now) / length))

// What a narrow band drops: the cost first (under 70 columns), then the ctx token count (under 55).
// The rings and the percentages are never dropped.
export const bandLayout = (columns: number): { showJet: boolean; showCost: boolean; showCtxTokens: boolean } => ({
  showJet: columns >= 85,
  showCost: columns >= 70,
  showCtxTokens: columns >= 55,
})

export const HISTORY_LIMIT = 6
export const NUDGE_AT = 55
export const SETTLE_MS = 2000

export type TurnUsage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
  model?: string
}

// turn.complete's usage sums every response of the turn, so the context fill cannot come from it.
// A turn is recorded with the latest reading's ctx and total cost; settleTurn corrects it with a later measurement.
export const recordTurn = (
  history: readonly Turn[],
  usage: TurnUsage,
  ctxPercent: number,
  usd: number | undefined,
  at: number,
  fiveHour?: number,
): Turn[] => {
  const turn: Turn = {
    n: (history.at(-1)?.n ?? 0) + 1,
    at,
    ctxPercent,
    ...(usd !== undefined && { usd }),
    ...(fiveHour !== undefined && { fiveHour }),
    ...(usage.model !== undefined && { model: usage.model }),
    in: usage.input_tokens,
    out: usage.output_tokens,
    cacheRead: usage.cache_read_input_tokens,
    cacheWrite: usage.cache_creation_input_tokens,
  }
  return [...history, turn].slice(-HISTORY_LIMIT)
}

// turn.complete and session.measure arrive in no promised order. A measurement within SETTLE_MS of the turn's end
// belongs to that turn and corrects the fields it carries; a later one is the middle of the next turn.
export const settleTurn = (
  history: readonly Turn[],
  patch: { ctxPercent?: number; usd?: number; fiveHour?: number },
  now: number,
): Turn[] => {
  const last = history.at(-1)
  if (!last || now - last.at > SETTLE_MS) return [...history]
  return [
    ...history.slice(0, -1),
    {
      ...last,
      ...(patch.ctxPercent !== undefined && { ctxPercent: patch.ctxPercent }),
      ...(patch.usd !== undefined && { usd: patch.usd }),
      ...(patch.fiveHour !== undefined && { fiveHour: patch.fiveHour }),
    },
  ]
}

// $.state history from v0.4 and earlier carries a single cache field: it counts as reads, writes 0.
export type LegacyTurn = Omit<Turn, 'cacheRead' | 'cacheWrite'> & { cache?: number; cacheRead?: number; cacheWrite?: number }

export const upgradeTurn = (t: LegacyTurn): Turn => {
  const { cache, ...rest } = t
  return { ...rest, cacheRead: t.cacheRead ?? cache ?? 0, cacheWrite: t.cacheWrite ?? 0 }
}

// Pass the returned nudgedAt to the next call. When the fill drops below nudgedAt (clear, compact) the nudge re-arms.
export const nudge = (ctxPercent: number, nudgedAt: number): { nudgedAt: number; shouldToast: boolean } => {
  const armed = ctxPercent < nudgedAt ? 0 : nudgedAt
  if (ctxPercent >= NUDGE_AT && ctxPercent >= armed + 10) {
    return { nudgedAt: Math.floor(ctxPercent / 10) * 10, shouldToast: true }
  }
  return { nudgedAt: armed, shouldToast: false }
}

export const nudgeText = (ctxPercent: number, t: Pick<Strings, 'nudge'> = STRINGS.tr): string =>
  t.nudge(Math.round(ctxPercent))

export const RECENT = 5

export const turnTotal = (t: Turn): number => t.in + t.out + t.cacheRead + t.cacheWrite

// The last RECENT turns, newest first. delta: the turn's ctx minus the previous turn's; cost: the session's total
// cost at the turn's end minus the previous one's (the engine's own ledger); five: how far the 5-hour window moved
// over the turn (negative when it reset in between). All null without a previous turn, except the session's first
// turn's cost, which counts from baseUsd (the session's cost when it started).
export type RecentTurn = { turn: Turn; delta: number | null; cost: number | null; five: number | null }

// The session's total before the turn is the previous turn's, or for the first turn the cost at session start.
const turnCost = (turn: Turn, prev: Turn | undefined, baseUsd: number | undefined): number | null => {
  const before = prev ? prev.usd : turn.n === 1 ? baseUsd : undefined
  return before !== undefined && turn.usd !== undefined ? turn.usd - before : null
}

export const recentTurns = (history: readonly Turn[], baseUsd?: number): RecentTurn[] =>
  history
    .map((turn, i) => {
      const prev = i > 0 ? history[i - 1] : undefined
      return {
        turn,
        delta: prev ? turn.ctxPercent - prev.ctxPercent : null,
        cost: turnCost(turn, prev, baseUsd),
        five: prev?.fiveHour !== undefined && turn.fiveHour !== undefined ? turn.fiveHour - prev.fiveHour : null,
      }
    })
    .slice(-RECENT)
    .reverse()

export const ctxDeltaText = (delta: number | null, ctxPercent: number): string => {
  if (delta === null) return `${Math.round(ctxPercent)}%`
  const d = Math.round(delta)
  return d > 0 ? `+${d}%` : d < 0 ? `${d}%` : '±0%'
}

// The 5-hour window's move over one turn: +0.4%, +1%, ±0%, the reset word when it went down, '' when unknown.
export const fiveDeltaText = (five: number | null, resetWord: string): string => {
  if (five === null) return ''
  if (five < 0) return resetWord
  const n = Number(five.toFixed(1))
  return n === 0 ? '±0%' : `+${n}%`
}

// The section's summary line: tokens, cost and the 5-hour window's growth over the shown turns (resets skipped).
export const turnsSummary = (rows: readonly RecentTurn[]): { tokens: number; cost: number | null; five: number | null } => {
  const costs = rows.map(r => r.cost).filter((c): c is number => c !== null)
  const fives = rows.map(r => r.five).filter((f): f is number => f !== null && f >= 0)
  return {
    tokens: rows.reduce((a, r) => a + turnTotal(r.turn), 0),
    cost: costs.length ? costs.reduce((a, c) => a + c, 0) : null,
    five: fives.length ? fives.reduce((a, f) => a + f, 0) : null,
  }
}

export const costText = (cost: number | null): string => {
  if (cost === null) return ''
  return cost < 0.01 ? '<$0.01' : `$${cost.toFixed(2)}`
}

// The cache ring drains every minute; drawn in 5% steps its Svg changes (and reloads) every few minutes instead.
export const ringStep = (percent: number): number => Math.round(percent / 5) * 5

export const TTL_1H = 60 * 60 * 1000
export const TTL_5M = 5 * 60 * 1000
export const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
export const LOG_KEEP_MS = 8 * 24 * 60 * 60 * 1000
export const LOG_LIMIT = 2000

export type CacheState = { percent: number; text: string; isWarm: boolean }

// The countdown starts at the turn's end, a little after its last request began, so it is an upper bound.
export const COUNTDOWN_STEP = 5

export const cacheState = (
  lastRequestAt: number | null,
  ttlMs: number,
  now: number,
  t: Pick<Strings, 'units' | 'cold'> = STRINGS.tr,
): CacheState | null => {
  if (lastRequestAt === null) return null
  const left = lastRequestAt + ttlMs - now
  if (left <= 0) return { percent: 0, text: t.cold, isWarm: false }
  // A long lifetime counts down in 5-minute steps, matching the ring's 5% steps; the 5-minute one by the minute.
  const step = ttlMs >= 30 * 60 * 1000 ? COUNTDOWN_STEP : 1
  const text = left < 60_000 ? `<1${t.units.numSep}${t.units.m}` : countdown(left, t.units, step)
  // The ring drains with the shown countdown, so both change on the same minute.
  const stepMs = step * 60_000
  return { percent: Math.min(100, (Math.ceil(left / stepMs) * stepMs * 100) / ttlMs), text, isWarm: true }
}

export const parseTtl = (arg: string): number | undefined => (arg === '5m' ? TTL_5M : arg === '1h' ? TTL_1H : undefined)

export const ttlText = (ms: number, t: Pick<Strings, 'ttl5m' | 'ttl1h'> = STRINGS.tr): string =>
  ms === TTL_5M ? t.ttl5m : t.ttl1h

// An unknown project or model is stored as the language-neutral ?; shown as t.unknown. v0.7 logs wrote bilinmiyor.
export const UNKNOWN = '?'
const LEGACY_UNKNOWN = 'bilinmiyor'
export const isUnknown = (name: string): boolean => name === UNKNOWN || name === LEGACY_UNKNOWN

export const projectName = (cwd: string): string => cwd.split(/[\\/]/).filter(Boolean).at(-1) ?? UNKNOWN

export const modelName = (id: string | undefined): string =>
  id === undefined ? UNKNOWN : id.replace(/^claude-/, '').replace(/\[1m\]$/, '')

// Adds this session's last turn to the log, or updates it under the same id after a settle. When the turn has no
// model (an interrupted turn, the turn of a hot reload) the session's model is used; earlier unknown rows are fixed too.
export const syncLog = (
  log: readonly LogEntry[],
  turn: Turn,
  prev: Turn | undefined,
  project: string,
  sessionModel?: string,
  baseUsd?: number,
): LogEntry[] => {
  const fallback = sessionModel === undefined ? UNKNOWN : modelName(sessionModel)
  const usd = turnCost(turn, prev, baseUsd)
  const entry: LogEntry = {
    id: String(turn.n),
    at: turn.at,
    project,
    model: turn.model === undefined ? fallback : modelName(turn.model),
    tokens: turnTotal(turn),
    ...(usd !== null && { usd }),
  }
  const repaired = log.map(e => (isUnknown(e.model) ? { ...e, model: fallback } : e))
  return [...repaired.filter(e => e.id !== entry.id), entry].slice(-LOG_LIMIT)
}

export type WindowView = '5h' | '7d'

export const windowStart = (view: WindowView, r: Reading | null, now: number): number =>
  view === '5h' ? (r?.fiveHourResetsAt ?? now) - FIVE_HOURS : (r?.sevenDayResetsAt ?? now) - SEVEN_DAYS

export type Group = { name: string; tokens: number; turns: number; usd: number }

export const breakdown = (entries: readonly LogEntry[], since: number, by: 'project' | 'model', limit = 5): Group[] => {
  const groups = new Map<string, Group>()
  for (const e of entries) {
    if (e.at < since) continue
    const name = isUnknown(e[by]) ? UNKNOWN : e[by]
    const g = groups.get(name) ?? { name, tokens: 0, turns: 0, usd: 0 }
    groups.set(name, { name, tokens: g.tokens + e.tokens, turns: g.turns + 1, usd: g.usd + (e.usd ?? 0) })
  }
  return [...groups.values()].sort((a, b) => b.usd - a.usd || b.tokens - a.tokens).slice(0, limit)
}

export const windowTotals = (entries: readonly LogEntry[], since: number): { turns: number; tokens: number; usd: number } =>
  entries
    .filter(e => e.at >= since)
    .reduce((t, e) => ({ turns: t.turns + 1, tokens: t.tokens + e.tokens, usd: t.usd + (e.usd ?? 0) }), { turns: 0, tokens: 0, usd: 0 })

// Another session's log is deleted when it is empty, malformed, or its last turn is older than LOG_KEEP_MS.
export const isStaleLog = (entries: unknown, now: number): boolean => {
  if (!Array.isArray(entries) || entries.length === 0) return true
  const last: unknown = entries.at(-1)
  const at = typeof last === 'object' && last !== null ? Reflect.get(last, 'at') : undefined
  return typeof at !== 'number' || at < now - LOG_KEEP_MS
}
