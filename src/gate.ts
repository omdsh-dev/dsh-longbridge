/**
 * Trading confirmation gate: every longbridge_place_order /
 * longbridge_cancel_order dispatch asks the DSH approval channel first.
 * Fail-closed: a missing approval service, an agent-less call, or any outcome
 * other than `allowed-once` denies the call with a structured reason.
 * @module
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-user-approval'
import { TRADING_TOOL_NAMES } from './tools/register.ts'

/** Human-readable intent preview for the approval prompt (bounded). */
function describeTradeIntent(args: unknown): string {
  try {
    const text = JSON.stringify(args)
    return text.length > 300 ? `${text.slice(0, 300)}…` : text
  } catch {
    return '(参数不可序列化)'
  }
}

export function registerTradingGate(ctx: Context): () => void {
  return ctx.on('tools/pre-execute', async (exec, next) => {
    if (!TRADING_TOOL_NAMES.has(exec.name)) return next()
    const approval = ctx.get('approval')
    if (approval === undefined) {
      return { kind: 'deny', reason: `交易工具 ${exec.name} 需要用户确认，但当前部署没有审批通道（已拒绝，防呆）` }
    }
    if (exec.agent === undefined) {
      return { kind: 'deny', reason: `交易工具 ${exec.name} 需要用户确认，但无法定位发起会话（已拒绝）` }
    }
    const outcome = await approval.request({
      agent: exec.agent,
      toolName: exec.name,
      callId: exec.callId,
      reason: describeTradeIntent(exec.arguments),
      signal: exec.signal,
    })
    if (outcome === 'allowed-once') return next()
    const reason = outcome === 'cancelled'
      ? '用户取消了确认'
      : outcome === 'unavailable'
        ? '审批通道不可用'
        : '用户拒绝'
    return { kind: 'deny', reason: `长桥交易操作未获确认：${reason}` }
  })
}
