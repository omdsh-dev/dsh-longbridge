/**
 * Experimental right-side market panel (Phase 2 spike). A self-mounted fixed
 * column squeezed into the app frame through the `--dsh-longbridge-panel-width`
 * CSS variable; data comes from the `/longbridge` panel/snapshot RPC.
 * @module
 */

import { useEffect, useState } from 'react'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { callRpc } from './rpc.ts'
import css from './LongbridgePanel.module.css'

const PANEL_WIDTH_PX = 320
const POLL_INTERVAL_MS = 5_000

interface PanelRow {
  symbol: string
  lastDone: string | null
  changePct: string | null
  timestamp: string
}

interface PanelSnapshot {
  symbols: string[]
  quotes: PanelRow[]
}

/** Injected body rule: the panel squeezes the app frame instead of overlaying it. */
const BODY_RULE = 'body { padding-right: var(--dsh-longbridge-panel-width, 0px); transition: padding-right 150ms ease; }'

function installBodyRule(): () => void {
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-longbridge'
  tag.dataset.pluginCss = 'dsh-longbridge/body-squeeze'
  document.head.appendChild(tag)
  tag.textContent = BODY_RULE
  return () => { tag.remove() }
}

export function LongbridgePanel(props: { connection: ConnectionHandle }) {
  const [collapsed, setCollapsed] = useState(false)
  const [snapshot, setSnapshot] = useState<PanelSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => installBodyRule(), [])
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--dsh-longbridge-panel-width', collapsed ? '0px' : `${PANEL_WIDTH_PX}px`,
    )
    return () => { document.documentElement.style.removeProperty('--dsh-longbridge-panel-width') }
  }, [collapsed])

  useEffect(() => {
    let cancelled = false
    const tick = async (): Promise<void> => {
      try {
        const next = await callRpc<PanelSnapshot>(props.connection, 'panel/snapshot')
        if (!cancelled) {
          setSnapshot(next)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setSnapshot(null)
        }
      }
    }
    void tick()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void tick()
    }, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [props.connection])

  return (
    <aside className={css.panel} style={{ width: PANEL_WIDTH_PX }} data-collapsed={collapsed || undefined}>
      <header className={css.header}>
        <span className={css.title}>长桥行情</span>
        <button
          type="button"
          className={css.collapse}
          aria-label={collapsed ? '展开行情面板' : '收起行情面板'}
          onClick={() => setCollapsed(v => !v)}
        >
          {collapsed ? '◀' : '▶'}
        </button>
      </header>
      {!collapsed && (
        <>
          {error !== null && <p className={css.error}>行情加载失败：{error}</p>}
          {snapshot !== null && (
            <ul className={css.list}>
              {snapshot.quotes.map(row => {
                const change = Number(row.changePct)
                const up = change > 0
                const down = change < 0
                return (
                  <li key={row.symbol} className={css.item}>
                    <span className={css.symbol}>{row.symbol}</span>
                    <span className={css.price}>{row.lastDone ?? '—'}</span>
                    <span className={up ? css.up : down ? css.down : css.flat}>
                      {row.changePct === null ? '—' : `${change > 0 ? '+' : ''}${row.changePct}%`}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          <footer className={css.footer}>
            实验面板 · 每 5s 轮询 · 未配置凭据时显示加载失败
          </footer>
        </>
      )}
    </aside>
  )
}
