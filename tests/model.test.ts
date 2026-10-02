import { describe, expect, test } from 'claude-code/testing'

import {
  bandLayout,
  breakdown,
  cacheState,
  clockTime,
  costText,
  countdown,
  ctxDeltaText,
  fiveDeltaText,
  dayClock,
  heat,
  HISTORY_LIMIT,
  isStaleLog,
  modelName,
  nudge,
  nudgeText,
  parseTtl,
  percentText,
  projectName,
  recentTurns,
  recordTurn,
  settleTurn,
  syncLog,
  takeReading,
  tokens,
  TTL_1H,
  TTL_5M,
  ttlText,
  turnTotal,
  UNKNOWN,
  upgradeTurn,
  windowElapsed,
  windowStart,
  windowTotals,
} from '../hooks/model'
import { STRINGS } from '../hooks/i18n'
import type { LogEntry, Turn } from '../types'

const MIN = 60 * 1000
const HOUR = 60 * MIN
const NOW = 1_700_000_000_000

describe('heat', () => {
  test('thresholds at 50 and 75', async () => {
    expect(heat(0)).toBe('calm')
    expect(heat(49.9)).toBe('calm')
    expect(heat(50)).toBe('warn')
    expect(heat(74.9)).toBe('warn')
    expect(heat(75)).toBe('hot')
    expect(heat(100)).toBe('hot')
  })
})

describe('takeReading', () => {
  test('takes the windows, context and cost', async () => {
    const r = takeReading({
      context: { window: 200_000, tokens: 124_000, percent: 62 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 34, resetsAt: new Date(NOW + 2 * HOUR).toISOString() },
        { kind: 'seven_day', percentUsed: 12 },
      ],
      cost: { usd: 1.23 },
    })
    expect(r).toEqual({
      fiveHour: 34,
      fiveHourResetsAt: NOW + 2 * HOUR,
      sevenDay: 12,
      ctxPercent: 62,
      ctxTokens: 124_000,
      ctxWindow: 200_000,
      usd: 1.23,
    })
  })

  test('off a subscription: no windows, a bad date is ignored', async () => {
    const r = takeReading({
      context: { window: 200_000 },
      rateLimits: [{ kind: 'five_hour', percentUsed: 5, resetsAt: 'bozuk' }],
    })
    expect(r.fiveHour).toBe(5)
    expect(r.fiveHourResetsAt).toBeUndefined()
    expect(r.sevenDay).toBeUndefined()
    expect(r.ctxPercent).toBeUndefined()
    expect(r.usd).toBeUndefined()
  })
})

describe('formatting', () => {
  test('tokens', async () => {
    expect(tokens(999)).toBe('999')
    expect(tokens(1000)).toBe('1k')
    expect(tokens(124_400)).toBe('124k')
    expect(tokens(999_400)).toBe('999k')
    expect(tokens(1_000_000)).toBe('1M')
    expect(tokens(1_540_000)).toBe('1.5M')
  })

  test('percentText', async () => {
    expect(percentText(undefined)).toBe('-')
    expect(percentText(33.6)).toBe('34%')
  })

  test('countdown reads as hours and minutes', async () => {
    expect(countdown(2 * HOUR + 10 * MIN)).toBe('2s 10dk')
    expect(countdown(2 * HOUR)).toBe('2s')
    expect(countdown(7 * MIN)).toBe('7dk')
    expect(countdown(-5)).toBe('0dk')
  })

  test('countdown past a day gives days and hours', async () => {
    expect(countdown(2 * 24 * HOUR + 5 * HOUR + 30 * MIN)).toBe('2g 5s')
    expect(countdown(3 * 24 * HOUR)).toBe('3g')
    expect(countdown(23 * HOUR + 59 * MIN)).toBe('23s 59dk')
  })

  test('clockTime gives local HH:MM', async () => {
    expect(clockTime(new Date(2026, 9, 2, 14, 35).getTime(), 'tr-TR')).toBe('14:35')
    expect(clockTime(new Date(2026, 9, 2, 9, 5).getTime(), 'tr-TR')).toBe('09:05')
    expect(clockTime(new Date(2026, 9, 2, 14, 35).getTime(), 'en-US')).toMatch(/^2:35\sPM$/)
  })

  test('dayClock gives weekday and time', async () => {
    expect(dayClock(new Date(2026, 9, 5, 9, 0).getTime())).toStartWith('Pzt ')
    expect(dayClock(new Date(2026, 9, 4, 18, 30).getTime())).toBe('Paz 18:30')
  })

  test('windowElapsed is the elapsed fraction (5 hours by default)', async () => {
    expect(windowElapsed(NOW + 5 * HOUR, NOW)).toBe(0)
    expect(windowElapsed(NOW + 2.5 * HOUR, NOW)).toBe(0.5)
    expect(windowElapsed(NOW, NOW)).toBe(1)
    expect(windowElapsed(NOW - HOUR, NOW)).toBe(1)
    expect(windowElapsed(NOW + 3.5 * 24 * HOUR, NOW, 7 * 24 * HOUR)).toBe(0.5)
  })
})

