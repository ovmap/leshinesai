# Dashboard CLI 设计方案

## 一、核心理念

用 **CLI（命令行接口）** 作为 AI 与看板 UI 之间的桥梁。

LLM 天然擅长生成结构化命令，CLI 是可组合的（像 docker/kubectl），比多个分散的工具更易扩展。

```
用户: "帮我看看地图上的在途车辆"
  ↓
AI 生成命令: dashboard page --page mapPage
  ↓
命令执行器解析 → IPC 发送到看板窗口 → Pinia Store 更新 → UI 自动响应
  ↓
AI 读取数据: dashboard data mapPage
  ↓
返回 Markdown 格式数据 → AI 组织自然语言回复用户
```

---

## 二、命令体系设计

### 2.1 命令总览

| 命令 | 功能 | 返回值 |
|------|------|--------|
| `dashboard show` | 打开看板（默认 scroll 布局） | 确认信息 |
| `dashboard filter` | 设置筛选条件 | 确认信息 |
| `dashboard data` | 获取当前数据 | Markdown 格式数据 |
| `dashboard action` | 触发 UI 操作 | 操作结果 |
| `dashboard layout` | 放大展示单个模块（single 布局） | 确认信息 |
| `dashboard page` | scroll 布局下切换页面 | 确认信息 |
| `dashboard close` | 关闭看板窗口 | 确认信息 |

### 2.2 命令详细定义

#### `dashboard show` — 打开看板

```json
{
  "command": "show"
}
```

show 命令用于打开看板窗口，默认进入 scroll 布局。无参数。

> 提示: 放大展示单个模块请使用 `layout` 命令

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

#### `dashboard layout` — 切换布局（放大展示）

```json
{
  "command": "layout",
  "args": {
    "modules": ["cargoTrend"]
  }
}
```

layout 命令用于放大展示、单独显示某个模块查看数据。

- `modules`: 模块列表（必填），取第一个模块全屏显示，仅支持大模块

> 提示: 切换到 scroll 布局请使用 `show` 或 `page` 命令

#### `dashboard page` — 切换页面（scroll 布局专用）

```json
{
  "command": "page",
  "args": {
    "page": "mapPage"
  }
}
```

- `page`: 目标页面名称（必填）
  - `cargoBanner` — 运输智能体（默认）
  - `mapPage` — 地图

page 命令用于在 scroll 布局下切换页面。每个页面是一个独立的全屏视图，包含多个模块。

