<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, Teleport, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  queryUrgentOrdersByPage,
  queryUrgentOrdersItemByPage,
  queryRiskList,
  queryOrderStatusList,
  exportUrgentOrdersItem,
  queryFromWarehouse,
} from '../../../services/transportApi'
import { useDashboardDataStore } from '../../../stores/dashboardDataStore'

const { t } = useI18n()
const dataStore = useDashboardDataStore()

const props = defineProps<{
  fromWarehouse?: string[]
  toProvince?: string[]
  toRdc?: string[]
}>()

// 表格数据类型定义
interface UrgentOrderData {
  invoiceNo: string
  transType: number | string
  location: string
  toProvince: string
  predictArriveTime: string
  riskType: string | null
  hasRisk: boolean | null
  [key: string]: any
}

// 表格数据
const tableData = ref<UrgentOrderData[]>([])

// 弹窗相关状态
const modalVisible = ref(false)
const modalTitle = computed(() => t('dashboard.urgentCustomer.modalTitles.detail'))
const modalData = ref<any[]>([])
const modalLoading = ref(false)
const exportLoading = ref(false)

// 分页相关状态
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

// 表格容器引用和高度
const modalTableSectionRef = ref<HTMLElement | null>(null)
const modalTableScrollY = ref<number | undefined>(200)

// 筛选表单数据
const filterForm = ref({
  startDate: '',
  endDate: '',
  notSigned: '1',
  customerOrderNo: '',
  toWarehouse: [] as string[],
  orderStatus: '',
  risk: [] as string[],
})

// 下拉选项数据
interface OptionItem {
  label: string
  value: string
}

const notSignedOptions = computed(() => [
  { label: t('dashboard.urgentCustomer.filters.notSigned'), value: '1' },
  { label: t('dashboard.urgentCustomer.filters.signed'), value: '0' },
])

const toWarehouseOptions = ref<string[]>([])
const orderStatusOptions = ref<OptionItem[]>([])
const riskOptions = ref<OptionItem[]>([])

// 下拉框开关状态
const isNotSignedOpen = ref(false)
const isToWarehouseOpen = ref(false)
const isOrderStatusOpen = ref(false)
const isRiskOpen = ref(false)

// 搜索关键词
const toWarehouseSearch = ref('')
const orderStatusSearch = ref('')
const riskSearch = ref('')

// 下拉框开关方法
const toggleNotSignedDropdown = () => {
  if (isNotSignedOpen.value) {
    isNotSignedOpen.value = false
  } else {
    closeAllDropdowns()
    isNotSignedOpen.value = true
  }
}

const toggleToWarehouseDropdown = () => {
  if (isToWarehouseOpen.value) {
    isToWarehouseOpen.value = false
    toWarehouseSearch.value = ''
  } else {
    closeAllDropdowns()
    isToWarehouseOpen.value = true
    toWarehouseSearch.value = ''
  }
}

const toggleOrderStatusDropdown = () => {
  if (isOrderStatusOpen.value) {
    isOrderStatusOpen.value = false
    orderStatusSearch.value = ''
  } else {
    closeAllDropdowns()
    isOrderStatusOpen.value = true
    orderStatusSearch.value = ''
  }
}

const toggleRiskDropdown = () => {
  if (isRiskOpen.value) {
    isRiskOpen.value = false
    riskSearch.value = ''
  } else {
    closeAllDropdowns()
    isRiskOpen.value = true
    riskSearch.value = ''
  }
}

// 关闭所有下拉框
const closeAllDropdowns = () => {
  isNotSignedOpen.value = false
  isToWarehouseOpen.value = false
  isOrderStatusOpen.value = false
  isRiskOpen.value = false
  toWarehouseSearch.value = ''
  orderStatusSearch.value = ''
  riskSearch.value = ''
}

// 选择方法
const selectNotSigned = (value: string) => {
  filterForm.value.notSigned = value
  closeAllDropdowns()
}

const selectToWarehouse = (value: string) => {
  if (value === '__reset__') {
    filterForm.value.toWarehouse = []
    toWarehouseSearch.value = ''
    return
  }

  const index = filterForm.value.toWarehouse.indexOf(value)
  if (index > -1) {
    filterForm.value.toWarehouse.splice(index, 1)
  } else {
    filterForm.value.toWarehouse.push(value)
  }
}

const selectOrderStatus = (value: string) => {
  if (value === '__reset__') {
    filterForm.value.orderStatus = ''
    orderStatusSearch.value = ''
    return
  }
  filterForm.value.orderStatus = value
  closeAllDropdowns()
}

const selectRisk = (value: string) => {
  if (value === '__reset__') {
    filterForm.value.risk = []
    riskSearch.value = ''
    return
  }

  const index = filterForm.value.risk.indexOf(value)
  if (index > -1) {
    filterForm.value.risk.splice(index, 1)
  } else {
    filterForm.value.risk.push(value)
  }
}

// 显示文本
const selectedNotSignedText = computed(() => {
  if (filterForm.value.notSigned === '') {
    return t('dashboard.urgentCustomer.filters.signStatus')
  }
  const option = notSignedOptions.value.find(item => item.value === filterForm.value.notSigned)
  return option ? option.label : t('dashboard.urgentCustomer.filters.signStatus')
})

const selectedToWarehouseText = computed(() => {
  if (filterForm.value.toWarehouse.length === 0) return t('dashboard.urgentCustomer.filters.destWarehouse')
  if (filterForm.value.toWarehouse.length === 1) return filterForm.value.toWarehouse[0]
  return t('dashboard.urgentCustomer.filters.selectedCount', { count: filterForm.value.toWarehouse.length })
})

