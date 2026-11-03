# Dashboard CLI 调试指南

## 手动调用方式

在主窗口按 `Ctrl+Shift+I` 打开 DevTools Console，直接调用 IPC 命令。

## 可用命令

### show — 打开看板（默认 scroll 布局）

```js
// 打开看板窗口，默认 scroll 布局
await window.ipcRenderer.invoke('dashboard:open', { layout: 'scroll' })
await window.ipcRenderer.invoke('dashboard:open')
```

> 提示: 放大展示单个模块请使用 `layout` 命令

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

### data — 获取数据（状态感知，返回 Markdown）

data 命令会根据当前布局状态智能返回数据，并感知当前筛选条件。

#### 参数

| 参数 | 说明 | 可选值 |
|------|------|--------|
| `module` | 模块名（不传则返回当前页面概览） | 见可用模块列表 |

#### 示例

```js
// 获取当前页面概览（含状态 + 筛选 + 当前页面模块摘要）
await window.ipcRenderer.invoke('dashboard:data', {})

// 获取单个模块数据（任意模块，不受当前页面限制）
await window.ipcRenderer.invoke('dashboard:data', { module: 'cargoTrend' })

// 获取签收信息数据
await window.ipcRenderer.invoke('dashboard:data', { module: 'signingInformation' })
```

#### 状态感知行为

| 布局 | 不指定 module | 指定 module |
|------|--------------|-------------|
| scroll | 当前页面概览（状态 + 筛选 + 当前页面模块摘要） | 直接返回模块数据（不受当前页面限制） |
| single | 当前全屏模块数据（状态 + 筛选） | 模块是当前全屏→返回数据；不是→提示切换 |

### layout — 切换布局（single 布局，放大展示）

```js
// 单模块全屏显示
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'layout',
  args: { modules: ['cargoTrend'] }
})
```

layout 命令用于放大展示、单独显示某个模块查看数据。`modules` 参数必填，取第一个模块全屏显示。

**支持的模块（大模块）：**
- `energyPrices` — 能源价格趋势
- `abnormalTransportation` — 运输异常
- `capacityPool` — 运力池
- `urgentCustomer` — 加急&重点客户风险
- `majorEvents` — 重大活动&极端天气影响
- `cargoTrend` — 货量趋势
- `signingInformation` — 签收信息
- `reorderProgress` — 返单进展

> 提示: 切换到 scroll 布局请使用 `show` 或 `page` 命令

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

page 命令用于在 scroll 布局下切换页面。每个页面是一个独立的全屏视图，包含多个模块。

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

// 查询始发仓可选值（动态从 selectOptionsStore 获取）
await window.ipcRenderer.invoke('dashboard:help', { queryCommand: 'filter', queryFilter: 'fromWarehouse' })

// 查询目的省可选值
await window.ipcRenderer.invoke('dashboard:help', { queryCommand: 'filter', queryFilter: 'toProvince' })

// 查询目的RDC可选值
await window.ipcRenderer.invoke('dashboard:help', { queryCommand: 'filter', queryFilter: 'toRdc' })
```

#### 分层查询示例

```
help()                                        → 命令总览（当前状态 + 9个命令 + 快速开始）
help({ queryCommand: "filter" })              → filter 参数详情（始发仓、目的省、目的RDC）
help({ queryCommand: "action" })              → action 用法总览（当前可操作模块 + 全部支持模块）
help({ queryCommand: "action", module: "cargoTrend" })  → cargoTrend 具体操作列表
help({ queryCommand: "page" })                → 12个页面列表（scroll 布局专用，标记当前页面）
help({ queryCommand: "show" })                → 打开看板说明（提示使用 layout 放大展示模块）
help({ queryCommand: "layout" })              → single 布局说明 + 大模块列表
help({ queryCommand: "data" })                → 数据获取说明（显示当前页面模块）
```

#### 状态感知说明

help 会根据当前状态动态返回内容：

| 命令 | 感知内容 |
|------|----------|
| help() | 显示当前布局、页面/模块 |
| help({ queryCommand: "show" }) | 提示使用 layout 命令放大展示模块 |
| help({ queryCommand: "data" }) | 显示当前页面模块列表 |
| help({ queryCommand: "action" }) | 显示当前可操作模块 |
| help({ queryCommand: "layout" }) | 显示当前布局，列出支持的大模块 |
| help({ queryCommand: "page" }) | 标记当前页面，提示需要先切换到 scroll 布局 |

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
