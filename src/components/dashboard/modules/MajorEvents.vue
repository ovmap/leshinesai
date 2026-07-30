<script setup lang="ts">
import { ref, onMounted, onUnmounted, Teleport, computed, nextTick, watch } from 'vue'
import {
  queryTrafficInfo,
  queryAffectOrderItemByPage,
  exportAffectOrderItem,
  queryFromWarehouse,
} from '../../../services/transportApi'

const props = defineProps<{
  fromWarehouse?: string[]
  toProvince?: string[]
  toRdc?: string[]
}>()

// 定义表格数据类型
interface TableDataItem {
  id: number
  roadSection: string
  impact: string
  affectedOrders: number
}

// 表格数据
const tableData = ref<TableDataItem[]>([])

// 弹窗相关状态
const isModalVisible = ref(false)
const modalLoading = ref(false)
const exportLoading = ref(false)
const unsignedDetailData = ref<any[]>([])
const totalCount = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)

// 表格容器引用和高度
const modalTableSectionRef = ref<HTMLElement | null>(null)
const modalTableScrollY = ref<number | undefined>(200)

// 搜索表单数据
const searchForm = ref({
  fromWarehouse: [] as string[],
  invoiceNo: '',
  startDate: '',
  endDate: '',
})

// 下拉框开关状态
const isFromWarehouseOpen = ref(false)

// 搜索关键词
const warehouseSearch = ref('')

// 下拉框选项数据
const warehouseOptions = ref<string[]>([])

// 下拉框开关方法
const toggleFromWarehouseDropdown = () => {
  if (isFromWarehouseOpen.value) {
    isFromWarehouseOpen.value = false
    warehouseSearch.value = ''
  } else {
    closeAllDropdowns()
    isFromWarehouseOpen.value = true
    warehouseSearch.value = ''
  }
}

// 关闭所有下拉框
const closeAllDropdowns = () => {
  isFromWarehouseOpen.value = false
  warehouseSearch.value = ''
}

// 选择方法
const selectFromWarehouse = (value: string) => {
  if (value === '__reset__') {
    searchForm.value.fromWarehouse = []
    warehouseSearch.value = ''
    return
  }

  const index = searchForm.value.fromWarehouse.indexOf(value)
  if (index > -1) {
    searchForm.value.fromWarehouse.splice(index, 1)
  } else {
    searchForm.value.fromWarehouse.push(value)
  }
}

// 显示文本
const selectedFromWarehouseText = computed(() => {
  if (searchForm.value.fromWarehouse.length === 0) return '始发仓库'
  if (searchForm.value.fromWarehouse.length === 1) return searchForm.value.fromWarehouse[0]
  return `已选${searchForm.value.fromWarehouse.length}项`
})

// 过滤后的选项
const filteredWarehouseOptions = computed(() => {
  let filtered = warehouseOptions.value
  if (warehouseSearch.value.trim()) {
    filtered = warehouseOptions.value.filter((option) =>
      option.toLowerCase().includes(warehouseSearch.value.toLowerCase()),
    )
  }
  return [{ value: '__reset__', label: '重置' }, ...filtered.map(o => ({ value: o, label: o }))]
})

// 获取交通信息数据
const fetchTrafficInfo = async () => {
  try {
    const response = await queryTrafficInfo()
    if (response.code === 200 && response.data) {
      tableData.value = response.data.map((item: any, index: number) => ({
        id: index + 1,
        roadSection: item.city ? `${item.province}/${item.city}` : item.province,
        impact: item.desc,
        affectedOrders: item.affectOrderCount,
      }))
    }
  } catch (error) {
    console.error('获取重大活动数据失败:', error)
  }
}

// 自动滚动相关
const tableContainer = ref<HTMLDivElement | null>(null)
let scrollTimer: ReturnType<typeof setTimeout> | null = null
let isScrolling = ref(false)
let currentScrollPosition = ref(0)

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

// 查看影响运单
const viewAffectedOrders = async () => {
  isModalVisible.value = true

  searchForm.value = {
    fromWarehouse: [],
    invoiceNo: '',
    startDate: '',
    endDate: '',
  }

  currentPage.value = 1

  nextTick(() => {
    calculateModalTableScrollY()
  })

  await fetchUnsignedDetails()
}

