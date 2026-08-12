import { describe, expect, it } from 'vitest'
import { TradeThrottle } from '../src/throttle.ts'

describe('TradeThrottle', () => {
  it('admits the first 30 calls within the 20ms-interval budget', async () => {
    const throttle = new TradeThrottle()
    const started = Date.now()
    for (let i = 0; i < 30; i++) await throttle.acquire()
    const elapsed = Date.now() - started
    // 29 gaps × 20ms minimum spacing; well under the 30s window cap.
    expect(elapsed).toBeGreaterThanOrEqual(29 * 20 - 5)
    expect(elapsed).toBeLessThan(3_000)
  })

  it('rejects on an already-aborted signal', async () => {
    const throttle = new TradeThrottle()
    const controller = new AbortController()
    controller.abort(new Error('boom'))
    await expect(throttle.acquire(controller.signal)).rejects.toThrow('boom')
  })
})
