<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import { queryConfirmInTimeRate, exportConfirmInTimeRate, queryLogisticList } from '../../../services/transportApi'
import { useGlobalFilterStore } from '../../../stores/globalFilterStore'
import { useDashboardDataStore } from '../../../stores/dashboardDataStore'

const globalFilterStore = useGlobalFilterStore()
const dataStore = useDashboardDataStore()

// 物流商相关（多选）
const selectedLogistic = ref<string[]>([])
const isLogisticOpen = ref(false)
const logisticOptions = ref<{ value: string; label: string }[]>([])
const logisticSearch = ref('')

// 计算默认日期范围：当前月份往前2个月
const getDefaultDateRange = () => {
  const now = dayjs()
  const startDate = now.subtract(2, 'month').startOf('month')
  const endDate = now.endOf('month')
  return [startDate, endDate]
}

// 日期范围
const dateRange = ref<any[]>(getDefaultDateRange())

// 表格数据
const tableData = ref<
  Array<{
    fromwarehouse: string
    logisticName: string
    year: number
    month: number
    confirmTotal: number
    nonCompliantOrderCount: number
    confirmInTimeRate: number | string
  }>
>([])

// 加载状态
const loading = ref(false)
// 导出状态
const exportLoading = ref(false)

// 过滤后的物流商选项
const filteredLogisticOptions = computed(() => {
  const filtered = logisticOptions.value.filter((option) =>
    option.label.toLowerCase().includes(logisticSearch.value.toLowerCase()),
  )
  // 在列表开头添加重置选项
  return [{ value: '__reset__', label: '重置' }, ...filtered]
})

// 显示文本
const selectedLogisticText = computed(() => {
  if (!selectedLogistic.value || selectedLogistic.value.length === 0) return '物流商'

  const selectedLabels = selectedLogistic.value
    .map(value => {
      const option = logisticOptions.value.find(item => item.value === value)
      return option ? option.label : ''
    })
    .filter(label => label)

  if (selectedLabels.length === 0) return '物流商'
  if (selectedLabels.length === 1) return selectedLabels[0]
  return `已选择${selectedLabels.length}个`
})

// 下拉框开关方法
const toggleLogisticDropdown = () => {
  if (isLogisticOpen.value) {
    closeAllDropdowns()
  } else {
    closeAllDropdowns()
    isLogisticOpen.value = true
    logisticSearch.value = ''
  }
}

// 关闭所有下拉框
const closeAllDropdowns = () => {
  isLogisticOpen.value = false
  logisticSearch.value = ''
}

// 选择方法
const selectLogistic = (value: string) => {
  if (value === '__reset__') {
    // 重置选择
    selectedLogistic.value = []
    logisticSearch.value = ''
    return
  }

  // 多选逻辑：如果已选中则取消，否则添加
  const index = selectedLogistic.value.indexOf(value)
  if (index > -1) {
    selectedLogistic.value = selectedLogistic.value.filter((_, i) => i !== index)
  } else {
    selectedLogistic.value = [...selectedLogistic.value, value]
  }
}

// 获取物流商列表
const fetchLogisticList = async () => {
  try {
    const result = await queryLogisticList()
    if (result && (result.code === 0 || result.code === 200) && Array.isArray(result.data)) {
      logisticOptions.value = result.data
        .filter((item: any) => item && item.code && item.name)
        .map((item: any) => ({
          value: item.code,
          label: item.name
        }))
    }
  } catch (error) {
    console.error('加载物流商列表失败:', error)
  }
}

// 加载数据
const loadData = async () => {
  try {
    loading.value = true

    const startDate = dateRange.value[0]
      ? dateRange.value[0]
          .startOf('month')
          .startOf('day')
          .format('YYYY-MM-DD HH:mm:ss')
      : dayjs()
          .subtract(2, 'month')
          .startOf('month')
          .startOf('day')
          .format('YYYY-MM-DD HH:mm:ss')
    const endDate = dateRange.value[1]
      ? dateRange.value[1]
          .endOf('month')
          .endOf('day')
          .format('YYYY-MM-DD HH:mm:ss')
      : dayjs().endOf('month').endOf('day').format('YYYY-MM-DD HH:mm:ss')

    const params = {
      startDate,
      endDate,
      fromWarehouse: globalFilterStore.selectedWarehouse,
      toProvince: globalFilterStore.selectedProvince,
      logisticName: selectedLogistic.value.length > 0 ? selectedLogistic.value : [],
    }

    const result = await queryConfirmInTimeRate(params)
    if (result && result.code === 200 && result.data) {
      dataStore.updateModuleData('orderRate', result.data)
      // 处理返回的数据
      if (Array.isArray(result.data)) {
        tableData.value = result.data.map((item: any) => ({
          fromwarehouse: item.fromwarehouse || item.fromWarehouse || item.warehouse || item.warehouseName || '',
          logisticName: item.logisticName || item.logistic || '',
          year: item.year || new Date().getFullYear(),
          month: item.month || new Date().getMonth() + 1,
          confirmTotal: item.confirmTotal || 0,
          nonCompliantOrderCount: item.nonCompliantOrderCount || 0,
          confirmInTimeRate: item.confirmInTimeRate || 0,
        }))
      } else {
        tableData.value = []
      }
    } else {
      tableData.value = []
    }
  } catch (error) {
    console.error('加载返单及时率数据失败:', error)
    tableData.value = []
  } finally {
    loading.value = false
  }
}

