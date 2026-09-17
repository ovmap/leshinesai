import { defineStore } from 'pinia'
import { ref } from 'vue'
import { queryFromWarehouse, queryToProvince, queryToRdc, queryDataSourceList, queryDeliveryList, queryCustomerList, queryLogistics, queryCdcWarehouses } from '../services/transportApi'

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
  // 数据源选项
  const dataSourceOptions = ref<{ code: string; name: string }[]>([])
  // 物流商选项
  const deliveryProviderOptions = ref<{ code: string; name: string }[]>([])
  // 客户选项
  const customerOptions = ref<{ code: string; name: string }[]>([])
  
  // 按业务类型存储物流商选项（Map<bizType, options>）
  const logisticsOptionsByBizType = ref<Map<string, { code: string; name: string }[]>>(new Map())
  
  // 按业务类型存储 CDC 仓库选项（Map<bizType, options>）
  const warehouseOptionsByBizType = ref<Map<string, { code: string; name: string }[]>>(new Map())

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
   * 格式化选项数据（从 {code, name} 对象数组）
   */
  const formatOptions = (data: any[]): { code: string; name: string }[] => {
    return data
      .map((item: any) => {
        const code = item?.code != null ? String(item.code) : ''
        const name = item?.name != null ? String(item.name) : ''
        return { code, name }
      })
      .filter((option) => option.code && option.name && option.code !== '[object Object]' && option.name !== '[object Object]')
  }

  /**
   * 获取数据源选项
   */
  async function fetchDataSourceOptions() {
    try {
      const res = await queryDataSourceList()
      if (res && res.code === 200 && Array.isArray(res.data)) {
        dataSourceOptions.value = formatOptions(res.data)
      }
    } catch (err) {
      console.error('获取数据源选项失败:', err)
      dataSourceOptions.value = []
    }
  }

  /**
   * 获取物流商选项
   */
  async function fetchDeliveryProviderOptions() {
    try {
      const res = await queryDeliveryList()
      if (res && res.code === 200 && Array.isArray(res.data)) {
        deliveryProviderOptions.value = formatOptions(res.data)
      }
    } catch (err) {
      console.error('获取物流商选项失败:', err)
      deliveryProviderOptions.value = []
    }
  }

  /**
   * 获取客户选项
   */
  async function fetchCustomerOptions() {
    try {
      const res = await queryCustomerList()
      if (res && res.code === 200 && Array.isArray(res.data)) {
        customerOptions.value = formatOptions(res.data)
      }
    } catch (err) {
      console.error('获取客户选项失败:', err)
      customerOptions.value = []
    }
  }

  /**
   * 根据业务类型获取物流商选项
   */
  async function fetchLogisticsByBizType(bizType: string = '1') {
    try {
      const res = await queryLogistics(bizType)
      if (res && res.code === 200 && Array.isArray(res.data)) {
        const options = formatOptions(res.data)
        logisticsOptionsByBizType.value.set(bizType, options)
      }
    } catch (err) {
      console.error(`获取物流商选项失败(bizType=${bizType}):`, err)
      logisticsOptionsByBizType.value.set(bizType, [])
    }
  }

  /**
   * 根据业务类型获取 CDC 仓库选项
   */
  async function fetchWarehouseByBizType(bizType: string = '1') {
    try {
      const res = await queryCdcWarehouses(bizType)
      if (res && res.code === 200 && Array.isArray(res.data)) {
        const options = formatOptions(res.data)
        warehouseOptionsByBizType.value.set(bizType, options)
      }
    } catch (err) {
      console.error(`获取 CDC 仓库选项失败(bizType=${bizType}):`, err)
      warehouseOptionsByBizType.value.set(bizType, [])
    }
  }

  /**
   * 获取指定业务类型的物流商选项
   */
  function getLogisticsByBizType(bizType: string = '1'): { code: string; name: string }[] {
    return logisticsOptionsByBizType.value.get(bizType) || []
  }

  /**
   * 获取指定业务类型的 CDC 仓库选项
   */
  function getWarehouseByBizType(bizType: string = '1'): { code: string; name: string }[] {
    return warehouseOptionsByBizType.value.get(bizType) || []
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
        fetchDataSourceOptions(),
        fetchDeliveryProviderOptions(),
        fetchCustomerOptions(),
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
    dataSourceOptions.value = []
    deliveryProviderOptions.value = []
    customerOptions.value = []
    isDataLoaded.value = false
    loading.value = false
  }

  return {
    fromWarehouseOptions,
    provinceOptions,
    rdcOptions,
    dataSourceOptions,
    deliveryProviderOptions,
    customerOptions,
    logisticsOptionsByBizType,
    warehouseOptionsByBizType,
    loading,
    isDataLoaded,
    fetchFromWarehouseOptions,
    fetchProvinceOptions,
    fetchRdcOptions,
    fetchDataSourceOptions,
    fetchDeliveryProviderOptions,
    fetchCustomerOptions,
    fetchLogisticsByBizType,
    fetchWarehouseByBizType,
    getLogisticsByBizType,
    getWarehouseByBizType,
    fetchAllOptions,
    ensureDataLoaded,
    resetData,
  }
})
