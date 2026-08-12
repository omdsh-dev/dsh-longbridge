/**
 * Symbol parsing for HK/US security codes. Longbridge symbols carry an
 * explicit market suffix: `700.HK`, `AAPL.US`. Indices use the same wire
 * format (e.g. `HSI.HK`), so validation only enforces the shape, not the
 * security class.
 * @module
 */

/** Upper-case Longbridge symbol pattern: code body + `.HK`/`.US`. */
const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9-]{0,9}\.(?:HK|US)$/

/** Normalized Longbridge symbol (`700.HK`, `AAPL.US`). */
export type LongbridgeSymbol = string

/**
 * Normalize one raw input to an upper-case Longbridge symbol.
 * @throws TypeError with a user-facing message when the shape is invalid.
 */
export function normalizeSymbol(raw: string): LongbridgeSymbol {
  const symbol = raw.trim().toUpperCase()
  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new TypeError(
      `无效证券代码 "${raw}"：请使用长桥格式，例如 700.HK 或 AAPL.US`,
    )
  }
  return symbol
}

/** Normalize a batch, capping at {@link max}; keeps first-seen order, drops duplicates. */
export function normalizeSymbols(raw: readonly string[], max: number): LongbridgeSymbol[] {
  if (raw.length === 0) throw new TypeError('至少需要一个证券代码')
  if (raw.length > max) throw new TypeError(`证券代码过多：最多 ${max} 个`)
  const seen = new Set<string>()
  const out: LongbridgeSymbol[] = []
  for (const entry of raw) {
    const symbol = normalizeSymbol(entry)
    if (seen.has(symbol)) continue
    seen.add(symbol)
    out.push(symbol)
  }
  return out
}