describe('bandLayout', () => {
  test('the cost drops first, then the token count', async () => {
    expect(bandLayout(100)).toEqual({ showJet: true, showCost: true, showCtxTokens: true })
    expect(bandLayout(84)).toEqual({ showJet: false, showCost: true, showCtxTokens: true })
    expect(bandLayout(69)).toEqual({ showJet: false, showCost: false, showCtxTokens: true })
    expect(bandLayout(54)).toEqual({ showJet: false, showCost: false, showCtxTokens: false })
  })
})

const usage = { input_tokens: 2000, output_tokens: 300, cache_read_input_tokens: 40_000, cache_creation_input_tokens: 5_000 }

describe('recordTurn', () => {
  test('numbers the turn, splits cache reads and writes, records time, ctx and cost', async () => {
    const h = recordTurn([], usage, 41, 1.5, NOW)
    expect(h).toEqual([{ n: 1, at: NOW, ctxPercent: 41, usd: 1.5, in: 2000, out: 300, cacheRead: 40_000, cacheWrite: 5_000 }])
    expect(recordTurn(h, usage, 50, 2, NOW + MIN)[1]?.n).toBe(2)
  })

  test('the history limit holds', async () => {
    let h = recordTurn([], usage, 1, undefined, NOW)
    for (let i = 0; i < 50; i += 1) h = recordTurn(h, usage, i, undefined, NOW + i)
    expect(h).toHaveLength(HISTORY_LIMIT)
    expect(h.at(-1)?.n).toBe(51)
  })
})

describe('settleTurn', () => {
  test("a measurement within 2 s of the turn's end corrects its ctx and cost", async () => {
    const h = recordTurn([], usage, 10, 1, NOW)
    const settled = settleTurn(h, { ctxPercent: 41, usd: 1.4 }, NOW + 1500).at(-1)
    expect(settled?.ctxPercent).toBe(41)
    expect(settled?.usd).toBe(1.4)
  })

  test('only the fields given are updated', async () => {
    const h = recordTurn([], usage, 10, 1, NOW)
    const settled = settleTurn(h, { usd: 1.4 }, NOW + 500).at(-1)
    expect(settled?.ctxPercent).toBe(10)
    expect(settled?.usd).toBe(1.4)
  })

  test('a measurement 2 s later (mid next turn) leaves the history alone', async () => {
    const h = recordTurn([], usage, 10, 1, NOW)
    expect(settleTurn(h, { ctxPercent: 55, usd: 3 }, NOW + 30_000).at(-1)?.ctxPercent).toBe(10)
  })

  test('does nothing on an empty history', async () => {
    expect(settleTurn([], { ctxPercent: 41 }, NOW)).toEqual([])
  })
})

describe('nudge', () => {
  test('past 55, once per new tenth', async () => {
    let at = 0
    const toasts: number[] = []
    for (const pct of [30, 56, 58, 59, 61, 66, 72]) {
      const n = nudge(pct, at)
      at = n.nudgedAt
      if (n.shouldToast) toasts.push(pct)
    }
    expect(toasts).toEqual([56, 61, 72])
  })

  test('re-arms when the fill drops after clear or compact', async () => {
    const first = nudge(66, 0)
    expect(first).toEqual({ nudgedAt: 60, shouldToast: true })
    const dropped = nudge(12, first.nudgedAt)
    expect(dropped).toEqual({ nudgedAt: 0, shouldToast: false })
    expect(nudge(57, dropped.nudgedAt).shouldToast).toBe(true)
  })

  test('text', async () => {
    expect(nudgeText(61.6)).toBe('context %62 · yeni iş ise /clear, devam için /compact')
  })
})