// 格式化返单及时率显示
const formatRate = (rate: number | string): string => {
  if (rate === null || rate === undefined) return '0%'
  const numRate = typeof rate === 'string' ? parseFloat(rate) : rate
  if (isNaN(numRate)) return '0%'
  return `${numRate.toFixed(2)}%`
}

// 监听全局筛选变化
watch(
  () => [globalFilterStore.selectedWarehouse, globalFilterStore.selectedProvince],
  () => {
    loadData()
  },
  { deep: true }
)

// 导出数据
const handleExport = async () => {
  if (!dateRange.value || !dateRange.value[0] || !dateRange.value[1]) {
    message.warning('请选择日期范围')
    return
  }

  try {
    exportLoading.value = true

    const startDate = dateRange.value[0]
      ? dateRange.value[0]
          .startOf('month')
          .startOf('day')
          .format('YYYY-MM-DD HH:mm:ss')
      : dayjs()
          .subtract(2, 'month')
          .startOf('month')
          .startOf('day')
          .format('YYYY-MM-DD HH:mm:ss')
    const endDate = dateRange.value[1]
      ? dateRange.value[1]
          .endOf('month')
          .endOf('day')
          .format('YYYY-MM-DD HH:mm:ss')
      : dayjs().endOf('month').endOf('day').format('YYYY-MM-DD HH:mm:ss')

    const params = {
      startDate,
      endDate,
      fromWarehouse: globalFilterStore.selectedWarehouse,
      toProvince: globalFilterStore.selectedProvince,
      logisticName: selectedLogistic.value.length > 0 ? selectedLogistic.value : [],
    }

    // 调用 exportConfirmInTimeRate 获取下载链接
    const result = await exportConfirmInTimeRate(params)

    // 处理导出结果
    if (result && result.code === 200) {
      // 如果返回的是文件流，创建下载链接
      if (result.data) {
        const link = document.createElement('a')
        link.href = result.data
        const xlsxMatch = result.data.match(/([^/]+\.xlsx)$/)
        const downloadFilename = xlsxMatch ? xlsxMatch[1] : `返单及时率导出汇总_${dateRange.value[0].format('YYYY-MM')}_${dateRange.value[1].format('YYYY-MM')}.xlsx`

        link.download = downloadFilename
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        message.success('导出汇总成功')
      }
    } else {
      console.error('导出汇总失败:', result?.message || '未知错误')
      message.error(result?.message || '导出汇总失败')
    }
  } catch (error: any) {
    console.error('导出汇总失败:', error)

    // 检查是否是409或504状态码
    const errCode = error?.code || error?.response?.status
    if (errCode === 409 || errCode === 504 || errCode === 505) {
      message.error(error.msg || '导出数据量过大，请缩小查询范围')
    } else {
      message.error(error.msg || '导出汇总失败')
    }
  } finally {
    exportLoading.value = false
  }
}

// 全局点击处理
const handleGlobalClick = (e: Event) => {
  const target = e.target as HTMLElement
  if (!target.closest('.dropdown-group')) {
    closeAllDropdowns()
  }
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClick)
  fetchLogisticList()
  loadData()
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick)
})
</script>

