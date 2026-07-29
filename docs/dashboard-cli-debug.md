# Dashboard CLI 调试指南

## 手动调用方式

在主窗口按 `Ctrl+Shift+I` 打开 DevTools Console，直接调用 IPC 命令。

## 可用命令

### show — 显示/切换模块

```js
await window.ipcRenderer.invoke('dashboard:open', {
  modules: ['cargoTrend', 'signingInformation'],
  layout: 'grid'
})
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
  command: 'action',
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

### data — 获取数据（返回 Markdown）

```js
// 获取指定模块摘要
await window.ipcRenderer.invoke('dashboard:get-data', {
  module: 'cargoTrend',
  format: 'markdown',
  scope: 'summary'
})

// 获取全部数据
await window.ipcRenderer.invoke('dashboard:get-data', {
  format: 'markdown',
  scope: 'full'
})
```

scope 可选值: `summary` | `detail` | `full`

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
  args: { layout: 'single' }
})
```

layout 可选值: `single` | `grid` | `cards` | `scroll`

| 值 | 说明 |
|---|---|
| `grid` | 网格布局（默认），多模块并排，自动分配列宽 |
| `single` | 单模块全屏聚焦，只显示第一个模块 |
| `cards` | 卡片流，可滚动（当前走 grid 默认逻辑） |
| `scroll` | 垂直滚动模式，每个模块独占一屏，右侧出现 QuickBar 导航栏 |

#### scroll 模式调试

```js
// 切换到 scroll 布局
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'layout',
  args: { layout: 'scroll' }
})

// 切回 grid
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'layout',
  args: { layout: 'grid' }
})
```

scroll 模式下 QuickBar 行为：
- 默认收起，鼠标悬停展开导航列表
- 点击导航项平滑滚动到对应模块
- 手动滚动时自动高亮当前模块
- 窗口 resize 后自动重新计算锚点

### close — 关闭看板

```js
await window.ipcRenderer.invoke('dashboard:close')
```

## 可用模块

| 模块名 | 中文名 | 说明 |
|--------|--------|------|
| `cargoTrend` | 货量趋势 | 堆叠柱状图 + 同比/环比折线 |
| `signingInformation` | 签收信息 | 环形图 + 未签收明细弹窗 |

## 筛选参数参考

### cargoTrend

| 参数 | 类型 | 说明 |
|------|------|------|
| `fromWarehouse` | string | 始发仓 |
| `toProvince` | string | 目的省 |
| `toRdc` | string | 目的RDC |
| `timeType` | string | 时间维度 (CALENDAR_YEAR/FICAL_YEAR/MONTH/WEEK/DAY...) |
| `metric` | string | 指标 (VOLUME/WEIGHT/VOLUME_SIZE) |
| `dataSource` | string[] | 数据源列表 |
| `dateRange` | string | 日期范围，格式 "YYYY-MM-DD ~ YYYY-MM-DD" |

### signingInformation

| 参数 | 类型 | 说明 |
|------|------|------|
| `fromWarehouse` | string | 始发仓 |
| `toProvince` | string | 目的省 |
| `toRdc` | string | 目的RDC |
| `modeType` | string | 配送模式 (区配/直送) |
