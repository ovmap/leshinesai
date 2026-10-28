<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs, { type Dayjs } from 'dayjs'
import { message } from 'ant-design-vue'
import { queryLogisticList, queryDeliveryNotConfirmStat, exportDeliveryNotConfirmStat } from '../../../services/transportApi'
import { useGlobalFilterStore } from '../../../stores/globalFilterStore'
import { useDashboardDataStore } from '../../../stores/dashboardDataStore'

const globalFilterStore = useGlobalFilterStore()
const dataStore = useDashboardDataStore()
const { t } = useI18n()

// Tab页签
const activeTab = ref('signReceive')

// 根据tab获取默认日期范围
const getDefaultDateRange = (tab: string): [Dayjs, Dayjs] => {
  const now = dayjs()
  if (tab === 'signReceive') {
    // 签收&配时间：默认上1个月
    const startDate = now.subtract(1, 'month').startOf('month')
    const endDate = now.subtract(1, 'month').endOf('month')
    return [startDate, endDate]
  } else {
    // 发货确认时间：默认当月
    const startDate = now.startOf('month')
    const endDate = now.endOf('month')
    return [startDate, endDate]
  }
}

// 日期范围
const dateRange = ref<[Dayjs, Dayjs]>(getDefaultDateRange(activeTab.value))

// 物流商相关（多选）
const selectedLogistic = ref<string[]>([])
const isLogisticOpen = ref(false)
const logisticOptions = ref<{ value: string; label: string }[]>([])
const logisticSearch = ref('')

// 超期区间相关
const selectedOverduePeriod = ref('')
const isOverduePeriodOpen = ref(false)
const overduePeriodOptions = computed(() => [
  { value: '', label: t('dashboard.udReorderProgress.overduePeriod.all') },
  { value: '1', label: t('dashboard.udReorderProgress.overduePeriod.within30d') },
  { value: '2', label: t('dashboard.udReorderProgress.overduePeriod.30to60d') },
  { value: '3', label: t('dashboard.udReorderProgress.overduePeriod.over60d') },
])

// 表格数据
const tableHeaders = computed(() => [
  t('dashboard.udReorderProgress.tableHeaders.warehouse'),
  t('dashboard.udReorderProgress.tableHeaders.logisticName'),
  t('dashboard.udReorderProgress.tableHeaders.billType'),
  t('dashboard.udReorderProgress.tableHeaders.year'),
  t('dashboard.udReorderProgress.tableHeaders.month'),
  t('dashboard.udReorderProgress.tableHeaders.count')
])
const tableData = ref<any[][]>([])
const tableLoading = ref(false)
const exportLoading = ref(false)

// 单据类型映射
const billTypeMap = computed<Record<string, string>>(() => ({
  '1': t('dashboard.udReorderProgress.billTypes.invoice'),
  '2': t('dashboard.udReorderProgress.billTypes.waybill')
}))

// 过滤后的物流商选项
const filteredLogisticOptions = computed(() => {
  const filtered = logisticOptions.value.filter((option) =>
    option.label.toLowerCase().includes(logisticSearch.value.toLowerCase()),
  )
  // 在列表开头添加重置选项
  return [{ value: '__reset__', label: t('dashboard.udReorderProgress.logistic.reset') }, ...filtered]
})

// 显示文本
const selectedLogisticText = computed(() => {
  if (!selectedLogistic.value || selectedLogistic.value.length === 0) return t('dashboard.udReorderProgress.logistic.label')

  const selectedLabels = selectedLogistic.value
    .map(value => {
      const option = logisticOptions.value.find(item => item.value === value)
      return option ? option.label : ''
    })
    .filter(label => label)

  if (selectedLabels.length === 0) return t('dashboard.udReorderProgress.logistic.label')
  if (selectedLabels.length === 1) return selectedLabels[0]
  return t('dashboard.udReorderProgress.logistic.selectedCount', [selectedLabels.length])
})

