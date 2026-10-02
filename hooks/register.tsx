import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { LogEntry, Reading, Turn } from '../types'
import type { Lang, Strings } from './i18n'
import { resolveLang, STRINGS } from './i18n'
import type { Group, WindowView } from './model'
import {
  bandLayout,
  breakdown,
  cacheState,
  clockTime,
  costText,
  countdown,
  COUNTDOWN_STEP,
  ctxDeltaText,
  fiveDeltaText,
  dayClock,
  FIVE_HOURS,
  isStaleLog,
  isUnknown,
  nudge,
  nudgeText,
  parseTtl,
  percentText,
  projectName,
  recentTurns,
  ringStep,
  recordTurn,
  SEVEN_DAYS,
  SETTLE_MS,
  settleTurn,
  syncLog,
  takeReading,
  tokens,
  TTL_1H,
  TTL_5M,
  ttlText,
  turnsSummary,
  turnTotal,
  upgradeTurn,
  windowElapsed,
  windowStart,
  windowTotals,
} from './model'
import type { JetLevel } from './jet'
import { jetLevel, jetStrip } from './jet'
import { liquidRing, resetBar, SEGMENTS, ttlColor, turnBar } from './svg'
import { terminalParts } from './terminal'

// Limit windows, context fill, cache warmth and cost: rings above the prompt, detail in a side pane.
// The figures arrive on session.measure and turn.complete (what the last API response already reported): no extra
// requests, no tokens. Svg rings and a pane on desktop, a one-line text band in the terminal. Strings live in i18n.ts.

const MOD = 'wavy-usage'
const PANE = 'wavy-usage'
const ENABLED_KEY = 'wavy-usage:enabled'
const TTL_KEY = 'wavy-usage:ttl'
const LOG_PREFIX = 'wavy-usage:log:'
const EFFORT_KEY = 'wavy-usage:effort'
const TICK_MS = 60 * 1000
// Band rings at 2x: the text keeps the app's size (Text has no size prop), the ring grows.
const BAND_RING = 44
const BAND_STROKE = 5
const JET_W = 130
const JET_H = 44
const JET_SCALE = 1.25
const JET_PANE_H = 84
const JET_PANE_SCALE = 2.6
// The terminal tag takes the flame's color family.
const JET_TERMINAL_COLOR: Record<JetLevel, string> = { low: 'magenta', medium: 'red', high: 'yellow', xhigh: 'yellow', max: 'cyan' }

const reading = atom({ plugin: 'wavy-usage', key: 'reading' } as const, null as Reading | null)
// What the band and the pane draw, published in one piece: once when a prompt finishes (after the measurement that
// settles it), never on mid-turn or idle measurements. One publish is one redraw; an identical one is skipped.
type Screen = { reading: Reading | null; turns: Turn[]; lastRequestAt: number | null; log: LogEntry[] }
const screen = atom({ plugin: 'wavy-usage', key: 'screen' } as const, { reading: null, turns: [], lastRequestAt: null, log: [] } as Screen)
const history = atom({ plugin: 'wavy-usage', key: 'history' } as const, [] as Turn[])
const isPaneOpen = atom({ plugin: 'wavy-usage', key: 'isPaneOpen' } as const, false)
const isEnabled = atom({ plugin: 'wavy-usage', key: 'isEnabled' } as const, true)
const lastRequestAt = atom({ plugin: 'wavy-usage', key: 'lastRequestAt' } as const, null as number | null)
const ttlMs = atom({ plugin: 'wavy-usage', key: 'ttlMs' } as const, TTL_1H)
const log = atom({ plugin: 'wavy-usage', key: 'log' } as const, [] as LogEntry[])
const others = atom({ plugin: 'wavy-usage', key: 'others' } as const, [] as LogEntry[])
const windowView = atom({ plugin: 'wavy-usage', key: 'windowView' } as const, '5h' as WindowView)
// The main loop's effort, from turn.step; the last one seen is kept so a new session shows the jet before its first request.
const effort = atom({ plugin: 'wavy-usage', key: 'effort' } as const, null as JetLevel | null)
// The session's cost when it started (0 when new, the restored total when resumed): the first turn's cost counts from it.
const costBase = atom({ plugin: 'wavy-usage', key: 'costBase' } as const, undefined as number | undefined)

