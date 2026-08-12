/**
 * longbridge_indices — major HK/US index snapshots, served through the same
 * quote path (indices are ordinary symbols on the Longbridge wire).
 * @module
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { changePct, dec, markdownTable } from '../serialize.ts'
import { normalizeSymbols } from '../symbols.ts'
import type { LongbridgeService } from '../service.ts'
import { ENV_PARAM } from './shared.ts'

/** Best-known default index symbols per market; verify against the official code table when live. */
const DEFAULT_INDICES: ReadonlyMap<string, readonly string[]> = new Map([
  ['HK', ['HSI.HK', 'HSCEI.HK', 'HSTECH.HK']],
  ['US', ['DJI.US', 'SPX.US', 'NDX.US']],
])

export function defineIndicesTool(service: LongbridgeService) {
  return defineTool({
    name: 'longbridge_indices',
    description: '长桥港股/美股主要指数快照（恒指、国企指数、恒生科技、道指、标普、纳指等）。可用 market 取默认指数组合，或用 symbols 指定任意指数代码。',
    parameters: {
      market: { type: 'string', enum: ['HK', 'US'], description: '市场；提供 symbols 时忽略' },
      symbols: { type: 'array', items: { type: 'string' }, description: '指数代码数组（长桥格式，如 HSI.HK、NDX.US），最多 10 个' },
      env: ENV_PARAM,
    },
    output: {
      schema: { type: 'json' } as const,
      render(_args, value) {
        const v = value as { indices?: unknown[] }
        const rows = (v.indices ?? []).map(r => {
          const row = r as Record<string, unknown>
          const change = row.changePct === null ? '—' : `${Number(row.changePct) >= 0 ? '+' : ''}${String(row.changePct)}%`
          return [String(row.symbol), String(row.lastDone ?? '—'), change, String(row.high ?? '—'), String(row.low ?? '—')]
        })
        return [{ type: 'text', text: markdownTable(['指数', '点位', '涨跌幅', '最高', '最低'], rows) }]
      },
    },
    timeoutMs: 15_000,
    isConcurrencySafe: () => true,
    async execute(args) {
      let symbols: string[]
      if (args.symbols !== undefined && args.symbols.length > 0) {
        symbols = normalizeSymbols(args.symbols, 10)
      } else if (args.market !== undefined) {
        symbols = [...(DEFAULT_INDICES.get(args.market) ?? [])]
        if (symbols.length === 0) throw new Error(`未知市场: ${args.market}`)
      } else {
        throw new Error('需要 market（HK/US）或 symbols 之一')
      }
      const quotes = await service.quotes(symbols, args.env)
      const rows = quotes.map(q => {
        const last = dec(q.lastDone)
        const prev = dec(q.prevClose)
        return {
          symbol: q.symbol,
          lastDone: last,
          changePct: changePct(last ?? '', prev ?? ''),
          open: dec(q.open),
          high: dec(q.high),
          low: dec(q.low),
          timestamp: q.timestamp.toISOString(),
        }
      })
      return { indices: rows }
    },
  })
}