describe('recentTurns', () => {
  test('newest first, last 5; ctx change and cost against the previous turn', async () => {
    let h: Turn[] = []
    const usds = [1, 1.2, 1.5, 1.5, 2.5, 2.6]
    for (const [i, pct] of [10, 12, 15, 15, 30, 10].entries()) h = recordTurn(h, usage, pct, usds[i], NOW + i)
    const recent = recentTurns(h)
    expect(recent.map(r => r.turn.n)).toEqual([6, 5, 4, 3, 2])
    expect(recent.map(r => r.delta)).toEqual([-20, 15, 0, 3, 2])
    expect(recent.map(r => Number(r.cost?.toFixed(2)))).toEqual([0.1, 1, 0, 0.3, 0.2])
  })

  test('the first turn has no previous; a turn with unknown cost has no cost', async () => {
    expect(recentTurns(recordTurn([], usage, 41, 1, NOW)).map(r => [r.delta, r.cost])).toEqual([[null, null]])
    const h = recordTurn(recordTurn([], usage, 10, undefined, NOW), usage, 20, 2, NOW + 1)
    expect(recentTurns(h)[0]?.cost).toBeNull()
  })

  test("the session's first turn counts from the cost at session start; a trimmed oldest turn does not", async () => {
    expect(recentTurns(recordTurn([], usage, 41, 1, NOW), 0)[0]?.cost).toBe(1)
    expect(recentTurns(recordTurn([], usage, 41, 5.5, NOW), 5)[0]?.cost).toBe(0.5)
    let h: Turn[] = []
    for (let i = 0; i < 7; i++) h = recordTurn(h, usage, 10, i + 1, NOW + i)
    expect(recentTurns(h.slice(-1), 0)[0]?.cost).toBeNull()
  })

  test('the total sums the four parts', async () => {
    expect(turnTotal({ n: 1, at: NOW, ctxPercent: 0, in: 10, out: 20, cacheRead: 30, cacheWrite: 40 })).toBe(100)
  })
})

describe('ctxDeltaText', () => {
  test('a signed change, else the absolute value', async () => {
    expect(ctxDeltaText(3, 41)).toBe('+3%')
    expect(ctxDeltaText(2.6, 41)).toBe('+3%')
    expect(ctxDeltaText(-20, 10)).toBe('-20%')
    expect(ctxDeltaText(0, 15)).toBe('±0%')
    expect(ctxDeltaText(null, 41)).toBe('41%')
  })
})

describe('costText', () => {
  test('dollars, a floor when tiny, empty when unknown', async () => {
    expect(costText(0.384)).toBe('$0.38')
    expect(costText(1.2)).toBe('$1.20')
    expect(costText(0.004)).toBe('<$0.01')
    expect(costText(null)).toBe('')
  })
})

describe('upgradeTurn', () => {
  test('a turn with the old cache field is upgraded', async () => {
    expect(upgradeTurn({ n: 3, at: NOW, ctxPercent: 20, in: 1, out: 2, cache: 300 })).toEqual({
      n: 3, at: NOW, ctxPercent: 20, in: 1, out: 2, cacheRead: 300, cacheWrite: 0,
    })
  })

  test('a turn already in the new shape stays as is', async () => {
    const t: Turn = { n: 1, at: NOW, ctxPercent: 5, usd: 1, in: 1, out: 2, cacheRead: 3, cacheWrite: 4 }
    expect(upgradeTurn(t)).toEqual(t)
  })
})