let disabled = false
let nudgedAt = 0
let hasLoggedRenderError = false
let lastTurnEnd = 0
let lastFace = ''
let lastMeasureAt = 0
let awaitingSettle = false
let sessionId = '?'
let project = '?'
let lang: Lang = 'en'
let t: Strings = STRINGS.en

// Each ring's last move: the liquid slides from `from` to `to`. A redraw at the same level returns the same `from`, so
// the Svg source stays byte-identical and the desktop keeps its frame instead of reloading it (a reload blinks and
// restarts the waves). Keys are language-neutral.
const lastLevel = new Map<string, { from: number; to: number }>()

const levelFrom = (key: string, percent: number | undefined): number => {
  const to = percent ?? 0
  const last = lastLevel.get(key)
  if (last && last.to === to) return last.from
  const from = last?.to ?? 0
  lastLevel.set(key, { from, to })
  return from
}

const shownName = (name: string): string => (isUnknown(name) ? t.unknown : name)

// CLAUDE_MODS_DISABLE=all, or wavy-usage in its comma list: every hook passes through and no command is registered.
const readDisabled = async ($: EngineInterface): Promise<boolean> => {
  const raw = (await $.env.get('CLAUDE_MODS_DISABLE').catch(() => undefined)) ?? ''
  disabled = raw
    .split(',')
    .map(v => v.trim())
    .some(v => v === 'all' || v === MOD)
  return disabled
}

const logRenderError = ($: EngineInterface, err: unknown): void => {
  if (hasLoggedRenderError) return
  hasLoggedRenderError = true
  $.ui.log(`wavy-usage: render failed, fell back to the engine's drawing: ${err}`)
}

// Other sessions' logs: read once when the pane opens and when the tab changes; stale keys are deleted.
const loadOthers = async ($: EngineInterface): Promise<void> => {
  const now = await $.clock.now()
  const own = LOG_PREFIX + sessionId
  const keys = (await $.store.keys().catch(() => [] as string[])).filter(k => k.startsWith(LOG_PREFIX) && k !== own)
  const all: LogEntry[] = []
  for (const key of keys) {
    const entries = await $.store.get(key).catch(() => undefined)
    if (isStaleLog(entries, now)) {
      await $.store.delete(key).catch(() => undefined)
      continue
    }
    all.push(...(entries as LogEntry[]))
  }
  await update($, others, () => all)
}

// This session's last turn (new, or corrected by a settle) is written to the log and to $.store.
const syncOwnLog = async ($: EngineInterface): Promise<void> => {
  const h = await read($, history)
  const last = h.at(-1)
  if (!last) return
  const sessionModel = await $.session.model().catch(() => undefined)
  const next = syncLog(await read($, log), last, h.at(-2), project, sessionModel, await read($, costBase))
  await update($, log, () => next)
  await $.store.set(LOG_PREFIX + sessionId, next).catch(() => undefined)
}

const openPane = async ($: EngineInterface): Promise<void> => {
  await $.ui.open({ id: PANE, title: t.paneTitle })
  await update($, isPaneOpen, () => true)
  await loadOthers($)
}

// Always close through $.ui.close: the ui.close hook clears isPaneOpen the same way as when the person closes it.
// It is cleared here too in case the plugin's own call skips its own hook.
const closePane = async ($: EngineInterface): Promise<void> => {
  await $.ui.close({ id: PANE })
  await update($, isPaneOpen, () => false)
}

const togglePane = async ($: EngineInterface): Promise<void> =>
  (await read($, isPaneOpen)) ? closePane($) : openPane($)

const switchWindow = async ($: EngineInterface, view: WindowView): Promise<void> => {
  await update($, windowView, () => view)
  await loadOthers($)
}

const publish = async ($: EngineInterface): Promise<void> => {
  const next: Screen = {
    reading: await read($, reading),
    turns: await read($, history),
    lastRequestAt: await read($, lastRequestAt),
    log: await read($, log),
  }
  if (JSON.stringify(await read($, screen)) === JSON.stringify(next)) return
  await update($, screen, () => next)
}