> 提示: 放大展示单个模块请使用 `layout` 命令

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
        "enum": ["show", "filter", "data", "action", "layout", "page", "close"],
        "description": "要执行的命令"
      },
      "args": {
        "type": "object",
        "description": "命令参数",
        "properties": {
          "modules": {
            "type": "array",
            "items": { "type": "string" },
            "description": "模块列表 (show 命令)"
          },
          "module": {
            "type": "string",
            "description": "目标模块 (filter/data/action 命令)"
          },
          "page": {
            "type": "string",
            "enum": ["cargoBanner", "mapPage"],
            "description": "目标页面 (page 命令)"
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
            "enum": ["single"],
            "description": "布局模式 (layout 命令)，用于放大展示单个模块"
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
│  用户: "帮我看看地图上的在途车辆"                               │
│                    │                                          │
│                    ▼                                          │
│  LLM → tool_call: dashboard_command                          │
│    { command: "page", args: { page: "mapPage" } }            │
│                    │                                          │
│                    ▼                                          │
│  functionCaller.ts                                           │
│    → executeDashboardCommand(parsedArgs)                     │
│                    │                                          │
│                    ▼                                          │
│  dashboard/index.ts (命令执行器)                               │
│    ├─ 解析命令 + 校验参数                                     │
│    ├─ 路由到对应 handler (commands/*.ts)                      │
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
│    ├─ currentPage: 当前页面                                   │
│    ├─ moduleFilters: 各模块筛选状态                            │
│    ├─ activeModules: 当前活跃模块                              │
│    ├─ currentLayout: 当前布局                                 │
│    └─ pendingActions: 待执行操作队列                           │
│                    │                                          │
│                    ▼                                          │
│  DashboardView.vue                                            │
│    ├─ 根据 currentPage 渲染对应页面                            │
│    ├─ ModulesRender.vue → 网格布局渲染                        │
│    └─ QuickBar.vue → 页面切换导航                             │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 数据流（双向）

**核心设计：dashboardDataStore 是 UI 的实时镜像**

`dashboardDataStore` 不只是缓存数据，而是**实时镜像当前 UI 的完整状态**——包括显示什么页面、筛选条件是什么、数据内容是什么。AI 随时能"看到"用户当前看到的界面。

```
AI 操作链：
  切换页面 → Store 同步更新 → AI 调 data 确认切换结果 ✓
  设置筛选 → Store 同步更新 → AI 调 data 确认筛选生效 ✓
  触发操作 → Store 同步更新 → AI 调 data 确认操作结果 ✓
```

**AI → UI（控制流）：**
```
AI tool_call → functionCaller → dashboard/index.ts → IPC:dashboard:control
→ 主进程转发 → dashboardControlStore 更新 → UI watch 响应
→ UI 执行操作 → 操作完成后更新 dashboardDataStore（实时镜像）
```

**UI → AI（数据流）：**
```
UI 组件获取数据 / 状态变化 → 实时同步到 dashboardDataStore
→ AI 调用 data 命令 → IPC:dashboard:data
→ 主进程转发 → 读取 dataStore（当前 UI 完整快照）→ 返回 Markdown
```

**dashboardDataStore 存储内容（UI 完整状态）：**
```typescript
{
  // 当前显示的页面
  currentPage: 'cargoBanner',
  
  // 当前布局
  currentLayout: 'scroll',
  
  // 各模块的筛选条件（与 UI 筛选器同步）
  filters: {
    cargoTrend: { timeType: 'FICAL_YEAR', dataSource: [...], metric: 'VOLUME' },
    signingInformation: { fromWarehouse: '天津宁河CDC', toRdc: '沈阳', modeType: '区配' }
  },
  
  // 各模块的数据（与 UI 图表/表格同步）
  moduleData: {
    cargoTrend: { chartData: [...], summary: {...} },
    signingInformation: { signed: 1234, unsigned: 567, detailList: [...] },
    mapPage: { heatMap: [...], trucks: [...], warehouses: [...] }
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

#### 4.3.3 数据对应关系

| UI 组件 | AI 读取格式 | 数据源 |
|---------|------------|--------|
| ECharts 堆叠柱状图 | Markdown 表格 | `raw.timeSeries` |
| ECharts 环形图 | 数字摘要 | `raw.signed / unsigned` |
| ECharts 中国地图 | 地区分布表 | `raw.heatMap` |
| Ant Table 表格 | Markdown 表格 | `raw.detailList` |

**一句话总结：Store 存原始 JSON，每个模块自己负责把它翻译成 AI 能理解的 Markdown。**

### 4.4 关键文件

| 文件 | 职责 |
|------|------|
| `src/utils/dashboard/index.ts` | 命令注册表 + 执行入口（主窗口侧） |
| `src/utils/dashboard/commands/*.ts` | 各命令处理函数 |
| `src/utils/dashboard/types.ts` | 命令类型定义 |
| `src/stores/dashboardControlStore.ts` | 看板窗口内的控制状态（看板窗口侧） |
| `src/stores/dashboardDataStore.ts` | 看板窗口内的数据缓存（看板窗口侧） |
| `src/utils/functionCaller.ts` | 注册 `dashboard_command` 工具 |
| `docs/functions.json` | 工具定义 |
| `electron/main/ipcManager.ts` | `dashboard:control` 和 `dashboard:data` IPC |
| `electron/main/windowManager.ts` | 转发控制指令到看板窗口 |

---

## 五、页面系统

### 5.1 页面注册表

看板支持多页面，每个页面是一个独立的全屏视图，内部使用网格布局排列子组件。

```typescript
// src/components/dashboard/moduleRegistry.ts

interface PageMeta {
  name: string                      // 页面标识符
  title: string                     // 页面标题
  icon: string                      // QuickBar 图标
  gridConfig: GridConfig            // 网格配置 (48x27)
  components: ComponentPosition[]   // 子组件布局
}

const pageRegistry: PageMeta[] = [
  {
    name: 'cargoBanner',
    title: '运输智能体',
    gridConfig: { gridCols: 48, gridRows: 27, gridGap: 12 },
    components: [
      // 16 个子组件的网格位置配置
      { name: 'cargoVolume', x: 1, y: 1, width: 4, height: 3 },
      { name: 'cargoBanner', x: 13, y: 1, width: 24, height: 18 },
      // ...
    ]
  },
  {
    name: 'mapPage',
    title: '地图',
    gridConfig: { gridCols: 48, gridRows: 27, gridGap: 12 },
    components: [
      { name: 'mapPage', x: 1, y: 1, width: 48, height: 27 },
    ]
  },
]
```

### 5.2 页面切换流程

```
QuickBar 点击 / CLI page 命令
  → dashboardControlStore.setCurrentPage(pageName)
  → DashboardView.vue watch currentPage
  → 重新渲染 ModulesRender (传入对应页面的 gridConfig + components)
  → QuickBar 高亮当前页面
```

### 5.3 网格坐标系

- 总网格：48 列 × 27 行
- 坐标从 1 开始（不是 0）
- `x` = 列位置，`y` = 行位置
- 小卡片标准尺寸：`width: 4, height: 3`

---

## 六、扩展性

### 新增页面

1. 在 `moduleRegistry.ts` 的 `pageRegistry` 中添加 `PageMeta`
2. 在 `QuickBar.vue` 中添加对应图标
3. 在 `dashboardControlStore.ts` 的 `currentPage` 默认值中考虑

### 新增模块

1. 在 `modules/` 目录下创建组件
2. 在 `moduleRegistry.ts` 的 `moduleRegistry` 中注册
3. 在对应页面的 `components` 数组中配置网格位置
4. 在 `dashboardDataStore` 添加格式化函数

### 新增命令

1. 在 `src/utils/dashboard/commands/` 创建新文件
2. 导出 `CommandHandler` 类型的处理函数
3. 在 `src/utils/dashboard/index.ts` 的 `commandRegistry` 中注册

### 未来可能的命令
- `dashboard export` — 导出数据
- `dashboard compare` — 对比两个时间段
- `dashboard alert` — 设置告警阈值
- `dashboard snapshot` — 截图当前看板
