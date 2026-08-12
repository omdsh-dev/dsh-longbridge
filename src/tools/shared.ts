/**
 * Shared tool plumbing: canonical-json output helper and the common
 * environment parameter every Longbridge tool accepts.
 * @module
 */

import type { ContentBlock } from '@deepseek-ai/dsh-llm'

/** Canonical output: lossless JSON, rendered as text for the model. */
export function jsonOutput() {
  return {
    schema: { type: 'json' } as const,
    render(_args: unknown, value: unknown): ContentBlock[] {
      const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
      return [{ type: 'text', text }]
    },
  }
}

/** Environment override parameter, shared by every Longbridge tool. */
export const ENV_PARAM = {
  type: 'string',
  enum: ['live', 'paper'],
  description: '交易环境；缺省使用 设置 → 长桥 里的选择（live=实盘，paper=模拟盘）',
} as const
