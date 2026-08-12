/**
 * Lossless serialization of the `longbridge` SDK's napi types. Prices and
 * amounts are `Decimal` instances; tool canonical values must be plain
 * lossless JSON, so every Decimal becomes a decimal string (never a float).
 * @module
 */

import type { Decimal } from 'longbridge'

/** Decimal → exact decimal string; null-safe passthrough for optional values. */
export function dec(value: Decimal | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return value.toString()
}

/** Percentage change computed from two decimal strings, rounded to 2dp. */
export function changePct(last: string | null | undefined, prev: string | null | undefined): string | null {
  if (last === null || prev === null) return null
  const l = Number(last)
  const p = Number(prev)
  if (!Number.isFinite(l) || !Number.isFinite(p) || p === 0) return null
  return ((l - p) / p * 100).toFixed(2)
}

/** Right-pad a CJK-aware cell for markdown tables (approximates 2:1 width). */
export function pad(text: string, width: number): string {
  let visual = 0
  for (const ch of text) visual += ch.codePointAt(0)! > 0xff ? 2 : 1
  return text + ' '.repeat(Math.max(0, width - visual))
}

/** Build a markdown table from rows; every row must share the header length. */
export function markdownTable(header: string[], rows: string[][]): string {
  const lines: string[] = []
  lines.push(`| ${header.join(' | ')} |`)
  lines.push(`|${header.map(() => '---').join('|')}|`)
  for (const row of rows) lines.push(`| ${row.join(' | ')} |`)
  return lines.join('\n')
}