describe('cacheState', () => {
  test('nothing before the first request, then time left, <1dk in the last minute, cold when out', async () => {
    expect(cacheState(null, TTL_1H, NOW)).toBeNull()
    expect(cacheState(NOW, TTL_1H, NOW + 13 * MIN)).toEqual({ percent: (50 * 100) / 60, text: '50dk', isWarm: true })
    expect(cacheState(NOW, TTL_1H, NOW + 16 * MIN)?.text).toBe('45dk')
    expect(cacheState(NOW, TTL_1H, NOW + 59.5 * MIN)?.text).toBe('<1dk')
    expect(cacheState(NOW, TTL_1H, NOW + 60 * MIN)).toEqual({ percent: 0, text: 'soğuk', isWarm: false })
    expect(cacheState(NOW, TTL_5M, NOW + 2 * MIN)?.text).toBe('3dk')
  })
})

describe('parseTtl', () => {
  test('5m and 1h, nothing else', async () => {
    expect(parseTtl('5m')).toBe(TTL_5M)
    expect(parseTtl('1h')).toBe(TTL_1H)
    expect(parseTtl('10m')).toBeUndefined()
  })
})

describe('names', () => {
  test("the project is the folder's last part, the model drops claude-", async () => {
    expect(projectName('C:\\Users\\cakar\\Documents\\Claude Mods')).toBe('Claude Mods')
    expect(projectName('/work/volty/')).toBe('volty')
    expect(projectName('')).toBe(UNKNOWN)
    expect(modelName('claude-opus-5-5')).toBe('opus-5-5')
    expect(modelName('claude-opus-5-5[1m]')).toBe('opus-5-5')
    expect(modelName(undefined)).toBe(UNKNOWN)
  })
})

describe('syncLog', () => {
  const t = (n: number, usd?: number): Turn => ({ n, at: NOW + n, ctxPercent: 0, usd, model: 'claude-opus-5-5', in: 1, out: 2, cacheRead: 3, cacheWrite: 4 })

  test('adds the last turn, cost against the previous; rewriting the same turn updates it', async () => {
    const first = syncLog([], t(1, 1), undefined, 'Claude Mods')
    expect(first).toEqual([{ id: String(NOW + 1), at: NOW + 1, project: 'Claude Mods', model: 'opus-5-5', tokens: 10 }])
    const second = syncLog(first, t(2, 1.3), t(1, 1), 'Claude Mods')
    expect(second.at(-1)?.usd?.toFixed(2)).toBe('0.30')
    const settled = syncLog(second, t(2, 1.5), t(1, 1), 'Claude Mods')
    expect(settled).toHaveLength(2)
    expect(settled.at(-1)?.usd?.toFixed(2)).toBe('0.50')
  })

  test('a turn logged under its older numbered id is replaced, not doubled', async () => {
    const old = [{ id: '1', at: NOW + 1, project: 'Claude Mods', model: 'opus-5-5', tokens: 10 }]
    expect(syncLog(old, t(1, 1), undefined, 'Claude Mods')).toHaveLength(1)
  })

  test("the session's first turn takes its cost from the cost at session start", async () => {
    expect(syncLog([], t(1, 0.06), undefined, 'Claude Mods', undefined, 0)[0]?.usd).toBe(0.06)
    expect(syncLog([], t(1, 2.5), undefined, 'Claude Mods', undefined, 2)[0]?.usd).toBe(0.5)
  })

  test("the session's model when the turn has none; old unknown rows are fixed with it", async () => {
    const unknown: Turn = { ...t(1, 1), model: undefined }
    const before = syncLog([], unknown, undefined, 'Claude Mods')
    expect(before[0]?.model).toBe(UNKNOWN)
    const after = syncLog(before, t(2, 1.2), t(1, 1), 'Claude Mods', 'claude-opus-5-5')
    expect(after.map(e => e.model)).toEqual(['opus-5-5', 'opus-5-5'])
    expect(syncLog([], unknown, undefined, 'Claude Mods', 'claude-sonnet-5-5')[0]?.model).toBe('sonnet-5-5')
  })
})

