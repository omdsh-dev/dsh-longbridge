/**
 * Shared tool-plumbing: the tool-group registry that registers and
 * re-registers the nine Longbridge tools as the settings switches move.
 * @module
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { LongbridgeConfig } from '../config.ts'
import type { LongbridgeService } from '../service.ts'
import { defineQuoteTool } from './quote.ts'
import { defineKlineTool } from './kline.ts'
import { defineIndicesTool } from './indices.ts'
import { defineWatchlistTool } from './watchlist.ts'
import { defineMarketStatusTool } from './market-status.ts'
import { defineAccountTool } from './account.ts'
import { definePositionsTool } from './positions.ts'
import { definePlaceOrderTool } from './place-order.ts'
import { defineCancelOrderTool } from './cancel-order.ts'

export type ToolGroup = 'market' | 'account' | 'trading'

/** Which tool group every public tool name belongs to. */
export const TOOL_GROUPS: ReadonlyMap<string, ToolGroup> = new Map([
  ['longbridge_quote', 'market'],
  ['longbridge_kline', 'market'],
  ['longbridge_indices', 'market'],
  ['longbridge_watchlist', 'market'],
  ['longbridge_market_status', 'market'],
  ['longbridge_account', 'account'],
  ['longbridge_positions', 'account'],
  ['longbridge_place_order', 'trading'],
  ['longbridge_cancel_order', 'trading'],
])

/** Trading tools always pass the confirmation gate, regardless of switches. */
export const TRADING_TOOL_NAMES = new Set(['longbridge_place_order', 'longbridge_cancel_order'])

/**
 * Register every Longbridge tool, then keep the registry in sync with the
 * settings switches: a flipped switch re-registers or unregisters the whole
 * group immediately (the registry is dynamic; registration order stays
 * stable per group).
 */
export function registerLongbridgeTools(
  ctx: Context, service: LongbridgeService, getConfig: () => LongbridgeConfig,
): () => void {
  const definitions: ReadonlyMap<ToolGroup, readonly ToolDefinition[]> = new Map([
    ['market', [defineQuoteTool(service), defineKlineTool(service), defineIndicesTool(service),
      defineWatchlistTool(service), defineMarketStatusTool(service)]],
    ['account', [defineAccountTool(service), definePositionsTool(service)]],
    ['trading', [definePlaceOrderTool(service), defineCancelOrderTool(service)]],
  ])
  const disposers = new Map<string, () => void>()

  const reconcile = (): void => {
    const config = getConfig()
    for (const [group, tools] of definitions) {
      const enabled = config.tools[group]
      for (const tool of tools) {
        const live = disposers.has(tool.name)
        if (enabled && !live) {
          disposers.set(tool.name, ctx.tools.register(tool))
        } else if (!enabled && live) {
          disposers.get(tool.name)!()
          disposers.delete(tool.name)
        }
      }
    }
  }

  ctx.effect(() => {
    reconcile()
    return () => {
      for (const dispose of disposers.values()) dispose()
      disposers.clear()
    }
  }, 'dsh-longbridge: tool registrations')
  return reconcile
}
