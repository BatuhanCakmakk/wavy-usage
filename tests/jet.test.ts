import { describe, expect, test } from 'claude-code/testing'

import { jetLevel, jetStrip, PACE } from '../hooks/jet'

describe('jet', () => {
  test('every effort level flies; a budget flies as max; no effort, no jet', async () => {
    expect(['low', 'medium', 'high', 'xhigh', 'max'].map(jetLevel)).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
    expect([jetLevel(8000), jetLevel(undefined), jetLevel('turbo')]).toEqual(['max', null, null])
  })

  test('low effort answers fastest: the shortest cycle and the fastest wind', async () => {
    expect(PACE.low.period).toBeLessThan(PACE.medium.period)
    expect(PACE.high.period).toBeLessThan(PACE.max.period)
    expect(PACE.low.wind).toBeLessThan(PACE.max.wind)
  })

  test('a sized svg whose cycle and flame follow the effort', async () => {
    const high = jetStrip('high', 400, 84, 2.6, 'Effort: high')
    const max = jetStrip('max', 400, 84, 2.6, 'Effort: max')
    expect(high).toStartWith('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="84"')
    expect(high).toContain(`dur="${PACE.high.period}s"`)
    expect(max).toContain(`dur="${PACE.max.period}s"`)
    expect(max).toContain(PACE.max.color)
    expect(max).toContain('<title>Effort: max</title>')
  })

  test('band and pane keep the same pace: wind speed follows the jet size', async () => {
    const band = jetStrip('high', 130, 44, 1.25, 'Effort: high')
    const pane = jetStrip('high', 440, 84, 2.6, 'Effort: high')
    expect(band).toContain(`dur="${Number(((PACE.high.wind * 170) / 340).toFixed(2))}s" begin`)
    expect(pane).toContain(`dur="${Number(((PACE.high.wind * 480 * 1.25) / (340 * 2.6)).toFixed(2))}s" begin`)
  })
})
