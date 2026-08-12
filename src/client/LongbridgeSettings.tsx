/**
 * Longbridge settings section: credentials form (App Key/Secret triplet),
 * tool-group switches, live/paper environment, connection probe, and the
 * experimental panel flag. Credentials travel through the `/longbridge`
 * RPC channel into the DSH credential vault — never into settings storage.
 * @module
 */

import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { callRpc } from './rpc.ts'
import css from './LongbridgeSettings.module.css'

/** Client view of the `longbridge` settings namespace. */
export interface LongbridgeConfigView {
  tools: { market: boolean; account: boolean; trading: boolean }
  env: 'live' | 'paper'
  panel: { enabled: boolean }
}

interface CredentialInfo {
  name: string
  configured: boolean
  source: string | null
  writable: boolean
}

interface ProbeResult {
  ok: boolean
  latencyMs: number
  sample?: { symbol: string; lastDone: string | null }
  error?: string
}

type Props = PropsRuntime<'settings.section'> & {
  connection: ConnectionHandle
  scope: SettingsScope<LongbridgeConfigView>
}

const CREDENTIAL_LABELS: ReadonlyMap<string, string> = new Map([
  ['LONGBRIDGE_APP_KEY', 'App Key'],
  ['LONGBRIDGE_APP_SECRET', 'App Secret'],
  ['LONGBRIDGE_ACCESS_TOKEN', 'Access Token'],
])

