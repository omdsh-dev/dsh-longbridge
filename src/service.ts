/**
 * LongbridgeService: the one place the `longbridge` SDK is touched. Owns
 * per-environment SDK contexts (lazy, invalidated when credentials change),
 * the quote snapshot cache for the panel RPC, and the trade-path throttle.
 * @module
 */

import type { Context } from '@deepseek-ai/cordis'
import {
  AdjustType, Config, Market, Period, QuoteContext, SecuritiesUpdateMode,
  TradeContext, TradeSessions,
  type Candlestick, type ExtraConfigParams, type MarketTradingSession, type SecurityQuote,
  type SubmitOrderOptions, type WatchlistGroup,
} from 'longbridge'
import type { LongbridgeConfig } from './config.ts'
import { resolveLongbridgeCredentials, UNCONFIGURED_MESSAGE } from './credentials.ts'
import { TradeThrottle } from './throttle.ts'

/** Quote snapshot cache TTL for panel polling (ms). */
const QUOTE_CACHE_TTL_MS = 4_000

interface Contexts {
  key: string
  quote: QuoteContext
  trade?: TradeContext
}

export class LongbridgeService {
  private contexts: Contexts | undefined
  private quoteCache = new Map<string, { at: number; value: SecurityQuote[] }>()
  readonly tradeThrottle = new TradeThrottle()

  constructor(private readonly ctx: Context, private readonly getConfig: () => LongbridgeConfig) {}

  /** Per-operation credential resolution; every API call starts here. */
  private async credentials(env?: 'live' | 'paper'): Promise<{ key: string; config: Config }> {
    const creds = await resolveLongbridgeCredentials(this.ctx)
    if (creds === undefined) throw new Error(UNCONFIGURED_MESSAGE)
    const target = env ?? this.getConfig().env
    const extra: ExtraConfigParams | undefined = target === 'paper' ? { enablePapertrading: true } : undefined
    const config = extra === undefined
      ? Config.fromApikey(creds.appKey, creds.appSecret, creds.accessToken)
      : Config.fromApikey(creds.appKey, creds.appSecret, creds.accessToken, extra)
    return { key: `${target}:${creds.appKey}`, config }
  }

  /** QuoteContext for the current environment, created lazily and re-keyed on change. */
  async quoteContext(env?: 'live' | 'paper'): Promise<QuoteContext> {
    const { key, config } = await this.credentials(env)
    if (this.contexts === undefined || this.contexts.key !== key) {
      const quote = QuoteContext.new(config)
      const existing = this.contexts?.key === key ? this.contexts.trade : undefined
      this.contexts = { key, quote, ...(existing === undefined ? {} : { trade: existing }) }
    }
    return this.contexts.quote
  }

  /** TradeContext for the current environment, created lazily (requires trade permission). */
  async tradeContext(env?: 'live' | 'paper'): Promise<TradeContext> {
    const { key, config } = await this.credentials(env)
    let contexts = this.contexts
    if (contexts === undefined || contexts.key !== key || contexts.trade === undefined) {
      const quote = contexts !== undefined && contexts.key === key ? contexts.quote : QuoteContext.new(config)
      contexts = { key, quote, trade: TradeContext.new(config) }
      this.contexts = contexts
    }
    return contexts.trade!
  }

  /** Fresh quote snapshots (tool path; SDK enforces the 10 req/s quote budget). */
  async quotes(symbols: string[], env?: 'live' | 'paper'): Promise<SecurityQuote[]> {
    return (await this.quoteContext(env)).quote(symbols)
  }

  /** Cached quote snapshots (panel path; TTL-bounded to keep polling within budget). */
  async cachedQuotes(symbols: string[]): Promise<SecurityQuote[]> {
    const cacheKey = [...symbols].sort().join(',')
    const hit = this.quoteCache.get(cacheKey)
    if (hit !== undefined && Date.now() - hit.at < QUOTE_CACHE_TTL_MS) return hit.value
    const value = await this.quotes(symbols)
    this.quoteCache.set(cacheKey, { at: Date.now(), value })
    return value
  }

  async candlesticks(
    symbol: string, period: Period, count: number, adjust: AdjustType, env?: 'live' | 'paper',
  ): Promise<Candlestick[]> {
    return (await this.quoteContext(env)).candlesticks(symbol, period, count, adjust, TradeSessions.Intraday)
  }

  async watchlistGroups(): Promise<WatchlistGroup[]> {
    return (await this.quoteContext()).watchlist()
  }

  async updateWatchlistGroup(id: number, securities: string[], mode: SecuritiesUpdateMode): Promise<void> {
    await (await this.quoteContext()).updateWatchlistGroup({ id, securities, mode })
  }

  async tradingSessions(): Promise<MarketTradingSession[]> {
    return (await this.quoteContext()).tradingSession()
  }

  async accountBalance(currency?: string, env?: 'live' | 'paper') {
    return (await this.tradeContext(env)).accountBalance(currency ?? undefined)
  }

  async stockPositions(symbols?: string[], env?: 'live' | 'paper') {
    return (await this.tradeContext(env)).stockPositions(symbols ?? undefined)
  }

  /** Submit one order behind the trade throttle (30 req/30s, >=20ms spacing). */
  async submitOrder(options: SubmitOrderOptions, signal?: AbortSignal, env?: 'live' | 'paper') {
    await this.tradeThrottle.acquire(signal)
    return (await this.tradeContext(env)).submitOrder(options)
  }

  async cancelOrder(orderId: string, signal?: AbortSignal, env?: 'live' | 'paper') {
    await this.tradeThrottle.acquire(signal)
    return (await this.tradeContext(env)).cancelOrder(orderId)
  }
}
