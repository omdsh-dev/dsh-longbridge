/**
 * Credential references for the Longbridge OpenAPI legacy App Key/Secret
 * triplet. Configuration carries references, never secrets: values live with
 * the DSH credential provider (env shadows the managed store read-only).
 * @module
 */

import type { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'

export const LONGBRIDGE_APP_KEY = credentialRef('LONGBRIDGE_APP_KEY')
export const LONGBRIDGE_APP_SECRET = credentialRef('LONGBRIDGE_APP_SECRET')
export const LONGBRIDGE_ACCESS_TOKEN = credentialRef('LONGBRIDGE_ACCESS_TOKEN')

/** All three references, in the order a settings form renders them. */
export const LONGBRIDGE_CREDENTIAL_REFS = [LONGBRIDGE_APP_KEY, LONGBRIDGE_APP_SECRET, LONGBRIDGE_ACCESS_TOKEN] as const

/** Fully resolved credential triplet. */
export interface LongbridgeCredentials {
  appKey: string
  appSecret: string
  accessToken: string
}

/**
 * Resolve the credential triplet per operation (the credentials doctrine:
 * never cache across operations). Returns undefined when any part is absent,
 * including empty stored values.
 */
export async function resolveLongbridgeCredentials(ctx: Context): Promise<LongbridgeCredentials | undefined> {
  const appKey = await ctx.credentials.resolve(LONGBRIDGE_APP_KEY)
  const appSecret = await ctx.credentials.resolve(LONGBRIDGE_APP_SECRET)
  const accessToken = await ctx.credentials.resolve(LONGBRIDGE_ACCESS_TOKEN)
  if (appKey === undefined || appSecret === undefined || accessToken === undefined) return undefined
  return { appKey: appKey.value, appSecret: appSecret.value, accessToken: accessToken.value }
}

/** Stable error message every unconfigured tool call returns. */
export const UNCONFIGURED_MESSAGE = '长桥凭据未配置：请在 设置 → 长桥 填写 App Key / App Secret / Access Token（需在 open.longbridge.com 完成开户与开发者认证后获取）'
