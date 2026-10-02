import { describe, expect, mock, test, tier } from 'claude-code/testing'
import type { CommandRunInput, On, RenderPropsOf, SessionMeasureInput, SessionStartInput, TurnCompleteInput } from 'claude-code'

tier('user')

const MIN = 60 * 1000
const HOUR = 60 * MIN
const NOW = 1_700_000_000_000
const PLUGIN = 'wavy-usage'

const session: SessionStartInput = { surface: 'desktop', isInteractive: true, cwd: '/work' }

const measure = (over: Partial<SessionMeasureInput> = {}): SessionMeasureInput => ({
  context: { window: 200_000, tokens: 124_000, percent: 62 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 34, resetsAt: new Date(NOW + 2 * HOUR + 10 * MIN).toISOString() },
    { kind: 'seven_day', percentUsed: 12 },
  ],
  cost: { usd: 1.23 },
  changed: ['context', 'rateLimits', 'cost'],
  ...over,
})

const ctx = (percent: number): Partial<SessionMeasureInput> => ({
  context: { window: 200_000, tokens: percent * 2000, percent },
  changed: ['context'],
})

type AnsweredTurn = Exclude<TurnCompleteInput, { reason: 'refusal' }>
const turn = (over: Partial<AnsweredTurn> = {}): TurnCompleteInput => ({
  answer: 'ok',
  durationMs: 1000,
  isAborted: false,
  turnId: 't1',
  reason: 'answer',
  usage: { input_tokens: 2000, output_tokens: 300, cache_read_input_tokens: 40_000, cache_creation_input_tokens: 5_000, model: 'claude-opus-5-5' },
  ...over,
})

const command = (args: string): CommandRunInput => ({
  command: 'wavy-usage', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 },
})

const bandProps = (bodyColumns = 100): RenderPropsOf['AbovePrompt'] => ({
  hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns, scroll: { offset: 0, bodyRows: 10 }, view: {},
})

const paneProps = (bodyColumns = 60): RenderPropsOf['Pane'] => ({
  title: 'Kullanım', isFocused: false, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {},
})

const ENGINE_BAND = { type: 'Text', children: [''] }

function world(on: On, opts: { env?: Record<string, string>; store?: Record<string, unknown>; claudeLanguage?: string } = {}) {
  const toasts: string[] = []
  const opened: string[] = []
  const closed: string[] = []
  let invalidations = 0
  // The test's $ has no store and one event takes one hook: an in-memory store instead of mock.store,
  // so the keys the mod writes and deletes are visible directly.
  const stored = new Map<string, unknown>(Object.entries(opts.store ?? {}))
  const deleted: string[] = []
  on('store.get', ($, e) => ({ value: stored.get(e.key) }))
  on('store.set', ($, e) => {
    stored.set(e.key, JSON.parse(JSON.stringify(e.value)))
    return { value: undefined }
  })
  on('store.delete', ($, e) => {
    deleted.push(e.key)
    stored.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...stored.keys()] }))
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, opts.env ?? {})
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('session.id', () => ({ value: 's-1' }))
  on('session.cwd', () => ({ value: 'C:\\work\\Claude Mods' }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  // With language auto, Claude Code's language setting is read; fixed here so tests do not depend on the machine's locale.
  on('config.list', () => ({ value: [{ key: 'language', value: opts.claudeLanguage ?? 'turkish' }] }))
  on('session.usage', () => ({ value: { startedAt: NOW, ...measure(), cost: { usd: 0 } } }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.invalidate', () => {
    invalidations += 1
    return { value: undefined }
  })
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.log', () => ({ value: undefined }))
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', ($, e) => {
    closed.push(e.id)
    return { value: undefined }
  })
  on('ui.render', { component: 'AbovePrompt' }, () => ENGINE_BAND)
  on('ui.render', { component: 'Pane' }, () => ({ type: 'Text', children: ['engine pane'] }))
  return { clock, toasts, opened, closed, stored, deleted, invalidations: () => invalidations }
}

