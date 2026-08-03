# 看板数据获取流程设计

## 概述

看板数据获取与布局系统强关联。AI 获取数据时，需要根据当前布局状态决定是直接返回数据，还是提示切换布局/页面。

## 布局层级

| 布局 | 用途 | 模块数量 | 数据获取策略 |
|------|------|----------|--------------|
| `scroll` | 全局概览（默认） | 多模块（按页面） | 返回模块列表+摘要，提示深入 |
| `grid` | 局部聚焦 | 2-3 个大模块 | 直接返回详细数据 |
| `single` | 单模块全屏 | 1 个大模块 | 返回完整数据+详情 |

## 数据获取流程

### 1. scroll 布局（默认）

```
AI 请求数据
    │
    ▼
获取当前页面信息
    │
    ▼
返回模块列表 + 各模块摘要
    │
    ├── AI 请求某个模块的详细数据
    │       │
    │       ├── 模块在当前页面？
    │       │       │
    │       │       ├── 是 → 返回详细数据
    │       │       │         │
    │       │       │         └── 模块支持 single 布局？
    │       │       │               ├── 是（大模块） → 额外提示"是否聚焦显示？"
    │       │       │               └── 否（小卡片） → 不提示
    │       │       │
    │       │       └── 否 → 提示"该模块在 XX 页面，是否切换？"
    │
    └── AI 请求不在当前页面的模块
            │
            ▼
        返回提示：
        "该模块在 [页面名] 页面，当前显示 [当前页面名]。
         是否切换到 [页面名] 页面？"
```

**scroll 布局返回格式示例：**

```markdown
# 运输智能体页面

当前显示 16 个模块：

## 模块概览

| 模块 | 状态 | 摘要 |
|------|------|------|
| 累计货量 | 正常 | 今日: 12,345 单 |
| 提货及时率 | 正常 | 98.5% |
| 准时交付率 | 正常 | 96.2% |
| 能源价格趋势 | 正常 | 近7日上涨 2.3% |
| 运输异常 | 警告 | 3 条异常待处理 |
| 运力池 | 正常 | 可用车辆 156 台 |
| 货量趋势 | 正常 | 月环比 +5.2% |
| 签收信息 | 正常 | 签收率 94.8% |
| ... | ... | ... |

## 提示

- 请求某个模块的详细数据，请指定模块名
- 大模块（如货量趋势、签收信息）支持聚焦显示
- 地图页面有独立数据，需要切换到地图页面查看
```

### 2. grid 布局（局部聚焦）

```
AI 请求数据
    │
    ▼
检查当前 grid 布局的模块
    │
    ├── 请求的模块在当前 grid 中？
    │       │
    │       ├── 是 → 返回该模块的详细数据
    │       │
    │       └── 否 → 提示"当前显示 [模块A]、[模块B]，
    │                是否切换显示 [请求模块]？"
    │
    └── 请求全部数据 → 返回当前 grid 中所有模块的详细数据
```

**grid 布局返回格式示例：**

```markdown
# 当前聚焦：货量趋势 + 签收信息

布局: grid (2 模块并排)

## 货量趋势

- 时间维度: 月
- 指标: 订单数量
- 本月: 125,680 单
- 同比: +8.3%
- 环比: +2.1%

| 月份 | 订单数 | 同比 | 环比 |
|------|--------|------|------|
| 2024-01 | 125,680 | +8.3% | +2.1% |
| 2024-02 | 98,450 | -3.2% | -21.7% |
| ... | ... | ... | ... |

## 签收信息

- 已签收: 45,230 单
- 待签收: 2,340 单
- 签收率: 95.1%

## 提示

如需查看其他模块，可执行：
- `show --modules [模块名]` 切换显示
- `layout scroll` 返回全局视图
```

### 3. single 布局（单模块全屏）

```
AI 请求数据
    │
    ▼
检查当前 single 布局的模块
    │
    ├── 请求的模块就是当前模块？
    │       │
    │       ├── 是 → 返回完整数据（含详情）
    │       │
    │       └── 否 → 提示"当前全屏显示 [模块A]，
    │                是否切换显示 [请求模块]？"
    │
    └── 请求全部数据 → 返回当前模块的完整数据
```

**single 布局返回格式示例：**

```markdown
# 货量趋势（全屏）

布局: single

## 详细数据

- 时间维度: 月
- 指标: 订单数量
- 数据源: 全部
- 时间范围: 2024-01 ~ 2024-12

### 月度数据

| 月份 | 联想 | 非联想 | 合计 | 同比 | 环比 |
|------|------|--------|------|------|------|
| 2024-01 | 98,500 | 27,180 | 125,680 | +8.3% | +2.1% |
| 2024-02 | 78,200 | 20,250 | 98,450 | -3.2% | -21.7% |
| ... | ... | ... | ... | ... | ... |

### 趋势分析

- 整体趋势: 上升
- 最高月份: 2024-03 (156,780 单)
- 最低月份: 2024-02 (98,450 单)

## 提示

如需查看其他模块，可执行：
- `show --modules [模块名]` 切换全屏
- `layout scroll` 返回全局视图
```

