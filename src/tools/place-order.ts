/**
 * longbridge_place_order — submit one order. ALWAYS gated by the trading
 * confirmation gate (tools/pre-execute → approval). Validation is pure and
 * unit-tested; the SDK submission happens behind the trade throttle.
 * @module
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { Decimal, OrderSide, OrderType, TimeInForceType } from 'longbridge'
import type { SubmitOrderOptions } from 'longbridge'
import { normalizeSymbol } from '../symbols.ts'
import type { LongbridgeService } from '../service.ts'
import { ENV_PARAM } from './shared.ts'

export type PlaceOrderArgs = {
  symbol: string
  side: 'buy' | 'sell'
  order_type: 'LO' | 'ELO' | 'MO'
  quantity: number
  price?: number
  time_in_force?: 'day' | 'gtc'
  remark?: string
  env?: 'live' | 'paper'
}

/** Pure argument validation → SDK options. Throws TypeError with user-facing messages. */
export function buildSubmitOrderOptions(args: PlaceOrderArgs): SubmitOrderOptions {
  const symbol = normalizeSymbol(args.symbol)
  if (args.side !== 'buy' && args.side !== 'sell') throw new TypeError(`无效方向: ${args.side}`)
  if (args.order_type !== 'LO' && args.order_type !== 'ELO' && args.order_type !== 'MO') {
    throw new TypeError(`无效订单类型: ${args.order_type}`)
  }
  if (!Number.isFinite(args.quantity) || args.quantity <= 0) {
    throw new TypeError('数量必须是正数')
  }
  if (args.order_type !== 'MO' && (args.price === undefined || !Number.isFinite(args.price) || args.price <= 0)) {
    throw new TypeError(`订单类型 ${args.order_type} 必须提供正的限价 price`)
  }
  const options: SubmitOrderOptions = {
    symbol,
    orderType: args.order_type === 'LO' ? OrderType.LO : args.order_type === 'ELO' ? OrderType.ELO : OrderType.MO,
    side: args.side === 'buy' ? OrderSide.Buy : OrderSide.Sell,
    submittedQuantity: new Decimal(String(args.quantity)),
    timeInForce: args.time_in_force === 'gtc' ? TimeInForceType.GoodTilCanceled : TimeInForceType.Day,
  }
  if (args.order_type !== 'MO') options.submittedPrice = new Decimal(String(args.price))
  if (args.remark !== undefined && args.remark !== '') options.remark = args.remark
  return options
}

export function definePlaceOrderTool(service: LongbridgeService) {
  return defineTool({
    name: 'longbridge_place_order',
    description: '长桥下单（港股/美股）。每次调用都需要用户确认。LO=限价单，ELO=增强限价单，MO=市价单；LO/ELO 必须带 price。',
    parameters: {
      symbol: { type: 'string', required: true, description: '证券代码，长桥格式（如 700.HK、AAPL.US）' },
      side: { type: 'string', enum: ['buy', 'sell'], required: true, description: '买卖方向' },
      order_type: { type: 'string', enum: ['LO', 'ELO', 'MO'], required: true, description: '订单类型：LO 限价 / ELO 增强限价 / MO 市价' },
      quantity: { type: 'number', required: true, description: '数量（股）' },
      price: { type: 'number', description: '限价；LO/ELO 必填，MO 忽略' },
      time_in_force: { type: 'string', enum: ['day', 'gtc'], description: '有效期：day 当日有效（缺省），gtc 撤单前有效' },
      remark: { type: 'string', description: '备注' },
      env: ENV_PARAM,
    },
    output: {
      schema: { type: 'json' } as const,
      render(_args, value) {
        const v = value as Record<string, unknown>
        return [{
          type: 'text',
          text: `下单已提交：${String(v.symbol)} ${String(v.side)} ${String(v.quantity)} 股 ${String(v.orderType)}${v.price === null ? '' : ` @ ${String(v.price)}`}，订单号 ${String(v.orderId)}`,
        }]
      },
    },
    timeoutMs: 30_000,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const options = buildSubmitOrderOptions(args as PlaceOrderArgs)
      const response = await service.submitOrder(options, exec.signal, (args as PlaceOrderArgs).env)
      return {
        orderId: response.orderId,
        symbol: options.symbol,
        side: (args as PlaceOrderArgs).side,
        orderType: (args as PlaceOrderArgs).order_type,
        quantity: String(options.submittedQuantity),
        price: options.submittedPrice === undefined ? null : String(options.submittedPrice),
      }
    },
  })
}
