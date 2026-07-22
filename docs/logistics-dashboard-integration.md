# Alice 物流看板集成方案

## 一、方案概述

### 1.1 目标

将 Alice AI 助手改造为**物流智能助手**，实现类似"贾维斯"的效果：
- AI 根据对话上下文**自主判断**何时需要展示物流数据
- 通过**原生 Vue 组件**渲染物流看板（运单、车辆、仓库等）
- 看板以**半透明悬浮窗口**形式弹出，支持用户交互
- 用户在看板上的操作可以**反馈给 AI**，形成闭环

### 1.2 技术选型

| 方案 | 选择 | 理由 |
|---|---|---|
| 视图集成方式 | **原生 Vue 组件** | 体验一致，交互流畅，可深度定制 |
| 窗口类型 | **独立 Dashboard 窗口** | 比 overlay 更灵活，可调整大小、位置 |
| 数据通信 | **IPC + Pinia Store** | 主进程管理窗口，渲染进程共享状态 |
| 触发方式 | **AI 工具调用** | AI 自主决策，无需用户手动触发 |

---

## 二、整体架构

```
┌─────────────────────────────────────────────────────────┐
│                      用户对话                            │
│  "帮我看看今天有哪些待处理的运单"                         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              LLM 返回 tool_call                          │
│  {                                                       │
│    "name": "show_logistics_dashboard",                  │
│    "arguments": { "view_type": "waybill", ... }         │
│  }                                                       │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│         functionCaller.executeFunction()                 │
│         -> window.ipcRenderer.invoke()                   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              Electron 主进程                             │
│         ipcManager 处理请求                              │
│         -> windowManager.createDashboardWindow()         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              Dashboard 窗口                              │
│         加载 #dashboard hash                             │
│         -> App.vue 渲染 DashboardView 组件               │
│         -> 根据 view_type 显示对应面板                   │
└─────────────────────────────────────────────────────────┘
```

---

## 三、详细设计

### 3.1 新增工具定义

**文件**: `docs/functions.json`

在现有工具数组中新增：

```json
{
  "type": "function",
  "function": {
    "name": "show_logistics_dashboard",
    "description": "展示物流数据看板。当需要向用户展示运单、车辆、仓库等物流信息时调用此工具。",
    "parameters": {
      "type": "object",
      "properties": {
        "view_type": {
          "type": "string",
          "enum": ["overview", "waybill", "vehicle", "warehouse", "route"],
          "description": "看板类型：总览/运单/车辆/仓库/路线"
        },
        "filters": {
          "type": "object",
          "description": "数据过滤条件",
          "properties": {
            "date_range": {
              "type": "string",
              "description": "日期范围，如 'today', 'this_week', '2024-01-01~2024-01-31'"
            },
            "status": {
              "type": "string",
              "description": "状态过滤，如 'pending', 'in_transit', 'completed'"
            },
            "keyword": {
              "type": "string",
              "description": "关键词搜索"
            }
          }
        },
        "focus_item": {
          "type": "object",
          "description": "需要高亮聚焦的数据项",
          "properties": {
            "type": {
              "type": "string",
              "enum": ["waybill", "vehicle", "warehouse"]
            },
            "id": {
              "type": "string",
              "description": "数据项 ID"
            }
          }
        }
      },
      "required": ["view_type"]
    }
  }
}
```

### 3.2 新增工具实现

**新建文件**: `src/utils/functions/dashboard.ts`

```typescript
import type { FunctionResult } from '../functionCaller'

export interface ShowDashboardArgs {
  view_type: 'overview' | 'waybill' | 'vehicle' | 'warehouse' | 'route'
  filters?: {
    date_range?: string
    status?: string
    keyword?: string
  }
  focus_item?: {
    type: 'waybill' | 'vehicle' | 'warehouse'
    id: string
  }
}

export async function show_logistics_dashboard(
  args: ShowDashboardArgs
): Promise<FunctionResult> {
  try {
    // 通过 IPC 通知主进程显示看板
    const result = await window.ipcRenderer.invoke('show-dashboard', {
      viewType: args.view_type,
      filters: args.filters,
      focusItem: args.focus_item
    })

    if (result.success) {
      return {
        success: true,
        data: {
          message: `已打开${getViewTypeName(args.view_type)}看板`,
          dashboardId: result.dashboardId
        }
      }
    } else {
      return {
        success: false,
        error: result.error || '打开看板失败'
      }
    }
  } catch (error: any) {
    return {
      success: false,
      error: `调用失败: ${error.message}`
    }
  }
}

function getViewTypeName(viewType: string): string {
  const names: Record<string, string> = {
    overview: '总览',
    waybill: '运单',
    vehicle: '车辆',
    warehouse: '仓库',
    route: '路线'
  }
  return names[viewType] || viewType
}
```

