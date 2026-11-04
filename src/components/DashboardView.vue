<template>
  <div class="dashboard-container">
    <!-- 背景层 -->
    <div class="dashboard-bg"></div>

    <!-- 头部 -->
    <div class="dashboard-header">
      <div class="header-bg-decoration"></div>
      <!-- 全局筛选栏 -->
      <div class="header-filter-container">
        <GlobalFilterBar />
      </div>
      <h1 class="dashboard-title">{{ t('dashboard.dashboardView.title') }}</h1>
      <div class="dashboard-actions">
        <button @click="refresh" class="action-btn" :title="t('dashboard.dashboardView.buttons.refresh')">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {{ t('dashboard.dashboardView.buttons.refresh') }}
        </button>
        <button @click="toggleFullscreen" class="action-btn" :title="t('dashboard.dashboardView.buttons.fullscreen')">
          <svg v-if="!isFullscreen" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          <svg v-else class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
          </svg>
          {{ isFullscreen ? t('dashboard.dashboardView.buttons.exitFullscreen') : t('dashboard.dashboardView.buttons.fullscreen') }}
        </button>
        <button @click="close" class="action-btn" :title="t('dashboard.dashboardView.buttons.close')">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          {{ t('dashboard.dashboardView.buttons.close') }}
        </button>
      </div>
    </div>

    <!-- 模块渲染区 -->
    <div class="dashboard-content">
      <!-- scroll 布局：按当前页面渲染，每个页面是独立的全屏视图 -->
      <div
        v-if="controlStore.currentLayout === 'scroll'"
        class="scroll-container"
        ref="scrollContainerRef"
      >
        <div v-if="currentPageData" class="view-item">
          <ModulesRender
            :gridConfig="currentPageData.gridConfig"
            :components="currentPageData.components"
            :filters="controlStore.moduleFilters"
            :key="`${refreshKey}-page-${currentPageData.name}`"
          />
        </div>
      </div>

      <!-- 其他布局：现有逻辑 -->
      <ModulesRender
        v-else
        :modules="displayModules"
        :filters="controlStore.moduleFilters"
        :layout="controlStore.currentLayout"
        :key="refreshKey"
      />
    </div>

    <!-- QuickBar 右侧导航（仅 scroll 布局时显示） -->
    <QuickBar
      v-if="controlStore.currentLayout === 'scroll'"
      ref="quickBarRef"
      :pages="pageRegistry"
      :current-page="controlStore.currentPage"
      @page-change="controlStore.setCurrentPage($event)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import ModulesRender from './dashboard/ModulesRender.vue'
import QuickBar from './dashboard/QuickBar.vue'
import GlobalFilterBar from './dashboard/GlobalFilterBar.vue'
import type { ModuleConfig } from './dashboard/ModulesRender.vue'
import { getModuleTitleMap, pageRegistry, getPageByName, LARGE_MODULES, getModuleByName, getPages, moduleRegistry } from './dashboard/moduleRegistry'
import type { PageMeta } from './dashboard/moduleRegistry'
import { useDashboardControlStore } from '../stores/dashboardControlStore'
import { useDashboardDataStore } from '../stores/dashboardDataStore'
import { useGlobalFilterStore } from '../stores/globalFilterStore'
import { useSelectOptionsStore } from '../stores/selectOptionsStore'
import { getHelpInfo } from '../utils/dashboard/commands/help'

const { t } = useI18n()
const controlStore = useDashboardControlStore()
const dataStore = useDashboardDataStore()
const globalFilterStore = useGlobalFilterStore()
const selectOptionsStore = useSelectOptionsStore()

const refreshKey = ref(0)
const isFullscreen = ref(false)
const quickBarRef = ref<InstanceType<typeof QuickBar> | null>(null)
const scrollContainerRef = ref<HTMLElement | null>(null)

// 从注册表获取模块标题映射
const moduleTitleMap = getModuleTitleMap()

// 默认模块配置（保留用于非 scroll 模式）
const defaultModules: ModuleConfig[] = [
  { name: 'cargoTrend', span: 12, title: '货量趋势' },
  { name: 'signingInformation', span: 12, title: '签收信息' },
  { name: 'cargoBanner', span: 24, title: '智能体异常预警' },
]

// 当前页面数据（参考 refer 项目的 zone/module 切换）
const currentPageData = computed<PageMeta | undefined>(() => {
  return getPageByName(controlStore.currentPage)
})

// 根据控制 Store 的 activeModules 和 layout 计算显示模块（非 scroll 模式）
const displayModules = computed<ModuleConfig[]>(() => {
  const active = controlStore.activeModules
  const layout = controlStore.currentLayout

  // single/grid/cards 布局只支持大模块
  if (layout === 'single' || layout === 'grid' || layout === 'cards') {
    const filtered = active.filter(m => LARGE_MODULES.includes(m))
    if (filtered.length === 0) return []

    if (layout === 'single') {
      return [{ name: filtered[0], span: 24 }]
    }

    // grid/cards 最多 3 个
    const modules = filtered.slice(0, 3)
    const span = modules.length <= 1 ? 24 : modules.length <= 2 ? 12 : 8
    return modules.map(name => ({ name, span }))
  }

  // 其他布局（scroll 等）不过滤
  return active.map(name => ({ name, span: 12 }))
})