describe('toast', () => {
  test('once per new tenth after ctx passes 55', async ($, on) => {
    const w = world(on)
    await $.session.start(session)
    for (const p of [40, 56, 58, 61]) await $.session.measure(measure(ctx(p)))
    expect(w.toasts).toEqual([
      'context %56 · yeni iş ise /clear, devam için /compact',
      'context %61 · yeni iş ise /clear, devam için /compact',
    ])
  })

  test('no toast while off', async ($, on) => {
    const w = world(on, { store: { 'wavy-usage:enabled': false } })
    await $.session.start(session)
    await $.session.measure(measure(ctx(70)))
    expect(w.toasts).toEqual([])
  })

  test('nothing happens under CLAUDE_MODS_DISABLE', async ($, on) => {
    const w = world(on, { env: { CLAUDE_MODS_DISABLE: 'wavy-usage' } })
    await $.session.start(session)
    await $.session.measure(measure(ctx(70)))
    expect(w.toasts).toEqual([])
  })
})

describe('panel', () => {
  test('a waiting note without a reading, a note instead of turns when there are none', async ($, on) => {
    world(on)
    await $.session.start(session)
    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', props: paneProps(), requestId: 'wavy-usage' })
    expect(await pane.find({ type: 'Text', text: 'İlk yanıt bekleniyor' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'Henüz tamamlanan tur yok' })).toBeDefined()
  })

  test('three large rings, values and the reset counter', async ($, on) => {
    world(on)
    await $.session.start(session)
    await $.session.measure(measure())
    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', props: paneProps(), requestId: 'wavy-usage' })
    const rings = await pane.findAll({ type: 'Svg' })
    expect(rings.filter(s => s.props.width === 64)).toHaveLength(3)
    expect(await pane.find({ type: 'Text', text: '34%' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: '124k / 200k' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: '2s 10dk sonra · saat' })).toBeDefined()
    expect(rings.filter(s => s.props.width === 64).every(s => s.props.isInteractive === true)).toBe(true)
  })

  test('last 5 turns: newest on top, total, cost and ctx change', async ($, on) => {
    const w = world(on)
    await $.session.start(session)
    const usds = [1, 1.2, 1.5, 1.5, 2.5, 2.6]
    for (const [i, p] of [10, 12, 15, 15, 30, 10].entries()) {
      await $.turn.complete(turn({ turnId: `t${i}` }))
      await $.session.measure(measure({ ...ctx(p), cost: { usd: usds[i] ?? 0 }, changed: ['context', 'cost'] }))
      await w.clock.advance(30 * 1000)
    }
    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', props: paneProps(), requestId: 'wavy-usage' })
    const labels = (await pane.findAll({ type: 'Text', text: /^#\d+ \d/ })).map(t => String(t.text).split(' ')[0])
    expect(labels).toEqual(['#6', '#5', '#4', '#3', '#2'])
    for (const head of ['Tur', 'Token', 'Maliyet', '5s']) {
      expect(await pane.find({ type: 'Text', text: head })).toBeDefined()
    }
    expect(await pane.findAll({ type: 'Text', text: '47k' })).toHaveLength(5)
    const bars = (await pane.findAll({ type: 'Svg' })).filter(s => String(s.props.alt).startsWith('Tur '))
    expect(bars).toHaveLength(5)
    expect(String(bars[0]?.props.alt)).toBe('Tur 6: 2k in, 300 out, 5k cache yazma, 40k cache okuma · ctx -20%')
    expect(bars.every(b => b.props.isInteractive === true)).toBe(true)
    expect(String(bars[0]?.props.source)).toContain('<title>cache okuma: 40k</title>')
    expect(await pane.find({ type: 'Text', text: '$0.10' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: '$1.00' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: '<$0.01' })).toBeDefined()
    for (const label of ['cache yazma: yeni içeriği saklama', 'cache okuma: sohbeti yeniden okuma (ucuz)']) {
      expect(await pane.find({ type: 'Text', text: label })).toBeDefined()
    }
  })

  test('a subagent turn stays out of the history', async ($, on) => {
    const w = world(on)
    await $.session.start(session)
    await $.turn.complete(turn())
    await $.turn.complete(turn({ agentId: 'a1' }))
    // No settling measurement came: the next minute tick publishes the finished prompt.
    await w.clock.advance(MIN)
    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', props: paneProps(), requestId: 'wavy-usage' })
    const labels = (await pane.findAll({ type: 'Text', text: /^#\d+ \d/ })).map(t => String(t.text).split(' ')[0])
    expect(labels).toEqual(['#1'])
  })

  test("closing is the desktop header's control: the pane's only buttons are the window tabs", async ($, on) => {
    world(on)
    await $.session.start(session)
    await $.session.measure(measure())
    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', props: paneProps(), requestId: 'wavy-usage' })
    expect((await pane.findAll({ type: 'Button' })).map(b => b.key)).toEqual(['win-5h', 'win-7d'])
  })

  test('a 1M window writes tokens in millions', async ($, on) => {
    world(on)
    await $.session.start(session)
    await $.session.measure(measure({ context: { window: 1_000_000, tokens: 304_000, percent: 30 } }))
    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', props: paneProps(), requestId: 'wavy-usage' })
    expect(await pane.find({ type: 'Text', text: '304k / 1M' })).toBeDefined()
  })

  test('a note in the terminal, which has no Svg', async ($, on) => {
    world(on)
    await $.session.start(session)
    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', props: paneProps(), requestId: 'wavy-usage' })
    expect(await pane.find({ type: 'Text', text: "yalnızca desktop'ta" })).toBeDefined()
  })
})

describe('band', () => {
  test('mid-turn measurements wait: the rings move when the prompt finishes', async ($, on) => {
    const w = world(on)
    await $.session.start(session)
    await $.session.measure(measure(ctx(30)))
    await $.turn.complete(turn())
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: bandProps() })
    await w.clock.advance(10 * 1000)
    await $.session.measure(measure(ctx(60)))
    await band.redraw()
    expect(await band.find({ type: 'Text', text: '30%' })).toBeDefined()
    expect(await band.findAll({ type: 'Text', text: '60%' })).toHaveLength(0)
    await $.turn.complete(turn({ turnId: 't2' }))
    await band.redraw()
    expect(await band.find({ type: 'Text', text: '60%' })).toBeDefined()
  })

  test('a redraw at the same values keeps every ring source identical (no frame reload)', async ($, on) => {
    world(on)
    await $.session.start(session)
    await $.session.measure(measure())
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: bandProps() })
    await band.redraw()
    const first = (await band.findAll({ type: 'Svg' })).map(s => s.props.source)
    await band.redraw()
    const second = (await band.findAll({ type: 'Svg' })).map(s => s.props.source)
    expect(second).toEqual(first)
  })

  test('the last known high effort flies the jet left of the pane button, not on a narrow band', async ($, on) => {
    world(on, { store: { 'wavy-usage:effort': 'max' } })
    await $.session.start(session)
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: bandProps() })
    const jets = (await band.findAll({ type: 'Svg' })).filter(s => s.props.alt === 'Efor: max')
    expect(jets).toHaveLength(1)
    const narrow = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: bandProps(60) })
    expect((await narrow.findAll({ type: 'Svg' })).filter(s => s.props.alt === 'Efor: max')).toHaveLength(0)
  })

  test('three empty rings and a waiting note before the first reading', async ($, on) => {
    world(on)
    await $.session.start(session)
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: bandProps() })
    expect(await band.findAll({ type: 'Svg' })).toHaveLength(3)
    expect(await band.find({ type: 'Text', text: 'ilk yanıt bekleniyor' })).toBeDefined()
  })

  test('rings, percentages, tokens and cost once a measurement arrives', async ($, on) => {
    world(on)
    await $.session.start(session)
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: bandProps() })
    await $.session.measure(measure())
    for (const text of ['34%', '12%', '62%', '124k', '$1.23']) {
      expect(await band.find({ type: 'Text', text })).toBeDefined()
    }
    expect(await band.findAll({ type: 'Svg' })).toHaveLength(3)
  })

  test('a narrow band drops the cost, then the tokens; percentages stay', async ($, on) => {
    world(on)
    await $.session.start(session)
    await $.session.measure(measure())
    const mid = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: bandProps(60) })
    expect(await mid.find({ type: 'Text', text: '$1.23' })).toBeUndefined()
    expect(await mid.find({ type: 'Text', text: '124k' })).toBeDefined()
    const narrow = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: bandProps(50) })
    expect(await narrow.find({ type: 'Text', text: '124k' })).toBeUndefined()
    expect(await narrow.find({ type: 'Text', text: '62%' })).toBeDefined()
  })

  test('off a subscription: only the ctx ring', async ($, on) => {
    world(on)
    await $.session.start(session)
    await $.session.measure(measure({ rateLimits: [] }))
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: bandProps() })
    expect(await band.findAll({ type: 'Svg' })).toHaveLength(1)
  })

  test("a one-line text band in the terminal; the engine's drawing during a survey", async ($, on) => {
    world(on)
    await $.session.start(session)
    await $.session.measure(measure())
    const term = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: bandProps() })
    expect(await term.find({ type: 'Text', text: '◔ 5s 34%' })).toBeDefined()
    expect(await term.findAll({ type: 'Button' })).toHaveLength(0)
    const survey = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: { ...bandProps(), hasSurvey: true } })
    expect(await survey.drawn()).toEqual(ENGINE_BAND)
  })

  test('the Panel button opens the pane, a second press closes it', async ($, on) => {
    const w = world(on)
    await $.session.start(session)
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: bandProps() })
    await band.press({ key: 'pane' })
    expect(w.opened).toEqual(['wavy-usage'])
    await band.press({ key: 'pane' })
    expect(w.closed).toEqual(['wavy-usage'])
  })

  test('the minute timer redraws only when a time-driven figure changes, never while off', async ($, on) => {
    const w = world(on)
    await $.session.start(session)
    await $.turn.complete(turn())
    await w.clock.advance(MIN)
    const first = w.invalidations()
    await w.clock.advance(MIN)
    expect(w.invalidations()).toBe(first)
    await w.clock.advance(4 * MIN)
    expect(w.invalidations()).toBeGreaterThan(first)
    await $.command.run(command('off'))
    const off = w.invalidations()
    await w.clock.advance(MIN)
    expect(w.invalidations()).toBe(off)
  })

  test('no band when the kept preference is off or under CLAUDE_MODS_DISABLE', async ($, on) => {
    world(on, { store: { 'wavy-usage:enabled': false } })
    await $.session.start(session)
    await $.session.measure(measure())
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: bandProps() })
    expect(await band.drawn()).toEqual(ENGINE_BAND)
  })

  test('2x band: 44px rings, percentage and tokens under the label', async ($, on) => {
    world(on)
    await $.session.start(session)
    await $.session.measure(measure())
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: bandProps() })
    const rings = await band.findAll({ type: 'Svg' })
    expect(rings.map(s => [s.props.width, s.props.height])).toEqual([[44, 44], [44, 44], [44, 44]])
    expect(await band.find({ type: 'Text', text: '· 124k' })).toBeDefined()
    const columns = (await band.findAll({ type: 'Box', text: /^5s\s*34%$/ })).filter(b => b.props.flexDirection === 'column')
    expect(columns).toHaveLength(1)
  })

  test('rings are interactive and liquid; they rise on the first draw and keep the same source on a redraw', async ($, on) => {
    world(on)
    await $.session.start(session)
    await $.session.measure(measure())
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: bandProps() })
    const first = await band.findAll({ type: 'Svg' })
    expect(first.every(s => s.props.isInteractive === true)).toBe(true)
    expect(first.every(s => String(s.props.source).includes('<clipPath id="liq">'))).toBe(true)
    expect(first.every(s => String(s.props.source).includes('fill="freeze"'))).toBe(true)
    await band.redraw()
    const again = await band.findAll({ type: 'Svg' })
    expect(again.map(s => s.props.source)).toEqual(first.map(s => s.props.source))
  })
})