const selectedOrderStatusText = computed(() => {
  if (!filterForm.value.orderStatus) return t('dashboard.urgentCustomer.filters.orderStatus')
  const option = orderStatusOptions.value.find(item => item.value === filterForm.value.orderStatus)
  return option ? option.label : t('dashboard.urgentCustomer.filters.orderStatus')
})

const selectedRiskText = computed(() => {
  if (filterForm.value.risk.length === 0) return t('dashboard.urgentCustomer.filters.riskType')
  if (filterForm.value.risk.length === 1) {
    const option = riskOptions.value.find(item => item.value === filterForm.value.risk[0])
    return option ? option.label : filterForm.value.risk[0]
  }
  return t('dashboard.urgentCustomer.filters.selectedCount', { count: filterForm.value.risk.length })
})

// 过滤后的选项
const filteredToWarehouseOptions = computed(() => {
  let filtered = toWarehouseOptions.value
  if (toWarehouseSearch.value.trim()) {
    filtered = toWarehouseOptions.value.filter((option) =>
      option.toLowerCase().includes(toWarehouseSearch.value.toLowerCase()),
    )
  }
  return [{ value: '__reset__', label: t('dashboard.urgentCustomer.filters.reset') }, ...filtered.map(o => ({ value: o, label: o }))]
})

const filteredOrderStatusOptions = computed(() => {
  let filtered = orderStatusOptions.value
  if (orderStatusSearch.value.trim()) {
    filtered = filtered.filter((option) =>
      option.label.toLowerCase().includes(orderStatusSearch.value.toLowerCase()),
    )
  }
  return [{ value: '__reset__', label: t('dashboard.urgentCustomer.filters.reset') }, ...filtered]
})

const filteredRiskOptions = computed(() => {
  let filtered = riskOptions.value
  if (riskSearch.value.trim()) {
    filtered = filtered.filter((option) =>
      option.label.toLowerCase().includes(riskSearch.value.toLowerCase()),
    )
  }
  return [{ value: '__reset__', label: t('dashboard.urgentCustomer.filters.reset') }, ...filtered]
})

// 分离风险行和普通行
const urgentRows = computed(() => {
  return tableData.value.filter(row => row.hasRisk === true)
})

const normalRows = computed(() => {
  return tableData.value.filter(row => row.hasRisk !== true)
})

// 运输方式转换函数
const getTransTypeName = (transType: number | string | undefined): string => {
  if (transType === undefined || transType === null) return ''
  const typeMap: { [key: number | string]: string } = {
    1: t('dashboard.urgentCustomer.transTypes.road'),
    2: t('dashboard.urgentCustomer.transTypes.air'),
    3: t('dashboard.urgentCustomer.transTypes.rail'),
    4: t('dashboard.urgentCustomer.transTypes.express'),
  }
  return typeMap[transType] || String(transType)
}

// 自动滚动相关
const tableContainer = ref<HTMLDivElement | null>(null)
const urgentTableContainer = ref<HTMLDivElement | null>(null)
let scrollTimer: ReturnType<typeof setTimeout> | null = null
let urgentScrollTimer: ReturnType<typeof setTimeout> | null = null
let isScrolling = ref(false)
let isUrgentScrolling = ref(false)
let currentScrollPosition = ref(0)
let currentUrgentScrollPosition = ref(0)

// 自动滚动函数
const startAutoScroll = () => {
  if (!tableContainer.value) return

  stopAutoScroll()

  isScrolling.value = true
  const container = tableContainer.value
  const scrollHeight = container.scrollHeight
  const clientHeight = container.clientHeight
  const maxScroll = scrollHeight - clientHeight

  if (maxScroll <= 0) return

  const scrollStep = 2
  const scrollInterval = 80
  const resetDelay = 500

  const scroll = () => {
    if (!isScrolling.value || !tableContainer.value) return

    currentScrollPosition.value += scrollStep

    if (currentScrollPosition.value >= maxScroll) {
      currentScrollPosition.value = 0
      container.scrollTop = 0

      scrollTimer = setTimeout(() => {
        if (isScrolling.value && tableContainer.value) {
          scroll()
        }
      }, resetDelay)
    } else {
      container.scrollTop = currentScrollPosition.value
      scrollTimer = setTimeout(scroll, scrollInterval)
    }
  }

  scroll()
}

// 停止自动滚动
const stopAutoScroll = () => {
  isScrolling.value = false
  if (scrollTimer) {
    clearTimeout(scrollTimer)
    scrollTimer = null
  }
}

// 异常列表自动滚动函数
const startUrgentAutoScroll = () => {
  if (!urgentTableContainer.value) return

  stopUrgentAutoScroll()

  isUrgentScrolling.value = true
  const container = urgentTableContainer.value
  const scrollHeight = container.scrollHeight
  const clientHeight = container.clientHeight
  const maxScroll = scrollHeight - clientHeight

  if (maxScroll <= 0) return

  const scrollStep = 2
  const scrollInterval = 80
  const resetDelay = 500

  const scroll = () => {
    if (!isUrgentScrolling.value || !urgentTableContainer.value) return

    currentUrgentScrollPosition.value += scrollStep

    if (currentUrgentScrollPosition.value >= maxScroll) {
      currentUrgentScrollPosition.value = 0
      container.scrollTop = 0

      urgentScrollTimer = setTimeout(() => {
        if (isUrgentScrolling.value && urgentTableContainer.value) {
          scroll()
        }
      }, resetDelay)
    } else {
      container.scrollTop = currentUrgentScrollPosition.value
      urgentScrollTimer = setTimeout(scroll, scrollInterval)
    }
  }

  scroll()
}

