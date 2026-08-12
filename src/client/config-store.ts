/**
 * Client-side config store: the browser reads and writes the `longbridge`
 * settings namespace through our own `/longbridge` RPC channel. The DSH
 * settings transport (settingsScope) intentionally serves only core-listed
 * namespaces (`WEB_SETTINGS_NAMESPACES` in the api-proxy), so a third-party
 * plugin's namespace is `settings-not-exposed` on that wire — this store is
 * the supported path around that boundary.
 * @module
 */

import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { callRpc } from './rpc.ts'

/** Client view of the `longbridge` settings namespace. */
export interface LongbridgeConfigView {
  tools: { market: boolean; account: boolean; trading: boolean }
  env: 'live' | 'paper'
  panel: { enabled: boolean }
}

interface StoreState {
  config: LongbridgeConfigView | null
  error: string | null
}

const listeners = new Set<() => void>()
let state: StoreState = { config: null, error: null }

export function getConfigSnapshot(): StoreState {
  return state
}

export function subscribeConfig(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function publish(next: StoreState): void {
  state = next
  for (const listener of listeners) listener()
}

/** Re-read the namespace section (and refresh the credential badges). */
export async function refreshConfig(connection: ConnectionHandle): Promise<void> {
  try {
    const described = await callRpc<{ config: LongbridgeConfigView }>(connection, 'settings/describe')
    publish({ config: described.config, error: null })
  } catch (error) {
    publish({ config: null, error: error instanceof Error ? error.message : String(error) })
  }
}

/** Write one patch through the host scope and publish the resolved section. */
export async function updateConfig(
  connection: ConnectionHandle, patch: Partial<LongbridgeConfigView>,
): Promise<LongbridgeConfigView> {
  try {
    const config = await callRpc<LongbridgeConfigView>(connection, 'settings/config', { patch })
    publish({ config, error: null })
    return config
  } catch (error) {
    publish({ config: null, error: error instanceof Error ? error.message : String(error) })
    throw error
  }
}