describe('/wavy-usage', () => {
  test('no argument opens and closes the pane', async ($, on) => {
    const w = world(on)
    await $.session.start(session)
    expect(await $.command.run(command(''))).toEqual({ text: 'Panel açıldı' })
    expect(w.opened).toEqual(['wavy-usage'])
    expect(await $.command.run(command(''))).toEqual({ text: 'Panel kapandı' })
    expect(w.closed).toEqual(['wavy-usage'])
  })

  test('off hides the band and closes the pane; on brings it back', async ($, on) => {
    const w = world(on)
    await $.session.start(session)
    await $.session.measure(measure())
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: bandProps() })
    await $.command.run(command(''))
    expect(await $.command.run(command('off'))).toEqual({ text: 'wavy-usage kapalı. Açmak için /wavy-usage on' })
    expect(w.closed).toEqual(['wavy-usage'])
    await band.redraw()
    expect(await band.drawn()).toEqual(ENGINE_BAND)
    expect(await $.command.run(command(''))).toEqual({ text: 'wavy-usage kapalı. Açmak için /wavy-usage on' })
    expect(await $.command.run(command('on'))).toEqual({ text: 'wavy-usage açık' })
    await band.redraw()
    expect(await band.find({ type: 'Text', text: '34%' })).toBeDefined()
  })

  test('the preference is kept: a new session after off starts off', async ($, on) => {
    world(on, { store: {} })
    await $.session.start(session)
    await $.command.run(command('off'))
    await $.session.start(session)
    await $.session.measure(measure())
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: bandProps() })
    expect(await band.drawn()).toEqual(ENGINE_BAND)
  })

  test('unknown argument', async ($, on) => {
    world(on)
    await $.session.start(session)
    expect(await $.command.run(command('sgd'))).toEqual({ text: 'wavy-usage: "sgd" tanınmadı. Kullanım: /wavy-usage [on | off | ttl 5m | ttl 1h]' })
  })
})