// 停止异常列表自动滚动
const stopUrgentAutoScroll = () => {
  isUrgentScrolling.value = false
  if (urgentScrollTimer) {
    clearTimeout(urgentScrollTimer)
    urgentScrollTimer = null
  }
}

// 鼠标悬停时暂停滚动
const handleMouseEnter = () => {
  stopAutoScroll()
}

// 鼠标离开时从当前位置恢复滚动
const handleMouseLeave = () => {
  if (!tableContainer.value) return

  currentScrollPosition.value = tableContainer.value.scrollTop

  setTimeout(() => {
    if (tableContainer.value) {
      startAutoScroll()
    }
  }, 100)
}

// 异常列表鼠标悬停时暂停滚动
const handleUrgentMouseEnter = () => {
  stopUrgentAutoScroll()
}

// 异常列表鼠标离开时从当前位置恢复滚动
const handleUrgentMouseLeave = () => {
  if (!urgentTableContainer.value) return

  currentUrgentScrollPosition.value = urgentTableContainer.value.scrollTop

  setTimeout(() => {
    if (urgentTableContainer.value) {
      startUrgentAutoScroll()
    }
  }, 100)
}

// 加载数据
const loadData = async () => {
  try {
    const params = {
      fromWarehouse: props.fromWarehouse || [],
      toProvince: props.toProvince || [],
      toRdc: props.toRdc || [],
    }

    const result = await queryUrgentOrdersByPage(params)

    if (result && result.code === 200 && result.data) {
      console.log('[UrgentCustomer] API result:', { total: result.total, dataLength: Array.isArray(result.data) ? result.data.length : 'not array', dataKeys: Object.keys(result.data) })
      if (Array.isArray(result.data)) {
        tableData.value = result.data
      } else if (result.data.list && Array.isArray(result.data.list)) {
        tableData.value = result.data.list
      } else if (result.data.records && Array.isArray(result.data.records)) {
        tableData.value = result.data.records
      }
      console.log('[UrgentCustomer] tableData.length:', tableData.value.length, 'result.total:', result.total)
      // 同步到数据 Store
      dataStore.updateModuleData('urgentCustomer', {
        list: tableData.value,
        total: result.total || tableData.value.length,
        rawData: result.data,
        filters: {
          fromWarehouse: props.fromWarehouse || [],
          toProvince: props.toProvince || [],
          toRdc: props.toRdc || [],
        },
      })
      console.log('[UrgentCustomer] Store updated, total:', result.total || tableData.value.length)
    }
  } catch (error) {
    console.error(t('dashboard.urgentCustomer.messages.fetchError'), error)
  }
}

// 加载下拉选项数据
const loadDropdownOptions = async () => {
  try {
    // 加载目的仓库
    const warehouseRes = await queryFromWarehouse()
    if (warehouseRes && warehouseRes.code === 200 && Array.isArray(warehouseRes.data)) {
      toWarehouseOptions.value = warehouseRes.data
    }

    // 加载风险列表
    const riskRes = await queryRiskList()
    if (riskRes && (riskRes.code === 0 || riskRes.code === 200) && Array.isArray(riskRes.data)) {
      riskOptions.value = riskRes.data.map((item: any) => ({
        label: item.name || item.label,
        value: item.code || item.value,
      }))
    }

    // 加载订单状态列表
    const orderStatusRes = await queryOrderStatusList()
    if (orderStatusRes && (orderStatusRes.code === 0 || orderStatusRes.code === 200) && Array.isArray(orderStatusRes.data)) {
      orderStatusOptions.value = orderStatusRes.data.map((item: any) => ({
        label: item.name || item.label,
        value: item.code || item.value,
      }))
    }
  } catch (error) {
    console.error('加载下拉选项数据失败:', error)
  }
}

// 构建查询参数的公共函数
const buildQueryParams = (page: number, pageSize: number) => {
  const startRow = page * pageSize

  const params: any = {
    page: page,
    pageSize: pageSize,
    startRow: startRow,
    queryType: 0,
    sortName: '',
    sortBy: '',
  }

  // 添加日期筛选条件
  if (filterForm.value.startDate && filterForm.value.endDate) {
    params.startDate = filterForm.value.startDate + ' 00:00:00'
    params.endDate = filterForm.value.endDate + ' 23:59:59'
  }

  // 客户订单号
  if (filterForm.value.customerOrderNo) {
    params.customerOrderNo = [filterForm.value.customerOrderNo]
  }

  // 目的仓库
  params.toWarehouse = filterForm.value.toWarehouse.length > 0
    ? filterForm.value.toWarehouse
    : []

  // 订单状态
  if (filterForm.value.orderStatus) {
    params.orderStatus = filterForm.value.orderStatus
  }

  // 风险
  params.risk = filterForm.value.risk.length > 0
    ? filterForm.value.risk
    : []

  // 签收状态
  if (filterForm.value.notSigned !== '') {
    params.isSign = filterForm.value.notSigned === '0'
  }

  // 其他字段
  params.fromProvince = []
  params.customer = []
  params.carrierName = []
  params.deliverName = []

  return params
}

// 获取弹窗详细数据
const fetchModalData = async (currentPageNum: number = currentPage.value) => {
  try {
    modalLoading.value = true

    const params = buildQueryParams(currentPageNum, pageSize.value)

    const result = await queryUrgentOrdersItemByPage(params)

    if (result && result.code === 200 && result.data) {
      total.value = result.total || 0

      if (Array.isArray(result.data)) {
        modalData.value = result.data
      } else if (result.data.list && Array.isArray(result.data.list)) {
        modalData.value = result.data.list
      } else if (result.data.records && Array.isArray(result.data.records)) {
        modalData.value = result.data.records
      } else {
        modalData.value = []
      }
    } else {
      modalData.value = []
      total.value = 0
    }
  } catch (error) {
    console.error('获取弹窗数据失败:', error)
    modalData.value = []
    total.value = 0
  } finally {
    modalLoading.value = false
  }
}