**修改文件**: `src/utils/functionCaller.ts`

在 `functionRegistry` 中注册新工具：

```typescript
import { show_logistics_dashboard } from './functions/dashboard'

const functionRegistry = {
  // ... 现有工具
  show_logistics_dashboard: show_logistics_dashboard,
}
```

### 3.3 主进程窗口管理

**修改文件**: `electron/main/windowManager.ts`

新增 Dashboard 窗口管理：

```typescript
let dashboardWindow: BrowserWindow | null = null

export async function createDashboardWindow(params: {
  viewType: string
  filters?: object
  focusItem?: object
}): Promise<BrowserWindow> {
  // 如果已存在，先关闭
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.close()
  }

  dashboardWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // 加载 dashboard 视图
  const hash = `dashboard/${params.viewType}`
  if (VITE_DEV_SERVER_URL) {
    await dashboardWindow.loadURL(`${VITE_DEV_SERVER_URL}#${hash}`)
  } else {
    await dashboardWindow.loadFile(getIndexHtmlPath(), { hash })
  }

  // 传递初始参数
  dashboardWindow.webContents.on('did-finish-load', () => {
    dashboardWindow?.webContents.send('dashboard:init', params)
  })

  // 窗口关闭时清理
  dashboardWindow.on('closed', () => {
    dashboardWindow = null
    win?.webContents.send('dashboard-closed')
  })

  return dashboardWindow
}

export function getDashboardWindow(): BrowserWindow | null {
  return dashboardWindow
}

export function closeDashboard(): boolean {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.close()
    return true
  }
  return false
}

export function updateDashboardFilters(filters: object): boolean {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.webContents.send('dashboard:update-filters', filters)
    return true
  }
  return false
}
```

**修改文件**: `electron/main/ipcManager.ts`

新增 IPC 处理器：

```typescript
import {
  createDashboardWindow,
  closeDashboard,
  updateDashboardFilters
} from './windowManager'

// 在 registerIPCHandlers() 中添加
ipcMain.handle('show-dashboard', async (event, params) => {
  try {
    const window = await createDashboardWindow(params)
    return {
      success: true,
      dashboardId: window.id
    }
  } catch (error: any) {
    console.error('[IPC] Error in show-dashboard handler:', error)
    return {
      success: false,
      error: error.message
    }
  }
})

ipcMain.handle('close-dashboard', () => {
  return closeDashboard()
})

ipcMain.handle('update-dashboard-filters', (event, filters) => {
  return updateDashboardFilters(filters)
})
```

### 3.4 路由配置

**修改文件**: `src/App.vue`

新增 dashboard 视图判断：

```vue
<script setup lang="ts">
// ... 现有代码

const showDashboard = computed(() => {
  return window.location.hash.startsWith('#dashboard/')
})

