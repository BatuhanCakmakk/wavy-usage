import { describe, expect, test } from 'claude-code/testing'

import { STRINGS } from '../hooks/i18n'
import { glyph, terminalParts } from '../hooks/terminal'

const r = { fiveHour: 34, sevenDay: 12, ctxPercent: 62, ctxTokens: 124_000, ctxWindow: 200_000, usd: 1.23 }
const text = (parts: { text: string }[]) => parts.map(p => p.text).join('')

describe('terminal band', () => {
  test('quarter-circle glyphs', async () => {
    expect([0, 20, 50, 70, 95].map(glyph)).toEqual(['○', '◔', '◑', '◕', '●'])
  })
  test('the full line, colors by heat', async () => {
    const parts = terminalParts(r, { percent: 78, text: '47dk', isWarm: true }, 120, STRINGS.tr)
    expect(text(parts)).toBe('◔ 5s 34%  ○ 7g 12%  ◑ ctx 62% 124k  ◕ cache 47dk  $1.23')
    expect(parts.find(p => p.text === '62%')?.color).toBe('yellow')
    expect(parts.find(p => p.text === '34%')?.color).toBe('green')
  })
  test('a narrow terminal drops the cost, then the tokens', async () => {
    expect(text(terminalParts(r, null, 60, STRINGS.en))).toBe('◔ 5h 34%  ○ 7d 12%  ◑ ctx 62% 124k')
    expect(text(terminalParts(r, null, 50, STRINGS.en))).toBe('◔ 5h 34%  ○ 7d 12%  ◑ ctx 62%')
  })
  test('waiting without a reading', async () => {
    expect(text(terminalParts(null, null, 120, STRINGS.en))).toBe('○ 5h -  ○ 7d -  ○ ctx -  waiting for the first reply')
  })
  test('a cold cache is dim', async () => {
    const parts = terminalParts(r, { percent: 0, text: 'cold', isWarm: false }, 120, STRINGS.en)
    expect(text(parts)).toContain('○ cache cold')
  })
})
