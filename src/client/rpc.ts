/**
 * Client RPC helpers for the `/longbridge` channel.
 * @module
 */

import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'

export const LONGBRIDGE_RPC_CHANNEL = '/longbridge'

/** Call one `/longbridge` endpoint; non-ok results throw with the error message. */
export async function callRpc<T = unknown>(
  connection: ConnectionHandle, endpoint: string, payload?: unknown, signal?: AbortSignal,
): Promise<T> {
  const result = await connection.rpc.call(LONGBRIDGE_RPC_CHANNEL, endpoint, payload, signal)
  if (!result.ok) throw new Error(`长桥 RPC ${endpoint} 失败：${result.error.message}`)
  return result.value as T
}
