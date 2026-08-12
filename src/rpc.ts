/**
 * `/longbridge` RPC channel (loopback): settings-page transports (credential
 * writes, config patches, connection probe) and the panel snapshot endpoint.
 * @module
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type { RpcResult } from '@deepseek-ai/dsh-host-apiproxy/api'
import { transportError } from '@deepseek-ai/dsh-host-apiproxy/api'
import type { SettingsScope } from '@deepseek-ai/dsh-settings'
import { changePct, dec } from './serialize.ts'
import type { LongbridgeConfig } from './config.ts'
import { LONGBRIDGE_CREDENTIAL_REFS, UNCONFIGURED_MESSAGE } from './credentials.ts'
import type { LongbridgeService } from './service.ts'

export const LONGBRIDGE_RPC_CHANNEL = '/longbridge'

/** Default index symbols the panel renders until a watchlist exists. */
const PANEL_DEFAULT_SYMBOLS = ['HSI.HK', 'HSTECH.HK', 'DJI.US', 'SPX.US', 'NDX.US']

function ok<T>(value: T): RpcResult<T> {
  return { ok: true, value }
}

export function registerLongbridgeRpc(
  ctx: Context, service: LongbridgeService, scope: SettingsScope<LongbridgeConfig>,
): () => void {
  const handle = ctx.connection.rpc.handle(LONGBRIDGE_RPC_CHANNEL, async (endpoint, payload, _signal) => {
    try {
      switch (endpoint) {
        case 'settings/describe': return ok(await describeState(ctx, scope))
        case 'settings/credentials': return ok(await writeCredentials(ctx, payload))
        case 'settings/config': return ok(await updateConfig(scope, payload))
        case 'settings/probe': return ok(await probe(service))
        case 'panel/snapshot': return ok(await panelSnapshot(service, payload))
        default: return transportError<unknown>(new Error(`长桥 RPC 未知端点: ${endpoint}`))
      }
    } catch (error) {
      return transportError<unknown>(error)
    }
  }, { authority: 'loopback' })
  return () => { void handle() }
}

async function describeState(ctx: Context, scope: SettingsScope<LongbridgeConfig>) {
  const credentials = []
  for (const ref of LONGBRIDGE_CREDENTIAL_REFS) {
    const info = await ctx.credentials.describe(ref)
    credentials.push({ name: ref, configured: info.configured, source: info.source ?? null, writable: info.writable })
  }
  return { config: scope.get(), credentials }
}

interface CredentialPatch { appKey?: string; appSecret?: string; accessToken?: string }

async function writeCredentials(ctx: Context, payload: unknown): Promise<{ saved: boolean }> {
  const patch = (payload ?? {}) as CredentialPatch
  const writes: Array<Promise<void>> = []
  const byName: Record<string, string | undefined> = {
    LONGBRIDGE_APP_KEY: patch.appKey,
    LONGBRIDGE_APP_SECRET: patch.appSecret,
    LONGBRIDGE_ACCESS_TOKEN: patch.accessToken,
  }
  for (const ref of LONGBRIDGE_CREDENTIAL_REFS) {
    const value = byName[ref]
    if (value === undefined) continue
    if (value === '') writes.push(ctx.credentials.unset(ref))
    else writes.push(ctx.credentials.set(ref, value))
  }
  await Promise.all(writes)
  return { saved: true }
}

async function updateConfig(scope: SettingsScope<LongbridgeConfig>, payload: unknown): Promise<LongbridgeConfig> {
  const patch = (payload ?? {}) as { patch?: Partial<LongbridgeConfig> }
  await scope.update(patch.patch ?? {})
  return scope.get()
}

async function probe(service: LongbridgeService) {
  const started = Date.now()
  try {
    const [quote] = await service.quotes(['700.HK'])
    const latencyMs = Date.now() - started
    if (quote === undefined) throw new Error(UNCONFIGURED_MESSAGE)
    return { ok: true, latencyMs, sample: { symbol: quote.symbol, lastDone: dec(quote.lastDone) } }
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function panelSnapshot(service: LongbridgeService, payload: unknown) {
  const input = (payload ?? {}) as { symbols?: string[] }
  const symbols = input.symbols !== undefined && input.symbols.length > 0 ? input.symbols : PANEL_DEFAULT_SYMBOLS
  const quotes = await service.cachedQuotes(symbols.slice(0, 10))
  const rows = quotes.map(q => {
    const last = dec(q.lastDone)
    const prev = dec(q.prevClose)
    return { symbol: q.symbol, lastDone: last, changePct: changePct(last ?? '', prev ?? ''), timestamp: q.timestamp.toISOString() }
  })
  return { symbols, quotes: rows }
}
