import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 看板控制状态 Store（看板窗口侧）
 * 管理看板窗口的控制状态：模块、布局、筛选、操作队列
 * 由 DashboardView 监听并分发到 UI 组件
 */
export const useDashboardControlStore = defineStore('dashboardControl', () => {
  // 当前活跃模块列表
  const activeModules = ref<string[]>(['cargoTrend', 'signingInformation'])

  // 当前布局模式
  const currentLayout = ref<'single' | 'grid' | 'cards'>('grid')

  // 各模块的筛选条件
  const moduleFilters = ref<Record<string, Record<string, any>>>({})

  // 待执行操作队列
  const pendingActions = ref<Array<{
    module: string
    action: string
    params: any
    id: string // 唯一标识，执行后移除
  }>>([])

  // 设置活跃模块
  function setModules(modules: string[]) {
    activeModules.value = modules
  }

  // 设置布局
  function setLayout(layout: 'single' | 'grid' | 'cards') {
    currentLayout.value = layout
  }

  // 应用筛选（合并到现有筛选）
  function applyFilters(module: string | undefined, filters: Record<string, any>) {
    if (module) {
      // 模块专属筛选
      moduleFilters.value[module] = {
        ...moduleFilters.value[module],
        ...filters,
      }
    } else {
      // 全局筛选，应用到所有已注册模块
      Object.keys(moduleFilters.value).forEach(mod => {
        moduleFilters.value[mod] = {
          ...moduleFilters.value[mod],
          ...filters,
        }
      })
    }
  }

  // 重置筛选
  function resetFilters(module?: string) {
    if (module) {
      moduleFilters.value[module] = {}
    } else {
      moduleFilters.value = {}
    }
  }

  // 添加待执行操作
  function addAction(module: string, action: string, params: any = {}) {
    pendingActions.value.push({
      module,
      action,
      params,
      id: `${module}_${action}_${Date.now()}`,
    })
  }

  // 消费操作（执行后移除）
  function consumeAction(id: string) {
    const index = pendingActions.value.findIndex(a => a.id === id)
    if (index !== -1) {
      return pendingActions.value.splice(index, 1)[0]
    }
    return null
  }

  // 获取模块的筛选条件
  function getModuleFilters(module: string): Record<string, any> {
    return moduleFilters.value[module] || {}
  }

  return {
    activeModules,
    currentLayout,
    moduleFilters,
    pendingActions,
    setModules,
    setLayout,
    applyFilters,
    resetFilters,
    addAction,
    consumeAction,
    getModuleFilters,
  }
})
