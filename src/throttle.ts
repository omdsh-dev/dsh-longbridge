/**
 * Trade-path throttle: Longbridge trade APIs allow at most 30 calls per
 * 30-second window with a >=20ms inter-call interval, and the SDK does NOT
 * throttle them. `acquire` serializes our trade calls behind that budget;
 * cancellation observes the caller's AbortSignal.
 * @module
 */

const WINDOW_MS = 30_000
const WINDOW_CAP = 30
const MIN_INTERVAL_MS = 20

export class TradeThrottle {
  private window: number[] = []

  /** Wait until one trade call may proceed, then record it. */
  async acquire(signal?: AbortSignal): Promise<void> {
    for (;;) {
      throwIfAborted(signal)
      const now = Date.now()
      this.window = this.window.filter(t => now - t < WINDOW_MS)
      const last = this.window[this.window.length - 1]
      const intervalOk = last === undefined || now - last >= MIN_INTERVAL_MS
      if (this.window.length < WINDOW_CAP && intervalOk) {
        this.window.push(now)
        return
      }
      const nextAllowedAt = this.window.length >= WINDOW_CAP
        ? this.window[0] + WINDOW_MS
        : last! + MIN_INTERVAL_MS
      await sleep(nextAllowedAt - now, signal)
    }
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('aborted')
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  const capped = Math.max(0, Math.ceil(ms))
  if (capped === 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, capped)
    function onAbort(): void {
      clearTimeout(timer)
      reject(signal!.reason instanceof Error ? signal!.reason : new Error('aborted'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
