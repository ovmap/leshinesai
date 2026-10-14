# Dashboard CLI 调试指南

## 手动调用方式

在主窗口按 `Ctrl+Shift+I` 打开 DevTools Console，直接调用 IPC 命令。

## 可用命令

### show — 显示/切换模块

```js
// 打开看板（默认 scroll 页面模式，modules 参数忽略，按 pageRegistry 渲染）
await window.ipcRenderer.invoke('dashboard:open', {})

// 打开看板并指定 grid 布局
await window.ipcRenderer.invoke('dashboard:open', {
  modules: ['cargoTrend', 'signingInformation'],
  layout: 'grid'
})

// 单模块全屏（仅大模块支持）
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'show',
  args: { modules: ['cargoTrend'], layout: 'single' }
})
```

### filter — 设置全局筛选条件

对应看板顶部 GlobalFilterBar 的三个下拉框，对所有模块全局生效。

```js
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'filter',
  args: { filters: { fromWarehouse: '天津宁河CDC', toProvince: '北京' } }
})
```

### action — 触发 UI 操作

```js
// 打开签收明细弹窗
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'action',
  args: { module: 'signingInformation', action: 'openDetail' }
})

// 关闭弹窗
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'action',
  args: { module: 'signingInformation', action: 'closeDetail' }
})

// 导出数据
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'action',
  args: { module: 'signingInformation', action: 'export' }
})

// 重置筛选
await window.ipcRenderer.invoke('dashboard:control', {
  co
  mmand: 'action',
  args: { module: 'signingInformation', action: 'resetFilters' }
})


// 刷新数据
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'action',
  args: { module: 'cargoTrend', action: 'refresh' }
})

// 切换时间维度
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'action',
  args: { module: 'cargoTrend', action: 'changeTimeType', params: { timeType: 'MONTH' } }
})

// 切换指标
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'action',
  args: { module: 'cargoTrend', action: 'changeMetric', params: { metric: 'WEIGHT' } }
})
```

### data — 获取数据（布局感知，返回 Markdown）

data 命令会根据当前布局状态智能返回数据。

#### 参数

| 参数 | 说明 | 可选值 |
|------|------|--------|
| `module` | 模块名（不传则返回页面概览） | 见下方模块列表 |
| `format` | 格式 | `markdown`（默认）, `json` |
| `scope` | 数据范围 | `summary`（默认）, `detail`, `full` |

#### 基础测试

```js
// 1. 获取页面概览（scroll 布局下不指定模块，返回当前页面所有模块摘要）
await window.ipcRenderer.invoke('dashboard:get-data', {
  format: 'markdown',
  scope: 'summary'
})

// 2. 获取单个模块数据（布局感知）
await window.ipcRenderer.invoke('dashboard:get-data', {
  module: 'cargoTrend',
  format: 'markdown',
  scope: 'summary'
})

// 3. 获取模块详细数据
await window.ipcRenderer.invoke('dashboard:get-data', {
  module: 'signingInformation',
  format: 'markdown',
  scope: 'detail'
})

// 4. 获取模块完整数据
await window.ipcRenderer.invoke('dashboard:get-data', {
  module: 'cargoTrend',
  format: 'markdown',
  scope: 'full'
})

// 5. 获取 JSON 格式原始数据
await window.ipcRenderer.invoke('dashboard:get-data', {
  module: 'cargoTrend',
  format: 'json',
  scope: 'full'
})
```

#### 各模块数据测试