// 打开详情弹窗
const showDetailModal = () => {
  modalVisible.value = true
  currentPage.value = 1
  total.value = 0

  nextTick(() => {
    calculateModalTableScrollY()
  })

  filterForm.value = {
    startDate: '',
    endDate: '',
    notSigned: '1',
    customerOrderNo: '',
    toWarehouse: [],
    orderStatus: '',
    risk: [],
  }

  if (riskOptions.value.length === 0 || orderStatusOptions.value.length === 0) {
    loadDropdownOptions()
  }

  fetchModalData()
}

// 关闭弹窗
const handleModalClose = () => {
  modalVisible.value = false
  modalData.value = []
  currentPage.value = 1
  total.value = 0
}

// 处理弹窗内容区域点击
const handleModalBodyClick = (event: Event) => {
  const target = event.target as HTMLElement
  const isClickInsideDropdown =
    target.closest('.dropdown-item') ||
    target.closest('.dropdown-content') ||
    target.closest('.search-input') ||
    target.closest('.dropdown-option') ||
    target.closest('.done-btn')

  if (!isClickInsideDropdown) {
    closeAllDropdowns()
  }
}

// 处理分页变化
const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current
  pageSize.value = pagination.pageSize
  fetchModalData(pagination.current)
}

// 查询数据
const handleQuery = () => {
  currentPage.value = 1
  fetchModalData()
}

// 重置筛选条件
const handleReset = () => {
  filterForm.value = {
    startDate: '',
    endDate: '',
    notSigned: '1',
    customerOrderNo: '',
    toWarehouse: [],
    orderStatus: '',
    risk: [],
  }
  currentPage.value = 1
  fetchModalData()
}