function refresh() {
  refreshKey.value++
}

function toggleFullscreen() {
  if (window.ipcRenderer) {
    // Electron 环境：使用窗口全屏
    window.ipcRenderer.invoke('dashboard:toggle-fullscreen').then((result: any) => {
      if (result.success) {
        isFullscreen.value = result.isFullscreen
      } else {
        console.error('全屏失败:', result.error)
      }
    }).catch((err: any) => {
      console.error('全屏失败:', err)
    })
  } else {
    // 浏览器环境：使用浏览器全屏 API
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        isFullscreen.value = true
      }).catch(err => {
        console.error('全屏失败:', err)
      })
    } else {
      document.exitFullscreen().then(() => {
        isFullscreen.value = false
      }).catch(err => {
        console.error('退出全屏失败:', err)
      })
    }
  }
}

function close() {
  window.close()
}

// 接收主进程参数（初始化）
const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement
}

onMounted(() => {
  // 监听全屏状态变化（浏览器环境）
  document.addEventListener('fullscreenchange', handleFullscreenChange)

  // 监听全屏状态变化（Electron 环境）
  window.ipcRenderer?.on('dashboard:fullscreen-change', (_event: any, isFullScreen: boolean) => {
    isFullscreen.value = isFullScreen
  })

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

  // dashboard:request-data — 数据请求响应（使用布局感知的 getSmartData）
  window.ipcRenderer?.on('dashboard:request-data', (_event: any, params: any) => {
    const { requestId, module, report } = params

    // AI 大脑报告：切换到 single 布局显示 aiBrainReport
    if (report) {
      controlStore.setModules(['aiBrainReport'])
      controlStore.setLayout('single')
      const data = dataStore.getSmartData(report)
      window.ipcRenderer?.send(`dashboard:data-response-${requestId}`, data)
      return
    }

    // 普通模块数据
    if (module) {
      const data = dataStore.getSmartData(module)
      window.ipcRenderer?.send(`dashboard:data-response-${requestId}`, data)
      return
    }

    // 都没传，返回当前页面概览
    const data = dataStore.getSmartData()
    window.ipcRenderer?.send(`dashboard:data-response-${requestId}`, data)
  })

  // dashboard:request-status — 状态请求响应
  window.ipcRenderer?.on('dashboard:request-status', (_event: any, params: any) => {
    const { requestId } = params
    const status = getStatusInfo()
    window.ipcRenderer?.send(`dashboard:status-response-${requestId}`, status)
  })

  // dashboard:request-help — 帮助请求响应（带状态感知）
  window.ipcRenderer?.on('dashboard:request-help', (_event: any, params: any) => {
    const { requestId, queryCommand, module, queryFilter } = params
    // 获取当前状态
    const layout = controlStore.currentLayout
    const currentPage = controlStore.currentPage
    const activeModules = controlStore.activeModules
    // 筛选状态和选项
    const currentFilters = {
      fromWarehouse: globalFilterStore.selectedWarehouse,
      toProvince: globalFilterStore.selectedProvince,
      toRdc: globalFilterStore.selectedRdc,
    }
    const filterOptions = {
      fromWarehouse: selectOptionsStore.fromWarehouseOptions,
      toProvince: selectOptionsStore.provinceOptions,
      toRdc: selectOptionsStore.rdcOptions,
    }
    const help = getHelpInfo(
      queryCommand,
      module,
      { layout, currentPage, activeModules, currentFilters, filterOptions },
      queryFilter
    )
    window.ipcRenderer?.send(`dashboard:help-response-${requestId}`, help)
  })

  // 开发环境直接加载默认模块
  if (!window.ipcRenderer) {
    controlStore.setModules(['cargoTrend', 'signingInformation'])
  }
})

// 监听布局切换，scroll 模式下重新初始化 QuickBar 锚点
watch(
  () => controlStore.currentLayout,
  (newLayout) => {
    if (newLayout === 'scroll') {
      nextTick(() => {
        quickBarRef.value?.initAnchor()
      })
    }
  }
)

// 监听页面切换，重新初始化 QuickBar 锚点
watch(
  () => controlStore.currentPage,
  () => {
    nextTick(() => {
      quickBarRef.value?.initAnchor()
    })
  }
)

