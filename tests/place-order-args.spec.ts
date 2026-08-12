import { describe, expect, it } from 'vitest'
import { OrderSide, OrderType, TimeInForceType } from 'longbridge'
import { buildSubmitOrderOptions, type PlaceOrderArgs } from '../src/tools/place-order.ts'

const base: PlaceOrderArgs = {
  symbol: '700.HK',
  side: 'buy',
  order_type: 'LO',
  quantity: 100,
  price: 412.8,
}

describe('buildSubmitOrderOptions', () => {
  it('maps a limit order', () => {
    const options = buildSubmitOrderOptions(base)
    expect(options.symbol).toBe('700.HK')
    expect(options.orderType).toBe(OrderType.LO)
    expect(options.side).toBe(OrderSide.Buy)
    expect(String(options.submittedQuantity)).toBe('100')
    expect(String(options.submittedPrice)).toBe('412.8')
    expect(options.timeInForce).toBe(TimeInForceType.Day)
  })

  it('maps a market order without a price', () => {
    const options = buildSubmitOrderOptions({ ...base, order_type: 'MO', price: undefined })
    expect(options.orderType).toBe(OrderType.MO)
    expect(options.submittedPrice).toBeUndefined()
  })

  it('maps gtc and sell', () => {
    const options = buildSubmitOrderOptions({ ...base, side: 'sell', time_in_force: 'gtc' })
    expect(options.side).toBe(OrderSide.Sell)
    expect(options.timeInForce).toBe(TimeInForceType.GoodTilCanceled)
  })

  it('requires a price for limit orders', () => {
    expect(() => buildSubmitOrderOptions({ ...base, price: undefined })).toThrow(/必须提供正的限价/)
    expect(() => buildSubmitOrderOptions({ ...base, price: 0 })).toThrow(/必须提供正的限价/)
  })

  it('rejects bad quantity and bad symbols', () => {
    expect(() => buildSubmitOrderOptions({ ...base, quantity: 0 })).toThrow(/数量必须是正数/)
    expect(() => buildSubmitOrderOptions({ ...base, symbol: '700.SH' })).toThrow(/无效证券代码/)
  })
})
