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

### filter — 设置筛选条件

```js
// 指定模块筛选
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'filter',
  args: { module: 'cargoTrend', filters: { fromWarehouse: '天津宁河CDC' } }
})

// 全局筛选（应用到所有模块）
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
| `cargoBanner` | 运输智能体 | 包含货量卡片、趋势图、异常图表等 16 个子组件 |
| `mapPage` | 地图 | 中国地图，含热力图、在途车辆、仓库、客户、迁徙路线 |

### close — 关闭看板

```js
await window.ipcRenderer.invoke('dashboard:close')
```

### fullscreen — 切换全屏

```js
// 切换全屏（toggle）
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'fullscreen',
  args: { action: 'toggle' }
})

// 进入全屏
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'fullscreen',
  args: { action: 'enter' }
})

// 退出全屏
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'fullscreen',
  args: { action: 'exit' }
})
```

action 可选值: `toggle`（默认）| `enter` | `exit`

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
