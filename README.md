# dsh-longbridge

DSH 长桥（Longbridge）港美股数据接入插件：券商级行情、账户与交易工具 + 设置页凭据管理。


## 定位

- **港美股**（`700.HK` / `AAPL.US` 格式）+ **券商级能力**（持仓/下单/账户），数据源为
  [Longbridge OpenAPI](https://open.longbridge.com)（`longbridge` npm SDK，App Key/Secret 认证）。
- 与 `dsh-stock-market` 差异化：它覆盖沪深 A 股免费公开源；本插件覆盖港美股与券商级数据。
- 交易工具**强制确认**：`longbridge_place_order` / `longbridge_cancel_order` 每次调用都过
  DSH 审批通道（`tools/pre-execute` → approval），非 `allowed-once` 一律拒绝。

## 硬前置：凭据门槛

1. 在长桥 App 完成**开户**；
2. 登录 open.longbridge.com 开发者平台完成**开发者认证 / OpenAPI 权限申请**；
3. 行情权限与交易权限**分别开通**（免费；港股实时订阅级别、美股期权数据有单独条件）；
4. 在用户中心取得 **App Key / App Secret / Access Token** 三件套，填入 设置 → 长桥。

凭据只写入 DSH 凭据保险箱（`ctx.credentials`，本地 `$DSH_HOME/.credentials.yaml`），
不进入 settings 文档、日志或会话内容；环境变量 `LONGBRIDGE_APP_KEY` /
`LONGBRIDGE_APP_SECRET` / `LONGBRIDGE_ACCESS_TOKEN` 提供时优先（只读遮蔽）。

## 工具清单（9 个，按开关分组）

| 分组 | 工具 | 说明 |
|---|---|---|
| 行情（默认开） | `longbridge_quote` | 实时快照（≤20 代码） |
| | `longbridge_kline` | K线（1m…year，≤500 根，前/不复权） |
| | `longbridge_indices` | 港美主要指数（HSI/HSTECH/DJI/SPX/NDX…） |
| | `longbridge_watchlist` | 券商自选分组 list/add/remove |
| | `longbridge_market_status` | 当日交易时段 |
| 账户（默认关） | `longbridge_account` | 资金总览（现金/净资产/保证金） |
| | `longbridge_positions` | 持仓列表 |
| 交易（默认关，强制确认） | `longbridge_place_order` | 下单（LO/ELO/MO，限价校验） |
| | `longbridge_cancel_order` | 撤单 |

开关在 设置 → 长桥 即时生效（动态注册/注销工具组）。账户/交易组默认关闭；
交易组开启后每次下单仍会弹确认。

## UI

- 设置页（`settings.section`「长桥」）：凭据三件套 + 状态徽章 + 测试连接（700.HK 探活）、
  环境（live/paper）、三组工具开关、实验面板开关。
- 右侧行情面板（**实验，默认关**）：自挂固定列 + `--dsh-longbridge-panel-width` 挤压布局，
  每 5s 轮询指数快照。开启方式：设置 → 长桥 → 实验：右侧行情面板。

## 开发与构建

```bash
npm ci --include=dev                              # 公开依赖（含 longbridge SDK）
DSH_WORKSPACE_ROOT=/path/to/dsh-checkout npm run setup:dsh-workspace   # 链接 DSH 私有 peer
npm run typecheck && npm test && npm run build    # 门禁：tsc + vitest + tsdown(client bundle)
```

`lib/` 为构建产物（host 半区 tsc 输出 + client 半区 tsdown bundle，含 CSS 内联）。

## 安装

```bash
dsh plugin --profile web add link:/absolute/path/to/dsh-longbridge
# 或从 git/npm 源安装发布包；hub catalog 每 2h 自动收录本仓库
```

安装后刷新 Web GUI（http://127.0.0.1:3080）：设置页出现「长桥」；模型工具目录出现
`longbridge_*`（按开关）。

## 限流与配额（实现内已处理/需知）

- Quote：10 req/s、并发 5（SDK 自动限流）；Trade：**30 req/30s、间隔 ≥20ms（本插件
  `TradeThrottle` 强制）**；
- 历史 K 线按月配额（unique symbols，按资产分级 100–3000），实时 K 线（`candlesticks`）
  与行情快照不受此配额限制。

## 路线备注（第一轮调研结论，存档）

- dsh-mcp-client（streamable-http）**不支持 OAuth 2.1**，无法直挂 `https://mcp.longbridge.com`
  （实测 401 + RFC 9728 挑战）；自托管 longbridge-mcp 仍走同一 OAuth。原生插件（本仓库）
  使用 legacy App Key/Secret 三元组，无浏览器交互。详见
  `docs/`（若随仓发布）与工作目录调研文档。
