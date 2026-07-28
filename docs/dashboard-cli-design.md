# Dashboard CLI 设计方案

## 一、核心理念

用 **CLI（命令行接口）** 作为 AI 与看板 UI 之间的桥梁。

LLM 天然擅长生成结构化命令，CLI 是可组合的（像 docker/kubectl），比多个分散的工具更易扩展。

```
用户: "帮我筛选北京始发的未签收数据"
  ↓
AI 生成命令: dashboard filter --fromWarehouse 北京
  ↓
命令执行器解析 → IPC 发送到看板窗口 → Pinia Store 更新 → UI 自动响应
  ↓
AI 读取数据: dashboard data signingInformation
  ↓
返回 Markdown 格式数据 → AI 组织自然语言回复用户
```

---

## 二、命令体系设计

### 2.1 命令总览

| 命令 | 功能 | 返回值 |
|------|------|--------|
| `dashboard show` | 显示/切换模块 | 确认信息 |
| `dashboard filter` | 设置筛选条件 | 确认信息 |
| `dashboard data` | 获取当前数据 | Markdown 格式数据 |
| `dashboard action` | 触发 UI 操作 | 操作结果 |
| `dashboard reset` | 重置所有筛选 | 确认信息 |
| `dashboard layout` | 切换布局模式 | 确认信息 |
| `dashboard close` | 关闭看板窗口 | 确认信息 |

### 2.2 命令详细定义

#### `dashboard show` — 显示模块

```json
{
  "command": "show",
  "args": {
    "modules": ["cargoTrend", "signingInformation"],
    "layout": "grid"
  }
}
```

- `modules`: 要显示的模块列表（可选，不传则保持当前）
- `layout`: 布局模式（可选）
  - `single` — 一次只显示一个模块，全屏聚焦
  - `grid` — 网格布局，多模块并排（默认）
  - `cards` — 卡片布局，可滚动

已注册模块：
- `cargoTrend` — 货量趋势（堆叠柱状图 + 同比/环比折线）
- `signingInformation` — 签收信息（环形图 + 未签收明细弹窗）

#### `dashboard filter` — 设置筛选

```json
{
  "command": "filter",
  "args": {
    "module": "signingInformation",
    "filters": {
      "fromWarehouse": "天津宁河CDC",
      "toProvince": "辽宁",
      "toRdc": "沈阳",
      "modeType": "区配"
    }
  }
}
```

- `module`: 目标模块（可选，不传则全局筛选）
- `filters`: 筛选条件键值对
  - 通用筛选：`fromWarehouse`, `toProvince`, `toRdc`
  - 模块专属：`modeType`（签收信息）、`timeType`/`dateRange`/`dataSource`/`metric`（货量趋势）

#### `dashboard data` — 获取数据

```json
{
  "command": "data",
  "args": {
    "module": "signingInformation",
    "format": "markdown",
    "scope": "summary"
  }
}
```

- `module`: 目标模块（可选，不传则返回所有模块数据）
- `format`: 输出格式
  - `markdown` — Markdown 表格（默认，适合 AI 阅读）
  - `json` — 原始 JSON
  - `csv` — CSV 格式
- `scope`: 数据范围
  - `summary` — 摘要数据（如签收统计数字）
  - `detail` — 详细数据（如未签收明细列表）
  - `full` — 完整数据

返回示例（Markdown）：
```
## 签收信息摘要
- 今日已签收: 1,234 单
- 今日待签收: 567 单
- 签收率: 68.6%

## 未签收明细 (前 10 条)
| 始发仓 | 运输单号 | 目的省 | 目的市 | 配送模式 | 件数 |
|--------|----------|--------|--------|----------|------|
| 天津宁河CDC | TJNHCKYD... | 辽宁 | 沈阳市 | 区配 | 18 |
| ... |
```

#### `dashboard action` — 触发操作

```json
{
  "command": "action",
  "args": {
    "module": "signingInformation",
    "action": "openDetail",
    "params": {}
  }
}
```

