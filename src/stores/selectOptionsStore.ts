import { defineStore } from 'pinia'
import { ref } from 'vue'
import { queryFromWarehouse, queryToProvince, queryToRdc } from '../services/transportApi'

/**
 * 下拉选项 Store
 * 管理看板筛选下拉框的选项数据
 */
export const useSelectOptionsStore = defineStore('selectOptions', () => {
  // 始发仓选项
  const fromWarehouseOptions = ref<string[]>([])
  // 目的省选项
  const provinceOptions = ref<string[]>([])
  // 目的RDC选项
  const rdcOptions = ref<string[]>([])

  // 加载状态
  const loading = ref(false)
  const isDataLoaded = ref(false)
  let loadingPromise: Promise<void> | null = null

  /**
   * 获取始发仓选项
   */
  async function fetchFromWarehouseOptions() {
    try {
      const res = await queryFromWarehouse()
      if (res && Array.isArray(res.data)) {
        fromWarehouseOptions.value = res.data
          .filter((item: any) => item && item.name)
          .map((item: any) => item.name)
      }
    } catch (err) {
      console.error('获取始发仓选项失败:', err)
      fromWarehouseOptions.value = []
    }
  }

  /**
   * 获取目的省选项
   */
  async function fetchProvinceOptions() {
    try {
      const res = await queryToProvince()
      if (res && Array.isArray(res.data)) {
        provinceOptions.value = res.data
          .filter((item: any) => item && item.name)
          .map((item: any) => item.name)
      }
    } catch (err) {
      console.error('获取目的省选项失败:', err)
      provinceOptions.value = []
    }
  }

  /**
   * 获取目的RDC选项
   */
  async function fetchRdcOptions() {
    try {
      const res = await queryToRdc()
      if (res && Array.isArray(res.data)) {
        rdcOptions.value = res.data
          .filter((item: any) => item && item.name)
          .map((item: any) => item.name)
      }
    } catch (err) {
      console.error('获取目的RDC选项失败:', err)
      rdcOptions.value = []
    }
  }

  /**
   * 并行加载所有选项
   */
  async function fetchAllOptions() {
    if (isDataLoaded.value) {
      return
    }

    loading.value = true
    try {
      await Promise.all<Promise<void>>([
        fetchFromWarehouseOptions(),
        fetchProvinceOptions(),
        fetchRdcOptions(),
      ])
      isDataLoaded.value = true
    } catch (err) {
      console.error('获取筛选选项失败:', err)
      isDataLoaded.value = true // 即使出错也标记为已加载，避免重复请求
    } finally {
      loading.value = false
    }
  }

  /**
   * 确保数据已加载（防重复加载）
   */
  async function ensureDataLoaded() {
    if (isDataLoaded.value) {
      return
    }

    if (loadingPromise) {
      return loadingPromise
    }

    loadingPromise = (async () => {
      try {
        await fetchAllOptions()
      } finally {
        loadingPromise = null
      }
    })()

    return loadingPromise
  }

  /**
   * 重置数据
   */
  function resetData() {
    fromWarehouseOptions.value = []
    provinceOptions.value = []
    rdcOptions.value = []
    isDataLoaded.value = false
    loading.value = false
  }

  return {
    fromWarehouseOptions,
    provinceOptions,
    rdcOptions,
    loading,
    isDataLoaded,
    fetchFromWarehouseOptions,
    fetchProvinceOptions,
    fetchRdcOptions,
    fetchAllOptions,
    ensureDataLoaded,
    resetData,
  }
})
