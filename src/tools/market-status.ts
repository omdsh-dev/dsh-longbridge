/**
 * longbridge_market_status — trading sessions for HK/US.
 * @module
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { Market, TradeSession } from 'longbridge'
import type { LongbridgeService } from '../service.ts'

const MARKET_NAMES: ReadonlyMap<Market, string> = new Map([
  [Market.US, 'US'], [Market.HK, 'HK'], [Market.CN, 'CN'], [Market.SG, 'SG'], [Market.Unknown, '?'],
])

const SESSION_NAMES: ReadonlyMap<TradeSession, string> = new Map([
  [TradeSession.Intraday, '连续交易'], [TradeSession.Pre, '盘前'], [TradeSession.Post, '盘后'], [TradeSession.Overnight, '隔夜'],
])

/** Time formatting from the SDK's hour/minute getters (Time#toString is a napi oddity). */
function timeString(t: { hour: number; minute: number }): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(t.hour)}:${pad(t.minute)}`
}

export function defineMarketStatusTool(service: LongbridgeService) {
  return defineTool({
    name: 'longbridge_market_status',
    description: '长桥港股/美股当日交易时段与状态：各市场的开收盘时段（连续交易/盘前/盘后）与时间。',
    parameters: {
      market: { type: 'string', enum: ['HK', 'US'], description: '市场；缺省返回全部市场' },
    },
    output: {
      schema: { type: 'json' } as const,
      render(_args, value) {
        const v = value as { markets?: Array<{ market: string; sessions: Array<{ begin: string; end: string; kind: string }> }> }
        const lines: string[] = []
        for (const m of v.markets ?? []) {
          lines.push(`${m.market === 'HK' ? '港股' : m.market === 'US' ? '美股' : m.market}：`)
          for (const s of m.sessions) lines.push(`- ${s.begin} – ${s.end} ${s.kind}`)
          if (m.sessions.length === 0) lines.push('- 今日无交易时段（休市）')
        }
        return [{ type: 'text', text: lines.join('\n') || '无数据' }]
      },
    },
    timeoutMs: 15_000,
    isConcurrencySafe: () => true,
    async execute(args) {
      const sessions = await service.tradingSessions()
      const rows = sessions
        .filter(s => args.market === undefined || MARKET_NAMES.get(s.market) === args.market)
        .map(s => ({
          market: MARKET_NAMES.get(s.market) ?? '?',
          sessions: s.tradeSessions.map(t => ({
            begin: timeString(t.beginTime),
            end: timeString(t.endTime),
            kind: SESSION_NAMES.get(t.tradeSession) ?? String(t.tradeSession),
          })),
        }))
      return { markets: rows }
    },
  })
}