支持的操作：
- `signingInformation.openDetail` — 打开未签收明细弹窗
- `signingInformation.export` — 导出未签收数据
- `signingInformation.resetFilters` — 重置筛选
- `cargoTrend.changeTimeType` — 切换时间维度
- `cargoTrend.changeMetric` — 切换指标
- `cargoTrend.refresh` — 刷新数据

#### `dashboard reset` — 重置

```json
{
  "command": "reset",
  "args": {
    "module": "signingInformation"
  }
}
```

- `module`: 可选，不传则重置所有模块

#### `dashboard layout` — 切换布局

```json
{
  "command": "layout",
  "args": {
    "type": "single",
    "focus": "cargoTrend"
  }
}
```

#### `dashboard close` — 关闭看板

```json
{
  "command": "close"
}
```

---

## 三、工具定义

在 `functions.json` 中注册为**一个统一工具**：

```json
{
  "type": "function",
  "name": "dashboard_command",
  "description": "控制物流数据看板的 CLI 命令工具。通过不同命令控制看板显示、筛选数据、获取数据等。",
  "strict": false,
  "parameters": {
    "type": "object",
    "properties": {
      "command": {
        "type": "string",
        "enum": ["show", "filter", "data", "action", "reset", "layout", "close"],
        "description": "要执行的命令"
      },
      "args": {
        "type": "object",
        "description": "命令参数",
        "properties": {
          "modules": {
            "type": "array",
            "items": { "type": "string", "enum": ["cargoTrend", "signingInformation"] },
            "description": "模块列表 (show 命令)"
          },
          "module": {
            "type": "string",
            "description": "目标模块 (filter/data/action 命令)"
          },
          "filters": {
            "type": "object",
            "description": "筛选条件 (filter 命令)",
            "properties": {
              "fromWarehouse": { "type": "string", "description": "始发仓" },
              "toProvince": { "type": "string", "description": "目的省" },
              "toRdc": { "type": "string", "description": "目的RDC" },
              "modeType": { "type": "string", "description": "配送模式" },
              "timeType": { "type": "string", "description": "时间维度" },
              "dateRange": { "type": "string", "description": "日期范围" },
              "dataSource": { "type": "array", "items": { "type": "string" }, "description": "数据源" },
              "metric": { "type": "string", "description": "指标类型" }
            }
          },
          "format": {
            "type": "string",
            "enum": ["markdown", "json", "csv"],
            "description": "数据格式 (data 命令)"
          },
          "scope": {
            "type": "string",
            "enum": ["summary", "detail", "full"],
            "description": "数据范围 (data 命令)"
          },
          "action": {
            "type": "string",
            "description": "操作名称 (action 命令)"
          },
          "layout": {
            "type": "string",
            "enum": ["single", "grid", "cards"],
            "description": "布局模式 (show/layout 命令)"
          }
        }
      }
    },
    "required": ["command"]
  }
}
```

同时保留现有的 `show_dashboard` 工具作为快捷方式（向后兼容），内部转换为 `dashboard show` 命令。

---

## 四、架构设计

### 4.1 整体架构