```js
// ===== 小卡片模块 =====
await window.ipcRenderer.invoke('dashboard:get-data', { module: 'cargoVolume' })
await window.ipcRenderer.invoke('dashboard:get-data', { module: 'onTime' })
await window.ipcRenderer.invoke('dashboard:get-data', { module: 'endToEnd' })
await window.ipcRenderer.invoke('dashboard:get-data', { module: 'energyPricesCard' })
await window.ipcRenderer.invoke('dashboard:get-data', { module: 'unitPrice' })
await window.ipcRenderer.invoke('dashboard:get-data', { module: 'dryPrice' })

// ===== 大模块 =====
await window.ipcRenderer.invoke('dashboard:get-data', { module: 'energyPrices' })
await window.ipcRenderer.invoke('dashboard:get-data', { module: 'abnormalTransportation' })
await window.ipcRenderer.invoke('dashboard:get-data', { module: 'capacityPool' })
await window.ipcRenderer.invoke('dashboard:get-data', { module: 'urgentCustomer' })
await window.ipcRenderer.invoke('dashboard:get-data', { module: 'majorEvents' })
await window.ipcRenderer.invoke('dashboard:get-data', { module: 'cargoTrend' })
await window.ipcRenderer.invoke('dashboard:get-data', { module: 'signingInformation' })
await window.ipcRenderer.invoke('dashboard:get-data', { module: 'reorderProgress' })

// ===== 特殊模块 =====
await window.ipcRenderer.invoke('dashboard:get-data', { module: 'mapPage' })
```

#### 布局感知行为测试

```js
// --- scroll 布局（默认）---

// 无模块 → 返回页面概览
await window.ipcRenderer.invoke('dashboard:get-data', {})

// 模块在当前页 → 返回数据 + 大模块提示聚焦
await window.ipcRenderer.invoke('dashboard:get-data', { module: 'cargoTrend' })

// 模块不在当前页 → 提示切换页面
await window.ipcRenderer.invoke('dashboard:get-data', { module: 'mapPage' })

// --- 切换到 grid 布局 ---
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'layout',
  args: { layout: 'grid', modules: ['cargoTrend', 'signingInformation'] }
})

// 模块在当前 grid → 返回详细数据（scope 自动提升到 detail）
await window.ipcRenderer.invoke('dashboard:get-data', { module: 'cargoTrend' })

// 模块不在当前 grid → 提示切换
await window.ipcRenderer.invoke('dashboard:get-data', { module: 'energyPrices' })

// --- 切换到 single 布局 ---
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'layout',
  args: { layout: 'single', modules: ['cargoTrend'] }
})

// 模块是当前全屏 → 返回完整数据
await window.ipcRenderer.invoke('dashboard:get-data', { module: 'cargoTrend' })

// 模块不是当前全屏 → 提示切换
await window.ipcRenderer.invoke('dashboard:get-data', { module: 'signingInformation' })

// --- 切回 scroll ---
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'layout',
  args: { layout: 'scroll' }
})
```

#### scope 在不同布局下的行为

| 布局 | scope=summary | scope=detail | scope=full |
|------|---------------|--------------|------------|
| scroll（无模块） | 页面概览 | 页面概览 | 页面概览 |
| scroll（指定模块） | 模块数据 | 模块详细数据 | 模块完整数据 |
| grid（指定模块） | 自动提升到 detail | 详细数据 | 完整数据 |
| single（指定模块） | 自动提升到 detail | 详细数据 | 完整数据 |

### reset — 重置筛选

```js
// 重置指定模块
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'reset',
  args: { module: 'cargoTrend' }
})

// 重置所有模块
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'reset',
  args: {}
})
```

### layout — 切换布局

```js
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'layout',
  args: { layout: 'scroll' }
})
```

layout 可选值: `single` | `grid` | `cards` | `scroll`

| 值 | 说明 |
|---|---|
| `scroll` | 页面模式（默认），每个页面独占全屏，右侧 QuickBar 切换页面 |
| `grid` | 网格布局，多模块并排，自动分配列宽 |
| `cards` | 卡片流（目前同 grid，后续会做动效） |
| `single` | 单模块全屏聚焦（仅大模块支持，见下方说明） |

**single 布局支持的模块：**
- `energyPrices` — 能源价格趋势
- `abnormalTransportation` — 运输异常
- `capacityPool` — 运力池
- `urgentCustomer` — 加急&重点客户风险
- `majorEvents` — 重大活动&极端天气影响
- `cargoTrend` — 货量趋势
- `signingInformation` — 签收信息
- `reorderProgress` — 返单进展