## 实现方案

### 1. 模块分类（moduleRegistry.ts）

```typescript
// 集中定义模块分类，供所有命令和组件使用
export const LARGE_MODULES = [...]   // 大模块（支持 single/grid）
export const SMALL_MODULES = [...]   // 小卡片（仅 scroll 页面内）
export const SPECIAL_MODULES = [...] // 特殊模块（页面容器/独占整页）

export function isLargeModule(module: string): boolean
export function isSmallModule(module: string): boolean
export function getPageModuleNames(pageName: string): string[]
export function findModulePage(module: string): string | null
```

### 2. 布局感知数据获取（dashboardDataStore.ts）

```typescript
// 获取当前布局上下文
function getLayoutContext(): { layout, currentPage, currentPageTitle, activeModules, pageModules }

// 检查模块是否在当前视图
function isModuleInCurrentView(module: string): boolean

// 获取模块摘要（scroll 概览用）
function getModuleSummary(module: string): string

// 获取页面概览（scroll 布局无指定模块时）
function getPageOverview(): string

// 布局感知的数据获取主入口
function getSmartData(module?, format?, scope?): string
```

### 3. 数据同步（各模块组件 → dataStore）

各模块组件在获取 API 数据后，调用 `dataStore.updateModuleData(moduleName, rawData)` 同步到 dataStore。

```typescript
// 模块组件中
import { useDashboardDataStore } from '../../../stores/dashboardDataStore'

const dataStore = useDashboardDataStore()

// 获取 API 数据后同步
const result = await queryXxx(params)
if (result?.code === 200 && result.data) {
  dataStore.updateModuleData('moduleName', result.data)
}
```

**各模块同步的数据结构：**

| 模块 | dataStore key | 数据结构 |
|------|---------------|----------|
| 累计货量 | `cargoVolume` | `{ day: {...}, month: {...}, year: {...} }` |
| 提货及时率 | `onTime` | `{ pickupRate }` |
| 准时交付率 | `endToEnd` | `{ deliveryRate }` |
| 能源价格 | `energyPricesCard` | `{ gasoline, diesel, aircraftFuel, *PriceIsUp }` |
| 干单价 | `unitPrice` | `{ trunkLinePrice }` |
| 配单价 | `dryPrice` | `{ deliveryPrice }` |
| 能源价格趋势 | `energyPrices` | `{ items: [{ month, gasoline, diesel, aircraftFuel, event }] }` |
| 运输异常 | `abnormalTransportation` | `{ rawData: [{ abnormalType, abnormalTypeName, abnormalInfoList }] }` |
| 运力池 | `capacityPool` | `{ list: [{ logisticName, route, truckCount, truckType }] }` |
| 加急客户风险 | `urgentCustomer` | `{ list: [{ invoiceNo, transType, location, ... }] }` |
| 重大活动天气 | `majorEvents` | `{ list: [{ province, city, desc, affectOrderCount }] }` |
| 返单进展 | `reorderProgress` | `{ confirmed, notConfirm, notConfirmWithin30d, ... }` |
| 货量趋势 | `cargoTrend` | `{ timeSeries: [...], filters: {...} }` |
| 签收信息 | `signingInformation` | `{ signed, unsigned, detailList, filters }` |

### 4. Markdown 格式化（dashboardFormatters/）

每个模块一个独立的格式化文件，统一注册到 `index.ts`。

```
src/stores/dashboardFormatters/
├── index.ts                    # 统一注册表 + 导出
├── cargoVolume.ts              # 累计货量（日/月/年）
├── onTime.ts                   # 提货及时率
├── endToEnd.ts                 # 准时交付率
├── energyPricesCard.ts         # 能源价格卡片
├── unitPrice.ts                # 干单价
├── dryPrice.ts                 # 配单价
├── energyPrices.ts             # 能源价格趋势（月度表格）
├── abnormalTransportation.ts   # 运输异常（分类表格）
├── capacityPool.ts             # 运力池（物流商/线路/车辆）
├── urgentCustomer.ts           # 加急客户风险（订单明细）
├── majorEvents.ts              # 重大活动天气（区域影响）
├── reorderProgress.ts          # 返单进展（环形图数据）
├── cargoTrend.ts               # 货量趋势（多数据源表格）
└── signingInformation.ts       # 签收信息（含明细表格）
```

**新增模块的格式化函数：**

```typescript
// 1. 新建 dashboardFormatters/newModule.ts
export function formatNewModule(data: any, scope: string): string {
  let md = `## 模块标题\n\n`
  // 格式化逻辑...
  return md
}

// 2. 在 index.ts 中注册
import { formatNewModule } from './newModule'