<template>
  <div class="order-rate-container">
    <!-- 标题栏 -->
    <div class="header-bar">
      <h2 class="header-title">返单及时率</h2>
    </div>

    <!-- 筛选器和操作按钮 -->
    <div class="header-section">
      <div class="filters-group">
        <!-- 日期选择器 -->
        <div class="date-picker-wrapper">
          <a-range-picker
            v-model:value="dateRange"
            format="YYYY-MM-DD"
            separator="至"
            class="date-range-picker"
            :show-time="false"
          />
        </div>

        <!-- 物流商下拉框（多选） -->
        <div class="dropdown-group">
          <div class="dropdown-item" :title="selectedLogisticText" @click="toggleLogisticDropdown">
            <span class="dropdown-text">{{ selectedLogisticText }}</span>
            <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
            <div class="dropdown-content" v-show="isLogisticOpen && logisticOptions?.length" @click.stop>
              <div class="search-box">
                <input v-model="logisticSearch" type="text" placeholder="搜索物流商..." class="search-input"
                  @click.stop />
              </div>
              <div class="options-list">
                <div v-for="option in filteredLogisticOptions" :key="option.value" class="dropdown-option"
                  :class="{ 'selected': selectedLogistic.includes(option.value) }" @click.stop="selectLogistic(option.value)">
                  <span class="checkmark" v-if="selectedLogistic.includes(option.value)">&#10003;</span>
                  {{ option.label }}
                </div>
                <div v-if="filteredLogisticOptions.length === 1 && logisticSearch" class="no-results">
                  无搜索结果
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <button class="action-btn search-btn" @click="loadData" :disabled="loading">
          {{ loading ? '搜索中...' : '搜索' }}
        </button>
        <button class="action-btn" @click="handleExport" :disabled="exportLoading">
          {{ exportLoading ? '导出中...' : '导出' }}
        </button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="table-wrapper">
      <div class="table-container">
        <!-- 加载遮罩 -->
        <div v-if="loading" class="loading-overlay">
          <div class="loading-spinner"></div>
        </div>

        <table v-if="tableData.length > 0" class="data-table">
          <thead>
            <tr>
              <th>仓库</th>
              <th>物流商</th>
              <th>年份</th>
              <th>月份</th>
              <th>返单总数</th>
              <th>不及时订单数</th>
              <th>返单及时率</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in tableData" :key="index">
              <td class="warehouse">{{ row.fromwarehouse }}</td>
              <td class="logistic-name">{{ row.logisticName }}</td>
              <td class="year">{{ row.year }}</td>
              <td class="month">{{ row.month }}</td>
              <td class="confirm-total">{{ row.confirmTotal }}</td>
              <td class="non-compliant-order-count">{{ row.nonCompliantOrderCount }}</td>
              <td class="confirm-rate">{{ formatRate(row.confirmInTimeRate) }}</td>
            </tr>
          </tbody>
        </table>

        <div v-else class="no-data-container">
          <div class="no-data-text">暂无数据</div>
          <div class="no-data-desc">请调整筛选条件后重试</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.order-rate-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 标题栏 */
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
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
}
.header-title {
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

/* 筛选器区域 */
.header-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0rem;
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
  flex-shrink: 0;
  gap: 0.5rem;
}
.filters-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

/* 日期选择器 */
.date-picker-wrapper {
  position: relative;
}
.date-picker-wrapper :deep(.ant-picker) {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.3rem;
  background: #081f40;
  border: 0.0625rem solid #2873cc;
  border-radius: 0.2rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(0.625rem);
  flex: 0 0 auto;
  width: 10rem;
  min-width: 10rem;
  max-width: 10rem;
  padding: 0.3rem 0.5rem;
}
.date-picker-wrapper :deep(.ant-picker:hover) {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}
.date-picker-wrapper :deep(.ant-picker-input input) {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
}
.date-picker-wrapper :deep(.ant-picker-separator) {
  color: rgba(255, 255, 255, 0.7);
}
.date-picker-wrapper :deep(.ant-picker-suffix) {
  color: rgba(255, 255, 255, 0.7);
}