```
┌──────────────────────────────────────────────────────────────┐
│                    Leshine 主窗口（对话）                         │
│                                                               │
│  用户: "帮我筛选北京始发的未签收数据"                           │
│                    │                                          │
│                    ▼                                          │
│  LLM → tool_call: dashboard_command                          │
│    { command: "filter", args: { fromWarehouse: "北京" } }    │
│                    │                                          │
│                    ▼                                          │
│  functionCaller.ts                                           │
│    → executeDashboardCommand(parsedArgs)                     │
│                    │                                          │
│                    ▼                                          │
│  dashboardCLI.ts (命令执行器)                                  │
│    ├─ 解析命令 + 校验参数                                     │
│    ├─ 路由到对应 handler                                     │
│    └─ 返回结果给 AI                                          │
│                    │                                          │
└────────────────────┼──────────────────────────────────────────┘
                     │ IPC: dashboard:control
                     ▼
┌──────────────────────────────────────────────────────────────┐
│              Electron 主进程                                   │
│  ipcManager → 转发到 dashboardWindow.webContents              │
│                    │                                          │
└────────────────────┼──────────────────────────────────────────┘
                     │ IPC: dashboard:command
                     ▼
┌──────────────────────────────────────────────────────────────┐
│              Dashboard 窗口                                    │
│                                                               │
│  dashboardControlStore (Pinia)                                │
│    ├─ currentFilters: 当前筛选状态                             │
│    ├─ activeModules: 当前活跃模块                              │
│    ├─ currentLayout: 当前布局                                 │
│    ├─ pendingActions: 待执行操作队列                           │
│    └─ dataCache: 数据缓存（供 data 命令读取）                  │
│                    │                                          │
│                    ▼                                          │
│  UI 组件 (watch store → 自动响应)                              │
│    ├─ CargoTrend.vue → watch filters → 重新请求数据           │
│    └─ SigningInformation.vue → watch filters → 重新请求数据   │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 数据流（双向）

**核心设计：dashboardDataStore 是 UI 的实时镜像**

`dashboardDataStore` 不只是缓存数据，而是**实时镜像当前 UI 的完整状态**——包括显示什么模块、筛选条件是什么、数据内容是什么。AI 随时能"看到"用户当前看到的界面。

```
AI 操作链：
  切换模块 → Store 同步更新 → AI 调 data 确认切换结果 ✓
  设置筛选 → Store 同步更新 → AI 调 data 确认筛选生效 ✓
  触发操作 → Store 同步更新 → AI 调 data 确认操作结果 ✓
```

**AI → UI（控制流）：**
```
AI tool_call → functionCaller → dashboardCLI → IPC:dashboard:control
→ 主进程转发 → dashboardControlStore 更新 → UI watch 响应
→ UI 执行操作 → 操作完成后更新 dashboardDataStore（实时镜像）
```

**UI → AI（数据流）：**
```
UI 组件获取数据 / 状态变化 → 实时同步到 dashboardDataStore
→ AI 调用 data 命令 → IPC:dashboard:get-data
→ 主进程转发 → 读取 dataStore（当前 UI 完整快照）→ 返回 Markdown
```

**dashboardDataStore 存储内容（UI 完整状态）：**
```typescript
{
  // 当前显示的模块
  activeModules: ['cargoTrend', 'signingInformation'],
  
  // 当前布局
  currentLayout: 'grid',
  
  // 各模块的筛选条件（与 UI 筛选器同步）
  filters: {
    cargoTrend: { timeType: 'FICAL_YEAR', dataSource: [...], metric: 'VOLUME' },
    signingInformation: { fromWarehouse: '天津宁河CDC', toRdc: '沈阳', modeType: '区配' }
  },
  
  // 各模块的数据（与 UI 图表/表格同步）
  moduleData: {
    cargoTrend: { chartData: [...], summary: {...} },
    signingInformation: { signed: 1234, unsigned: 567, detailList: [...] }
  },
  
  // UI 状态（弹窗、选中等）
  uiState: {
    signingInformation: { modalOpen: false, currentPage: 1 }
  },
  
  // 时间戳
  lastUpdated: 1234567890
}
```

这样 AI 调用 `data` 命令时，拿到的就是**用户当前看到的完全一致的状态**，形成真正的视觉闭环。

### 4.3 数据格式设计

**核心原则：同一数据，一体两面**

- **UI 看**：ECharts 图表、Ant Table 表格、地图等视觉组件
- **AI 看**：Markdown 表格、数字摘要等结构化文本
- **数据源**：dashboardDataStore 存储原始 JSON，UI 和 AI 共用

#### 4.3.1 Store 内部结构

每个模块定义自己的数据契约：

```typescript
interface ModuleDataSchema {
  // 原始数据（UI 和 AI 共用）
  raw: any
  
  // 摘要格式化（给 AI 快速看）
  summary: () => string   // 返回 Markdown
  