const HOUR_MS = 60 * MIN

describe('cache TTL', () => {
  test('a fourth ring after the first turn; time runs down, cold when out', async ($, on) => {
    const w = world(on)
    await $.session.start(session)
    await $.session.measure(measure())
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: bandProps() })
    expect(await band.findAll({ type: 'Svg' })).toHaveLength(3)
    await $.turn.complete(turn())
    expect(await band.findAll({ type: 'Svg' })).toHaveLength(4)
    await w.clock.advance(13 * MIN)
    await band.redraw()
    expect(await band.find({ type: 'Text', text: '50dk' })).toBeDefined()
    await w.clock.advance(47 * MIN)
    await band.redraw()
    expect(await band.find({ type: 'Text', text: 'soğuk' })).toBeDefined()
  })

  test('a subagent turn does not refresh the cache clock', async ($, on) => {
    const w = world(on)
    await $.session.start(session)
    await $.turn.complete(turn())
    await w.clock.advance(30 * MIN)
    await $.turn.complete(turn({ agentId: 'a1' }))
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: bandProps() })
    expect(await band.find({ type: 'Text', text: '30dk' })).toBeDefined()
  })

  test('ttl 5m shortens it and carries to the next session', async ($, on) => {
    const w = world(on)
    await $.session.start(session)
    expect(await $.command.run(command('ttl 5m'))).toEqual({ text: 'cache TTL: 5 dakika' })
    expect(await $.command.run(command('ttl 2h'))).toEqual({ text: 'wavy-usage: "2h" tanınmadı. Kullanım: /wavy-usage ttl 5m | ttl 1h' })
    await $.session.start(session)
    await $.turn.complete(turn())
    await w.clock.advance(2 * MIN)
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: bandProps() })
    expect(await band.find({ type: 'Text', text: '3dk' })).toBeDefined()
  })
})

