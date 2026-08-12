import { describe, expect, it } from 'vitest'
import { normalizeSymbol, normalizeSymbols } from '../src/symbols.ts'

describe('normalizeSymbol', () => {
  it('accepts HK/US symbols and upper-cases them', () => {
    expect(normalizeSymbol('700.hk')).toBe('700.HK')
    expect(normalizeSymbol(' aapl.us ')).toBe('AAPL.US')
  })

  it('rejects malformed symbols', () => {
    expect(() => normalizeSymbol('700')).toThrow(/无效证券代码/)
    expect(() => normalizeSymbol('700.SH')).toThrow(/无效证券代码/)
    expect(() => normalizeSymbol('')).toThrow(/无效证券代码/)
    expect(() => normalizeSymbol('700 HK')).toThrow(/无效证券代码/)
  })
})

describe('normalizeSymbols', () => {
  it('deduplicates and keeps order', () => {
    expect(normalizeSymbols(['700.HK', 'AAPL.US', '700.hk'], 20)).toEqual(['700.HK', 'AAPL.US'])
  })

  it('enforces the cap', () => {
    const many = Array.from({ length: 21 }, (_, i) => `S${String(i).padStart(4, '0')}.HK`)
    expect(() => normalizeSymbols(many, 20)).toThrow(/最多 20 个/)
  })

  it('rejects an empty batch', () => {
    expect(() => normalizeSymbols([], 20)).toThrow(/至少需要一个/)
  })
})