**不支持 single 的模块（小卡片/特殊组件）：**
- `cargoBanner` — 运输智能体（视频+弹窗）
- `mapPage` — 地图（独占整页）
- `cargoVolume` / `onTime` / `endToEnd` / `energyPricesCard` / `unitPrice` / `dryPrice` — 4×3 小卡片

### page — 切换页面（scroll 布局专用）

```js
// 切换到地图页面
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'page',
  args: { page: 'mapPage' }
})

// 切换到运输智能体页面
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'page',
  args: { page: 'cargoBanner' }
})
```

可用页面:

| 页面名 | 标题 | 说明 |
|--------|------|------|
| `cargoBanner` | 智能体中心 | 包含货量卡片、趋势图、异常图表等 16 个子组件 |
| `mapPage` | 地图 | 中国地图，含热力图、在途车辆、仓库、客户、迁徙路线 |
| `reorderDashboard` | 返单看板 | 应签未签、返单及时率、未返单明细 |
| `cargoDashboard` | 货量看板 | 货量趋势、货量占比、运输异常 |
| `onTimeDelivery` | 准时交付率 | 准时交付率(仓+物流)、准时交付率(时间维度) |
| `onTimeDeliveryCustomer` | 准时交付率(联想客户) | 联想/非联想客户准时交付率 |
| `pfpKpiWarehouse` | ToB物流商KPI评分 | 仓库 KPI 评分与排名 |
| `pfpKpiTransport` | 运输物流商KPI评分 | 运输物流 KPI 评分与排名 |
| `pfpKpiCityDelivery` | 城配物流商KPI评分 | 城配 KPI 评分与排名 |
| `pfpKpiCustomer` | PFP KPI-客户 | 客户 KPI 评分 |
| `pfpKpiToC` | PFP KPI-ToC | ToC 物流商 KPI 评分 |
| `pfpKpiExpress` | PFP KPI-运输快递业务 | 运输快递 KPI 评分 |

### close — 关闭看板

```js
await window.ipcRenderer.invoke('dashboard:close')
```

### status — 获取看板当前状态

```js
// 获取当前布局、页面、模块信息
await window.ipcRenderer.invoke('dashboard:get-status')
```

返回示例（scroll 布局）：
```
## 看板当前状态

- **布局**: scroll
- **当前页面**: 智能体中心
- **页面模块**: 累计货量、提货及时率、准时交付率、能源价格、干单价、配单价、货量趋势、签收信息、返单进展、能源价格趋势、运输异常、运力池、加急&重点客户风险、重大活动&极端天气影响
```

返回示例（single 布局）：
```
## 看板当前状态

- **布局**: single
- **显示模块**: 货量趋势
```

### help — 查询命令用法（分层帮助 + 状态感知）

help 命令通过 IPC 调用看板窗口，和其他命令保持一致。

**状态感知**：help 会根据当前布局、页面、模块动态返回不同的帮助内容。

#### 在 DevTools 中测试

```js
// 获取命令总览（带当前状态）
await window.ipcRenderer.invoke('dashboard:help', {})

// 查询 filter 命令详情
await window.ipcRenderer.invoke('dashboard:help', { queryCommand: 'filter' })

// 查询 action 命令详情（会显示当前可操作的模块）
await window.ipcRenderer.invoke('dashboard:help', { queryCommand: 'action' })

// 查询具体模块的操作
await window.ipcRenderer.invoke('dashboard:help', { queryCommand: 'action', module: 'signingInformation' })

// 查询页面列表（会标记当前页面）
await window.ipcRenderer.invoke('dashboard:help', { queryCommand: 'page' })

// 查询 show 命令（会根据当前布局提示）
await window.ipcRenderer.invoke('dashboard:help', { queryCommand: 'show' })

// 查询 data 命令（会显示当前页面模块）
await window.ipcRenderer.invoke('dashboard:help', { queryCommand: 'data' })
```

#### 分层查询示例