  // 明细格式化（给 AI 深度看）
  detail: () => string    // 返回 Markdown
}
```

#### 4.3.2 示例：签收信息模块

```typescript
{
  raw: {
    signed: 1234,
    unsigned: 567,
    detailList: [
      { fromWarehouse: '天津宁河CDC', transNo: 'TJNHCKYD...', toProvince: '辽宁', ... }
    ],
    filters: { fromWarehouse: '', toRdc: '沈阳' }
  },
  
  summary: () => `## 签收信息
- 已签收: 1,234 单
- 待签收: 567 单
- 签收率: 68.6%`,
  
  detail: () => `## 未签收明细 (共 23 条)
| 始发仓 | 运输单号 | 承运商 | 目的省 | 目的市 | 配送模式 | 件数 | 体积 | 发货时间 |
|--------|----------|--------|--------|--------|----------|------|------|----------|
| 天津宁河CDC | TJNHCKYD20260720T08807 | 中外运 | 辽宁 | 沈阳市 | 区配 | 18 | 0.276 | 07-20 20:25 |
| 天津宁河CDC | TJNHCKYD20260720T01104 | 中外运 | 辽宁 | 沈阳市 | 区配 | 1 | 0.015 | 07-20 13:06 |`
}
```

#### 4.3.3 示例：货量趋势模块

```typescript
{
  raw: {
    timeSeries: [
      { 
        timeDimension: '2024', 
        items: [
          { dataSource: 'TMS', value: '548934' },
          { dataSource: 'LESTMS', value: '62004' }
        ],
        totalYoy: null,
        totalMom: '-11.09%'
      }
    ],
    filters: { timeType: 'CALENDAR_YEAR', metric: 'VOLUME', dataSource: ['TMS', 'LESTMS'] }
  },
  
  summary: () => `## 货量趋势
- 时间维度: 自然年
- 指标: 订单数量
- 数据源: TMS, LESTMS
- 时间范围: 2024-01-01 ~ 2026-07-22

| 时间段 | TMS | LESTMS | 合计 | 环比 |
|--------|-----|--------|------|------|
| 2024 | 548,934 | 62,004 | 917,531 | -11.09% |
| 2025 | 538,361 | 242,478 | 1,129,288 | +23.08% |
| 2026 | 122,684 | 100,807,509 | 101,126,047 | +8854.85% |`,
  
  detail: () => `更详细的时间序列数据，包含每个数据源的完整信息...`
}
```

#### 4.3.4 数据对应关系

| UI 组件 | AI 读取格式 | 数据源 |
|---------|------------|--------|
| ECharts 堆叠柱状图 | Markdown 表格 | `raw.timeSeries` |
| ECharts 环形图 | 数字摘要 | `raw.signed / unsigned` |
| Ant Table 表格 | Markdown 表格 | `raw.detailList` |
| 地图（未来） | 地区分布表 | `raw.regionData` |

**一句话总结：Store 存原始 JSON，每个模块自己负责把它翻译成 AI 能理解的 Markdown。**

### 4.4 关键文件

| 文件 | 职责 |
|------|------|
| `src/utils/dashboardCLI.ts` | 命令解析器 + 执行器（主窗口侧） |
| `src/stores/dashboardControlStore.ts` | 看板窗口内的控制状态（看板窗口侧） |
| `src/stores/dashboardDataStore.ts` | 看板窗口内的数据缓存（看板窗口侧） |
| `src/utils/functionCaller.ts` | 注册 `dashboard_command` 工具 |
| `docs/functions.json` | 工具定义 |
| `electron/main/ipcManager.ts` | 新增 `dashboard:control` 和 `dashboard:get-data` IPC |
| `electron/main/windowManager.ts` | 转发控制指令到看板窗口 |

---

## 五、实现细节

### 5.1 命令执行器 (`src/utils/dashboardCLI.ts`)

```typescript
// 命令路由
export async function executeDashboardCommand(args: {
  command: string
  args?: Record<string, any>
}): Promise<string> {
  const { command, args: cmdArgs } = args

  switch (command) {
    case 'show':
      return handleShow(cmdArgs)
    case 'filter':
      return handleFilter(cmdArgs)
    case 'data':
      return await handleData(cmdArgs)
    case 'action':
      return await handleAction(cmdArgs)
    case 'reset':
      return handleReset(cmdArgs)
    case 'layout':
      return handleLayout(cmdArgs)
    case 'close':
      return handleClose()
    default:
      return `未知命令: ${command}。可用命令: show, filter, data, action, reset, layout, close`
  }
}

