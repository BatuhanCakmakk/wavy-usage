import { describe, expect, test } from 'claude-code/testing'

import { langFromText, LANGS, resolveLang, STRINGS } from '../hooks/i18n'

describe('STRINGS', () => {
  test('every language has every key, of the same type', async () => {
    const keys = Object.keys(STRINGS.en).sort()
    for (const lang of LANGS) {
      const s = STRINGS[lang] as Record<string, unknown>
      expect(Object.keys(s).sort()).toEqual(keys)
      for (const k of keys) expect(typeof s[k]).toBe(typeof (STRINGS.en as Record<string, unknown>)[k])
    }
  })

  test('function strings are never empty', async () => {
    for (const lang of LANGS) {
      const s = STRINGS[lang]
      for (const text of [
        s.turnsTotal('1k', '$1', '5h +1%'),
        s.turns(2),
        s.summary('5h', 2, '1M', '$1.00'),
        s.inTime('2h', '16:00'),
        s.atClock('16:00'),
        s.ttl('1h'),
        s.nudge(62),
        s.ttlSet('1h'),
        s.ttlUnknown('x'),
        s.argUnknown('x'),
        s.barAlt(1, '1k', '2k', '3k', '4k'),
        s.elapsedAlt('5h'),
      ]) {
        expect(text.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('resolveLang', () => {
  test('an explicit choice wins', async () => {
    expect(resolveLang('ja', 'turkish', 'tr-TR')).toBe('ja')
  })

  test("auto: Claude Code's language (English or native name), then the locale, then en", async () => {
    expect(resolveLang('auto', 'Türkçe', 'en-US')).toBe('tr')
    expect(resolveLang('auto', 'japanese', undefined)).toBe('ja')
    expect(resolveLang('auto', '한국어', undefined)).toBe('ko')
    expect(resolveLang('auto', undefined, 'pt-PT')).toBe('pt-BR')
    expect(resolveLang('auto', 'klingon', 'de-AT')).toBe('de')
    expect(resolveLang(undefined, undefined, 'sv-SE')).toBe('en')
  })

  test('langFromText ignores case and region suffixes', async () => {
    expect(langFromText('ENGLISH')).toBe('en')
    expect(langFromText('es-MX')).toBe('es')
    expect(langFromText('')).toBeUndefined()
  })
})