describe('what filled the window', () => {
  const other = (at: number, project: string, model: string, usd: number) => ({ id: '1', at, project, model, tokens: 1000, usd })

  test("this session's turns and other sessions' logs by project and model", async ($, on) => {
    const w = world(on, {
      store: {
        'wavy-usage:log:s-0': [other(NOW - HOUR_MS, 'volty-api', 'sonnet-5-5', 0.4)],
        'wavy-usage:log:s-old': [other(NOW - 9 * 24 * HOUR_MS, 'eski', 'haiku-4-5', 1)],
      },
    })
    await $.session.start(session)
    for (const [i, usd] of [1, 1.5, 2.5].entries()) {
      await $.turn.complete(turn({ turnId: `t${i}`, usage: { input_tokens: 2000, output_tokens: 300, cache_read_input_tokens: 40_000, cache_creation_input_tokens: 5_000, model: 'claude-opus-5-5' } }))
      await $.session.measure(measure({ ...ctx(10 + i), cost: { usd }, changed: ['context', 'cost'] }))
      await w.clock.advance(MIN)
    }
    await $.command.run(command(''))
    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', props: paneProps(), requestId: 'wavy-usage' })
    expect(await pane.find({ type: 'Text', text: 'Claude Mods' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'volty-api' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'opus-5-5' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'sonnet-5-5' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: '$2.50' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'Son 5 saatte 4 tur' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'eski' })).toBeUndefined()
    expect(w.deleted).toContain('wavy-usage:log:s-old')
    expect(w.deleted).not.toContain('wavy-usage:log:s-0')
    const own = w.stored.get('wavy-usage:log:s-1')
    expect(Array.isArray(own) && own.length).toBe(3)
  })

  test('the 7d tab shows older entries too', async ($, on) => {
    world(on, { store: { 'wavy-usage:log:s-0': [other(NOW - 2 * 24 * HOUR_MS, 'dotfiles', 'haiku-4-5', 0.2)] } })
    await $.session.start(session)
    await $.session.measure(measure())
    await $.command.run(command(''))
    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', props: paneProps(), requestId: 'wavy-usage' })
    expect(await pane.find({ type: 'Text', text: 'dotfiles' })).toBeUndefined()
    expect(await pane.find({ type: 'Text', text: 'Bu pencerede kayıt yok' })).toBeDefined()
    await pane.press({ key: 'win-7d' })
    expect(await pane.find({ type: 'Text', text: 'dotfiles' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'Son 7 günde 1 tur' })).toBeDefined()
  })

  test("a turn without a model is logged with the session's model", async ($, on) => {
    world(on)
    await $.session.start(session)
    const noModel = { input_tokens: 2000, output_tokens: 300, cache_read_input_tokens: 40_000, cache_creation_input_tokens: 5_000 }
    await $.turn.complete(turn({ usage: noModel as AnsweredTurn['usage'] }))
    await $.session.measure(measure())
    await $.command.run(command(''))
    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', props: paneProps(), requestId: 'wavy-usage' })
    expect(await pane.find({ type: 'Text', text: 'opus-5-5' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'bilinmiyor' })).toBeUndefined()
  })
})