describe('window breakdown', () => {
  const e = (id: string, at: number, project: string, model: string, usd: number, tokens = 100): LogEntry => ({ id, at, project, model, tokens, usd })
  const entries = [
    e('1', NOW - HOUR, 'Claude Mods', 'opus-5-5', 2),
    e('2', NOW - 2 * HOUR, 'Claude Mods', 'opus-5-5', 1),
    e('3', NOW - HOUR, 'volty', 'sonnet-5-5', 0.5),
    e('4', NOW - 2 * 24 * HOUR, 'eski', 'haiku-4-5', 9),
  ]

  test('the window starts at resetsAt minus its length, else now minus its length', async () => {
    expect(windowStart('5h', { ctxWindow: 1, fiveHourResetsAt: NOW + HOUR }, NOW)).toBe(NOW - 4 * HOUR)
    expect(windowStart('7d', { ctxWindow: 1 }, NOW)).toBe(NOW - 7 * 24 * HOUR)
    expect(windowStart('5h', null, NOW)).toBe(NOW - 5 * HOUR)
  })

  test('by project and by model, ranked by cost, outside the window left out', async () => {
    const since = NOW - 5 * HOUR
    expect(breakdown(entries, since, 'project')).toEqual([
      { name: 'Claude Mods', tokens: 200, turns: 2, usd: 3 },
      { name: 'volty', tokens: 100, turns: 1, usd: 0.5 },
    ])
    expect(breakdown(entries, since, 'model').map(g => g.name)).toEqual(['opus-5-5', 'sonnet-5-5'])
    expect(windowTotals(entries, since)).toEqual({ turns: 3, tokens: 300, usd: 3.5 })
  })

  test('an old or malformed log is stale', async () => {
    expect(isStaleLog([e('1', NOW - 9 * 24 * HOUR, 'a', 'b', 1)], NOW)).toBe(true)
    expect(isStaleLog([e('1', NOW - HOUR, 'a', 'b', 1)], NOW)).toBe(false)
    expect(isStaleLog([], NOW)).toBe(true)
    expect(isStaleLog('bozuk', NOW)).toBe(true)
  })
})

describe('formatting per language', () => {
  test('duration units', async () => {
    expect(countdown(2 * HOUR + 10 * MIN, STRINGS.en.units)).toBe('2h 10m')
    expect(countdown(2 * HOUR + 10 * MIN, STRINGS.de.units)).toBe('2 Std. 10 Min.')
    expect(countdown(2 * HOUR + 10 * MIN, STRINGS.ja.units)).toBe('2時間10分')
    expect(countdown(2 * 24 * HOUR + 5 * HOUR, STRINGS.ko.units)).toBe('2일 5시간')
  })

  test('cache, nudge, TTL and weekday', async () => {
    expect(cacheState(NOW, TTL_1H, NOW + 60 * MIN, STRINGS.en)?.text).toBe('cold')
    expect(cacheState(NOW, TTL_1H, NOW + 59.5 * MIN, STRINGS.en)?.text).toBe('<1m')
    expect(nudgeText(61.6, STRINGS.en)).toBe('context 62% · /clear if the next thing is a new task, /compact to keep going')
    expect(ttlText(TTL_5M, STRINGS.en)).toBe('5 minutes')
    expect(dayClock(new Date(2026, 9, 5, 9, 0).getTime(), 'en')).toStartWith('Mon ')
  })

  test('unknown is the language-neutral ?; the old bilinmiyor counts as unknown', async () => {
    expect(projectName('')).toBe(UNKNOWN)
    expect(modelName(undefined)).toBe(UNKNOWN)
    const e = (model: string): LogEntry => ({ id: model, at: NOW, project: 'p', model, tokens: 1, usd: 1 })
    expect(breakdown([e('?'), e('bilinmiyor')], 0, 'model')).toEqual([{ name: UNKNOWN, tokens: 2, turns: 2, usd: 2 }])
  })
})

describe('5-hour share per turn', () => {
  test('one decimal, ±0, the reset word when the window went down, nothing when unknown', async () => {
    expect([fiveDeltaText(0.4, 'reset'), fiveDeltaText(1, 'reset'), fiveDeltaText(0, 'reset')]).toEqual(['+0.4%', '+1%', '±0%'])
    expect([fiveDeltaText(-80, 'reset'), fiveDeltaText(null, 'reset')]).toEqual(['reset', ''])
  })
})
