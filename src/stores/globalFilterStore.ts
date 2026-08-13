import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useDashboardControlStore } from './dashboardControlStore'

/**
 * 全局筛选 Store
 * 管理看板的全局筛选条件（始发仓、目的省、目的RDC）
 */
export const useGlobalFilterStore = defineStore('globalFilter', () => {
  const controlStore = useDashboardControlStore()

  // 选中的始发仓（多选）
  const selectedWarehouse = ref<string[]>([])
  // 选中的目的省（多选）
  const selectedProvince = ref<string[]>([])
  // 选中的目的RDC（多选）
  const selectedRdc = ref<string[]>([])

  /**
   * 切换始发仓选中状态
   */
  function toggleWarehouse(warehouse: string) {
    const index = selectedWarehouse.value.indexOf(warehouse)
    if (index > -1) {
      selectedWarehouse.value = selectedWarehouse.value.filter((_, i) => i !== index)
    } else {
      selectedWarehouse.value = [...selectedWarehouse.value, warehouse]
    }
  }

  /**
   * 设置始发仓选中列表
   */
  function setSelectedWarehouse(warehouses: string[]) {
    selectedWarehouse.value = [...warehouses]
  }

  /**
   * 切换目的省选中状态
   */
  function toggleProvince(province: string) {
    const index = selectedProvince.value.indexOf(province)
    if (index > -1) {
      selectedProvince.value = selectedProvince.value.filter((_, i) => i !== index)
    } else {
      selectedProvince.value = [...selectedProvince.value, province]
    }
  }

  /**
   * 设置目的省选中列表
   */
  function setSelectedProvince(provinces: string[]) {
    selectedProvince.value = [...provinces]
  }

  /**
   * 切换目的RDC选中状态
   */
  function toggleRdc(rdc: string) {
    const index = selectedRdc.value.indexOf(rdc)
    if (index > -1) {
      selectedRdc.value = selectedRdc.value.filter((_, i) => i !== index)
    } else {
      selectedRdc.value = [...selectedRdc.value, rdc]
    }
  }

  /**
   * 设置目的RDC选中列表
   */
  function setSelectedRdc(rdcs: string[]) {
    selectedRdc.value = [...rdcs]
  }

  /**
   * 重置所有筛选条件
   */
  function resetFilters() {
    selectedWarehouse.value = []
    selectedProvince.value = []
    selectedRdc.value = []
  }

  /**
   * 获取当前筛选参数（用于 API 调用）
   */
  function getFilterParams() {
    return {
      fromWarehouse: [...selectedWarehouse.value],
      toProvince: [...selectedProvince.value],
      toRdc: [...selectedRdc.value],
    }
  }

  /**
   * 同步筛选条件到 controlStore
   * 触发所有模块的数据刷新
   */
  function syncToControlStore() {
    const filters = getFilterParams()
    // 应用到所有模块（module 参数为 undefined 表示全局）
    controlStore.applyFilters(undefined, filters)
  }

  return {
    selectedWarehouse,
    selectedProvince,
    selectedRdc,
    toggleWarehouse,
    setSelectedWarehouse,
    toggleProvince,
    setSelectedProvince,
    toggleRdc,
    setSelectedRdc,
    resetFilters,
    getFilterParams,
    syncToControlStore,
  }
})
