/**
 * longbridge_watchlist — broker watchlist groups (list/add/remove).
 * @module
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { Market, SecuritiesUpdateMode } from 'longbridge'
import { normalizeSymbols } from '../symbols.ts'
import type { LongbridgeService } from '../service.ts'

const MARKET_NAMES: ReadonlyMap<Market, string> = new Map([
  [Market.US, 'US'], [Market.HK, 'HK'], [Market.CN, 'CN'], [Market.SG, 'SG'], [Market.Unknown, '?'],
])

type WatchlistGroupShape = {
  id: number
  name: string
  securities: Array<{ symbol: string; market: string; name: string }>
}

function shapeGroups(groups: Array<{ id: number; name: string; securities: Array<{ symbol: string; market: Market; name: string }> }>): WatchlistGroupShape[] {
  return groups.map(g => ({
    id: g.id,
    name: g.name,
    securities: g.securities.map(s => ({
      symbol: s.symbol,
      market: MARKET_NAMES.get(s.market) ?? '?',
      name: s.name,
    })),
  }))
}

export function defineWatchlistTool(service: LongbridgeService) {
  return defineTool({
    name: 'longbridge_watchlist',
    description: '长桥自选股分组管理：list 列出全部分组与成分；add/remove 向指定分组（缺省第一个分组）添加或移除证券。',
    parameters: {
      action: { type: 'string', enum: ['list', 'add', 'remove'], required: true, description: '操作类型' },
      group_id: { type: 'integer', description: '分组 id；缺省用第一个分组' },
      symbols: { type: 'array', items: { type: 'string' }, description: 'add/remove 时的证券代码数组（长桥格式），最多 20 个' },
    },
    output: {
      schema: { type: 'json' } as const,
      render(_args, value) {
        const v = value as { action?: string; groupId?: number | null; symbols?: string[] | null; groups?: WatchlistGroupShape[] }
        if (v.action === 'add' || v.action === 'remove') {
          return [{
            type: 'text',
            text: `已${v.action === 'add' ? '添加' : '移除'} ${(v.symbols ?? []).join('、')} ${v.action === 'add' ? '到' : '出'}分组 #${String(v.groupId)}`,
          }]
        }
        const lines: string[] = []
        for (const group of v.groups ?? []) {
          lines.push(`【${group.name}】#${group.id}`)
          for (const s of group.securities) lines.push(`- ${s.symbol} (${s.market}) ${s.name}`)
        }
        return [{ type: 'text', text: lines.join('\n') || '自选为空' }]
      },
    },
    timeoutMs: 15_000,
    isConcurrencySafe: () => true,
    async execute(args) {
      const groups = await service.watchlistGroups()
      const shaped = shapeGroups(groups)
      if (args.action === 'list') return { action: 'list', groups: shaped, groupId: null, symbols: null }

      const symbols = normalizeSymbols(args.symbols ?? [], 20)
      const group = shaped.find(g => g.id === args.group_id) ?? shaped[0]
      if (group === undefined) throw new Error('自选分组为空：请先在长桥 App 创建分组')
      const mode = args.action === 'add' ? SecuritiesUpdateMode.Add : SecuritiesUpdateMode.Remove
      await service.updateWatchlistGroup(group.id, symbols, mode)
      const updated = shapeGroups(await service.watchlistGroups())
      return { action: args.action, groups: updated, groupId: group.id, symbols }
    },
  })
}
