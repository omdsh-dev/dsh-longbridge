/**
 * longbridge_kline — HK/US candlesticks.
 * @module
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { AdjustType, Period } from 'longbridge'
import { dec, markdownTable } from '../serialize.ts'
import { normalizeSymbol } from '../symbols.ts'
import type { LongbridgeService } from '../service.ts'
import { ENV_PARAM } from './shared.ts'

const PERIODS: ReadonlyMap<string, Period> = new Map([
  ['1m', Period.Min_1], ['5m', Period.Min_5], ['15m', Period.Min_15], ['30m', Period.Min_30],
  ['60m', Period.Min_60], ['day', Period.Day], ['week', Period.Week], ['month', Period.Month], ['year', Period.Year],
])

const ADJUSTS: ReadonlyMap<string, AdjustType> = new Map([
  ['none', AdjustType.NoAdjust], ['forward', AdjustType.ForwardAdjust],
])

export function defineKlineTool(service: LongbridgeService) {
  return defineTool({
    name: 'longbridge_kline',
    description: '长桥港股/美股K线（OHLCV）。period 为 K 线周期；count 为根数（最多 500）。历史K线受长桥月度配额限制。',
    parameters: {
      symbol: { type: 'string', required: true, description: '证券代码，长桥格式（如 700.HK、AAPL.US）' },
      period: {
        type: 'string',
        enum: ['1m', '5m', '15m', '30m', '60m', 'day', 'week', 'month', 'year'],
        description: 'K线周期',
      },
      count: { type: 'integer', description: 'K线根数，1-500，缺省 60' },
      adjust: { type: 'string', enum: ['none', 'forward'], description: '复权方式：none 不复权（缺省），forward 前复权' },
      env: ENV_PARAM,
    },
    output: {
      schema: { type: 'json' } as const,
      render(_args, value) {
        const v = value as { symbol?: string; period?: string; candles?: unknown[] }
        const candles = (v.candles ?? []).map(c => {
          const row = c as Record<string, unknown>
          return [
            String(row.time ?? '').replace('T', ' ').slice(0, 16),
            String(row.open ?? ''), String(row.high ?? ''), String(row.low ?? ''), String(row.close ?? ''),
            String(row.volume ?? ''),
          ]
        })
        const shown = candles.slice(0, 40)
        const omitted = candles.length - shown.length
        const head = `${String(v.symbol)} ${String(v.period)} 最近 ${candles.length} 根（${omitted > 0 ? `仅显示前 ${shown.length} 根` : '全部显示'}）\n`
        const table = markdownTable(['时间', '开盘', '最高', '最低', '收盘', '成交量'], shown)
        return [{ type: 'text', text: head + table }]
      },
    },
    timeoutMs: 20_000,
    isConcurrencySafe: () => true,
    async execute(args) {
      const symbol = normalizeSymbol(args.symbol)
      const period = PERIODS.get(args.period ?? 'day') ?? Period.Day
      const count = Math.min(Math.max(args.count ?? 60, 1), 500)
      const adjust = ADJUSTS.get(args.adjust ?? 'none') ?? AdjustType.NoAdjust
      const candles = await service.candlesticks(symbol, period, count, adjust, args.env)
      return {
        symbol,
        period: args.period ?? 'day',
        adjust: args.adjust ?? 'none',
        candles: candles.map(c => ({
          time: c.timestamp.toISOString(),
          open: dec(c.open),
          high: dec(c.high),
          low: dec(c.low),
          close: dec(c.close),
          volume: c.volume,
          turnover: dec(c.turnover),
        })),
      }
    },
  })
}
