<template>
  <div class="dashboard-container">
    <!-- 头部 -->
    <div class="dashboard-header">
      <h1 class="dashboard-title">物流看板</h1>
      <div class="dashboard-actions">
        <button @click="refresh" class="action-btn">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
        <button @click="close" class="action-btn">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          关闭
        </button>
      </div>
    </div>

    <!-- 模块渲染区 -->
    <div class="dashboard-content">
      <ModulesRender
        :modules="displayModules"
        :filters="controlStore.moduleFilters"
        :layout="controlStore.currentLayout"
        :key="refreshKey"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import ModulesRender from './dashboard/ModulesRender.vue'
import type { ModuleConfig } from './dashboard/ModulesRender.vue'
import { useDashboardControlStore } from '../stores/dashboardControlStore'
import { useDashboardDataStore } from '../stores/dashboardDataStore'

const controlStore = useDashboardControlStore()
const dataStore = useDashboardDataStore()

// 默认模块配置
const defaultModules: ModuleConfig[] = [
  { name: 'cargoTrend', span: 12, title: '货量趋势' },
  { name: 'signingInformation', span: 12, title: '签收信息' },
]

// 模块名称到中文标题的映射
const moduleTitleMap: Record<string, string> = {
  cargoTrend: '货量趋势',
  signingInformation: '签收信息',
}

const refreshKey = ref(0)

// 根据控制 Store 的 activeModules 和 layout 计算显示模块
const displayModules = computed<ModuleConfig[]>(() => {
  const active = controlStore.activeModules
  const layout = controlStore.currentLayout

  if (layout === 'single' && active.length > 0) {
    // 单模块模式：第一个模块占满 24 列
    return [{ name: active[0], span: 24, title: moduleTitleMap[active[0]] || active[0] }]
  }

  // 网格模式：根据模块数量分配 span
  const span = active.length <= 1 ? 24 : active.length <= 2 ? 12 : Math.floor(24 / active.length)
  return active.map(name => ({
    name,
    span,
    title: moduleTitleMap[name] || name,
  }))
})

function refresh() {
  refreshKey.value++
}

function close() {
  window.close()
}

// 接收主进程参数（初始化）
onMounted(() => {
  const handleParams = (params: any) => {
    if (params?.modules && Array.isArray(params.modules)) {
      controlStore.setModules(params.modules.map((m: any) =>
        typeof m === 'string' ? m : m.name || m
      ))
    }
    if (params?.layout) {
      controlStore.setLayout(params.layout)
    }
    if (params?.filters) {
      // 初始筛选应用到所有模块
      controlStore.applyFilters(undefined, params.filters)
    }
  }

  // dashboard:init — 初始参数
  window.ipcRenderer?.on('dashboard:init', (_event: any, params: any) => {
    handleParams(params)
  })

  // dashboard:update — 更新参数
  window.ipcRenderer?.on('dashboard:update', (_event: any, params: any) => {
    handleParams(params)
    refresh()
  })

  // dashboard:command — CLI 命令分发
  window.ipcRenderer?.on('dashboard:command', (_event: any, command: any) => {
    handleCommand(command)
  })

  // dashboard:request-data — 数据请求响应
  window.ipcRenderer?.on('dashboard:request-data', (_event: any, params: any) => {
    const { requestId, module, format, scope } = params
    const data = dataStore.getFormattedData(module, format || 'markdown', scope || 'summary')
    // 直接发送给主进程（主进程 ipcMain.once 直接捕获，无需通过主窗口转发）
    window.ipcRenderer?.send(`dashboard:data-response-${requestId}`, data)
  })

  // 开发环境直接加载默认模块
  if (!window.ipcRenderer) {
    controlStore.setModules(['cargoTrend', 'signingInformation'])
  }
})

// 处理 CLI 命令
function handleCommand(command: any) {
  const { command: cmd, args } = command

  switch (cmd) {
    case 'show':
      if (args?.modules) controlStore.setModules(args.modules)
      if (args?.layout) controlStore.setLayout(args.layout)
      break

    case 'filter':
      controlStore.applyFilters(args?.module, args?.filters || {})
      break

    case 'action':
      if (args?.module && args?.action) {
        controlStore.addAction(args.module, args.action, args.params || {})
      }
      break

    case 'reset':
      controlStore.resetFilters(args?.module)
      break

    case 'layout':
      if (args?.layout) controlStore.setLayout(args.layout)
      break
  }
}

onUnmounted(() => {
  window.ipcRenderer?.removeAllListeners('dashboard:init')
  window.ipcRenderer?.removeAllListeners('dashboard:update')
  window.ipcRenderer?.removeAllListeners('dashboard:command')
  window.ipcRenderer?.removeAllListeners('dashboard:request-data')
})
</script>

<style scoped>
.dashboard-container {
  width: 100vw;
  height: 100vh;
  background: #0f172a;
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}

.dashboard-title {
  font-size: 18px;
  font-weight: 600;
  color: #3b82f6;
  margin: 0;
}

.dashboard-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #334155;
  border: none;
  border-radius: 6px;
  color: #e2e8f0;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}

.action-btn:hover {
  background: #475569;
}

.action-btn .icon {
  width: 14px;
  height: 14px;
}

.dashboard-content {
  flex: 1;
  overflow: hidden;
}
</style>