// 导出功能
const handleExport = async () => {
  try {
    exportLoading.value = true

    const params = buildQueryParams(1, 10)

    const result = await exportUrgentOrdersItem(params)

    if (result.code === 409 || result.code === 504 || result.code === 505) {
      alert(result.msg || t('dashboard.urgentCustomer.messages.exportTooLarge'))
      return
    }

    if (result && result.data) {
      const url = typeof result.data === 'string' ? result.data : result.data.downloadUrl
      if (url) {
        const link = document.createElement('a')
        link.href = url
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    }
  } catch (error: any) {
    console.error('导出失败:', error)
    alert(error.msg || t('dashboard.urgentCustomer.messages.exportFailed'))
  } finally {
    exportLoading.value = false
  }
}

// 计算弹窗表格滚动高度
const calculateModalTableScrollY = () => {
  nextTick(() => {
    if (modalTableSectionRef.value) {
      const containerHeight = modalTableSectionRef.value.clientHeight
      const calculatedHeight = containerHeight > 300 ? containerHeight - 100 : 200
      modalTableScrollY.value = calculatedHeight
    }
  })
}

// 表格列配置
const tableColumns = computed(() => [
  { title: t('dashboard.urgentCustomer.tableColumns.dataSource'), dataIndex: 'dataSource', key: 'dataSource', width: 120 },
  { title: t('dashboard.urgentCustomer.tableColumns.orderStatus'), dataIndex: 'orderStatus', key: 'orderStatus', width: 120 },
  { title: t('dashboard.urgentCustomer.tableColumns.riskType'), dataIndex: 'riskType', key: 'riskType', width: 150 },
  { title: t('dashboard.urgentCustomer.tableColumns.riskInfo'), dataIndex: 'riskInfo', key: 'riskInfo', width: 150 },
  { title: t('dashboard.urgentCustomer.tableColumns.transType'), dataIndex: 'transTypeName', key: 'transTypeName', width: 120 },
  { title: t('dashboard.urgentCustomer.tableColumns.location'), dataIndex: 'location', key: 'location', width: 150 },
  { title: t('dashboard.urgentCustomer.tableColumns.actualTransNo'), dataIndex: 'actualTransNo', key: 'actualTransNo', width: 240 },
  { title: t('dashboard.urgentCustomer.tableColumns.customerOrderNo'), dataIndex: 'customerOrderNo', key: 'customerOrderNo', width: 150 },
  { title: t('dashboard.urgentCustomer.tableColumns.invoiceNo'), dataIndex: 'invoiceNo', key: 'invoiceNo', width: 150 },
  { title: t('dashboard.urgentCustomer.tableColumns.onTime'), dataIndex: 'onTime', key: 'onTime', width: 100 },
  { title: t('dashboard.urgentCustomer.tableColumns.predictArriveTime'), dataIndex: 'predictArriveTime', key: 'predictArriveTime', width: 180 },
  { title: t('dashboard.urgentCustomer.tableColumns.fromWarehouse'), dataIndex: 'fromWarehouse', key: 'fromWarehouse', width: 150 },
  { title: t('dashboard.urgentCustomer.tableColumns.toWarehouse'), dataIndex: 'toWarehouse', key: 'toWarehouse', width: 150 },
  { title: t('dashboard.urgentCustomer.tableColumns.carrierName'), dataIndex: 'carrierName', key: 'carrierName', width: 150 },
  { title: t('dashboard.urgentCustomer.tableColumns.deliveryName'), dataIndex: 'deliveryName', key: 'deliveryName', width: 150 },
  { title: t('dashboard.urgentCustomer.tableColumns.consignee'), dataIndex: 'consignee', key: 'consignee', width: 150 },
  { title: t('dashboard.urgentCustomer.tableColumns.consigneeAddress'), dataIndex: 'consigneeAddress', key: 'consigneeAddress', width: 200 },
  { title: t('dashboard.urgentCustomer.tableColumns.goodsCode'), dataIndex: 'goodsCode', key: 'goodsCode', width: 150 },
  { title: t('dashboard.urgentCustomer.tableColumns.goodsName'), dataIndex: 'goodsName', key: 'goodsName', width: 200 },
  { title: t('dashboard.urgentCustomer.tableColumns.goodsCount'), dataIndex: 'goodsCount', key: 'goodsCount', width: 120 },
  { title: t('dashboard.urgentCustomer.tableColumns.arrivalSignTime'), dataIndex: 'arrivalSignTime', key: 'arrivalSignTime', width: 180 },
  { title: t('dashboard.urgentCustomer.tableColumns.lastAbnormalCode'), dataIndex: 'lastAbnormalCode', key: 'lastAbnormalCode', width: 200 },
  { title: t('dashboard.urgentCustomer.tableColumns.cost'), dataIndex: 'cost', key: 'cost', width: 120 },
])

onMounted(() => {
  loadData()
  loadDropdownOptions()

  setTimeout(() => {
    startAutoScroll()
    startUrgentAutoScroll()
  }, 1000)
})

onUnmounted(() => {
  stopAutoScroll()
  stopUrgentAutoScroll()
})
</script>

<template>
  <div class="urgent-customer-wrapper">
    <div class="header-bar">
      <h2 class="header-title">{{ t('dashboard.urgentCustomer.title') }}</h2>
    </div>
    <div class="urgent-customer-container">
      <!-- 查看详情按钮 -->
      <div class="view-detail-button-wrapper">
        <button @click="showDetailModal" class="view-detail-btn">
          {{ t('dashboard.urgentCustomer.buttons.viewDetail') }}
        </button>
      </div>

      <!-- 数据表格 -->
      <div class="table-wrapper">
        <!-- 置顶的加急行 -->
        <div class="urgent-section">
          <table class="data-table urgent-table">
            <thead>
              <tr>
                <th>{{ t('dashboard.urgentCustomer.tableColumns.invoiceNo') }}</th>
                <th>{{ t('dashboard.urgentCustomer.tableColumns.transType') }}</th>
                <th>{{ t('dashboard.urgentCustomer.tableColumns.location') }}</th>
                <th>{{ t('dashboard.urgentCustomer.tableColumns.destProvince') }}</th>
                <th>{{ t('dashboard.urgentCustomer.tableColumns.predictArriveTime') }}</th>
                <th>{{ t('dashboard.urgentCustomer.tableColumns.riskInfo') }}</th>
              </tr>
            </thead>
          </table>
          <div
            class="urgent-table-container"
            ref="urgentTableContainer"
            @mouseenter="handleUrgentMouseEnter"
            @mouseleave="handleUrgentMouseLeave"
          >
            <table class="data-table urgent-table">
              <tbody>
                <tr v-if="urgentRows.length === 0 && normalRows.length === 0">
                  <td colspan="6" class="no-data">{{ t('dashboard.urgentCustomer.messages.noData') }}</td>
                </tr>
                <tr v-for="(row, index) in urgentRows" :key="`urgent-${index}`" class="urgent-row" v-else>
                  <td class="order-number" :title="`▲ ${row.invoiceNo}`">
                    ▲ {{ row.invoiceNo }}
                  </td>
                  <td class="trans-type-cell" :title="getTransTypeName(row.transType)">{{ getTransTypeName(row.transType) }}</td>
                  <td class="location-cell" :title="row.location">{{ row.location }}</td>
                  <td class="province-cell" :title="row.toProvince">{{ row.toProvince }}</td>
                  <td class="time-cell" :title="row.predictArriveTime">{{ row.predictArriveTime }}</td>
                  <td class="risk-cell" :title="`⚠ ${row.riskType || t('dashboard.urgentCustomer.messages.hasRisk')}`">
                    ⚠ {{ row.riskType || t('dashboard.urgentCustomer.messages.hasRisk') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 可滚动的普通行 -->
        <div
          class="table-container"
          ref="tableContainer"
          @mouseenter="handleMouseEnter"
          @mouseleave="handleMouseLeave"
        >
          <table class="data-table">
            <tbody>
              <tr v-if="urgentRows.length === 0 && normalRows.length === 0">
                <td colspan="6" class="no-data">{{ t('dashboard.urgentCustomer.messages.noData') }}</td>
              </tr>
              <tr v-for="(row, index) in normalRows" :key="`normal-${index}`" v-else>
                <td class="order-number" :title="row.invoiceNo">{{ row.invoiceNo }}</td>
                <td class="trans-type-cell" :title="getTransTypeName(row.transType)">{{ getTransTypeName(row.transType) }}</td>
                <td class="location-cell" :title="row.location">{{ row.location }}</td>
                <td class="province-cell" :title="row.toProvince">{{ row.toProvince }}</td>
                <td class="time-cell" :title="row.predictArriveTime">{{ row.predictArriveTime }}</td>
                <td class="risk-cell" :title="row.riskType || t('dashboard.urgentCustomer.messages.normal')">{{ row.riskType || t('dashboard.urgentCustomer.messages.normal') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 详情弹窗 -->
      <Teleport to="body">
        <div v-if="modalVisible" class="custom-modal-overlay" @click.self="handleModalClose">
          <div class="custom-modal">
            <!-- 弹窗头部 -->
            <div class="modal-header">
              <h3 class="modal-title">{{ modalTitle }}</h3>
              <button class="close-btn" @click="handleModalClose">×</button>
            </div>

            <!-- 弹窗内容 -->
            <div class="modal-body" @click="handleModalBodyClick">
              <!-- 筛选区域 -->
              <div class="filter-section">
                <div class="filter-form">
                  <!-- 日期范围 -->
                  <div class="filter-item">
                    <input
                      v-model="filterForm.startDate"
                      type="date"
                      class="date-input"
                      :placeholder="t('dashboard.urgentCustomer.filters.startDate')"
                    />
                    <span class="date-separator">{{ t('dashboard.urgentCustomer.filters.to') }}</span>
                    <input
                      v-model="filterForm.endDate"
                      type="date"
                      class="date-input"
                      :placeholder="t('dashboard.urgentCustomer.filters.endDate')"
                    />
                  </div>

                  <!-- 签收状态 -->
                  <div class="filter-item">
                    <div class="dropdown-item" :title="selectedNotSignedText" @click="toggleNotSignedDropdown">
                      <span class="dropdown-text">{{ selectedNotSignedText }}</span>
                      <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6,9 12,15 18,9"></polyline>
                      </svg>
                      <div class="dropdown-content" v-show="isNotSignedOpen" @click.stop>
                        <div class="options-list">
                          <div
                            v-for="option in notSignedOptions"
                            :key="option.value"
                            class="dropdown-option"
                            :class="{ selected: filterForm.notSigned === option.value }"
                            @click.stop="selectNotSigned(option.value)"
                          >
                            <span class="checkmark" v-if="filterForm.notSigned === option.value">✓</span>
                            {{ option.label }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 客户订单号 -->
                  <div class="filter-item">
                    <input
                      v-model="filterForm.customerOrderNo"
                      type="text"
                      :placeholder="t('dashboard.urgentCustomer.filters.customerOrderNo')"
                      class="customer-order-input"
                    />
                  </div>

                  <!-- 目的仓库 -->
                  <div class="filter-item">
                    <div class="dropdown-item" :title="selectedToWarehouseText" @click="toggleToWarehouseDropdown">
                      <span class="dropdown-text">{{ selectedToWarehouseText }}</span>
                      <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6,9 12,15 18,9"></polyline>
                      </svg>
                      <div class="dropdown-content" v-show="isToWarehouseOpen && toWarehouseOptions?.length" @click.stop>
                        <div class="search-box">
                          <input
                            v-model="toWarehouseSearch"
                            type="text"
                            :placeholder="t('dashboard.urgentCustomer.filters.searchWarehouse')"
                            class="search-input"
                            @click.stop
                          />
                        </div>
                        <div class="options-list">
                          <div
                            v-for="option in filteredToWarehouseOptions"
                            :key="option.value"
                            class="dropdown-option"
                            :class="{ selected: option.value !== '__reset__' && filterForm.toWarehouse.includes(option.value) }"
                            @click.stop="selectToWarehouse(option.value)"
                          >
                            <span class="checkmark" v-if="option.value !== '__reset__' && filterForm.toWarehouse.includes(option.value)">✓</span>
                            {{ option.label }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 订单状态 -->
                  <div class="filter-item">
                    <div class="dropdown-item" :title="selectedOrderStatusText" @click="toggleOrderStatusDropdown">
                      <span class="dropdown-text">{{ selectedOrderStatusText }}</span>
                      <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6,9 12,15 18,9"></polyline>
                      </svg>
                      <div class="dropdown-content" v-show="isOrderStatusOpen && orderStatusOptions?.length" @click.stop>
                        <div class="search-box">
                          <input
                            v-model="orderStatusSearch"
                            type="text"
                            :placeholder="t('dashboard.urgentCustomer.filters.searchStatus')"
                            class="search-input"
                            @click.stop
                          />
                        </div>
                        <div class="options-list">
                          <div
                            v-for="option in filteredOrderStatusOptions"
                            :key="option.value"
                            class="dropdown-option"
                            :class="{ selected: option.value !== '__reset__' && filterForm.orderStatus === option.value }"
                            @click.stop="selectOrderStatus(option.value)"
                          >
                            <span class="checkmark" v-if="option.value !== '__reset__' && filterForm.orderStatus === option.value">✓</span>
                            {{ option.label }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 风险类型 -->
                  <div class="filter-item">
                    <div class="dropdown-item" :title="selectedRiskText" @click="toggleRiskDropdown">
                      <span class="dropdown-text">{{ selectedRiskText }}</span>
                      <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6,9 12,15 18,9"></polyline>
                      </svg>
                      <div class="dropdown-content" v-show="isRiskOpen && riskOptions?.length" @click.stop>
                        <div class="search-box">
                          <input
                            v-model="riskSearch"
                            type="text"
                            :placeholder="t('dashboard.urgentCustomer.filters.searchRisk')"
                            class="search-input"
                            @click.stop
                          />
                        </div>
                        <div class="options-list">
                          <div
                            v-for="option in filteredRiskOptions"
                            :key="option.value"
                            class="dropdown-option"
                            :class="{ selected: option.value !== '__reset__' && filterForm.risk.includes(option.value) }"
                            @click.stop="selectRisk(option.value)"
                          >
                            <span class="checkmark" v-if="option.value !== '__reset__' && filterForm.risk.includes(option.value)">✓</span>
                            {{ option.label }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 操作按钮 -->
                  <div class="filter-actions">
                    <button @click="handleReset" class="action-btn">{{ t('dashboard.urgentCustomer.buttons.reset') }}</button>
                    <button @click="handleQuery" class="action-btn primary">{{ t('dashboard.urgentCustomer.buttons.query') }}</button>
                    <button @click="handleExport" class="action-btn" :disabled="exportLoading">
                      {{ exportLoading ? t('dashboard.urgentCustomer.buttons.exporting') : t('dashboard.urgentCustomer.buttons.export') }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- 表格区域 -->
              <div class="table-section" ref="modalTableSectionRef">
                <div v-if="modalLoading" class="loading-mask">{{ t('dashboard.urgentCustomer.messages.loading') }}</div>
                <table class="modal-table">
                  <thead>
                    <tr>
                      <th v-for="col in tableColumns" :key="col.key" :style="{ width: col.width + 'px' }">
                        {{ col.title }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in modalData" :key="row.id || row.invoiceNo">
                      <td v-for="col in tableColumns" :key="col.key">
                        <template v-if="col.dataIndex === 'onTime'">
                          {{ row[col.dataIndex] === true ? t('dashboard.urgentCustomer.tableColumns.yes') : row[col.dataIndex] === false ? t('dashboard.urgentCustomer.tableColumns.no') : '-' }}
                        </template>
                        <template v-else>
                          {{ row[col.dataIndex] || '-' }}
                        </template>
                      </td>
                    </tr>
                    <tr v-if="modalData.length === 0 && !modalLoading">
                      <td :colspan="tableColumns.length" class="empty-cell">{{ t('dashboard.urgentCustomer.messages.empty') }}</td>
                    </tr>
                  </tbody>
                </table>

                <!-- 分页 -->
                <div v-if="total > 0" class="pagination">
                  <span class="pagination-info">{{ t('dashboard.urgentCustomer.pagination.total', { total }) }}</span>
                  <div class="pagination-controls">
                    <button
                      class="page-btn"
                      :disabled="currentPage <= 1"
                      @click="handleTableChange({ current: currentPage - 1, pageSize })"
                    >{{ t('dashboard.urgentCustomer.pagination.prev') }}</button>
                    <span class="page-number">{{ currentPage }} / {{ Math.ceil(total / pageSize) }}</span>
                    <button
                      class="page-btn"
                      :disabled="currentPage >= Math.ceil(total / pageSize)"
                      @click="handleTableChange({ current: currentPage + 1, pageSize })"
                    >{{ t('dashboard.urgentCustomer.pagination.next') }}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<style scoped>
.urgent-customer-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header-bar {
  width: 100%;
  height: 1.8rem;
  flex-shrink: 0;
  background: url('/dashboard/images/title-bg.png') center/100% 100% no-repeat;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 1rem;
  padding-right: 1rem;
  position: relative;
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
}

.header-title {
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  margin: 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  z-index: 2;
  position: relative;
}

.urgent-customer-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.view-detail-button-wrapper {
  display: flex;
  justify-content: flex-end;
  padding: 0.5rem 0.75rem;
  flex-shrink: 0;
}

.view-detail-btn {
  padding: 4px 12px;
  background: linear-gradient(135deg, #4a9eff 0%, #3a8eef 100%);
  border: 1px solid rgba(74, 158, 255, 0.8);
  border-radius: 4px;
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 2px 8px rgba(74, 158, 255, 0.3);
  height: 24px;
  line-height: 1;
}

.view-detail-btn:hover {
  background: linear-gradient(135deg, #3a8eef 0%, #2a7edf 100%);
}

/* 表格包装器 */
.table-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* 置顶的加急行区域 */
.urgent-section {
  flex-shrink: 0;
  padding: 0 0 0.75rem 0.75rem;
  display: flex;
  flex-direction: column;
}

.urgent-table-container {
  max-height: calc(1.5rem * 3);
  overflow-y: auto;
  overflow-x: hidden;
}

.urgent-table {
  width: 100%;
  border-collapse: collapse;
  color: white;
  font-size: 0.5rem;
  table-layout: fixed;
}

.urgent-table thead th {
  padding: 0.375rem 0.25rem;
  vertical-align: middle;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  border-bottom: 1px solid rgba(74, 158, 255, 0.3);
  background: rgba(0, 0, 0, 0.2);
  font-size: 0.5rem;
}

.urgent-table thead th:nth-child(1) { width: 18%; }
.urgent-table thead th:nth-child(2) { width: 12%; }
.urgent-table thead th:nth-child(3) { width: 16%; }
.urgent-table thead th:nth-child(4) { width: 12%; }
.urgent-table thead th:nth-child(5) { width: 24%; }
.urgent-table thead th:nth-child(6) { width: 18%; }

.urgent-table tbody tr {
  border-bottom: 1px solid rgba(74, 158, 255, 0.1);
  transition: background 0.2s ease;
}

.urgent-table tbody tr:hover {
  background: rgba(74, 158, 255, 0.1);
}

.urgent-table tbody td {
  padding: 0.375rem 0.25rem;
  vertical-align: middle;
}

/* 可滚动的普通行容器 */
.table-container {
  flex: 1;
  overflow: auto;
  padding: 0 0 0.75rem 0.75rem;
  scroll-behavior: smooth;
}

.table-container .data-table {
  height: 100%;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  color: white;
  font-size: 0.5rem;
  table-layout: fixed;
}

.data-table tbody tr {
  border-bottom: 1px solid rgba(74, 158, 255, 0.1);
  transition: background 0.2s ease;
}

.data-table tbody tr:hover {
  background: rgba(74, 158, 255, 0.1);
}

.data-table tbody td {
  padding: 0.375rem 0.25rem;
  vertical-align: middle;
}

.order-number {
  width: 18%;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trans-type-cell {
  text-align: center;
  width: 12%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.location-cell {
  text-align: center;
  width: 16%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.province-cell {
  text-align: center;
  width: 12%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time-cell {
  text-align: center;
  width: 24%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-cell {
  text-align: center;
  width: 18%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #51cf66;
}

.urgent-row .risk-cell {
  color: #ff6b6b;
}

.no-data {
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  padding: 2rem;
  font-style: italic;
}

/* 弹窗样式 */
.custom-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.custom-modal {
  width: 90%;
  max-width: 1400px;
  height: 85vh;
  background: #0a1929;
  border: 1px solid rgba(74, 158, 255, 0.3);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(74, 158, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(180deg, rgba(74, 158, 255, 0.1) 0%, transparent 100%);
}

.modal-title {
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.close-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.3s;
}

.close-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.modal-body {
  flex: 1;
  padding: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 筛选区域 */
.filter-section {
  margin-bottom: 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(74, 158, 255, 0.3);
  border-radius: 8px;
  padding: 16px;
  position: relative;
  z-index: 10;
  flex-shrink: 0;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-input {
  width: 140px;
  height: 1.8rem;
  padding: 0 0.4rem;
  background: #081f40;
  border: 0.0625rem solid rgba(59, 130, 246, 0.6);
  border-radius: 0.2rem;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.7rem;
  outline: none;
}

.date-separator {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.7rem;
}

.customer-order-input {
  width: 140px;
  height: 1.8rem;
  padding: 0 0.4rem;
  background: #081f40;
  border: 0.0625rem solid rgba(59, 130, 246, 0.6);
  border-radius: 0.2rem;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.7rem;
  outline: none;
}

.customer-order-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.dropdown-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  padding: 0.25rem 0.4rem;
  background: #081f40;
  border: 0.0625rem solid rgba(59, 130, 246, 0.6);
  border-radius: 0.2rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 140px;
  height: 1.8rem;
  min-height: 1.8rem;
  z-index: 100;
}

.dropdown-item:hover {
  color: white;
}

.dropdown-icon {
  width: 0.5rem;
  height: 0.5rem;
  color: rgba(255, 255, 255, 0.7);
}

.dropdown-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.dropdown-content {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #081f40;
  border: 0.0625rem solid rgba(59, 130, 246, 0.6);
  border-radius: 0.15rem;
  box-shadow: 0 0.1rem 0.4rem rgba(0, 0, 0, 0.2);
  z-index: 1000;
  margin-top: 0.05rem;
  min-width: 5rem;
  max-width: 15rem;
}

.search-box {
  padding: 0.2rem;
  border-bottom: 0.0625rem solid rgba(59, 130, 246, 0.3);
}

.search-input {
  width: 100%;
  padding: 0.15rem 0.3rem;
  background: rgba(0, 0, 0, 0.3);
  border: 0.0625rem solid rgba(59, 130, 246, 0.4);
  border-radius: 0.125rem;
  color: white;
  font-size: 0.65rem;
  outline: none;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.options-list {
  max-height: 6rem;
  position: relative;
  overflow: hidden;
  overflow-y: auto;
}

.dropdown-option {
  padding: 0.12rem 0.3rem;
  color: white;
  font-size: 0.65rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  line-height: 1.1;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.dropdown-option:hover {
  background: rgba(59, 130, 246, 0.3);
}

.dropdown-option.selected {
  background: rgba(59, 130, 246, 0.5);
  color: #60a5fa;
}

.checkmark {
  color: #00ff88;
  font-weight: bold;
  font-size: 0.8rem;
}

.filter-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.action-btn {
  height: 1.6rem;
  padding: 0 12px;
  background: #2873cc;
  border-radius: 4px;
  border: none;
  color: white;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.action-btn:hover:not(:disabled) {
  background: #1e6cc8;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn.primary {
  background: linear-gradient(135deg, #4a9eff 0%, #3a8eef 100%);
}

/* 表格区域 */
.table-section {
  flex: 1;
  overflow: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
}

.loading-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
  z-index: 10;
}

.modal-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.modal-table th,
.modal-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
  white-space: nowrap;
}

.modal-table th {
  background: rgba(74, 158, 255, 0.1);
  color: #a0c4ff;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 1;
}

.modal-table td {
  color: rgba(255, 255, 255, 0.8);
}

.modal-table tr:hover td {
  background: rgba(74, 158, 255, 0.05);
}

.empty-cell {
  text-align: center !important;
  padding: 40px !important;
  color: rgba(255, 255, 255, 0.5);
}

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(74, 158, 255, 0.05);
  border-top: 1px solid rgba(74, 158, 255, 0.2);
  flex-shrink: 0;
}

.pagination-info {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-btn {
  padding: 6px 12px;
  background: #2873cc;
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
}

.page-btn:hover:not(:disabled) {
  background: #1e6cc8;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-number {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
}

/* 滚动条样式 */
.table-container::-webkit-scrollbar,
.urgent-table-container::-webkit-scrollbar {
  width: 6px;
}

.table-container::-webkit-scrollbar-track,
.urgent-table-container::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.table-container::-webkit-scrollbar-thumb {
  background: rgba(74, 158, 255, 0.6);
  border-radius: 3px;
}

.urgent-table-container::-webkit-scrollbar-thumb {
  background: rgba(255, 107, 107, 0.6);
  border-radius: 3px;
}

.table-section::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.table-section::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.table-section::-webkit-scrollbar-thumb {
  background: rgba(74, 158, 255, 0.4);
  border-radius: 4px;
}
</style>