export const formatters: Record<string, (data: any, scope: string) => string> = {
  // ... 现有注册
  newModule: formatNewModule,
}
```

### 5. data 命令（data.ts）

data.ts 通过 IPC 转发到看板窗口，看板窗口的 DashboardView.vue 监听 `dashboard:request-data`，调用 `dataStore.getSmartData()` 处理。

**参数说明：**

| 参数 | 说明 | 可选值 |
|------|------|--------|
| `module` | 模块名（不传则返回页面概览） | cargoTrend, signingInformation, ... |
| `format` | 格式 | `markdown`（默认）, `json` |
| `scope` | 数据范围 | `summary`（默认）, `detail`, `full` |

**scope 在不同布局下的行为：**

| 布局 | scope=summary | scope=detail | scope=full |
|------|---------------|--------------|------------|
| scroll（无模块） | 页面概览 | 页面概览 | 页面概览 |
| scroll（指定模块） | 模块数据 | 模块详细数据 | 模块完整数据 |
| grid（指定模块） | 自动提升到 detail | 详细数据 | 完整数据 |
| single（指定模块） | 自动提升到 detail | 详细数据 | 完整数据 |

**调用链路：**

```
AI 调用 dashboard_command({ command: 'data', args: { module: 'cargoTrend' } })
  → data.ts 转发 IPC: dashboard:get-data
  → ipcManager.ts handler → 看板窗口
  → DashboardView.vue 监听 dashboard:request-data
  → dataStore.getSmartData(module, format, scope)
    → 判断布局 → 判断模块可见性 → 调用 formatter → 返回 Markdown/JSON
```

## 模块分类

### 大模块（支持 single/grid）

| 模块 | 说明 |
|------|------|
| `energyPrices` | 能源价格趋势 |
| `abnormalTransportation` | 运输异常 |
| `capacityPool` | 运力池 |
| `urgentCustomer` | 加急&重点客户风险 |
| `majorEvents` | 重大活动&极端天气影响 |
| `cargoTrend` | 货量趋势 |
| `signingInformation` | 签收信息 |
| `reorderProgress` | 返单进展 |

### 小模块（仅 scroll 页面内展示）

| 模块 | 说明 |
|------|------|
| `cargoVolume` | 累计货量 |
| `onTime` | 提货及时率 |
| `endToEnd` | 准时交付率 |
| `energyPricesCard` | 能源价格 |
| `unitPrice` | 干单价 |
| `dryPrice` | 配单价 |

### 特殊模块

| 模块 | 说明 |
|------|------|
| `cargoBanner` | 运输智能体（页面容器） |
| `mapPage` | 地图（独占整页） |

## 典型对话场景

### 场景 1：AI 查看全局状态

```
用户: 看看看板现在什么情况
AI: dashboard_command({ command: 'data' })

返回:
# 运输智能体页面

当前显示 16 个模块：
- 累计货量: 12,345 单
- 提货及时率: 98.5%
- 运输异常: 3 条待处理
...

提示: 请求某个模块的详细数据，请指定模块名
```

### 场景 2：AI 查看某个模块详情

```
用户: 货量趋势怎么样
AI: dashboard_command({ command: 'data', args: { module: 'cargoTrend' } })

返回:
## 货量趋势

- 本月: 125,680 单
- 同比: +8.3%
- 环比: +2.1%

[详细表格数据]

提示: 是否聚焦显示该模块？执行 show --modules cargoTrend --layout single
```

### 场景 3：AI 查看不在当前页面的模块

```
用户: 地图上的车辆情况
AI: dashboard_command({ command: 'data', args: { module: 'mapPage' } })

返回:
错误: 地图模块在"地图"页面，当前显示"运输智能体"页面。

建议: 切换到地图页面？
执行: dashboard_command({ command: 'page', args: { page: 'mapPage' } })
```

### 场景 4：AI 聚焦显示模块

```
用户: 放大看看签收信息
AI: dashboard_command({ command: 'show', args: { modules: ['signingInformation'], layout: 'single' } })
AI: dashboard_command({ command: 'data', args: { module: 'signingInformation', scope: 'full' } })

返回:
# 签收信息（全屏）

[完整数据，包含明细表格]
```

## 实现状态

### 已完成

- [x] 模块分类集中定义（moduleRegistry.ts）
- [x] `getLayoutContext()` 方法
- [x] `isModuleInCurrentView()` 方法
- [x] `getModuleSummary()` 方法（所有模块的摘要逻辑）
- [x] `getPageOverview()` 方法（scroll 页面概览）
- [x] `getSmartData()` 布局感知主入口
- [x] DashboardView.vue IPC handler 改用 `getSmartData`
- [x] show.ts / layout.ts 统一引用 `LARGE_MODULES`
- [x] 各模块组件调用 `dataStore.updateModuleData()` 同步数据
- [x] 创建 `dashboardFormatters/` 文件夹，14 个模块的 Markdown 格式化函数
- [x] 修复 `energyPricesCard` 和 `energyPrices` 的 dataStore key 冲突

### 待完成

- [ ] 各模块格式化函数根据实际 API 返回数据调试优化
- [ ] `mapPage`、`cargoBanner` 等模块的数据同步和格式化