const selectedOverduePeriodText = computed(() => {
  const option = overduePeriodOptions.value?.find(item => item.value === selectedOverduePeriod.value)
  return option ? option.label : t('dashboard.udReorderProgress.overduePeriod.label')
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

const toggleOverduePeriodDropdown = () => {
  if (isOverduePeriodOpen.value) {
    isOverduePeriodOpen.value = false
  } else {
    closeAllDropdowns()
    isOverduePeriodOpen.value = true
  }
}

// 关闭所有下拉框
const closeAllDropdowns = () => {
  isLogisticOpen.value = false
  isOverduePeriodOpen.value = false
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

const selectOverduePeriod = (value: string) => {
  selectedOverduePeriod.value = value
  closeAllDropdowns()
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
    console.error('获取物流商列表失败:', error)
  }
}

// 获取表格数据
const fetchTableData = async () => {
  try {
    tableLoading.value = true

    // 转换超期区间类型："" -> "", "1" -> 1, "2" -> 2, "3" -> 3
    const notConfirmType = selectedOverduePeriod.value === ''
      ? ""
      : parseInt(selectedOverduePeriod.value)

    // 转换 tab 类型：第一个传1，第二个传2
    const timeType = activeTab.value === 'signReceive' ? 1 : 2

    // 格式化日期范围
    const startDate = dateRange.value[0]
      ? dateRange.value[0].startOf('day').format('YYYY-MM-DD HH:mm:ss')
      : getDefaultDateRange(activeTab.value)[0].startOf('day').format('YYYY-MM-DD HH:mm:ss')
    const endDate = dateRange.value[1]
      ? dateRange.value[1].endOf('day').format('YYYY-MM-DD HH:mm:ss')
      : getDefaultDateRange(activeTab.value)[1].endOf('day').format('YYYY-MM-DD HH:mm:ss')

    const params = {
      fromWarehouse: globalFilterStore.selectedWarehouse || [],
      toProvince: globalFilterStore.selectedProvince || [],
      toRdc: globalFilterStore.selectedRdc || [],
      logisticName: selectedLogistic.value.length > 0 ? selectedLogistic.value : [],
      notConfirmType: notConfirmType,
      timeType: timeType,
      startDate: startDate,
      endDate: endDate
    }

    const result = await queryDeliveryNotConfirmStat(params)

    // 处理返回的数据，更新表格数据
    if (result && result.code === 200 && result.data) {
      dataStore.updateModuleData('udReorderProgress', result.data)
      let dataArray: any[] = []

      // 如果接口返回的数据结构是 { data: [...] }
      if (Array.isArray(result.data)) {
        dataArray = result.data
      }
      // 如果接口返回的数据结构是 { data: { list: [...] } }
      else if (result.data.list && Array.isArray(result.data.list)) {
        dataArray = result.data.list
      }
      // 如果接口返回的数据结构是 { data: { records: [...] } }
      else if (result.data.records && Array.isArray(result.data.records)) {
        dataArray = result.data.records
      }
      // 如果接口返回的数据结构是 { data: { data: [...] } }
      else if (result.data.data && Array.isArray(result.data.data)) {
        dataArray = result.data.data
      }

      // 转换对象数组为表格需要的数组格式
      if (dataArray.length > 0) {
        // 将对象数组转换为二维数组
        tableData.value = dataArray.map((item: any) => {
          return [
            item.warehouse || '',           // 仓库
            item.logisticName || '',        // 物流商
            billTypeMap.value[item.billType] || item.billType || '', // 单据类型（转换为文本）
            item.year || '',                // 年
            item.month || '',               // 月
            item.count || 0                 // 未返单数量
          ]
        })
      } else {
        tableData.value = []
      }
    } else {
      // 没有数据时清空表格
      tableData.value = []
    }
  } catch (error) {
    console.error('获取表格数据失败:', error)
    tableData.value = []
  } finally {
    tableLoading.value = false
  }
}

// 导出功能
const handleExport = async () => {
  try {
    exportLoading.value = true

    // 转换超期区间类型："" -> "", "1" -> 1, "2" -> 2, "3" -> 3
    const notConfirmType = selectedOverduePeriod.value === ''
      ? ""
      : parseInt(selectedOverduePeriod.value)

    // 转换 tab 类型：第一个传1，第二个传2
    const timeType = activeTab.value === 'signReceive' ? 1 : 2

    // 格式化日期范围
    const startDate = dateRange.value[0]
      ? dateRange.value[0].startOf('day').format('YYYY-MM-DD HH:mm:ss')
      : getDefaultDateRange(activeTab.value)[0].startOf('day').format('YYYY-MM-DD HH:mm:ss')
    const endDate = dateRange.value[1]
      ? dateRange.value[1].endOf('day').format('YYYY-MM-DD HH:mm:ss')
      : getDefaultDateRange(activeTab.value)[1].endOf('day').format('YYYY-MM-DD HH:mm:ss')

    const params = {
      fromWarehouse: globalFilterStore.selectedWarehouse || [],
      toProvince: globalFilterStore.selectedProvince || [],
      toRdc: globalFilterStore.selectedRdc || [],
      logisticName: selectedLogistic.value.length > 0 ? selectedLogistic.value : [],
      notConfirmType: notConfirmType,
      timeType: timeType,
      startDate: startDate,
      endDate: endDate
    }

    const result = await exportDeliveryNotConfirmStat(params)

    // 检查返回状态码
    if (result.code === 409 || result.code === 504 || result.code === 505) {
      // 导出数量超过限制
      message.error(result.msg || t('dashboard.udReorderProgress.messages.exportLimitExceeded'))
      return
    }

    // 如果接口返回文件下载链接，可以触发下载
    if (result && result.data && result.data.downloadUrl) {
      window.open(result.data.downloadUrl, '_blank')
    } else if (result && result.data) {
      // 如果返回的是文件数据，创建下载链接
      const url = result.data
      const link = document.createElement('a')
      link.href = url
      const dateStr = new Date().toISOString().slice(0, 10)
      link.download = t('dashboard.udReorderProgress.messages.exportFileName', [dateStr])
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    }
  } catch (error: any) {
    console.error('导出失败:', error)

    // 检查是否是409或504状态码
    const errCode = error?.code || error?.response?.status
    if (errCode === 409 || errCode === 504 || errCode === 505) {
      message.error(error.msg || t('dashboard.udReorderProgress.messages.exportLimitExceeded'))
    } else {
      message.error(error.msg || t('dashboard.udReorderProgress.messages.exportFailed'))
    }
  } finally {
    exportLoading.value = false
  }
}

// 重置功能
const handleReset = () => {
  try {
    // 清空物流商选择
    selectedLogistic.value = []
    // 清空超期区间选择
    selectedOverduePeriod.value = ''
    // 重置日期范围为当前tab的默认值
    dateRange.value = getDefaultDateRange(activeTab.value)
    // 关闭所有下拉框
    closeAllDropdowns()
    // 重置后自动搜索
    fetchTableData()
  } catch (error) {
    console.error('重置失败:', error)
  }
}

// 监听 tab 切换
watch(activeTab, (newTab) => {
  // 重置搜索内容
  selectedLogistic.value = []
  logisticSearch.value = ''
  selectedOverduePeriod.value = ''
  // 更新日期范围为当前tab的默认值
  dateRange.value = getDefaultDateRange(newTab)
  // 关闭所有下拉框
  closeAllDropdowns()
  // 切换tab时自动刷新数据
  fetchTableData()
})

// 监听全局 header 的三个下拉框变化（始发仓库、目的省份、目的RDC）
watch([
  () => globalFilterStore.selectedWarehouse,
  () => globalFilterStore.selectedProvince,
  () => globalFilterStore.selectedRdc
], () => {
  // 当 header 的筛选条件变化时，自动重新调用接口
  fetchTableData()
}, { deep: true })

// 全局点击处理
const handleGlobalClick = (e: Event) => {
  const target = e.target as HTMLElement
  if (!target.closest('.dropdown-group')) {
    closeAllDropdowns()
  }
}

// 生命周期管理
onMounted(() => {
  document.addEventListener('click', handleGlobalClick)
  fetchLogisticList()
  fetchTableData()
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick)
})
</script>

<template>
  <div class="ud-reorder-progress-container">
    <!-- 标题栏 -->
    <div class="header-bar">
      <h2 class="header-title">{{ t('dashboard.udReorderProgress.title') }}</h2>
    </div>

    <!-- 顶部导航标签页 -->
    <div class="tabs-container">
      <div class="tab-item" :class="{ active: activeTab === 'signReceive' }" @click="activeTab = 'signReceive'">
        {{ t('dashboard.udReorderProgress.tabs.signReceive') }}
      </div>
      <div class="tab-item" :class="{ active: activeTab === 'confirmTime' }" @click="activeTab = 'confirmTime'">
        {{ t('dashboard.udReorderProgress.tabs.confirmTime') }}
      </div>
    </div>

    <!-- 筛选器组和导出按钮 -->
    <div class="filters-container">
      <div class="dropdown-group">
        <!-- 日期范围选择器 -->
        <div class="date-picker-wrapper">
          <a-range-picker
            v-model:value="dateRange"
            format="YYYY-MM-DD"
            :separator="t('dashboard.udReorderProgress.dateRange.separator')"
            class="date-range-picker"
            :show-time="false"
          />
        </div>

        <!-- 物流商下拉框（多选） -->
        <div class="dropdown-item" :title="selectedLogisticText" @click="toggleLogisticDropdown">
          <span class="dropdown-text">{{ selectedLogisticText }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isLogisticOpen && logisticOptions?.length" @click.stop>
            <div class="search-box">
              <input v-model="logisticSearch" type="text" :placeholder="t('dashboard.udReorderProgress.logistic.searchPlaceholder')" class="search-input"
                @click.stop />
            </div>
            <div class="options-list">
              <div v-for="option in filteredLogisticOptions" :key="option.value" class="dropdown-option"
                :class="{ 'selected': selectedLogistic.includes(option.value) }" @click.stop="selectLogistic(option.value)">
                <span class="checkmark" v-if="selectedLogistic.includes(option.value)">&#10003;</span>
                {{ option.label }}
              </div>
              <div v-if="filteredLogisticOptions.length === 1 && logisticSearch" class="no-results">
                {{ t('dashboard.udReorderProgress.messages.noSearchResults') }}
              </div>
            </div>
          </div>
        </div>

        <!-- 超期区间下拉框 -->
        <div class="dropdown-item" :title="selectedOverduePeriodText" @click="toggleOverduePeriodDropdown">
          <span class="dropdown-text">{{ selectedOverduePeriodText }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isOverduePeriodOpen && overduePeriodOptions?.length" @click.stop>
            <div class="options-list">
              <div v-for="option in overduePeriodOptions" :key="option.value" class="dropdown-option"
                :class="{ 'selected': selectedOverduePeriod === option.value }" @click.stop="selectOverduePeriod(option.value)">
                <span class="checkmark" v-if="selectedOverduePeriod === option.value">&#10003;</span>
                {{ option.label }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 搜索、重置和导出按钮 -->
      <div class="export-container">
        <button class="export-btn search-btn" :disabled="tableLoading" @click="fetchTableData">
          {{ tableLoading ? t('dashboard.udReorderProgress.messages.searching') : t('dashboard.udReorderProgress.buttons.search') }}
        </button>
        <button class="export-btn" @click="handleReset">{{ t('dashboard.udReorderProgress.buttons.reset') }}</button>
        <button class="export-btn" :disabled="exportLoading" @click="handleExport">
          {{ exportLoading ? t('dashboard.udReorderProgress.messages.exporting') : t('dashboard.udReorderProgress.buttons.export') }}
        </button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="table-container">
      <!-- 加载遮罩 -->
      <div v-if="tableLoading" class="loading-overlay">
        <div class="loading-spinner"></div>
      </div>

      <table v-if="tableData.length > 0" class="data-table">
        <thead>
          <tr>
            <th v-for="(header, index) in tableHeaders" :key="index">{{ header }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in tableData" :key="rowIndex">
            <td v-for="(cell, cellIndex) in row" :key="cellIndex">
              {{ cell }}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 无数据时显示提示信息 -->
      <div v-else class="no-data-container">
        <div class="no-data-text">{{ t('dashboard.udReorderProgress.messages.noData') }}</div>
        <div class="no-data-desc">{{ t('dashboard.udReorderProgress.messages.noDataDesc') }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ud-reorder-progress-container {
  width: 100%;
  height: 100%;
  border-radius: 0.5rem;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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

/* 顶部标签页 */
.tabs-container {
  display: flex;
  gap: 0;
  border-bottom: 0.0625rem solid rgba(74, 158, 255, 0.2);
}
.tab-item {
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  border-bottom: 0.125rem solid transparent;
  transition: all 0.3s ease;
  position: relative;
  flex: 1;
  text-align: center;
  min-height: 2rem;
}
.tab-item:hover {
  color: rgba(255, 255, 255, 0.8);
}
.tab-item.active {
  color: #4a9eff;
  border-bottom-color: #4a9eff;
  font-weight: 600;
}

/* 筛选器容器 */
.filters-container {
  width: 100%;
  margin-bottom: 0.5rem;
  position: relative;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.dropdown-group {
  display: flex;
  gap: 0.4rem;
  flex-wrap: nowrap;
  flex: 1;
}

/* 日期选择器 */
.date-picker-wrapper {
  flex-shrink: 0;
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
  height: 1.6rem;
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

/* 下拉框 */
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
  flex: 1;
  min-width: 0;
  max-width: 7rem;
  z-index: 1001;
}
.dropdown-item:hover {
  color: white;
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
}
.dropdown-content {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #081F40;
  border: 0.0625rem solid rgba(59, 130, 246, 0.6);
  border-radius: 0.15rem;
  box-shadow: 0 0.1rem 0.4rem rgba(0, 0, 0, 0.2);
  z-index: 9999;
  margin-top: 0.05rem;
  min-width: 7rem;
  max-width: 12rem;
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

/* 导出按钮容器 */
.export-container {
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
  gap: 0.5rem;
}

/* 导出按钮 */
.export-btn {
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
.export-btn:hover:not(:disabled) {
  background: #1e6cc8;
  box-shadow: 1px 1px 1px 0px #1c5fb8, inset 0px 1px 1px 0px #b8d5ff;
}
.export-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  overflow-x: auto;
  overflow-y: auto;
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

/* 数据表格 */
.data-table {
  width: 100%;
  border-collapse: collapse;
  color: white;
  font-size: 0.8rem;
  table-layout: auto;
  white-space: nowrap;
}
.data-table thead {
  background: rgba(74, 158, 255, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(8px);
}
.data-table thead th {
  padding: 0.75rem 0.5rem;
  text-align: center;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  border-bottom: 0.0625rem solid rgba(74, 158, 255, 0.3);
  border-right: 0.0625rem solid rgba(74, 158, 255, 0.2);
  background: rgba(74, 158, 255, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
  white-space: nowrap;
}
.data-table thead th:last-child {
  border-right: none;
}
.data-table tbody tr {
  border-bottom: 0.0625rem solid rgba(74, 158, 255, 0.1);
  transition: background 0.2s ease;
}
.data-table tbody tr:hover {
  background: rgba(74, 158, 255, 0.05);
}
.data-table tbody tr:last-child {
  border-bottom: none;
}
.data-table tbody td {
  padding: 0.75rem 0.5rem;
  text-align: center;
  border-right: 0.0625rem solid rgba(74, 158, 255, 0.1);
  vertical-align: middle;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.8);
}
.data-table tbody td:last-child {
  border-right: none;
}

/* 无数据提示 */
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

/* 滚动条 */
.table-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.table-container::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}
.table-container::-webkit-scrollbar-thumb {
  background: rgba(74, 158, 255, 0.7);
  border-radius: 4px;
  border: 1px solid rgba(74, 158, 255, 0.3);
}
.table-container::-webkit-scrollbar-thumb:hover {
  background: rgba(74, 158, 255, 0.9);
}
.table-container::-webkit-scrollbar-corner {
  background: rgba(0, 0, 0, 0.3);
}

/* 响应式 */
@media (max-width: 1200px) {
  .data-table {
    font-size: 0.7rem;
  }
  .tab-item {
    font-size: 0.7rem;
    padding: 0.4375rem 0.875rem;
  }
  .export-btn {
    font-size: 0.7rem;
    height: 1.5rem;
  }
}

@media (max-width: 768px) {
  .filters-container .dropdown-group {
    flex-direction: column;
    gap: 0.5rem;
  }
  .filters-container .dropdown-item {
    max-width: none;
    width: 100%;
  }
}
</style>