// 获取未签明细数据
const fetchUnsignedDetails = async () => {
  try {
    modalLoading.value = true

    const params: any = {
      page: currentPage.value,
      pageSize: pageSize.value,
      sortName: 'deliverTime',
      sortBy: 'desc',
      fromWarehouse: searchForm.value.fromWarehouse.length > 0 ? searchForm.value.fromWarehouse : [],
      invoiceNo: searchForm.value.invoiceNo || '',
    }

    if (searchForm.value.startDate && searchForm.value.endDate) {
      params.startDate = searchForm.value.startDate + ' 00:00:00'
      params.endDate = searchForm.value.endDate + ' 23:59:59'
    }

    const response = await queryAffectOrderItemByPage(params)

    if (response && response.code === 200 && response.data) {
      unsignedDetailData.value = response.data
      totalCount.value = response.total || 0
    } else {
      unsignedDetailData.value = []
      totalCount.value = 0
    }
  } catch (error) {
    console.error('获取影响运单数据失败:', error)
    unsignedDetailData.value = []
    totalCount.value = 0
  } finally {
    modalLoading.value = false
  }
}

// 搜索
const handleSearch = () => {
  currentPage.value = 1
  fetchUnsignedDetails()
}

// 重置搜索
const handleReset = () => {
  searchForm.value = {
    fromWarehouse: [],
    invoiceNo: '',
    startDate: '',
    endDate: '',
  }
  currentPage.value = 1
  fetchUnsignedDetails()
}

// 导出功能
const handleExport = async () => {
  try {
    exportLoading.value = true

    const params: any = {
      page: 1,
      pageSize: 10000,
      sortName: 'deliverTime',
      sortBy: 'desc',
      fromWarehouse: searchForm.value.fromWarehouse.length > 0 ? searchForm.value.fromWarehouse : [],
      invoiceNo: searchForm.value.invoiceNo || '',
    }

    if (searchForm.value.startDate && searchForm.value.endDate) {
      params.startDate = searchForm.value.startDate + ' 00:00:00'
      params.endDate = searchForm.value.endDate + ' 23:59:59'
    }

    const result = await exportAffectOrderItem(params)

    if (result.code === 409 || result.code === 504 || result.code === 505) {
      alert(result.msg || '导出数据量过大')
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
    console.error(error)
    alert(error.msg || '导出失败')
  } finally {
    exportLoading.value = false
  }
}

// 处理分页变化
const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current
  pageSize.value = pagination.pageSize
  fetchUnsignedDetails()
}

