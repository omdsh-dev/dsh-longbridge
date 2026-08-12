import { describe, expect, it } from 'vitest'
import { changePct, dec, markdownTable } from '../src/serialize.ts'

// Decimal comes from the napi SDK; tests use a stand-in with the same toString contract.
const fakeDecimal = (value: string) => ({
  toString: () => value,
  toNumber: () => Number(value),
}) as unknown as import('longbridge').Decimal

describe('dec', () => {
  it('preserves exact decimal strings', () => {
    expect(dec(fakeDecimal('412.80000000000001'))).toBe('412.80000000000001')
    expect(dec(fakeDecimal('0'))).toBe('0')
  })

  it('passes through null/undefined', () => {
    expect(dec(null)).toBeNull()
    expect(dec(undefined)).toBeNull()
  })
})

describe('changePct', () => {
  it('computes the signed percentage', () => {
    expect(changePct('110', '100')).toBe('10.00')
    expect(changePct('90', '100')).toBe('-10.00')
  })

  it('is null when the base is absent or zero', () => {
    expect(changePct(null, '100')).toBeNull()
    expect(changePct('10', null)).toBeNull()
    expect(changePct('10', '0')).toBeNull()
  })
})

describe('markdownTable', () => {
  it('renders header, separator and rows', () => {
    const text = markdownTable(['A', 'B'], [['1', '2']])
    expect(text).toBe('| A | B |\n|---|---|\n| 1 | 2 |')
  })
})
