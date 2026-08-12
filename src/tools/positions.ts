/**
 * longbridge_positions — current stock positions (read-only, account-scoped).
 * @module
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { dec, markdownTable } from '../serialize.ts'
import { normalizeSymbols } from '../symbols.ts'
import type { LongbridgeService } from '../service.ts'
import { ENV_PARAM } from './shared.ts'

export function definePositionsTool(service: LongbridgeService) {
  return defineTool({
    name: 'longbridge_positions',
    description: '长桥当前持仓列表（只读）：代码、数量、可卖数量、成本价、币种。需要账户级权限。',
    parameters: {
      symbols: { type: 'array', items: { type: 'string' }, description: '证券代码筛选（长桥格式），缺省返回全部持仓' },
      env: ENV_PARAM,
    },
    output: {
      schema: { type: 'json' } as const,
      render(_args, value) {
        const v = value as { positions?: unknown[] }
        const rows = (v.positions ?? []).map(r => {
          const row = r as Record<string, unknown>
          return [
            String(row.symbol ?? '—'),
            String(row.symbolName ?? ''),
            String(row.quantity ?? '—'),
            String(row.availableQuantity ?? '—'),
            String(row.costPrice ?? '—'),
            String(row.currency ?? '—'),
          ]
        })
        const text = markdownTable(['代码', '名称', '持仓数量', '可卖数量', '成本价', '币种'], rows)
        return [{ type: 'text', text: rows.length === 0 ? '当前无持仓' : text }]
      },
    },
    timeoutMs: 30_000,
    isConcurrencySafe: () => true,
    async execute(args) {
      const symbols = args.symbols !== undefined && args.symbols.length > 0
        ? normalizeSymbols(args.symbols, 50)
        : undefined
      const response = await service.stockPositions(symbols, args.env)
      const positions = response.channels.flatMap(channel =>
        channel.positions.map(p => ({
          accountChannel: channel.accountChannel,
          symbol: p.symbol,
          symbolName: p.symbolName,
          quantity: dec(p.quantity),
          availableQuantity: dec(p.availableQuantity),
          costPrice: dec(p.costPrice),
          currency: p.currency,
        })),
      )
      return { positions }
    },
  })
}
