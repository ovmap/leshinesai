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
      <ModulesRender :modules="currentModules" :filters="currentFilters" :key="refreshKey" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import ModulesRender from './dashboard/ModulesRender.vue'
import type { ModuleConfig } from './dashboard/ModulesRender.vue'

// 默认模块配置
const defaultModules: ModuleConfig[] = [
  { name: 'cargoTrend', span: 12, title: '货量趋势' },
  { name: 'signingInformation', span: 12, title: '签收信息' },
]

const currentModules = ref<ModuleConfig[]>(defaultModules)
const currentFilters = ref<any>({})
const refreshKey = ref(0)

// 模块名称到中文标题的映射（AI 传参用）
const moduleTitleMap: Record<string, string> = {
  cargoTrend: '货量趋势',
  signingInformation: '签收信息',
}

function refresh() {
  refreshKey.value++
}

function close() {
  window.close()
}

// 接收主进程参数
onMounted(() => {
  const handleParams = (params: any) => {
    if (params?.modules && Array.isArray(params.modules)) {
      // AI 传入的 modules 可能是字符串数组或对象数组
      currentModules.value = params.modules.map((m: any) => {
        if (typeof m === 'string') {
          return { name: m, span: 12, title: moduleTitleMap[m] || m }
        }
        return {
          name: m.name || m,
          span: m.span || 12,
          title: m.title || moduleTitleMap[m.name] || m.name,
        }
      })
    }
    if (params?.filters) {
      currentFilters.value = params.filters
    }
  }

  window.ipcRenderer?.on('dashboard:init', (_event: any, params: any) => {
    handleParams(params)
  })

  window.ipcRenderer?.on('dashboard:update', (_event: any, params: any) => {
    handleParams(params)
    refresh()
  })

  // 开发环境直接加载默认模块
  if (!window.ipcRenderer) {
    currentModules.value = defaultModules
  }
})

onUnmounted(() => {
  window.ipcRenderer?.removeAllListeners('dashboard:init')
  window.ipcRenderer?.removeAllListeners('dashboard:update')
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