```
help()                                        → 命令总览（当前状态 + 10个命令 + 快速开始）
help({ queryCommand: "filter" })              → filter 参数详情（始发仓、目的省、目的RDC）
help({ queryCommand: "action" })              → action 用法总览（当前可操作模块 + 全部支持模块）
help({ queryCommand: "action", module: "cargoTrend" })  → cargoTrend 具体操作列表
help({ queryCommand: "page" })                → 12个页面列表（标记当前页面）
help({ queryCommand: "show" })                → 模块列表 + 布局说明（根据当前布局提示）
help({ queryCommand: "layout" })              → 4种布局说明（显示当前布局）
help({ queryCommand: "data" })                → format/scope 说明（显示当前页面模块）
```

#### 状态感知说明

help 会根据当前状态动态返回内容：

| 命令 | 感知内容 |
|------|----------|
| help() | 显示当前布局、页面/模块 |
| help({ queryCommand: "show" }) | 根据当前布局提示使用方式 |
| help({ queryCommand: "data" }) | 显示当前页面模块列表 |
| help({ queryCommand: "action" }) | 显示当前可操作模块 |
| help({ queryCommand: "layout" }) | 显示当前布局 |
| help({ queryCommand: "page" }) | 标记当前页面 |

#### 使用场景

1. **AI 不确定参数时**：先调用 help 查询用法
2. **探索模块操作**：`help({ queryCommand: "action", module: "xxx" })` 查看模块支持的操作
3. **了解页面结构**：`help({ queryCommand: "page" })` 查看所有页面
4. **感知当前状态**：help 自动显示当前布局/页面/模块，帮助 AI 做出正确决策

### fullscreen — 已删除

> fullscreen 命令已删除，全屏操作请手动完成。

## 可用模块

| 模块名 | 中文名 | 说明 |
|--------|--------|------|
| `cargoBanner` | 运输智能体 | 视频+数据卡片+弹窗 |
| `mapPage` | 地图 | ECharts 中国地图（热力图+车辆+仓库+客户+路线） |
| `cargoVolume` | 累计货量 | Swiper 轮播（日/月/年） |
| `onTime` | 提货及时率 | 静态单值卡片 |
| `endToEnd` | 准时交付率 | 静态单值卡片 |
| `energyPricesCard` | 能源价格 | Swiper 轮播（汽/柴/航空燃油） |
| `energyPrices` | 能源价格趋势 | ECharts 折线/柱状图 |
| `abnormalTransportation` | 运输异常 | ECharts 矩形树图+详情弹窗 |
| `capacityPool` | 运力池 | 自动滚动表格+详情弹窗 |
| `urgentCustomer` | 加急&重点客户风险 | 自动滚动表格+详情弹窗 |
| `majorEvents` | 重大活动&极端天气影响 | 自动滚动表格+详情弹窗 |
| `unitPrice` | 干单价 | 静态单值卡片 |
| `dryPrice` | 配单价 | 静态单值卡片 |
| `cargoTrend` | 货量趋势 | 图表 |
| `signingInformation` | 签收信息 | 表格+图表 |
| `reorderProgress` | 返单进展 | 双层环形图+导出进度 |

## 筛选参数参考

### 通用筛选

| 参数 | 类型 | 说明 |
|------|------|------|
| `fromWarehouse` | string | 始发仓 |
| `toProvince` | string | 目的省 |
| `toRdc` | string | 目的RDC |

### cargoTrend

| 参数 | 类型 | 说明 |
|------|------|------|
| `timeType` | string | 时间维度 (CALENDAR_YEAR/FICAL_YEAR/MONTH/WEEK/DAY...) |
| `metric` | string | 指标 (VOLUME/WEIGHT/VOLUME_SIZE) |
| `dataSource` | string[] | 数据源列表 |
| `dateRange` | string | 日期范围，格式 "YYYY-MM-DD ~ YYYY-MM-DD" |

### signingInformation

| 参数 | 类型 | 说明 |
|------|------|------|
| `modeType` | string | 配送模式 (区配/直送) |
