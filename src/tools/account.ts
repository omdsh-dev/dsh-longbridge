/**
 * longbridge_account — account balance summary (read-only, account-scoped).
 * @module
 */

import { defineTool, type JsonValue } from '@deepseek-ai/dsh-tools'
import { dec, markdownTable } from '../serialize.ts'
import type { LongbridgeService } from '../service.ts'
import { ENV_PARAM } from './shared.ts'

export function defineAccountTool(service: LongbridgeService) {
  return defineTool({
    name: 'longbridge_account',
    description: '长桥账户资金总览（只读）：现金、净资产、保证金、风控等级等。需要账户级权限；交易环境由 env/设置决定。',
    parameters: {
      currency: { type: 'string', enum: ['HKD', 'USD'], description: '币种筛选；缺省返回全部币种' },
      env: ENV_PARAM,
    },
    output: {
      schema: { type: 'json' } as const,
      render(_args, value) {
        const v = value as { balances?: unknown[] }
        const rows = (v.balances ?? []).map(r => {
          const row = r as Record<string, unknown>
          return [
            String(row.currency ?? '—'),
            String(row.totalCash ?? '—'),
            String(row.netAssets ?? '—'),
            String(row.initMargin ?? '—'),
            String(row.riskLevel ?? '—'),
          ]
        })
        const text = markdownTable(['币种', '总现金', '净资产', '初始保证金', '风控等级'], rows)
        return [{ type: 'text', text: rows.length === 0 ? '账户数据为空（可能尚未入金或权限不足）' : text }]
      },
    },
    timeoutMs: 30_000,
    isConcurrencySafe: () => true,
    async execute(args) {
      const balances = await service.accountBalance(args.currency, args.env)
      return {
        balances: balances.map(b => ({
          currency: b.currency,
          totalCash: dec(b.totalCash),
          netAssets: dec(b.netAssets),
          initMargin: dec(b.initMargin),
          maintenanceMargin: dec(b.maintenanceMargin),
          marginCall: dec(b.marginCall),
          maxFinanceAmount: dec(b.maxFinanceAmount),
          remainingFinanceAmount: dec(b.remainingFinanceAmount),
          riskLevel: b.riskLevel,
          cashInfos: b.cashInfos.map(c => (c as unknown as { toJSON(): JsonValue }).toJSON()),
        })),
      }
    },
  })
}