// 处理 CLI 命令
function handleCommand(command: any) {
  const { command: cmd, args } = command

  switch (cmd) {
    case 'show':
      if (args?.modules) controlStore.setModules(args.modules)
      if (args?.layout) controlStore.setLayout(args.layout)
      break

    case 'filter': {
      const filters = args?.filters || {}
      // 始终替换全部字段，未传的字段重置为空
      const toArray = (v: any) => {
        if (v === undefined || v === null || v === '') return []
        return Array.isArray(v) ? v : [v]
      }
      globalFilterStore.setSelectedWarehouse(toArray(filters.fromWarehouse))
      globalFilterStore.setSelectedProvince(toArray(filters.toProvince))
      globalFilterStore.setSelectedRdc(toArray(filters.toRdc))
      // 同步到 controlStore（触发模块数据刷新）
      globalFilterStore.syncToControlStore()
      break
    }

    case 'action':
      if (args?.module && args?.action) {
        controlStore.addAction(args.module, args.action, args.params || {})
      }
      break

    case 'layout':
      if (args?.layout) controlStore.setLayout(args.layout)
      break

    case 'page':
      if (args?.page) {
        controlStore.setLayout('scroll')
        controlStore.setCurrentPage(args.page)
      }
      break

    case 'fullscreen':
      toggleFullscreen()
      break
  }
}

// 获取当前看板状态信息
function getStatusInfo(): string {
  const layout = controlStore.currentLayout
  const currentPage = controlStore.currentPage
  const activeModules = controlStore.activeModules

  let status = `## Dashboard Status\n\n`
  status += `- **${t('dashboard.dashboardView.status.layout')}**: ${layout}\n`

  if (layout === 'scroll' && currentPage) {
    const pageInfo = getPageByName(currentPage)
    status += `- **${t('dashboard.dashboardView.status.currentPage')}**: ${pageInfo?.title || currentPage}\n`
    // scroll 布局显示当前页面的模块
    if (pageInfo?.components) {
      const moduleNames = pageInfo.components.map(c => moduleTitleMap[c.name] || c.name)
      status += `- **${t('dashboard.dashboardView.status.pageModules')}**: ${moduleNames.join('、')}\n`
    }
  } else if (activeModules.length > 0) {
    // 非 scroll 布局显示 activeModules
    const moduleNames = activeModules.map(m => moduleTitleMap[m] || m)
    if (layout === 'single') {
      status += `- **${t('dashboard.dashboardView.status.displayModules')}**: ${moduleNames[0] || t('dashboard.dashboardView.status.none')}\n`
    } else {
      status += `- **${t('dashboard.dashboardView.status.displayModules')}**: ${moduleNames.join('、')}\n`
    }
  } else {
    status += `- **${t('dashboard.dashboardView.status.displayModules')}**: ${t('dashboard.dashboardView.status.none')}\n`
  }

  return status
}

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  window.ipcRenderer?.removeAllListeners('dashboard:fullscreen-change')
  window.ipcRenderer?.removeAllListeners('dashboard:init')
  window.ipcRenderer?.removeAllListeners('dashboard:update')
  window.ipcRenderer?.removeAllListeners('dashboard:command')
  window.ipcRenderer?.removeAllListeners('dashboard:request-data')
  window.ipcRenderer?.removeAllListeners('dashboard:request-status')
  window.ipcRenderer?.removeAllListeners('dashboard:request-help')
})
</script>

<style scoped>
.dashboard-container {
  width: 100vw;
  height: 100vh;
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* 世界地图背景 */
.dashboard-bg {
  position: absolute;
  inset: 0;
  background: url('/dashboard/bigbg.png') center/cover no-repeat;
  z-index: 0;
}

.dashboard-header {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 4px 24px 12px;
  background: url('/dashboard/header-bg.png') center/cover no-repeat;
  -webkit-app-region: drag;
  flex-shrink: 0;
  overflow: visible;
}

.header-bg-decoration {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
    radial-gradient(circle at 80% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
    linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.05) 50%, transparent 100%);
  pointer-events: none;
}

.dashboard-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  font-size: 20px;
  font-weight: 700;
  color: #60a5fa;
  margin: 0;
  text-shadow: 0 0 12px rgba(96, 165, 250, 0.4);
  letter-spacing: 2px;
}

.header-filter-container {
  position: absolute;
  left: 24px;
  z-index: 100;
  -webkit-app-region: no-drag;
  overflow: visible;
}

.dashboard-actions {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.dashboard-header:hover .dashboard-actions {
  opacity: 1;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  background: rgba(8, 31, 64, 0.8);
  border: 1px solid rgba(74, 158, 255, 0.4);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 13px;
}

.action-btn:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(74, 158, 255, 0.7);
  color: #fff;
}

.action-btn .icon {
  width: 14px;
  height: 14px;
}

.dashboard-content {
  position: relative;
  z-index: 1;
  flex: 1;
  overflow: hidden;
}

/* scroll 容器 */
.scroll-container {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  scroll-behavior: smooth;
}

/* 每个模块占满一屏 */
.scroll-container .view-item {
  width: 100%;
  min-height: calc(100vh - 60px);
  padding: 16px;
  box-sizing: border-box;
}

/* scroll 容器滚动条 */
.scroll-container::-webkit-scrollbar { width: 6px; }
.scroll-container::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); }
.scroll-container::-webkit-scrollbar-thumb { background: rgba(74, 158, 255, 0.4); border-radius: 3px; }
</style>
