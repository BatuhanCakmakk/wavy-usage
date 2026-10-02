import { describe, expect, test } from 'claude-code/testing'

import { COLORS, liquidRing, resetBar, SEGMENTS, turnBar } from '../hooks/svg'

const arcLength = (svg: string): number => Number(/stroke-dasharray="([\d.]+) /.exec(svg)?.[1] ?? 'NaN')

describe('liquidRing', () => {
  test('a valid svg and a track circle', async () => {
    const svg = liquidRing(34, 22, 3)
    expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"')
    expect(svg).toContain('stroke-opacity="0.3"')
  })

  test('the arc length follows the percentage', async () => {
    const r = (22 - 3) / 2
    const c = 2 * Math.PI * r
    expect(Math.abs(arcLength(liquidRing(50, 22, 3)) - c / 2)).toBeLessThan(0.01)
    expect(Math.abs(arcLength(liquidRing(25, 22, 3)) - c / 4)).toBeLessThan(0.01)
  })

  test('color by threshold', async () => {
    expect(liquidRing(34, 22, 3)).toContain(COLORS.calm)
    expect(liquidRing(62, 22, 3)).toContain(COLORS.warn)
    expect(liquidRing(80, 22, 3)).toContain(COLORS.hot)
  })

  test('no arc and no liquid without a value or at 0', async () => {
    for (const svg of [liquidRing(undefined, 22, 3), liquidRing(0, 22, 3)]) {
      expect(svg).not.toContain('stroke-dasharray')
      expect(svg).not.toContain('<path')
    }
  })

  test('above 100 is clamped', async () => {
    const r = (64 - 6) / 2
    expect(Math.abs(arcLength(liquidRing(140, 64, 6)) - 2 * Math.PI * r)).toBeLessThan(0.01)
  })

  test('two endless waves clipped to the inner circle', async () => {
    const svg = liquidRing(50, 64, 6)
    expect(svg).toContain('<clipPath id="liq"><circle cx="32" cy="32" r="24.00"/></clipPath>')
    expect(svg.match(/repeatCount="indefinite"/g)).toHaveLength(2)
    expect(svg).toContain('dur="2.2s"')
    expect(svg).toContain('dur="3.4s"')
  })

  test('the 50% level sits at the center', async () => {
    const svg = liquidRing(50, 64, 6)
    expect(svg).toContain('<path d="M8.00 32.00 ')
    expect(svg).toContain('<path d="M-16.00 32.00 ')
  })

  test('the level rises once given from, no animation when equal', async () => {
    const rising = liquidRing(50, 64, 6, 0)
    expect(rising).toContain('from="0 24.00" to="0 0" dur="1.2s" fill="freeze"')
    expect(liquidRing(50, 64, 6, 50)).not.toContain('fill="freeze"')
    expect(liquidRing(50, 64, 6)).not.toContain('fill="freeze"')
  })

  test('a given color replaces the heat color', async () => {
    const svg = liquidRing(90, 44, 5, undefined, '#123456')
    expect(svg).toContain('stroke="#123456"')
    expect(svg).not.toContain(COLORS.hot)
  })

  test('stays small', async () => {
    expect(liquidRing(62, 64, 6, 10).length).toBeLessThan(3000)
  })
})

describe('resetBar', () => {
  test('the filled part follows the fraction', async () => {
    const svg = resetBar(0.5, 200)
    expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="8"')
    expect(svg).toContain('<rect width="100.00" height="8"')
  })

  test('only the track at 0', async () => {
    expect(resetBar(0, 200).match(/<rect /g)).toHaveLength(1)
  })
})

describe('turnBar', () => {
  test('segments in order (in, out, cache write, cache read) and to scale', async () => {
    const svg = turnBar({ in: 10, out: 30, cacheWrite: 20, cacheRead: 40 }, 200, 100)
    expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="10"')
    expect(svg).toContain(`<rect x="0.00" width="5.00" height="10" fill="${SEGMENTS.in}"`)
    expect(svg).toContain(`<rect x="5.00" width="15.00" height="10" fill="${SEGMENTS.out}"`)
    expect(svg).toContain(`<rect x="20.00" width="10.00" height="10" fill="${SEGMENTS.cacheWrite}"`)
    expect(svg).toContain(`<rect x="30.00" width="20.00" height="10" fill="${SEGMENTS.cacheRead}" fill-opacity="0.45"`)
  })

  test('only the clip and the background at zero scale', async () => {
    expect(turnBar({ in: 0, out: 0, cacheWrite: 0, cacheRead: 0 }, 0, 100).match(/<rect /g)).toHaveLength(2)
  })
})
