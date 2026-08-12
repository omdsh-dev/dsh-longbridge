/**
 * Settings namespace `longbridge`: tool-group switches, the live/paper
 * environment selection, and the experimental right-panel flag. Defaults
 * resolve through the schemastery schema; the user document layers on top.
 * @module
 */

import z from '@deepseek-ai/schemastery'

/** One tool group switch. */
export interface LongbridgeToolFlags {
  /** Market-data tools (quote/kline/indices/watchlist/market-status). */
  market: boolean
  /** Account tools (account/positions), read-only but account-scoped. */
  account: boolean
  /** Trading tools (place_order/cancel_order); every call goes through the confirmation gate. */
  trading: boolean
}

/** Resolved section of the `longbridge` settings namespace. */
export interface LongbridgeConfig {
  tools: LongbridgeToolFlags
  /** Which Longbridge environment credentials resolve against. */
  env: 'live' | 'paper'
  /** Experimental right-side market panel. */
  panel: { enabled: boolean }
}

/** Schemastery schema: schema defaults below the user document layer. */
export const LongbridgeConfigSchema = z.object({
  tools: z.object({
    market: z.boolean().default(true),
    account: z.boolean().default(false),
    trading: z.boolean().default(false),
  }),
  env: z.union([z.const('live'), z.const('paper')]).default('live'),
  panel: z.object({
    enabled: z.boolean().default(false),
  }),
}) as unknown as z<LongbridgeConfig>

/** Namespace name (lowercase kebab-case, per the settings service contract). */
export const LONGBRIDGE_NAMESPACE = 'longbridge'