// show 命令处理
async function handleShow(args?: Record<string, any>): Promise<string> {
  const modules = args?.modules || []
  const layout = args?.layout || 'grid'

  // 如果看板窗口不存在，先创建
  await window.ipcRenderer.invoke('dashboard:open', { modules, layout })

  // 如果已存在，发送更新
  await window.ipcRenderer.invoke('dashboard:control', {
    command: 'show',
    args: { modules, layout }
  })

  return `看板已更新: 显示模块 [${modules.join(', ')}], 布局: ${layout}`
}

// filter 命令处理
async function handleFilter(args?: Record<string, any>): Promise<string> {
  if (!args?.filters && !args?.module) {
    return '错误: filter 命令需要 filters 参数'
  }

  await window.ipcRenderer.invoke('dashboard:control', {
    command: 'filter',
    args
  })

  const filterDesc = Object.entries(args.filters || {})
    .map(([k, v]) => `${k}=${v}`)
    .join(', ')

  return `筛选条件已应用: ${filterDesc}`
}

// data 命令处理（需要读取看板窗口的数据）
async function handleData(args?: Record<string, any>): Promise<string> {
  const module = args?.module
  const format = args?.format || 'markdown'
  const scope = args?.scope || 'summary'

  const result = await window.ipcRenderer.invoke('dashboard:get-data', {
    module, format, scope
  })

  return result.data || '暂无数据'
}
```

### 5.2 看板控制 Store (`src/stores/dashboardControlStore.ts`)

```typescript
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useDashboardControlStore = defineStore('dashboardControl', () => {
  // 当前筛选状态
  const currentFilters = ref<Record<string, any>>({})

  // 当前活跃模块
  const activeModules = ref<string[]>(['cargoTrend', 'signingInformation'])

  // 当前布局
  const currentLayout = ref<'single' | 'grid' | 'cards'>('grid')

  // 待执行操作队列
  const pendingActions = ref<Array<{ module: string; action: string; params: any }>>([])

  // 应用筛选（由 IPC 触发）
  function applyFilters(module: string | undefined, filters: Record<string, any>) {
    if (module) {
      // 模块专属筛选
      currentFilters.value[module] = { ...currentFilters.value[module], ...filters }
    } else {
      // 全局筛选，应用到所有模块
      Object.keys(currentFilters.value).forEach(mod => {
        currentFilters.value[mod] = { ...currentFilters.value[mod], ...filters }
      })
    }
  }

  // 切换模块
  function setModules(modules: string[]) {
    activeModules.value = modules
  }

  // 切换布局
  function setLayout(layout: 'single' | 'grid' | 'cards') {
    currentLayout.value = layout
  }

  // 添加操作
  function addAction(module: string, action: string, params: any) {
    pendingActions.value.push({ module, action, params })
  }

  // 重置
  function reset(module?: string) {
    if (module) {
      currentFilters.value[module] = {}
    } else {
      currentFilters.value = {}
    }
  }

  return {
    currentFilters,
    activeModules,
    currentLayout,
    pendingActions,
    applyFilters,
    setModules,
    setLayout,
    addAction,
    reset,
  }
})
```

### 5.3 数据 Store (`src/stores/dashboardDataStore.ts`)

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useDashboardDataStore = defineStore('dashboardData', () => {
  // 各模块的数据缓存
  const moduleData = ref<Record<string, any>>({})

  // 更新模块数据（由 UI 组件调用）
  function updateModuleData(module: string, data: any) {
    moduleData.value[module] = {
      data,
      timestamp: Date.now(),
    }
  }

  // 获取格式化数据（供 data 命令使用）
  function getFormattedData(module?: string, format = 'markdown', scope = 'summary'): string {
    const modules = module ? [module] : Object.keys(moduleData.value)

    if (format === 'markdown') {
      return modules.map(mod => formatAsMarkdown(mod, moduleData.value[mod], scope)).join('\n\n')
    } else if (format === 'json') {
      const data = module ? moduleData.value[module] : moduleData.value
      return JSON.stringify(data, null, 2)
    }
    return ''
  }

  // Markdown 格式化
  function formatAsMarkdown(module: string, cached: any, scope: string): string {
    if (!cached?.data) return `## ${module}\n暂无数据`

    const data = cached.data
    switch (module) {
      case 'signingInformation':
        return formatSigningData(data, scope)
      case 'cargoTrend':
        return formatCargoTrendData(data, scope)
      default:
        return `## ${module}\n${JSON.stringify(data, null, 2)}`
    }
  }

  return { moduleData, updateModuleData, getFormattedData }
})
```

### 5.4 UI 组件改造

以 `SigningInformation.vue` 为例，需要：

```typescript
// 引入控制 Store 和数据 Store
import { useDashboardControlStore } from '../../../stores/dashboardControlStore'
import { useDashboardDataStore } from '../../../stores/dashboardDataStore'

