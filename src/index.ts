/**
 * dsh-longbridge host half: Longbridge (长桥) HK/US market integration.
 * Registers the `longbridge` settings namespace, the nine semantic tools
 * (grouped behind live switches), the trading confirmation gate, and the
 * `/longbridge` RPC channel consumed by the settings page and market panel.
 * @module
 */

import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { LONGBRIDGE_NAMESPACE, LongbridgeConfigSchema, type LongbridgeConfig } from './config.ts'
import { registerTradingGate } from './gate.ts'
import { registerLongbridgeRpc } from './rpc.ts'
import { LongbridgeService } from './service.ts'
import { registerLongbridgeTools } from './tools/register.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'dsh-longbridge'

/** Services required by this plugin. */
export const inject = ['tools', 'credentials', 'connection', 'settings']

export function apply(ctx: Context): void {
  const scope = ctx.settings.register(
    settingsNamespace(LONGBRIDGE_NAMESPACE),
    LongbridgeConfigSchema,
    { applies: 'live' },
  )
  const getConfig = (): LongbridgeConfig => scope.get()
  const service = new LongbridgeService(ctx, getConfig)

  const reconcileTools = registerLongbridgeTools(ctx, service, getConfig)
  ctx.effect(() => scope.watch(() => reconcileTools()), 'dsh-longbridge: settings → tool groups')
  ctx.effect(() => registerTradingGate(ctx), 'dsh-longbridge: trading confirmation gate')
  ctx.effect(() => registerLongbridgeRpc(ctx, service, scope), 'dsh-longbridge: RPC channel')
}