export function LongbridgeSettings(props: Props) {
  const snapshot = useSyncExternalStore(props.scope.subscribe, props.scope.getSnapshot)
  const config = snapshot.value
  const [credentials, setCredentials] = useState<CredentialInfo[] | null>(null)
  const [form, setForm] = useState({ appKey: '', appSecret: '', accessToken: '' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [probe, setProbe] = useState<ProbeResult | null>(null)

  const refreshDescribe = async (): Promise<void> => {
    try {
      const state = await callRpc<{ credentials: CredentialInfo[] }>(props.connection, 'settings/describe')
      setCredentials(state.credentials)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    }
  }
  useEffect(() => { void refreshDescribe() }, [props.connection])

  const saveCredentials = async (): Promise<void> => {
    setBusy(true)
    setNotice(null)
    try {
      const patch: Record<string, string> = {}
      if (form.appKey.trim() !== '') patch.appKey = form.appKey.trim()
      if (form.appSecret.trim() !== '') patch.appSecret = form.appSecret.trim()
      if (form.accessToken.trim() !== '') patch.accessToken = form.accessToken.trim()
      if (Object.keys(patch).length === 0) {
        setNotice('没有需要保存的内容（表单为空）')
        return
      }
      await callRpc(props.connection, 'settings/credentials', patch)
      setForm({ appKey: '', appSecret: '', accessToken: '' })
      setNotice('凭据已保存到 DSH 凭据保险箱')
      await refreshDescribe()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const clearCredentials = async (): Promise<void> => {
    setBusy(true)
    setNotice(null)
    try {
      await callRpc(props.connection, 'settings/credentials', { appKey: '', appSecret: '', accessToken: '' })
      setNotice('凭据已全部清除')
      await refreshDescribe()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const runProbe = async (): Promise<void> => {
    setBusy(true)
    setNotice(null)
    setProbe(null)
    try {
      setProbe(await callRpc<ProbeResult>(props.connection, 'settings/probe'))
    } catch (error) {
      setProbe({ ok: false, latencyMs: 0, error: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  const setEnv = (env: 'live' | 'paper'): void => { void props.scope.set('env', env) }
  const setTool = (group: 'market' | 'account' | 'trading', enabled: boolean): void => {
    if (config === undefined) return
    void props.scope.set('tools', { ...config.tools, [group]: enabled })
  }
  const setPanel = (enabled: boolean): void => { void props.scope.set('panel', { enabled }) }

  const unavailable = snapshot.status === 'unavailable'

  return (
    <section className={css.section}>
      <h2 className={css.groupTitle}>凭据</h2>
      <p className={css.hint}>
        需在 open.longbridge.com 完成长桥开户与开发者认证后获取 App Key / App Secret / Access Token；
        行情权限与交易权限分别开通。凭据只写入 DSH 凭据保险箱（$DSH_HOME/.credentials.yaml），
        不进入设置文档、日志或会话内容。
      </p>
      {credentials === null
        ? <p className={css.hint}>读取凭据状态中…</p>
        : (
          <ul className={css.credList}>
            {credentials.map(c => (
              <li key={c.name} className={css.credRow}>
                <span className={css.credName}>{CREDENTIAL_LABELS.get(c.name) ?? c.name}</span>
                <span className={c.configured ? css.badgeOk : css.badgeOff}>
                  {c.configured ? `已配置${c.source !== null ? `（${c.source}）` : ''}` : '未配置'}
                </span>
                {!c.writable && <span className={css.badgeRo}>只读（环境变量提供）</span>}
              </li>
            ))}
          </ul>
        )}
      <label className={css.field}>
        <span>App Key</span>
        <input type="password" value={form.appKey} onChange={e => setForm({ ...form, appKey: e.target.value })} />
      </label>
      <label className={css.field}>
        <span>App Secret</span>
        <input type="password" value={form.appSecret} onChange={e => setForm({ ...form, appSecret: e.target.value })} />
      </label>
      <label className={css.field}>
        <span>Access Token</span>
        <input type="password" value={form.accessToken} onChange={e => setForm({ ...form, accessToken: e.target.value })} />
      </label>
      <div className={css.actions}>
        <button type="button" disabled={busy} onClick={() => void saveCredentials()}>保存凭据</button>
        <button type="button" className={css.danger} disabled={busy} onClick={() => void clearCredentials()}>清除全部凭据</button>
        <button type="button" disabled={busy} onClick={() => void runProbe()}>测试连接</button>
      </div>
      {probe !== null && (
        <p className={probe.ok ? css.probeOk : css.probeFail}>
          {probe.ok
            ? `连接正常：延迟 ${probe.latencyMs}ms，700.HK 最新价 ${probe.sample?.lastDone ?? '—'}`
            : `连接失败：${probe.error}`}
        </p>
      )}

      <h2 className={css.groupTitle}>环境与工具开关</h2>
      {unavailable
        ? <p className={css.hint}>设置存储当前不可用（远端浏览器不支持回环设置）。</p>
        : config !== undefined && (
          <>
            <div className={css.row}>
              <span>环境</span>
              <select value={config.env} onChange={e => setEnv(e.target.value as 'live' | 'paper')}>
                <option value="live">实盘 Live</option>
                <option value="paper">模拟 Paper</option>
              </select>
            </div>
            <div className={css.row}>
              <span>行情工具（quote/kline/indices/watchlist/market_status）</span>
              <input type="checkbox" checked={config.tools.market} onChange={e => setTool('market', e.target.checked)} />
            </div>
            <div className={css.row}>
              <span>账户工具（account/positions，只读）</span>
              <input type="checkbox" checked={config.tools.account} onChange={e => setTool('account', e.target.checked)} />
            </div>
            <div className={css.row}>
              <span>交易工具（place_order/cancel_order，每次调用弹确认）</span>
              <input type="checkbox" checked={config.tools.trading} onChange={e => setTool('trading', e.target.checked)} />
            </div>
            <div className={css.row}>
              <span>实验：右侧行情面板（Phase 2 预览）</span>
              <input type="checkbox" checked={config.panel.enabled} onChange={e => setPanel(e.target.checked)} />
            </div>
          </>
        )}

      {notice !== null && <p className={css.notice}>{notice}</p>}

      <h2 className={css.groupTitle}>关于</h2>
      <p className={css.hint}>
        dsh-longbridge v0.1.0 · 数据源：Longbridge OpenAPI（港美股 + 券商级账户/交易）。
        A 股行情请使用 dsh-stock-market。⚠ 内测插件，仅组织内可见，请勿外传。
      </p>
    </section>
  )
}