const controlStore = useDashboardControlStore()
const dataStore = useDashboardDataStore()

// 监听控制 Store 的筛选变化
watch(() => controlStore.currentFilters['signingInformation'], (newFilters) => {
  if (newFilters) {
    // 应用筛选到本地状态
    if (newFilters.fromWarehouse) modalSelectedWarehouse.value = newFilters.fromWarehouse
    if (newFilters.toProvince) modalSelectedProvince.value = newFilters.toProvince
    if (newFilters.toRdc) modalSelectedRdc.value = newFilters.toRdc
    if (newFilters.modeType) modalSelectedModeType.value = newFilters.modeType
    // 重新获取数据
    fetchModalData()
  }
}, { deep: true })

// 获取数据后同步到数据 Store
const fetchSigningData = async () => {
  // ... 原有逻辑 ...
  // 同步到数据 Store
  dataStore.updateModuleData('signingInformation', {
    signed: signingData.value[0].value,
    unsigned: signingData.value[1].value,
  })
}
```

### 5.5 IPC 通信

**主进程新增处理 (`ipcManager.ts`)：**

```typescript
// 控制指令转发到看板窗口
ipcMain.handle('dashboard:control', async (event, command) => {
  const dashboardWin = getDashboardWindow()
  if (dashboardWin && !dashboardWin.isDestroyed()) {
    dashboardWin.webContents.send('dashboard:command', command)
    return { success: true }
  }
  return { success: false, error: '看板窗口未打开' }
})

// 从看板窗口获取数据
ipcMain.handle('dashboard:get-data', async (event, params) => {
  const dashboardWin = getDashboardWindow()
  if (!dashboardWin || dashboardWin.isDestroyed()) {
    return { success: false, error: '看板窗口未打开' }
  }

  // 通过 IPC 请求看板窗口的数据
  return new Promise((resolve) => {
    const requestId = Date.now().toString()
    // 监听看板窗口的数据响应
    ipcMain.once(`dashboard:data-response-${requestId}`, (_, data) => {
      resolve({ success: true, data })
    })
    // 向看板窗口请求数据
    dashboardWin.webContents.send('dashboard:request-data', { ...params, requestId })
  })
})
```

**看板窗口接收命令 (`DashboardView.vue`)：**

```typescript
onMounted(() => {
  // 接收控制命令
  window.ipcRenderer.on('dashboard:command', (_, command) => {
    const controlStore = useDashboardControlStore()

    switch (command.command) {
      case 'show':
        controlStore.setModules(command.args.modules)
        controlStore.setLayout(command.args.layout)
        break
      case 'filter':
        controlStore.applyFilters(command.args.module, command.args.filters)
        break
      case 'action':
        controlStore.addAction(command.args.module, command.args.action, command.args.params)
        break
      case 'reset':
        controlStore.reset(command.args?.module)
        break
    }
  })

  // 响应数据请求
  window.ipcRenderer.on('dashboard:request-data', (_, params) => {
    const dataStore = useDashboardDataStore()
    const formatted = dataStore.getFormattedData(params.module, params.format, params.scope)
    window.ipcRenderer.invoke(`dashboard:data-response`, {
      requestId: params.requestId,
      data: formatted
    })
  })
})
```

---

## 六、交互示例

### 场景 1: 查看并筛选签收数据

```
用户: "帮我看看未签收的情况"