// The time-driven figures as drawn now, or null while the band is off.
const clockFace = async ($: EngineInterface): Promise<string | null> => {
  if (!(await read($, isEnabled))) return null
  const now = await $.clock.now()
  const shownNow = await read($, screen)
  const cache = cacheState(shownNow.lastRequestAt, await read($, ttlMs), now, t)
  const parts = [cache === null ? '' : `${ringStep(cache.percent)} ${cache.text}`]
  if (await read($, isPaneOpen)) {
    const r = shownNow.reading
    for (const at of [r?.fiveHourResetsAt, r?.sevenDayResetsAt]) {
      if (at !== undefined) parts.push(countdown(at - now, t.units, COUNTDOWN_STEP))
    }
  }
  return parts.join('|')
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    // Module variables start clean on every load (and in every test of a file).
    nudgedAt = 0
    lastTurnEnd = 0
    lastFace = ''
    lastMeasureAt = 0
    awaitingSettle = false
    hasLoggedRenderError = false
    lastLevel.clear()
    if (await readDisabled($)) return r
    // Language: userConfig > Claude Code's language setting > system locale > English.
    const rows = await $.config.list().catch(() => [])
    const claudeLanguage = rows.find(row => row.key === 'language')?.value
    lang = resolveLang(options.language, claudeLanguage, Intl.DateTimeFormat().resolvedOptions().locale)
    t = STRINGS[lang]
    const stored = await $.store.get(ENABLED_KEY).catch(() => undefined)
    await update($, isEnabled, () => stored !== false)
    // A hot reload keeps $.state: turns from earlier versions with a single cache field are upgraded.
    await update($, history, h => h.map(turn => upgradeTurn(turn)))
    // Taken before the first turn only: a hot reload mid-session keeps the base it had.
    if ((await read($, history)).length === 0) {
      const startUsd = (await $.session.usage().catch(() => undefined))?.cost?.usd
      await update($, costBase, () => startUsd)
    }
    sessionId = await $.session.id().catch(() => '?')
    project = projectName((await $.session.cwd().catch(() => undefined)) ?? '')
    const ttl = await $.store.get(TTL_KEY).catch(() => undefined)
    await update($, ttlMs, () => (ttl === TTL_5M ? TTL_5M : TTL_1H))
    const lastEffort = await $.store.get(EFFORT_KEY).catch(() => undefined)
    await update($, effort, () => jetLevel(lastEffort))
    await loadOthers($)
    await publish($)
    await $.command
      .register({
        name: 'wavy-usage',
        description: t.cmdDescription,
        argumentHint: '[on | off | ttl 5m | ttl 1h]',
        immediate: true,
      })
      .catch(err => $.ui.log(`wavy-usage: /wavy-usage not registered: ${err}`))
    // Once a minute while on: the cache countdown and the pane's reset counters.
    // Once a minute, redraw only if a time-driven figure on screen would read differently: the cache ring's step and
    // countdown, and while the pane is open its reset countdowns. An unchanged screen is left alone.
    $.clock.every(TICK_MS, () => {
      void (async () => {
        // A finished prompt whose settling measurement never came is published on the next tick.
        if (awaitingSettle && (await $.clock.now()) - lastTurnEnd > SETTLE_MS) {
          awaitingSettle = false
          await publish($)
        }
        return clockFace($)
      })()
        .then(face => {
          if (face === null || face === lastFace) return
          lastFace = face
          $.ui.invalidate('ui.render')
        })
        .catch(() => undefined)
    })
    return r
  })

  on('session.measure', async ($, e, next) => {
    const r = await next(e)
    if (disabled) return r
    const fresh = takeReading(e)
    await update($, reading, () => fresh)
    const at = await $.clock.now()
    lastMeasureAt = at
    const pct = fresh.ctxPercent
    const ctxChanged = e.changed.includes('context') && pct !== undefined
    const costChanged = e.changed.includes('cost') && fresh.usd !== undefined
    const fiveChanged = e.changed.includes('rateLimits') && fresh.fiveHour !== undefined
    if (ctxChanged || costChanged || fiveChanged) {
      const now = await $.clock.now()
      const patch = {
        ...(ctxChanged && { ctxPercent: pct }),
        ...(costChanged && { usd: fresh.usd }),
        ...(fresh.fiveHour !== undefined && { fiveHour: fresh.fiveHour }),
      }
      await update($, history, h => settleTurn(h, patch, now))
      await syncOwnLog($)
    }
    // The first reading of a session shows at once; after that only the measurement settling a finished prompt.
    if ((await read($, screen)).reading === null || (awaitingSettle && at - lastTurnEnd <= SETTLE_MS)) {
      awaitingSettle = false
      await publish($)
    }
    if (pct === undefined || !ctxChanged) return r
    const n = nudge(pct, nudgedAt)
    nudgedAt = n.nudgedAt
    if (n.shouldToast && (await read($, isEnabled))) $.ui.toast(nudgeText(pct, t), { timeoutMs: 8000 })
    return r
  })

  // Subagent turns stay out of the history and do not refresh the main conversation's cache clock.
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (disabled || e.agentId || !e.usage) return r
    const usage = e.usage
    const current = await read($, reading)
    const now = await $.clock.now()
    await update($, history, h => recordTurn(h, usage, current?.ctxPercent ?? 0, current?.usd, now, current?.fiveHour))
    await update($, lastRequestAt, () => now)
    lastTurnEnd = now
    await syncOwnLog($)
    // The settling measurement may already have come (the two arrive in no fixed order): publish now. Otherwise wait
    // for it, so the prompt's end draws once.
    if (now - lastMeasureAt <= SETTLE_MS) await publish($)
    else awaitingSettle = true
    return r
  })

  // Every main-loop request names its effort: the jet follows a change on the next request.
  on('turn.step', async function* ($, e, next) {
    if (!disabled && !e.agentId) {
      const level = jetLevel(e.effort)
      if (level !== (await read($, effort).catch(() => null))) {
        await update($, effort, () => level).catch(() => undefined)
        await $.store.set(EFFORT_KEY, level).catch(() => undefined)
      }
    }
    return yield* next(e)
  })

  on('ui.close', async ($, e, next) => {
    const r = await next(e)
    if (e.id === PANE) await update($, isPaneOpen, () => false)
    return r
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (disabled) return next(e)
    if (e.surface !== 'desktop') {
      const { Text } = $.ui.resolve(e)
      return <Text dimColor>{t.desktopOnlyPane}</Text>
    }
    // Closing is the desktop header's own × control; the ui.close hook clears isPaneOpen.
    try {
      const { Box, Button, Svg, Text } = $.ui.resolve(e)
      const shownNow = await read($, screen)
      const r = shownNow.reading
      const turns = shownNow.turns
      const now = await $.clock.now()
      const width = Math.min(640, Math.max(160, e.props.bodyColumns * 7))
      const recent = recentTurns(turns, await read($, costBase))
      const scale = Math.max(0, ...recent.map(({ turn }) => turnTotal(turn)))
      const barWidth = Math.max(60, width - 230)
      const view = await read($, windowView)
      const since = windowStart(view, r, now)
      const entries = [...(await read($, others)), ...shownNow.log]
      const totals = windowTotals(entries, since)
      const shareWidth = Math.max(60, width - 230)
      const ttl = await read($, ttlMs)
      const cache = cacheState(shownNow.lastRequestAt, ttl, now, t)
      const big = (id: string, label: string, percent: number | undefined, extra?: string, value?: string, color?: string) => (
        <Box key={`big-${id}`} flexDirection="column" alignItems="center">
          <Svg
            source={liquidRing(percent, 64, 6, levelFrom(`pane-${id}`, percent), color)}
            alt={`${label} ${value ?? percentText(percent)}`}
            width={64}
            height={64}
            isInteractive
          />
          <Text dimColor>{label}</Text>
          <Text bold>{value ?? percentText(percent)}</Text>
          {extra !== undefined && <Text dimColor>{extra}</Text>}
        </Box>
      )
      const resetWidth = Math.max(60, width - 40)
      const resetRow = (label: string, at: number, length: number, clock: string) => (
        <Box key={`reset-${label}`} flexDirection="column">
          <Box flexDirection="row" gap={1} alignItems="center">
            <Box width={6}>
              <Text bold>{label}</Text>
            </Box>
            <Svg source={resetBar(windowElapsed(at, now, length), resetWidth)} alt={t.elapsedAlt(label)} width={resetWidth} height={8} />
          </Box>
          <Text dimColor>{t.inTime(countdown(at - now, t.units, COUNTDOWN_STEP), clock)}</Text>
        </Box>
      )
      const groupRows = (groups: Group[]) => {
        const max = Math.max(0, ...groups.map(g => g.usd))
        return groups.map(g => (
          <Box key={`g-${g.name}`} flexDirection="row" gap={1} alignItems="center">
            <Box width={14}>
              <Text wrap="truncate">{shownName(g.name)}</Text>
            </Box>
            <Svg
              source={resetBar(max > 0 ? g.usd / max : 0, shareWidth)}
              alt={`${shownName(g.name)}: ${g.usd > 0 ? costText(g.usd) : t.noCost}`}
              width={shareWidth}
              height={8}
            />
            <Box width={7}>
              <Text bold>{g.usd > 0 ? costText(g.usd) : '-'}</Text>
            </Box>
            <Text dimColor>{t.turns(g.turns)}</Text>
          </Box>
        ))
      }
      const legend = [
        ['in', t.legendIn, t.hintIn],
        ['out', t.legendOut, t.hintOut],
        ['cacheWrite', t.legendCacheWrite, t.hintCacheWrite],
        ['cacheRead', t.legendCacheRead, t.hintCacheRead],
      ] as const
      const summary = turnsSummary(recent)
      // Column widths in cells; the bar column's header spans the bar's pixels (about 7 px a cell).
      const COL_TURN = 12
      const COL_TOKENS = 6
      const COL_COST = 7
      const COL_FIVE = 7
      // The bar column's header is drawn at the bar's own pixel width so the columns after it line up.
      const headerCell = (label: string, w: number) =>
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="14"><text x="0" y="11" font-family="system-ui, sans-serif" font-size="12" fill="#888780">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`
      const legendWidth = Math.max(16, Math.floor(width / 7 / 2) - 2)
      const legendItem = ([k, label, hint]: (typeof legend)[number]) => (
        <Box key={`legend-${k}`} flexDirection="row" gap={1} width={legendWidth}>
          <Text color={SEGMENTS[k]}>■</Text>
          <Text dimColor>{`${label}: ${hint}`}</Text>
        </Box>
      )
      const fiveAt = r?.fiveHourResetsAt
      const sevenAt = r?.sevenDayResetsAt
      const level = await read($, effort)
      return (
        <Box flexDirection="column" gap={1}>
          {level !== null && (
            <Box key="jet" flexDirection="column">
              <Svg
                source={jetStrip(level, width, JET_PANE_H, JET_PANE_SCALE, t.effort(level), 'jp')}
                alt={t.effort(level)}
                width={width}
                height={JET_PANE_H}
                isInteractive
              />
              <Text dimColor>{t.effort(level)}</Text>
            </Box>
          )}
          {r === null ? (
            <Text dimColor>{t.waitingPane}</Text>
          ) : (
            <Box flexDirection="row" justifyContent="space-around">
              {r.fiveHour !== undefined && big('5h', t.win5h, r.fiveHour)}
              {r.sevenDay !== undefined && big('7d', t.win7d, r.sevenDay)}
              {big('ctx', t.ctx, r.ctxPercent, r.ctxTokens !== undefined ? `${tokens(r.ctxTokens)} / ${tokens(r.ctxWindow)}` : undefined)}
              {cache !== null && big('cache', t.cache, ringStep(cache.percent), t.ttl(ttlText(ttl, t)), cache.text, ttlColor(cache.percent))}
            </Box>
          )}
          <Box flexDirection="column">
            <Text bold>{t.lastTurns}</Text>
            <Text dimColor>{t.lastTurnsHint}</Text>
          </Box>
          {recent.length === 0 ? (
            <Text dimColor>{t.noTurns}</Text>
          ) : (
            <Box flexDirection="column">
              <Text dimColor>
                {t.turnsTotal(
                  tokens(summary.tokens),
                  summary.cost === null ? '-' : costText(summary.cost),
                  `${t.win5h} ${summary.five === null ? '-' : fiveDeltaText(summary.five, t.fiveReset)}`,
                )}
              </Text>
              <Box key="turn-head" flexDirection="row" gap={1}>
                <Box width={COL_TURN}>
                  <Text dimColor>{t.colTurn}</Text>
                </Box>
                <Svg source={headerCell(t.colSplit, barWidth)} alt={t.colSplit} width={barWidth} height={14} />
                <Box width={COL_TOKENS}>
                  <Text dimColor>{t.colTokens}</Text>
                </Box>
                <Box width={COL_COST}>
                  <Text dimColor>{t.colCost}</Text>
                </Box>
                <Box width={COL_FIVE}>
                  <Text dimColor>{t.win5h}</Text>
                </Box>
              </Box>
              {recent.map(({ turn, delta, cost, five }) => (
                <Box key={`turn-${turn.n}`} flexDirection="row" gap={1} alignItems="center">
                  <Box width={COL_TURN}>
                    <Text dimColor wrap="truncate">{`#${turn.n} ${clockTime(turn.at)}`}</Text>
                  </Box>
                  <Svg
                    source={turnBar(turn, scale, barWidth, [
                      `${t.legendIn}: ${tokens(turn.in)}`,
                      `${t.legendOut}: ${tokens(turn.out)}`,
                      `${t.legendCacheWrite}: ${tokens(turn.cacheWrite)}`,
                      `${t.legendCacheRead}: ${tokens(turn.cacheRead)}`,
                    ])}
                    alt={`${t.barAlt(turn.n, tokens(turn.in), tokens(turn.out), tokens(turn.cacheWrite), tokens(turn.cacheRead))} · ctx ${ctxDeltaText(delta, turn.ctxPercent)}`}
                    width={barWidth}
                    height={10}
                    isInteractive
                  />
                  <Box width={COL_TOKENS}>
                    <Text bold>{tokens(turnTotal(turn))}</Text>
                  </Box>
                  <Box width={COL_COST}>
                    <Text>{costText(cost)}</Text>
                  </Box>
                  <Box width={COL_FIVE}>
                    <Text dimColor>{fiveDeltaText(five, t.fiveReset)}</Text>
                  </Box>
                </Box>
              ))}
              <Box flexDirection="row" gap={2}>
                {legendItem(legend[3])}
                {legendItem(legend[2])}
              </Box>
              <Box flexDirection="row" gap={2}>
                {legendItem(legend[0])}
                {legendItem(legend[1])}
              </Box>
              <Text dimColor>{t.barHint}</Text>
            </Box>
          )}
          <Box flexDirection="row" gap={1} alignItems="center">
            <Text bold>{t.filledBy}</Text>
            <Box flexGrow={1} />
            <Button key="win-5h" label={t.win5h} variant={view === '5h' ? 'primary' : 'secondary'} onPress={() => switchWindow($, '5h')} />
            <Button key="win-7d" label={t.win7d} variant={view === '7d' ? 'primary' : 'secondary'} onPress={() => switchWindow($, '7d')} />
          </Box>
          {totals.turns === 0 ? (
            <Text dimColor>{t.noEntries}</Text>
          ) : (
            <Box flexDirection="column">
              <Text dimColor>{t.summary(view, totals.turns, tokens(totals.tokens), costText(totals.usd))}</Text>
              <Text bold>{t.byProject}</Text>
              {groupRows(breakdown(entries, since, 'project'))}
              <Text bold>{t.byModel}</Text>
              {groupRows(breakdown(entries, since, 'model'))}
            </Box>
          )}
          <Text dimColor>{t.localOnly}</Text>
          {(fiveAt !== undefined || sevenAt !== undefined) && (
            <Box flexDirection="column">
              <Text bold>{t.resets}</Text>
              {fiveAt !== undefined && resetRow(t.win5h, fiveAt, FIVE_HOURS, t.atClock(clockTime(fiveAt)))}
              {sevenAt !== undefined && resetRow(t.win7d, sevenAt, SEVEN_DAYS, dayClock(sevenAt, lang))}
            </Box>
          )}
        </Box>
      )
    } catch (err) {
      logRenderError($, err)
      return next(e)
    }
  })

  // The band: liquid rings and a pane button on desktop, one text line in the terminal. Other plugins' bands stay below.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (disabled || e.props.hasSurvey) return next(e)
    if (!(await read($, isEnabled))) return next(e)
    if (e.surface === 'terminal') {
      try {
        const { Box, Text } = $.ui.resolve(e)
        const shownNow = await read($, screen)
        const r = shownNow.reading
        const cache = cacheState(shownNow.lastRequestAt, await read($, ttlMs), await $.clock.now(), t)
        const rest = await next(e)
        const level = await read($, effort)
        const parts = [
          ...terminalParts(r, cache, e.props.bodyColumns, t),
          ...(level === null ? [] : [{ text: `  ✈ ${level}`, color: JET_TERMINAL_COLOR[level] }]),
        ]
        return (
          <Box flexDirection="column">
            <Text wrap="truncate">
              {parts.map((p, i) => (
                <Text key={String(i)} color={p.color} dimColor={p.dim} bold={p.bold}>
                  {p.text}
                </Text>
              ))}
            </Text>
            {rest}
          </Box>
        )
      } catch (err) {
        logRenderError($, err)
        return next(e)
      }
    }
    if (e.surface !== 'desktop') return next(e)
    try {
      const { Box, Button, Svg, Text } = $.ui.resolve(e)
      const shownNow = await read($, screen)
      const r = shownNow.reading
      const cache = cacheState(shownNow.lastRequestAt, await read($, ttlMs), await $.clock.now(), t)
      const rest = await next(e)
      const layout = bandLayout(e.props.bodyColumns)
      const level = await read($, effort)
      const metric = (id: string, label: string, percent: number | undefined, extra?: string, value?: string, color?: string) => (
        <Box key={`m-${id}`} flexDirection="row" gap={1} alignItems="center">
          <Svg
            source={liquidRing(percent, BAND_RING, BAND_STROKE, levelFrom(`band-${id}`, percent), color)}
            alt={`${label} ${value ?? percentText(percent)}`}
            width={BAND_RING}
            height={BAND_RING}
            isInteractive
          />
          <Box flexDirection="column">
            <Text dimColor>{label}</Text>
            <Box flexDirection="row" gap={1}>
              <Text bold>{value ?? percentText(percent)}</Text>
              {extra !== undefined && <Text dimColor>{`· ${extra}`}</Text>}
            </Box>
          </Box>
        </Box>
      )
      // A finished turn means the API answered: the cache ring shows even before a measurement.
      const cacheMetric = cache !== null && metric('cache', t.cache, ringStep(cache.percent), undefined, cache.text, ttlColor(cache.percent))
      const metrics =
        r === null
          ? [
              metric('5h', t.win5h, undefined),
              metric('7d', t.win7d, undefined),
              metric('ctx', t.ctx, undefined),
              cacheMetric,
              <Text dimColor>{t.waitingBand}</Text>,
            ]
          : [
              r.fiveHour !== undefined && metric('5h', t.win5h, r.fiveHour),
              r.sevenDay !== undefined && metric('7d', t.win7d, r.sevenDay),
              metric('ctx', t.ctx, r.ctxPercent, layout.showCtxTokens && r.ctxTokens !== undefined ? tokens(r.ctxTokens) : undefined),
              cacheMetric,
              layout.showCost && r.usd !== undefined && <Text dimColor>{`$${r.usd.toFixed(2)}`}</Text>,
            ]
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" gap={2} alignItems="center">
            {metrics}
            <Box flexGrow={1} />
            {level !== null && layout.showJet && (
              <Svg
                key="jet"
                source={jetStrip(level, JET_W, JET_H, JET_SCALE, t.effort(level), 'jb')}
                alt={t.effort(level)}
                width={JET_W}
                height={JET_H}
                isInteractive
              />
            )}
            <Button key="pane" label={t.panel} dimColor onPress={() => togglePane($)} />
          </Box>
          {rest}
        </Box>
      )
    } catch (err) {
      logRenderError($, err)
      return next(e)
    }
  })

  on('command.run', { command: 'wavy-usage' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'on') {
      await update($, isEnabled, () => true)
      await $.store.set(ENABLED_KEY, true).catch(() => undefined)
      const u = await $.session.usage().catch(() => undefined)
      if (u) {
        await update($, reading, () => takeReading(u))
        await publish($)
      }
      return { text: t.turnedOn }
    }
    if (arg === 'off') {
      await update($, isEnabled, () => false)
      await $.store.set(ENABLED_KEY, false).catch(() => undefined)
      if (await read($, isPaneOpen)) await closePane($)
      return { text: t.turnedOff }
    }
    const ttl = /^ttl\s+(\S+)$/.exec(arg)
    if (ttl) {
      const ms = parseTtl(ttl[1] ?? '')
      if (ms === undefined) return { text: t.ttlUnknown(ttl[1] ?? '') }
      await update($, ttlMs, () => ms)
      await $.store.set(TTL_KEY, ms).catch(() => undefined)
      return { text: t.ttlSet(ttlText(ms, t)) }
    }
    if (arg === '') {
      if (!(await read($, isEnabled))) return { text: t.turnedOff }
      const wasOpen = await read($, isPaneOpen)
      await togglePane($)
      return { text: wasOpen ? t.paneClosed : t.paneOpened }
    }
    return { text: t.argUnknown(arg) }
  })
}
