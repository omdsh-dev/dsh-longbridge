/**
 * longbridge_quote — real-time HK/US quote snapshots.
 * @module
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { changePct, dec, markdownTable } from '../serialize.ts'
import { normalizeSymbols } from '../symbols.ts'
import type { LongbridgeService } from '../service.ts'
import { ENV_PARAM } from './shared.ts'

export function defineQuoteTool(service: LongbridgeService) {
  return defineTool({
    name: 'longbridge_quote',
    description: '长桥港股/美股实时行情快照：最新价、涨跌幅、今开/最高/最低、成交量、成交额。代码用长桥格式（700.HK / AAPL.US）。',
    parameters: {
      symbols: {
        type: 'array',
        items: { type: 'string' },
        required: true,
        description: '证券代码数组，长桥格式（如 700.HK、AAPL.US），最多 20 个',
      },
      env: ENV_PARAM,
    },
    output: {
      schema: { type: 'json' } as const,
      render(_args, value) {
        const v = value as { quotes?: unknown[] }
        const rows = (v.quotes ?? []).map(r => {
          const row = r as Record<string, unknown>
          const change = row.changePct === null ? '—' : `${Number(row.changePct) >= 0 ? '+' : ''}${String(row.changePct)}%`
          return [
            String(row.symbol),
            String(row.lastDone ?? '—'),
            change,
            String(row.open ?? '—'),
            String(row.high ?? '—'),
            String(row.low ?? '—'),
            String(row.volume ?? '—'),
          ]
        })
        const text = markdownTable(['代码', '最新价', '涨跌幅', '今开', '最高', '最低', '成交量'], rows)
        return [{ type: 'text', text }]
      },
    },
    timeoutMs: 15_000,
    isConcurrencySafe: () => true,
    async execute(args) {
      const symbols = normalizeSymbols(args.symbols, 20)
      const quotes = await service.quotes(symbols, args.env)
      const rows = quotes.map(q => {
        const last = dec(q.lastDone)
        const prev = dec(q.prevClose)
        return {
          symbol: q.symbol,
          lastDone: last,
          prevClose: prev,
          changePct: changePct(last ?? '', prev ?? ''),
          open: dec(q.open),
          high: dec(q.high),
          low: dec(q.low),
          volume: q.volume,
          turnover: dec(q.turnover),
          timestamp: q.timestamp.toISOString(),
        }
      })
      return { quotes: rows }
    },
  })
}