AI:
  → dashboard_command({ command: "show", args: { modules: ["signingInformation"] } })
  → dashboard_command({ command: "data", args: { module: "signingInformation", scope: "summary" } })
  ← "已签收: 1,234 单, 待签收: 567 单"

AI 回复: "当前有 567 单待签收，已在看板展示签收信息。需要我筛选特定仓库或地区吗？"

用户: "看看天津发往沈阳的"

AI:
  → dashboard_command({ command: "filter", args: { module: "signingInformation", filters: { fromWarehouse: "天津宁河CDC", toRdc: "沈阳" } } })
  → dashboard_command({ command: "data", args: { module: "signingInformation", scope: "detail" } })
  ← 返回筛选后的 Markdown 表格

AI 回复: "天津发往沈阳的未签收有 23 单，主要分布在...（展示明细表格）"
```

### 场景 2: 切换模块查看

```
用户: "今年货量怎么样"

AI:
  → dashboard_command({ command: "show", args: { modules: ["cargoTrend"] } })
  → dashboard_command({ command: "filter", args: { module: "cargoTrend", filters: { timeType: "FICAL_YEAR" } } })
  → dashboard_command({ command: "data", args: { module: "cargoTrend", scope: "summary" } })
  ← 返回货量摘要

AI 回复: "今年货量趋势已展示在看板上。FY2026 总货量约 XX 万单，同比增长 XX%。"
```

### 场景 3: 组合操作

```
用户: "帮我导出沈阳RDC的区配未签收数据"

AI:
  → dashboard_command({ command: "show", args: { modules: ["signingInformation"] } })
  → dashboard_command({ command: "filter", args: { filters: { toRdc: "沈阳", modeType: "区配" } } })
  → dashboard_command({ command: "action", args: { module: "signingInformation", action: "export" } })
  ← "导出成功"

AI 回复: "已将沈阳RDC区配模式的未签收数据导出，文件已下载。共 23 条记录。"
```

---

## 七、实施步骤

### Phase 1: 基础框架
1. 创建 `dashboardControlStore.ts` 和 `dashboardDataStore.ts`
2. 新增 `dashboard:control` 和 `dashboard:get-data` IPC 通道
3. 创建 `dashboardCLI.ts` 命令执行器
4. 在 `functions.json` 中注册 `dashboard_command` 工具
5. 在 `functionCaller.ts` 中注册工具

### Phase 2: UI 组件改造
1. 修改 `CargoTrend.vue` — 接入控制 Store + 数据 Store
2. 修改 `SigningInformation.vue` — 接入控制 Store + 数据 Store
3. 修改 `DashboardView.vue` — 监听 IPC 命令并分发
4. 修改 `ModulesRender.vue` — 支持动态布局切换

### Phase 3: 数据格式化
1. 实现 `formatSigningData()` — 签收数据 Markdown 格式化
2. 实现 `formatCargoTrendData()` — 货量趋势 Markdown 格式化
3. 实现 `dashboard:get-data` 的完整数据回传链路

### Phase 4: 测试与优化
1. 端到端测试：AI 命令 → UI 响应 → 数据回传
2. 错误处理：看板窗口未打开时的降级策略
3. 命令组合：多个命令连续执行的正确性

---

## 八、扩展性

### 新增模块
只需：
1. 在 `ModulesRender.vue` 注册组件
2. 在 `dashboardDataStore` 添加格式化函数
3. 在 `functions.json` 的 enum 中添加模块名

### 新增命令
只需：
1. 在 `dashboardCLI.ts` 添加 handler
2. 在 `dashboardControlStore` 添加对应状态
3. 在 `functions.json` 的 command enum 中添加

### 未来可能的命令
- `dashboard export` — 导出数据
- `dashboard compare` — 对比两个时间段
- `dashboard alert` — 设置告警阈值
- `dashboard snapshot` — 截图当前看板