/* 物流商下拉框 */
.dropdown-group {
  position: relative;
  z-index: 1000;
}
.dropdown-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  padding: 0.25rem 0.4rem;
  background: #081F40;
  border: 0.0625rem solid rgba(59, 130, 246, 0.6);
  border-radius: 0.2rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(0.625rem);
  flex: 0 0 auto;
  min-width: 7rem;
  max-width: 10rem;
  z-index: 1001;
}
.dropdown-item:hover {
  color: white;
  border-color: rgba(59, 130, 246, 0.8);
}
.dropdown-item:hover .dropdown-icon {
  color: white;
}
.dropdown-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.dropdown-icon {
  width: 0.5rem;
  height: 0.5rem;
  color: rgba(255, 255, 255, 0.7);
  transition: color 0.3s ease;
  flex-shrink: 0;
}
.dropdown-content {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  background: #081F40;
  border: 0.0625rem solid rgba(59, 130, 246, 0.6);
  border-radius: 0.15rem;
  box-shadow: 0 0.1rem 0.4rem rgba(0, 0, 0, 0.2);
  z-index: 9999;
  margin-top: 0.05rem;
  box-sizing: border-box;
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
  transition: all 0.3s ease;
}
.search-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}
.search-input:focus {
  border-color: rgba(59, 130, 246, 0.8);
  background: rgba(0, 0, 0, 0.5);
}
.options-list {
  max-height: 6rem;
  position: relative;
  overflow: hidden;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(59, 130, 246, 0.6) rgba(0, 0, 0, 0.2);
}
.options-list::-webkit-scrollbar {
  width: 0.25rem;
}
.options-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 0.125rem;
}
.options-list::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.6);
  border-radius: 0.125rem;
  transition: background 0.3s ease;
}
.options-list::-webkit-scrollbar-thumb:hover {
  background: rgba(59, 130, 246, 0.8);
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
.dropdown-option .checkmark {
  color: #00ff88;
  font-weight: bold;
  font-size: 0.8rem;
}
.no-results {
  padding: 0.25rem 0.6rem;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.75rem;
  text-align: center;
  font-style: italic;
  line-height: 1.2;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
  margin-left: auto;
}
.action-btn {
  height: 1.6rem;
  background: #2873cc;
  box-shadow: 1px 1px 1px 0px #1e6cc8, inset 0px 1px 1px 0px #c5dfff;
  border-radius: 2px;
  border: none;
  color: white;
  font-weight: 500;
  transition: all 0.3s;
  font-size: 0.7rem;
  cursor: pointer;
  padding: 0 12px;
  flex-shrink: 0;
}
.action-btn:hover:not(:disabled) {
  background: #1e6cc8;
  box-shadow: 1px 1px 1px 0px #1c5fb8, inset 0px 1px 1px 0px #b8d5ff;
}
.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 表格包装器 */
.table-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

/* 表格容器 */
.table-container {
  flex: 1;
  overflow: auto;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 0.375rem;
  border: 0.0625rem solid rgba(74, 158, 255, 0.2);
  min-height: 0;
  position: relative;
  z-index: 1;
  scrollbar-width: thin;
  scrollbar-color: rgba(74, 158, 255, 0.3) rgba(0, 0, 0, 0.1);
}
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

/* 加载遮罩 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid rgba(74, 158, 255, 0.3);
  border-top-color: #4a9eff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 表格样式 */
.data-table {
  width: 100%;
  border-collapse: collapse;
  color: white;
  font-size: 0.8rem;
  table-layout: fixed;
}
.data-table th,
.data-table td {
  padding: 0.75rem 0.5rem;
  text-align: center;
  vertical-align: middle;
}
.data-table th:nth-child(1),
.data-table td:nth-child(1) { width: 20%; }
.data-table th:nth-child(2),
.data-table td:nth-child(2) { width: 20%; }
.data-table th:nth-child(3),
.data-table td:nth-child(3) { width: 20%; }
.data-table th:nth-child(4),
.data-table td:nth-child(4) { width: 10%; }
.data-table th:nth-child(5),
.data-table td:nth-child(5) { width: 10%; }
.data-table th:nth-child(6),
.data-table td:nth-child(6) { width: 20%; }
.data-table th:nth-child(7),
.data-table td:nth-child(7) { width: 20%; }

.data-table thead th {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  border-bottom: 1px solid rgba(74, 158, 255, 0.3);
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(8px);
  position: sticky;
  top: 0;
  z-index: 100;
  white-space: nowrap;
}

.data-table tbody tr {
  border-bottom: 1px solid rgba(74, 158, 255, 0.1);
  transition: background 0.2s ease;
}
.data-table tbody tr:hover {
  background: rgba(74, 158, 255, 0.1);
}
.data-table tbody tr:last-child {
  border-bottom: none;
}
.data-table tbody td {
  border-right: 1px solid rgba(74, 158, 255, 0.1);
}
.data-table tbody td:last-child {
  border-right: none;
}

.warehouse {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}
.logistic-name {
  color: rgba(255, 255, 255, 0.8);
}
.year,
.month {
  color: rgba(255, 255, 255, 0.8);
}
.confirm-rate {
  color: #51cf66;
  font-weight: 600;
}

/* 无数据 */
.no-data-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 12rem;
  padding: 2rem;
}
.no-data-text {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
  margin-bottom: 0.5rem;
}
.no-data-desc {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  line-height: 1.4;
}
</style>