describe("resets and the pane's cache ring", () => {
  test("7d reset with a weekday; the pane's cache ring after the first turn", async ($, on) => {
    world(on)
    await $.session.start(session)
    await $.session.measure(
      measure({
        rateLimits: [
          { kind: 'five_hour', percentUsed: 34, resetsAt: new Date(NOW + 2 * HOUR + 10 * MIN).toISOString() },
          { kind: 'seven_day', percentUsed: 12, resetsAt: new Date(NOW + 2 * 24 * HOUR + 5 * HOUR + 30 * MIN).toISOString() },
        ],
      }),
    )
    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', props: paneProps(), requestId: 'wavy-usage' })
    expect(await pane.find({ type: 'Text', text: /^2g 5s sonra · (Paz|Pzt|Sal|Çar|Per|Cum|Cmt) \d\d:\d\d$/ })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: '2s 10dk sonra · saat' })).toBeDefined()
    const big = async () => (await pane.findAll({ type: 'Svg' })).filter(s => s.props.width === 64)
    expect(await big()).toHaveLength(3)
    await $.turn.complete(turn())
    expect(await big()).toHaveLength(4)
    expect(await pane.find({ type: 'Text', text: 'TTL 1 saat' })).toBeDefined()
  })
})

describe('language', () => {
  test('userConfig en: band, pane and command in English', { options: { language: 'en' } }, async ($, on) => {
    world(on)
    await $.session.start(session)
    await $.session.measure(measure())
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: bandProps() })
    expect(await band.find({ type: 'Text', text: '5h' })).toBeDefined()
    expect(await band.find({ type: 'Text', text: '7d' })).toBeDefined()
    expect(await $.command.run(command(''))).toEqual({ text: 'Pane opened' })
    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', props: paneProps(), requestId: 'wavy-usage' })
    expect(await pane.find({ type: 'Text', text: 'Last 5 turns' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: /^in 2h 10m · at \d\d:\d\d$/ })).toBeDefined()
  })

  test("auto: Japanese when Claude Code's language is japanese", async ($, on) => {
    world(on, { claudeLanguage: 'japanese' })
    await $.session.start(session)
    await $.session.measure(measure())
    const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: bandProps() })
    expect(await band.find({ type: 'Text', text: '5時間' })).toBeDefined()
  })
})
