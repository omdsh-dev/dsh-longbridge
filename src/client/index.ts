/**
 * Longbridge client half: the `settings.section` page and the experimental
 * right-side panel controller. The panel mounts only while the
 * `longbridge.panel.enabled` setting is on (read through our own RPC-backed
 * config store — the DSH settings transport does not serve third-party
 * namespaces).
 * @module
 */

import { Component, createElement, useEffect, useSyncExternalStore, type ErrorInfo, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { getConfigSnapshot, refreshConfig, subscribeConfig } from './config-store.ts'
import { LongbridgePanel } from './LongbridgePanel.tsx'
import { LongbridgeSettings } from './LongbridgeSettings.tsx'

export const inject = ['slots', 'connection']

class PanelBoundary extends Component<{ children: ReactNode }, { error: string | undefined }> {
  state: { error: string | undefined } = { error: undefined }

  static getDerivedStateFromError(error: unknown): { error: string } {
    return { error: error instanceof Error ? error.message : String(error) }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[dsh-longbridge] market panel render failed:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error !== undefined) {
      return createElement('div', { role: 'alert' }, '长桥行情面板加载失败：', this.state.error)
    }
    return this.props.children
  }
}

function PanelController(props: { connection: ConnectionHandle }) {
  const snapshot = useSyncExternalStore(subscribeConfig, getConfigSnapshot)
  const enabled = snapshot.config?.panel.enabled === true
  useEffect(() => {
    void refreshConfig(props.connection)
    if (!enabled) document.documentElement.style.removeProperty('--dsh-longbridge-panel-width')
  }, [props.connection, enabled])
  if (!enabled) return null
  return createElement(LongbridgePanel, { connection: props.connection })
}

export function apply(ctx: ClientContext): void {
  const connection = ctx.get('connection') as unknown as ConnectionHandle

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'longbridge',
    order: 45,
    label: () => '长桥',
    inject: () => ({ connection }),
  }, LongbridgeSettings))

  ctx.effect(() => {
    let root: Root | undefined
    const host = document.createElement('div')
    host.setAttribute('data-dsh-longbridge-panel', '')
    document.body.appendChild(host)
    root = createRoot(host)
    root.render(createElement(PanelBoundary, null, createElement(PanelController, { connection })))
    return () => {
      root?.unmount()
      host.remove()
    }
  }, 'dsh-longbridge: panel controller mount')
}
