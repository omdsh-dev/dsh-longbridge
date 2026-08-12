/**
 * longbridge_cancel_order — cancel one order. ALWAYS gated by the trading
 * confirmation gate.
 * @module
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { LongbridgeService } from '../service.ts'
import { ENV_PARAM } from './shared.ts'

export function defineCancelOrderTool(service: LongbridgeService) {
  return defineTool({
    name: 'longbridge_cancel_order',
    description: '长桥撤单。每次调用都需要用户确认。',
    parameters: {
      order_id: { type: 'string', required: true, description: '订单号（来自 longbridge_place_order 返回的 orderId）' },
      env: ENV_PARAM,
    },
    output: {
      schema: { type: 'json' } as const,
      render(_args, value) {
        const v = value as Record<string, unknown>
        return [{ type: 'text', text: `撤单请求已提交：订单号 ${String(v.orderId)}` }]
      },
    },
    timeoutMs: 30_000,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      await service.cancelOrder(args.order_id, exec.signal, args.env)
      return { orderId: args.order_id, cancelled: true }
    },
  })
}