// 关闭弹窗
const closeModal = () => {
  isModalVisible.value = false
  unsignedDetailData.value = []
  totalCount.value = 0
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
const tableColumns = [
  { title: '始发仓库', dataIndex: 'fromWarehouse', key: 'fromWarehouse', width: 120 },
  { title: '目的仓库', dataIndex: 'toWarehouse', key: 'toWarehouse', width: 120 },
  { title: '物流商', dataIndex: 'logisticName', key: 'logisticName', width: 100 },
  { title: '发货单号', dataIndex: 'invoiceNo', key: 'invoiceNo', width: 200 },
  { title: '发货时间', dataIndex: 'deliverTime', key: 'deliverTime', width: 150 },
  { title: '预计到达时间', dataIndex: 'predictArriveTime', key: 'predictArriveTime', width: 150 },
  { title: '运输方式', dataIndex: 'transType', key: 'transType', width: 100 },
  { title: '数据源', dataIndex: 'dataSource', key: 'dataSource', width: 100 },
]

onMounted(async () => {
  await fetchTrafficInfo()

  // 加载仓库选项
  const warehouseRes = await queryFromWarehouse()
  if (warehouseRes && warehouseRes.code === 200 && Array.isArray(warehouseRes.data)) {
    warehouseOptions.value = warehouseRes.data
  }

  setTimeout(() => {
    startAutoScroll()
  }, 1000)
})

onUnmounted(() => {
  stopAutoScroll()
})
</script>

<template>
  <div class="major-events-wrapper">
    <div class="header-bar">
      <h2 class="header-title">重大活动&极端天气影响</h2>
    </div>
    <div class="major-events-container">
      <!-- 数据表格 -->
      <div class="table-wrapper">
        <!-- 固定的表头 -->
        <div class="table-header">
          <table class="data-table">
            <thead>
              <tr>
                <th>路段/区域</th>
                <th>影响</th>
                <th>订单数</th>
                <th>影响运单</th>
              </tr>
            </thead>
          </table>
        </div>

        <!-- 可滚动的表格内容 -->
        <div
          class="table-container"
          ref="tableContainer"
          @mouseenter="handleMouseEnter"
          @mouseleave="handleMouseLeave"
        >
          <table class="data-table">
            <tbody>
              <tr v-if="tableData.length === 0">
                <td colspan="4" class="no-data">暂无重大活动</td>
              </tr>
              <tr v-for="row in tableData" :key="row.id" v-else>
                <td class="road-section">{{ row.roadSection }}</td>
                <td class="impact">{{ row.impact }}</td>
                <td class="order-count">{{ row.affectedOrders }}</td>
                <td class="affected-orders">
                  <button @click="viewAffectedOrders" class="view-btn">查看</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 影响运单详情弹窗 -->
      <Teleport to="body">
        <div v-if="isModalVisible" class="custom-modal-overlay" @click.self="closeModal">
          <div class="custom-modal">
            <!-- 弹窗头部 -->
            <div class="modal-header">
              <h3 class="modal-title">影响运单详情</h3>
              <button class="close-btn" @click="closeModal">×</button>
            </div>

            <!-- 弹窗内容 -->
            <div class="modal-body" @click="handleModalBodyClick">
              <!-- 筛选区域 -->
              <div class="filter-section">
                <div class="filter-form">
                  <!-- 始发仓库 -->
                  <div class="filter-item">
                    <div class="dropdown-item" :title="selectedFromWarehouseText" @click="toggleFromWarehouseDropdown">
                      <span class="dropdown-text">{{ selectedFromWarehouseText }}</span>
                      <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6,9 12,15 18,9"></polyline>
                      </svg>
                      <div class="dropdown-content" v-show="isFromWarehouseOpen && warehouseOptions?.length" @click.stop>
                        <div class="search-box">
                          <input
                            v-model="warehouseSearch"
                            type="text"
                            placeholder="搜索仓库..."
                            class="search-input"
                            @click.stop
                          />
                        </div>
                        <div class="options-list">
                          <div
                            v-for="option in filteredWarehouseOptions"
                            :key="option.value"
                            class="dropdown-option"
                            :class="{ selected: searchForm.fromWarehouse.includes(option.value) }"
                            @click.stop="selectFromWarehouse(option.value)"
                          >
                            <span class="checkmark" v-if="searchForm.fromWarehouse.includes(option.value)">✓</span>
                            {{ option.label }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 发货单号 -->
                  <div class="filter-item">
                    <input
                      v-model="searchForm.invoiceNo"
                      type="text"
                      placeholder="发货单号"
                      class="invoice-input"
                    />
                  </div>

                  <!-- 日期范围 -->
                  <div class="filter-item">
                    <input
                      v-model="searchForm.startDate"
                      type="date"
                      class="date-input"
                      placeholder="开始日期"
                    />
                    <span class="date-separator">至</span>
                    <input
                      v-model="searchForm.endDate"
                      type="date"
                      class="date-input"
                      placeholder="结束日期"
                    />
                  </div>

                  <!-- 操作按钮 -->
                  <div class="filter-actions">
                    <button @click="handleSearch" class="action-btn primary">查询</button>
                    <button @click="handleReset" class="action-btn">重置</button>
                    <button @click="handleExport" class="action-btn" :disabled="exportLoading">
                      {{ exportLoading ? '导出中...' : '导出' }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- 表格区域 -->
              <div class="table-section" ref="modalTableSectionRef">
                <div v-if="modalLoading" class="loading-mask">加载中...</div>
                <table class="modal-table">
                  <thead>
                    <tr>
                      <th v-for="col in tableColumns" :key="col.key" :style="{ width: col.width + 'px' }">
                        {{ col.title }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in unsignedDetailData" :key="row.id || row.invoiceNo">
                      <td v-for="col in tableColumns" :key="col.key">{{ row[col.dataIndex] || '-' }}</td>
                    </tr>
                    <tr v-if="unsignedDetailData.length === 0 && !modalLoading">
                      <td :colspan="tableColumns.length" class="empty-cell">暂无数据</td>
                    </tr>
                  </tbody>
                </table>

                <!-- 分页 -->
                <div v-if="totalCount > 0" class="pagination">
                  <span class="pagination-info">共 {{ totalCount }} 条</span>
                  <div class="pagination-controls">
                    <button
                      class="page-btn"
                      :disabled="currentPage <= 1"
                      @click="handleTableChange({ current: currentPage - 1, pageSize })"
                    >上一页</button>
                    <span class="page-number">{{ currentPage }} / {{ Math.ceil(totalCount / pageSize) }}</span>
                    <button
                      class="page-btn"
                      :disabled="currentPage >= Math.ceil(totalCount / pageSize)"
                      @click="handleTableChange({ current: currentPage + 1, pageSize })"
                    >下一页</button>
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
.major-events-wrapper {
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

.major-events-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 表格包装器 */
.table-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* 固定的表头区域 */
.table-header {
  flex-shrink: 0;
  z-index: 10;
  position: relative;
  padding-right: 8px;
  box-sizing: border-box;
}

.table-header .data-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.table-header thead th {
  padding: 0.375rem 0.25rem;
  text-align: center;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  border-bottom: 1px solid rgba(74, 158, 255, 0.3);
  background: rgba(0, 0, 0, 0.2);
  font-size: 0.6rem;
}

.table-header thead th:nth-child(1) { width: 20%; }
.table-header thead th:nth-child(2) { width: 45%; }
.table-header thead th:nth-child(3) { width: 15%; }
.table-header thead th:nth-child(4) { width: 20%; }

/* 可滚动的表格内容容器 */
.table-container {
  flex: 1;
  overflow: auto;
  scroll-behavior: smooth;
  min-height: 0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  color: white;
  font-size: 0.6rem;
  table-layout: fixed;
}

.table-container tbody tr {
  border-bottom: 1px solid rgba(74, 158, 255, 0.1);
  transition: background 0.2s ease;
}

.table-container tbody tr:hover {
  background: rgba(74, 158, 255, 0.1);
}

.table-container tbody td {
  padding: 0.375rem 0.25rem;
  vertical-align: middle;
  text-align: center;
}

.table-container tbody td:nth-child(1) { width: 20%; }
.table-container tbody td:nth-child(2) { width: 45%; }
.table-container tbody td:nth-child(3) { width: 15%; }
.table-container tbody td:nth-child(4) { width: 20%; }

.road-section {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.4;
  text-align: center;
}

.impact {
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.5;
  word-wrap: break-word;
  word-break: break-all;
  text-align: left !important;
}

.order-count {
  font-weight: 600;
  color: #FFC633;
  line-height: 1.4;
  text-align: center;
}

.affected-orders {
  text-align: center;
  padding-right: 0.5rem;
}

.view-btn {
  background: #4A9EFF;
  color: white;
  border: none;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.55rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: 12px;
}

.view-btn:hover {
  background: #3A8EFF;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(74, 158, 255, 0.3);
}

.view-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(74, 158, 255, 0.2);
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
  max-width: 1200px;
  height: 80vh;
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

.invoice-input {
  width: 200px;
  height: 1.8rem;
  padding: 0 0.4rem;
  background: #081f40;
  border: 0.0625rem solid rgba(59, 130, 246, 0.6);
  border-radius: 0.2rem;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.7rem;
  outline: none;
}

.invoice-input::placeholder {
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
.table-container::-webkit-scrollbar {
  width: 4px;
}

.table-container::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}

.table-container::-webkit-scrollbar-thumb {
  background: rgba(74, 158, 255, 0.3);
  border-radius: 2px;
}

.table-container::-webkit-scrollbar-thumb:hover {
  background: rgba(74, 158, 255, 0.5);
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