const dashboardViewType = computed(() => {
  const match = window.location.hash.match(/^#dashboard\/(\w+)/)
  return match ? match[1] : 'overview'
})
</script>

<template>
  <template v-if="showOnboarding || showSettings || showOverlay || showDashboard">
    <Overlay v-if="showOverlay" />
    <OnboardingWizard v-if="showOnboarding" />
    <SettingsWindow v-if="showSettings" />
    <DashboardView v-if="showDashboard" :view-type="dashboardViewType" />
  </template>
  <Main v-else />
</template>
```

### 3.5 Dashboard Vue 组件

**新建文件**: `src/components/DashboardView.vue`

```vue
<template>
  <div class="dashboard-container">
    <!-- 标题栏 -->
    <div class="dashboard-header">
      <h1 class="dashboard-title">{{ title }}</h1>
      <div class="dashboard-controls">
        <button @click="refresh" class="btn-refresh">
          <IconRefresh />
        </button>
        <button @click="close" class="btn-close">
          <IconClose />
        </button>
      </div>
    </div>

    <!-- 过滤栏 -->
    <div class="dashboard-filters">
      <DateRangePicker v-model="filters.dateRange" />
      <StatusSelect v-model="filters.status" :options="statusOptions" />
      <SearchInput v-model="filters.keyword" placeholder="搜索..." />
    </div>

    <!-- 主内容区 -->
    <div class="dashboard-content">
      <OverviewPanel v-if="viewType === 'overview'" :filters="filters" />
      <WaybillPanel v-else-if="viewType === 'waybill'" :filters="filters" :focus-item="focusItem" />
      <VehiclePanel v-else-if="viewType === 'vehicle'" :filters="filters" :focus-item="focusItem" />
      <WarehousePanel v-else-if="viewType === 'warehouse'" :filters="filters" :focus-item="focusItem" />
      <RoutePanel v-else-if="viewType === 'route'" :filters="filters" />
    </div>

    <!-- 详情侧边栏 -->
    <transition name="slide">
      <DetailSidebar
        v-if="selectedItem"
        :item="selectedItem"
        @close="selectedItem = null"
      />
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import OverviewPanel from './dashboard/OverviewPanel.vue'
import WaybillPanel from './dashboard/WaybillPanel.vue'
import VehiclePanel from './dashboard/VehiclePanel.vue'
import WarehousePanel from './dashboard/WarehousePanel.vue'
import RoutePanel from './dashboard/RoutePanel.vue'
import DetailSidebar from './dashboard/DetailSidebar.vue'
import DateRangePicker from './dashboard/filters/DateRangePicker.vue'
import StatusSelect from './dashboard/filters/StatusSelect.vue'
import SearchInput from './dashboard/filters/SearchInput.vue'

const props = defineProps<{
  viewType: string
}>()

const title = computed(() => {
  const titles: Record<string, string> = {
    overview: '物流总览',
    waybill: '运单管理',
    vehicle: '车辆调度',
    warehouse: '仓库管理',
    route: '路线规划'
  }
  return titles[props.viewType] || '物流看板'
})

const filters = ref({
  dateRange: 'today',
  status: '',
  keyword: ''
})

const focusItem = ref<{ type: string; id: string } | null>(null)
const selectedItem = ref<any>(null)
const statusOptions = ref<string[]>([])

// 接收主进程传递的初始参数
onMounted(() => {
  window.ipcRenderer.on('dashboard:init', (event, params) => {
    if (params.filters) {
      filters.value = { ...filters.value, ...params.filters }
    }
    if (params.focusItem) {
      focusItem.value = params.focusItem
    }
  })

  // 接收过滤条件更新
  window.ipcRenderer.on('dashboard:update-filters', (event, newFilters) => {
    filters.value = { ...filters.value, ...newFilters }
  })
})

onUnmounted(() => {
  window.ipcRenderer.removeAllListeners('dashboard:init')
  window.ipcRenderer.removeAllListeners('dashboard:update-filters')
})

// 监听过滤条件变化，通知子组件
watch(filters, (newFilters) => {
  // 子组件通过 props 自动响应
}, { deep: true })

function refresh() {
  // 触发数据刷新
  window.location.reload()
}

function close() {
  window.ipcRenderer.invoke('close-dashboard')
}
</script>

<style scoped>
.dashboard-container {
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 12px;
  border: 1px solid rgba(59, 130, 246, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #e2e8f0;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: rgba(30, 41, 59, 0.8);
  border-bottom: 1px solid rgba(59, 130, 246, 0.2);
}

.dashboard-title {
  font-size: 20px;
  font-weight: 600;
  color: #3b82f6;
  margin: 0;
}

.dashboard-controls {
  display: flex;
  gap: 8px;
}

.btn-refresh,
.btn-close {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-refresh:hover,
.btn-close:hover {
  background: rgba(59, 130, 246, 0.3);
}

.dashboard-filters {
  display: flex;
  gap: 12px;
  padding: 12px 24px;
  background: rgba(30, 41, 59, 0.5);
  border-bottom: 1px solid rgba(59, 130, 246, 0.1);
}

.dashboard-content {
  flex: 1;
  overflow: auto;
  padding: 24px;
}

/* 滚动条样式 */
.dashboard-content::-webkit-scrollbar {
  width: 8px;
}

.dashboard-content::-webkit-scrollbar-track {
  background: rgba(30, 41, 59, 0.5);
}

.dashboard-content::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.3);
  border-radius: 4px;
}

.dashboard-content::-webkit-scrollbar-thumb:hover {
  background: rgba(59, 130, 246, 0.5);
}

/* 侧边栏滑入动画 */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
```

### 3.6 子面板组件示例

**新建文件**: `src/components/dashboard/WaybillPanel.vue`

```vue
<template>
  <div class="waybill-panel">
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <StatCard
        title="待处理"
        :value="stats.pending"
        icon="clock"
        color="warning"
      />
      <StatCard
        title="运输中"
        :value="stats.inTransit"
        icon="truck"
        color="info"
      />
      <StatCard
        title="已完成"
        :value="stats.completed"
        icon="check"
        color="success"
      />
      <StatCard
        title="异常"
        :value="stats.exception"
        icon="alert"
        color="danger"
      />
    </div>

    <!-- 数据表格 -->
    <div class="data-table-container">
      <DataTable
        :columns="columns"
        :data="waybills"
        :loading="loading"
        @row-click="handleRowClick"
        :highlight-id="focusItem?.id"
      >
        <template #cell-status="{ value }">
          <StatusBadge :status="value" />
        </template>
        <template #cell-actions="{ row }">
          <button @click.stop="viewDetail(row)" class="btn-view">
            查看详情
          </button>
        </template>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import StatCard from './common/StatCard.vue'
import DataTable from './common/DataTable.vue'
import StatusBadge from './common/StatusBadge.vue'

const props = defineProps<{
  filters: {
    dateRange: string
    status: string
    keyword: string
  }
  focusItem?: { type: string; id: string } | null
}>()

const emit = defineEmits<{
  (e: 'item-selected', item: any): void
}>()

const loading = ref(false)
const waybills = ref<any[]>([])
const stats = ref({
  pending: 0,
  inTransit: 0,
  completed: 0,
  exception: 0
})

const columns = [
  { key: 'waybillNo', label: '运单号', width: 150 },
  { key: 'sender', label: '发货人', width: 120 },
  { key: 'receiver', label: '收货人', width: 120 },
  { key: 'origin', label: '始发地', width: 100 },
  { key: 'destination', label: '目的地', width: 100 },
  { key: 'status', label: '状态', width: 100, slot: 'status' },
  { key: 'actions', label: '操作', width: 100, slot: 'actions' }
]

// 加载数据
async function loadData() {
  loading.value = true
  try {
    // TODO: 调用实际的物流 API
    // const response = await logisticsAPI.getWaybills(props.filters)
    // waybills.value = response.data
    // stats.value = response.stats
    
    // 模拟数据
    await new Promise(resolve => setTimeout(resolve, 500))
    waybills.value = [
      {
        id: '1',
        waybillNo: 'WL20240115001',
        sender: '张三',
        receiver: '李四',
        origin: '上海',
        destination: '北京',
        status: 'in_transit'
      },
      // ... 更多数据
    ]
    stats.value = {
      pending: 12,
      inTransit: 45,
      completed: 128,
      exception: 3
    }
  } catch (error) {
    console.error('加载运单数据失败:', error)
  } finally {
    loading.value = false
  }
}

// 监听过滤条件变化
watch(() => props.filters, () => {
  loadData()
}, { deep: true })

onMounted(() => {
  loadData()
})

function handleRowClick(row: any) {
  emit('item-selected', row)
}

function viewDetail(row: any) {
  emit('item-selected', row)
}
</script>

<style scoped>
.waybill-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.data-table-container {
  background: rgba(30, 41, 59, 0.5);
  border-radius: 8px;
  border: 1px solid rgba(59, 130, 246, 0.2);
  overflow: hidden;
}

.btn-view {
  padding: 4px 12px;
  border-radius: 4px;
  border: none;
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.btn-view:hover {
  background: rgba(59, 130, 246, 0.3);
}
</style>
```

### 3.7 数据源接入

**新建文件**: `src/services/logisticsAPI.ts`

```typescript
import axios from 'axios'

const baseURL = import.meta.env.VITE_LOGISTICS_API_URL || 'http://localhost:3000/api'

const client = axios.create({
  baseURL,
  timeout: 10000
})

export interface WaybillFilters {
  dateRange?: string
  status?: string
  keyword?: string
}

export interface Waybill {
  id: string
  waybillNo: string
  sender: string
  receiver: string
  origin: string
  destination: string
  status: string
  createTime: string
  updateTime: string
}

export interface WaybillStats {
  pending: number
  inTransit: number
  completed: number
  exception: number
}

export const logisticsAPI = {
  async getWaybills(filters: WaybillFilters): Promise<{
    data: Waybill[]
    stats: WaybillStats
  }> {
    const response = await client.get('/waybills', { params: filters })
    return response.data
  },

  async getWaybillDetail(id: string): Promise<Waybill> {
    const response = await client.get(`/waybills/${id}`)
    return response.data
  },

  async getVehicles(filters?: any): Promise<any> {
    const response = await client.get('/vehicles', { params: filters })
    return response.data
  },

  async getWarehouses(filters?: any): Promise<any> {
    const response = await client.get('/warehouses', { params: filters })
    return response.data
  },

  async getRoutes(filters?: any): Promise<any> {
    const response = await client.get('/routes', { params: filters })
    return response.data
  }
}
```

---

## 四、AI 与看板联动

### 4.1 AI 触发看板

AI 在对话中判断需要展示数据时，调用 `show_logistics_dashboard` 工具：

```
用户: "今天有多少待处理的运单？"

AI 内部思考:
- 用户询问运单数据
- 需要展示运单看板
- 过滤条件：date_range=today, status=pending

AI 调用工具:
show_logistics_dashboard({
  view_type: "waybill",
  filters: {
    date_range: "today",
    status: "pending"
  }
})

AI 回复:
"我已经为你打开了今天的运单看板，目前有 12 个待处理的运单。你可以在看板上查看详情或进行其他操作。"
```

### 4.2 用户操作反馈给 AI（可选扩展）

如果需要在用户操作看板后反馈给 AI，可以：

1. **看板组件通过 IPC 通知主进程**
2. **主进程将操作结果写入临时状态**
3. **AI 在下一次对话时读取该状态**

```typescript
// DashboardView.vue 中
function handleItemAction(action: string, item: any) {
  window.ipcRenderer.invoke('dashboard-action', {
    action,
    item
  })
}

// ipcManager.ts 中
ipcMain.handle('dashboard-action', (event, payload) => {
  // 保存到临时状态
  lastDashboardAction = payload
  return true
})

// functionCaller.ts 中新增工具
export async function get_dashboard_action(): Promise<FunctionResult> {
  return {
    success: true,
    data: lastDashboardAction
  }
}
```

---

## 五、UI/UX 设计要点

### 5.1 视觉风格

- **深色主题**：背景 `rgba(15, 23, 42, 0.95)`，文字 `#e2e8f0`
- **科技蓝**：主色调 `#3b82f6`，用于标题、按钮、边框
- **毛玻璃效果**：`backdrop-filter: blur(20px)`
- **圆角边框**：`border-radius: 12px`
- **发光边框**：`border: 1px solid rgba(59, 130, 246, 0.3)`
- **阴影**：`box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5)`

### 5.2 交互设计

- **无边框窗口**：自定义标题栏，关闭/刷新按钮
- **可调整大小**：`resizable: true`，最小 800x600
- **始终置顶**：`alwaysOnTop: true`，方便用户边对话边查看
- **动画过渡**：侧边栏滑入、数据加载淡入
- **高亮聚焦**：AI 指定的数据项高亮显示

### 5.3 响应式布局

- **统计卡片**：`grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))`
- **数据表格**：横向滚动，固定列宽
- **移动端适配**：暂不考虑（桌面应用）

---

## 六、实施步骤

### 第一阶段：基础框架（1-2 天）

1. 新增 `show_logistics_dashboard` 工具定义和实现
2. 扩展 `windowManager.ts`，支持创建 Dashboard 窗口
3. 修改 `App.vue`，支持 `#dashboard` hash 路由
4. 创建 `DashboardView.vue` 基础框架

### 第二阶段：数据面板（2-3 天）

1. 实现通用组件：`StatCard`、`DataTable`、`StatusBadge`
2. 实现过滤组件：`DateRangePicker`、`StatusSelect`、`SearchInput`
3. 实现 `WaybillPanel`（运单面板）
4. 接入物流 API（或先用模拟数据）

### 第三阶段：其他面板（2-3 天）

1. 实现 `OverviewPanel`（总览面板）
2. 实现 `VehiclePanel`（车辆面板）
3. 实现 `WarehousePanel`（仓库面板）
4. 实现 `RoutePanel`（路线面板）

### 第四阶段：联调优化（1-2 天）

1. 测试 AI 触发看板的完整流程
2. 优化 UI 细节和动画效果
3. 处理边界情况（网络错误、数据为空等）
4. 性能优化（大数据量渲染）

### 第五阶段：高级功能（可选）

1. 用户操作反馈给 AI
2. 看板间数据联动
3. 导出功能（Excel、PDF）
4. 图表可视化（ECharts）

---

## 七、技术难点与解决方案

### 7.1 窗口通信

**问题**：主窗口和 Dashboard 窗口如何共享状态？

**方案**：
- 使用 Pinia Store + IPC 同步
- 主窗口修改 Store 后，通过 IPC 通知 Dashboard 窗口刷新
- Dashboard 窗口操作后，通过 IPC 通知主窗口更新状态

### 7.2 数据实时更新

**问题**：物流数据变化频繁，如何保持看板数据最新？

**方案**：
- 定时轮询：每 30 秒自动刷新
- WebSocket：如果后端支持，使用 WebSocket 推送
- 手动刷新：提供刷新按钮

### 7.3 大数据量渲染

**问题**：运单数量多时，表格渲染卡顿。

**方案**：
- 虚拟滚动：只渲染可视区域的行
- 分页加载：每页显示 50 条，滚动到底部加载更多
- 后端分页：通过 API 参数控制分页

### 7.4 多显示器支持

**问题**：用户有多个显示器，Dashboard 窗口应该显示在哪个？

**方案**：
- 默认显示在主窗口所在显示器
- 可拖拽到其他显示器
- 记住上次位置（通过 electron-store）

---

## 八、后续扩展

### 8.1 更多看板类型

- 财务报表看板
- 客户分析看板
- 运营监控看板

### 8.2 智能推荐

- AI 根据当前对话上下文，自动推荐最相关的看板
- AI 根据用户习惯，学习常用看板

### 8.3 语音控制

- "打开今天的运单看板"
- "切换到车辆调度页面"
- "显示异常运单"

### 8.4 跨应用集成

- 与 ERP 系统集成
- 与财务系统集成
- 与 CRM 系统集成

---

## 九、总结

本方案通过**原生 Vue 组件 + Electron 多窗口 + AI 工具调用**的方式，实现了贾维斯风格的物流智能助手。核心优势：

1. **体验一致**：原生 Vue 组件，与主界面风格统一
2. **AI 驱动**：AI 自主判断何时展示数据，无需用户手动触发
3. **灵活扩展**：模块化设计，易于添加新的看板类型
4. **交互流畅**：独立窗口，可调整大小、位置，始终置顶

下一步可以先实现最小可用 demo（工具调用 → 弹出窗口 → 显示模拟数据），验证整体流程后再逐步完善。

数据源
'TRANSPORT_DASHBOARD_URL',
'https://transport-service-dashboard-tst.t-sy-in.earth.xcloud.lenovo.com'
'TRANSPORT_AI_URL',
'https://transport-service-ai-tst.t-sy-in.earth.xcloud.lenovo.com'

请求案例：
C:\Users\huangrui19>curl "https://transport-service-dashboard-tst.t-sy-in.earth.xcloud.lenovo.com/kanban/v1/volume/queryVolume" ^
More?   --header "Accept: */*" ^
More?   --header "Connection: keep-alive" ^
More?   --header "Content-Type: application/json" ^
More?   --header "User-Agent: PostmanRuntime-ApipostRuntime/1.1.0" ^
More?   --data-raw "{\"fromWarehouse\":[],\"toProvince\":[],\"toRdc\":[],\"startDate\":\"2024-04-01 00:00:00\",\"endDate\":\"2026-07-22 23:59:59\",\"timeType\":\"FICAL_YEAR\",\"agg\":\"VOLUME\",\"customer\":[],\"bizType\":[],\"transType\":[],\"cityLevel\":[],\"dataSource\":[\"TMS\",\"LESTMS\",\"BTCP\",\"SEC\"],\"productType\":[]}"
{"code":200,"msg":"成功","data":[{"timeDimension":"FY2024","totalValue":917531.397399997185,"totalYoy":null,"totalMom":"-11.09%","items":[{"timeDimension":"FY2024","value":"548934.0736999994","dataSource":"TMS"},{"timeDimension":"FY2024","value":"62003.630499999985","dataSource":"LESTMS"},{"timeDimension":"FY2024","value":"306593.6931999978","dataSource":"SEC"}]},{"timeDimension":"FY2025","totalValue":1129287.89689999825,"totalYoy":null,"totalMom":"23.08%","items":[{"timeDimension":"FY2025","value":"348448.35869999905","dataSource":"SEC"},{"timeDimension":"FY2025","value":"242478.4575999999","dataSource":"LESTMS"},{"timeDimension":"FY2025","value":"538361.0805999993","dataSource":"TMS"}]},{"timeDimension":"FY2026","totalValue":101126046.93240000717,"totalYoy":null,"totalMom":"8854.85%","items":[{"timeDimension":"FY2026","value":"100807508.82609999","dataSource":"LESTMS"},{"timeDimension":"FY2026","value":"122684.32290000017","dataSource":"TMS"},{"timeDimension":"FY202

C:\Users\huangrui19\OneDrive - Lenovo\桌面\Program\Nodejs\alice>curl --request POST --url https://transport-service-dashboard-tst.t-sy-in.earth.xcloud.lenovo.com/kanban/v1/sign/queryNotSignItemByPage --header "Accept: */*" --header "Connection: keep-alive" --header "Content-Type: application/json" --header "User-Agent: PostmanRuntime-ApipostRuntime/1.1.0" --data "{\"modeType\": \"区配\", \"fromWarehouse\": [], \"toRdc\": [\"沈阳\"], \"pageSize\": 2}" 
{"code":200,"total":23,"data":[{"dataSource":"TMS","fromWarehouse":"天津宁河CDC","carrierName":"中外运","deliveryName":"恒路","transNo":"TJNHCKYD20260720T08807","invoiceNo":"TJNHCKFHD20260720T10188","expressNo":null,"transportationType":"公路运输","modeType":"区配","toWarehouse":"沈阳","toProvince":"辽宁","toCity":"沈阳市","toCounty":"大东区","deliveryParty":"京东电器辽宁分部沈阳超体卖场库","channel":null,"deliverTime":"2026-07-20 20:25:11","arrivalRdcTime":"2026-07-22 14:30:00","planArrivalTime":"2026-07-22 23:00:00","goodsNum":18,"volume":0.27648,"orderStatus":"正常","predictArrivalCustomerTime":"2026-07-22 23:00:00","channelName":null,"transType":"公路运输"},{"dataSource":"TMS","fromWarehouse":"天津宁河CDC","carrierName":"中外运","deliveryName":"恒路","transNo":"TJNHCKYD20260720T01104","invoiceNo":"TJNHCKFHD20260720T01637","expressNo":null,"transportationType":"公路运输","modeType":"区配","toWarehouse":"沈阳","toProvince":"辽宁","toCity":"沈阳市","toCounty":"浑南区","deliveryParty":"辽宁京邦达供应链科技有限公司","channel":null,"deliverTime":"2026-07-20 13:06:54","arrivalRdcTime":"2026-07-22 14:30:00","planArrivalTime":"2026-07-22 23:00:00","goodsNum":1,"volume":0.01536,"orderStatus":"正常","predictArrivalCustomerTime":"2026-07-22 23:00:00","channelName":null,"transType":"公路 运输"}],"msg":"success"}




## 方案设计：Alice 动态物流看板系统

### 核心思路

```
用户对话 → Alice AI 判断需要展示数据 → 调用 show_dashboard 工具
→ Electron 打开全屏看板窗口 → 动态渲染指定模块 → 直连 Transport API 获取数据
```

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Alice 主窗口（对话）                       │
│  "帮我看看今天的货量情况"                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │ LLM 返回 tool_call
                       │ show_dashboard({ modules: [...] })
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Electron 主进程                                  │
│  windowManager.createDashboardWindow()                       │
│  → 全屏、无边框、alwaysOnTop                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Dashboard 全屏窗口                               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  DashboardView.vue（全屏容器）                         │   │
│  │                                                        │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │   │
│  │  │ Module 1    │ │ Module 2    │ │ Module 3    │    │   │
│  │  │ cargoVolume │ │ cargoMap    │ │ onTime      │    │   │
│  │  │ (网格布局)   │ │ (网格布局)   │ │ (网格布局)   │    │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘    │   │
│  │                                                        │   │
│  │  ┌─────────────────────────────────────────────┐      │   │
│  │  │ Module 4: transportationLogisticsScores     │      │   │
│  │  └─────────────────────────────────────────────┘      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  数据层：transportClient → 直连 Transport API（无网关）       │
└─────────────────────────────────────────────────────────────┘
```

### 关键设计点

**1. 模块注册表** - 从 refer 移植图表组件，建立名称映射：

```typescript
// src/modules/dashboard/moduleRegistry.ts
const MODULE_REGISTRY = {
  cargoVolume: { component: CargoVolume, category: 'cargo', label: '货量总览' },
  cargoMap: { component: CargoMap, category: 'map', label: '货物地图' },
  onTime: { component: OnTime, category: 'kpi', label: '准时交付率' },
  capacityPool: { component: CapacityPool, category: 'resource', label: '运力池' },
  // ... 更多模块
}
```

**2. AI 工具定义** - 让 AI 指定要渲染哪些模块：

```json
{
  "name": "show_dashboard",
  "parameters": {
    "modules": [
      { "name": "cargoVolume", "grid": { "x": 1, "y": 1, "w": 12, "h": 6 } },
      { "name": "cargoMap", "grid": { "x": 13, "y": 1, "w": 12, "h": 6 } }
    ],
    "filters": { "dateRange": "today", "warehouse": "SH" }
  }
}
```

**3. 数据源直连** - 在 Alice 的 `.env` 中配置：

```
VITE_TRANSPORT_DASHBOARD_URL=https://transport-service-dashboard-tst.t-sy-in.earth.xcloud.lenovo.com
VITE_TRANSPORT_AI_URL=https://transport-service-ai-tst.t-sy-in.earth.xcloud.lenovo.com
```

**4. 移植策略** - refer 的图表组件依赖 Ant Design Vue + ECharts，需要：
- 在 Alice 中安装 `ant-design-vue` 和 `echarts`
- 移植 `refer/src/components/RenderComponent/chartRender/LS/` 下的组件
- 移植 `refer/src/api/fullscreen.ts` 中的 API 调用（改为直连）
- 移植 `refer/src/store/` 中的 filter store

---

你觉得这个方向对吗？有几个问题想确认：

1. **移植范围**：refer 里有 40+ 个图表组件，你想全部移植还是先选几个核心的？
2. **窗口样式**：全屏无边框（像贾维斯那样）还是保留标题栏可以关闭/拖拽？
3. **交互方式**：看板打开后用户能操作（筛选、切换），还是纯展示？