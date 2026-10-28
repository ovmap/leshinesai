<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import { queryAbnormalOrder, exportAbnormalOrder, queryRegionList, queryAbnormalTypeList } from '../../../services/transportApi'
import { useSelectOptionsStore } from '../../../stores/selectOptionsStore'
import { useGlobalFilterStore } from '../../../stores/globalFilterStore'
import { useDashboardDataStore } from '../../../stores/dashboardDataStore'

const { t } = useI18n()
const selectOptionsStore = useSelectOptionsStore()
const globalFilterStore = useGlobalFilterStore()
const dataStore = useDashboardDataStore()

// Tab 页签
const activeTab = ref('terminal')

// 内部筛选
const selectedRdc = ref('RDC&配送商')
const selectedRegion = ref('')
const selectedCategory = ref('')
const selectedDataSource = ref('')

// 导出状态
const exportLoading = ref(false)

// 下拉框开关状态
const isRdcOpen = ref(false)
const isRegionOpen = ref(false)
const isCategoryOpen = ref(false)
const isDataSourceOpen = ref(false)

// RDC 选项（末端）
const rdcOptions = computed(() => [
  { value: 'RDC&配送商', label: t('dashboard.signUp.rdcOptions.rdcDelivery') },
  { value: 'CDC&承运商', label: t('dashboard.signUp.rdcOptions.cdcCarrier') },
  { value: 'RDC&异常代码', label: t('dashboard.signUp.rdcOptions.rdcAbnormalCode') },
  { value: 'CDC&异常代码', label: t('dashboard.signUp.rdcOptions.cdcAbnormalCode') },
])

// RDC 选项（干线）
const trunkRdcOptions = computed(() => [
  { value: 'CDC&承运商', label: t('dashboard.signUp.rdcOptions.cdcCarrier') },
  { value: 'CDC&异常代码', label: t('dashboard.signUp.rdcOptions.cdcAbnormalCode') },
])

// 大区选项
const regionOptions = ref<{ value: string; label: string }[]>([])

// 异常分类选项
const categoryOptions = ref<{ value: string; label: string }[]>([])

// 数据源选项（来自 store）
const dataSourceOptions = computed(() => {
  return selectOptionsStore.dataSourceOptions.map((item) => ({
    value: item.code,
    label: item.name,
  }))
})

// 当前 RDC 选项（根据 tab 动态切换）
const currentRdcOptions = computed(() => {
  return activeTab.value === 'terminal' ? rdcOptions.value : trunkRdcOptions.value
})

// 显示文本
const selectedRdcText = computed(() => {
  const option = currentRdcOptions.value?.find(item => item.value === selectedRdc.value)
  return option ? option.label : (activeTab.value === 'terminal' ? t('dashboard.signUp.rdcOptions.rdcDelivery') : t('dashboard.signUp.rdcOptions.cdcCarrier'))
})

const selectedRegionText = computed(() => {
  const option = regionOptions.value?.find(item => item.value === selectedRegion.value)
  return option ? option.label : t('dashboard.signUp.placeholders.region')
})

const selectedCategoryText = computed(() => {
  const option = categoryOptions.value?.find(item => item.value === selectedCategory.value)
  return option ? option.label : t('dashboard.signUp.placeholders.category')
})

const selectedDataSourceText = computed(() => {
  const option = dataSourceOptions.value?.find(item => item.value === selectedDataSource.value)
  return option ? option.label : t('dashboard.signUp.placeholders.dataSource')
})

// 表格数据
const tableHeaders = ref<string[]>([])
const tableData = ref<any[][]>([])
const tableContainerRef = ref<HTMLElement | null>(null)

// 获取大区列表
const fetchRegionList = async () => {
  try {
    const params = { transLinkType: activeTab.value === 'terminal' ? 1 : 2 }
    const result = await queryRegionList(params)
    if (result && result.code === 200 && result.data) {
      regionOptions.value = result.data
        .filter((item: any) => item && item.code && item.name)
        .map((item: any) => ({ value: item.code, label: item.name }))
    }
  } catch (error) {
    console.error(t('dashboard.signUp.messages.fetchRegionListFailed'), error)
  }
}

// 获取异常分类列表
const fetchAbnormalReasonList = async () => {
  try {
    const result = await queryAbnormalTypeList()
    if (result && result.code === 200 && result.data) {
      categoryOptions.value = result.data
        .filter((item: any) => item && item.code && item.name)
        .map((item: any) => ({ value: item.code, label: item.name }))
    }
  } catch (error) {
    console.error(t('dashboard.signUp.messages.fetchAbnormalReasonListFailed'), error)
  }
}

// 获取数据源列表
const fetchDataSourceList = async () => {
  try {
    await selectOptionsStore.ensureDataLoaded()
  } catch (error) {
    console.error(t('dashboard.signUp.messages.fetchDataSourceListFailed'), error)
  }
}

// 获取异常订单数据
const fetchAbnormalOrderData = async () => {
  try {
    const scrollTop = tableContainerRef.value?.scrollTop || 0

    const params = {
      page: 1,
      pageSize: 100,
      fromWarehouse: globalFilterStore.selectedWarehouse,
      toProvince: globalFilterStore.selectedProvince,
      toRdc: globalFilterStore.selectedRdc,
      transLinkType: activeTab.value === 'terminal' ? 1 : 2,
      dcTransAbnormal: selectedRdc.value || '',
      region: selectedRegion.value || '',
      abnormalType: selectedCategory.value || '',
      datasource: selectedDataSource.value || '',
    }

    const result = await queryAbnormalOrder(params)

    if (result && result.data) {
      dataStore.updateModuleData('signUp', result.data)
      let dataArray: any[] = []

      if (Array.isArray(result.data)) {
        dataArray = result.data
      } else if (result.data.list && Array.isArray(result.data.list)) {
        dataArray = result.data.list
      } else if (result.data.records && Array.isArray(result.data.records)) {
        dataArray = result.data.records
      } else if (result.data.data && Array.isArray(result.data.data)) {
        dataArray = result.data.data
      }

      if (dataArray.length > 0) {
        if (Array.isArray(dataArray[0]) && dataArray[0].length > 0) {
          tableHeaders.value = dataArray[0]
          tableData.value = dataArray.slice(1)
        } else {
          tableHeaders.value = []
          tableData.value = []
        }
      } else {
        tableHeaders.value = []
        tableData.value = []
      }
    } else {
      tableHeaders.value = []
      tableData.value = []
    }

    await nextTick()
    if (tableContainerRef.value) {
      tableContainerRef.value.scrollTop = scrollTop
    }
  } catch (error: any) {
    console.error(t('dashboard.signUp.messages.fetchAbnormalOrderDataFailed'), error)
    const errCode = error?.code
    if (errCode === 409 || errCode === 504 || errCode === 505) {
      message.error(error.msg || t('dashboard.signUp.messages.queryTooMuch'))
    } else {
      message.error(error.msg || t('dashboard.signUp.messages.fetchAbnormalOrderDataFailed'))
    }
  }
}

// 监听 tab 切换
watch(activeTab, () => {
  if (activeTab.value === 'terminal') {
    selectedRdc.value = 'RDC&配送商'
  } else {
    selectedRdc.value = 'CDC&承运商'
  }
  selectedRegion.value = ''
  selectedCategory.value = ''
  selectedDataSource.value = ''
  closeAllDropdowns()
  fetchRegionList()
  fetchAbnormalReasonList()
  fetchAbnormalOrderData()
}, { flush: 'post' })

// 监听全局筛选变化
watch(
  () => [globalFilterStore.selectedWarehouse, globalFilterStore.selectedProvince, globalFilterStore.selectedRdc],
  () => {
    fetchAbnormalOrderData()
  },
  { deep: true }
)

// 下拉框方法
const closeAllDropdowns = () => {
  isRdcOpen.value = false
  isRegionOpen.value = false
  isCategoryOpen.value = false
  isDataSourceOpen.value = false
}

const toggleRdcDropdown = () => {
  if (isRdcOpen.value) { isRdcOpen.value = false } else { closeAllDropdowns(); isRdcOpen.value = true }
}
const toggleRegionDropdown = () => {
  if (isRegionOpen.value) { isRegionOpen.value = false } else { closeAllDropdowns(); isRegionOpen.value = true }
}
const toggleCategoryDropdown = () => {
  if (isCategoryOpen.value) { isCategoryOpen.value = false } else { closeAllDropdowns(); isCategoryOpen.value = true }
}
const toggleDataSourceDropdown = () => {
  if (isDataSourceOpen.value) { isDataSourceOpen.value = false } else { closeAllDropdowns(); isDataSourceOpen.value = true }
}

const selectRdc = (value: string) => {
  selectedRdc.value = value
  closeAllDropdowns()
  fetchAbnormalOrderData()
}
const selectRegion = (value: string) => {
  selectedRegion.value = value
  closeAllDropdowns()
  fetchAbnormalOrderData()
}
const selectCategory = (value: string) => {
  selectedCategory.value = value
  closeAllDropdowns()
  fetchAbnormalOrderData()
}
const selectDataSource = (value: string) => {
  selectedDataSource.value = value
  closeAllDropdowns()
  fetchAbnormalOrderData()
}

// 重置
const handleReset = () => {
  if (activeTab.value === 'terminal') {
    selectedRdc.value = 'RDC&配送商'
  } else {
    selectedRdc.value = 'CDC&承运商'
  }
  selectedRegion.value = ''
  selectedCategory.value = ''
  selectedDataSource.value = ''
  closeAllDropdowns()
  fetchAbnormalOrderData()
}

// 导出
const handleExport = async () => {
  try {
    exportLoading.value = true
    const params = {
      page: 1,
      pageSize: 100,
      fromWarehouse: globalFilterStore.selectedWarehouse,
      toProvince: globalFilterStore.selectedProvince,
      toRdc: globalFilterStore.selectedRdc,
      transLinkType: activeTab.value === 'terminal' ? 1 : 2,
      dcTransAbnormal: selectedRdc.value || '',
      region: selectedRegion.value || '',
      abnormalType: selectedCategory.value || '',
      datasource: selectedDataSource.value || '',
    }

    const result = await exportAbnormalOrder(params)

    if (result.code === 409 || result.code === 504 || result.code === 505) {
      message.error(result.msg || t('dashboard.signUp.messages.exportLimitExceeded'))
      return
    }

    if (result && result.data && result.data.downloadUrl) {
      window.open(result.data.downloadUrl, '_blank')
    } else if (result && result.data) {
      const url = result.data
      const link = document.createElement('a')
      link.href = url
      const dateStr = new Date().toISOString().slice(0, 10)
      link.download = `${t('dashboard.signUp.title')}_${dateStr}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    }
  } catch (error: any) {
    console.error(t('dashboard.signUp.messages.exportFailed'), error)
    const errCode = error?.code || error?.response?.status
    if (errCode === 409 || errCode === 504 || errCode === 505) {
      message.error(error.msg || t('dashboard.signUp.messages.exportLimitExceeded'))
    } else {
      message.error(error.msg || t('dashboard.signUp.messages.exportFailed'))
    }
  } finally {
    exportLoading.value = false
  }
}

// 全局点击关闭下拉框
const handleGlobalClick = (e: Event) => {
  const target = e.target as HTMLElement
  if (!target.closest('.dropdown-group')) {
    closeAllDropdowns()
  }
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClick)
  fetchRegionList()
  fetchAbnormalReasonList()
  fetchDataSourceList()
  fetchAbnormalOrderData()
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick)
})
</script>

<template>
  <div class="signup-container">
    <!-- 标题栏 -->
    <div class="header-bar">
      <h2 class="header-title">{{ t('dashboard.signUp.title') }}</h2>
    </div>

    <!-- 顶部标签页 -->
    <div class="tabs-container">
      <div class="tab-item" :class="{ active: activeTab === 'terminal' }" @click="activeTab = 'terminal'">{{ t('dashboard.signUp.tabs.terminal') }}</div>
      <div class="tab-item" :class="{ active: activeTab === 'trunk' }" @click="activeTab = 'trunk'">{{ t('dashboard.signUp.tabs.trunk') }}</div>
    </div>

    <!-- 筛选器 + 导出按钮 -->
    <div class="filters-container">
      <div class="dropdown-group">
        <!-- RDC&配送商 -->
        <div class="dropdown-item dropdown-item-rdc" :title="selectedRdcText" @click="toggleRdcDropdown">
          <span class="dropdown-text">{{ selectedRdcText }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isRdcOpen && currentRdcOptions?.length" @click.stop>
            <div class="options-list">
              <div v-for="option in currentRdcOptions" :key="option.value" class="dropdown-option"
                :class="{ selected: selectedRdc === option.value }" @click.stop="selectRdc(option.value)">
                <span class="checkmark" v-if="selectedRdc === option.value">&#10003;</span>
                {{ option.label }}
              </div>
            </div>
          </div>
        </div>

        <!-- 大区 -->
        <div class="dropdown-item" :title="selectedRegionText" @click="toggleRegionDropdown">
          <span class="dropdown-text">{{ selectedRegionText }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isRegionOpen && regionOptions?.length" @click.stop>
            <div class="options-list">
              <div v-for="option in regionOptions" :key="option.value" class="dropdown-option"
                :class="{ selected: selectedRegion === option.value }" @click.stop="selectRegion(option.value)">
                <span class="checkmark" v-if="selectedRegion === option.value">&#10003;</span>
                {{ option.label }}
              </div>
            </div>
          </div>
        </div>

        <!-- 异常分类 -->
        <div class="dropdown-item" :title="selectedCategoryText" @click="toggleCategoryDropdown">
          <span class="dropdown-text">{{ selectedCategoryText }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isCategoryOpen && categoryOptions?.length" @click.stop>
            <div class="options-list">
              <div v-for="option in categoryOptions" :key="option.value" class="dropdown-option"
                :class="{ selected: selectedCategory === option.value }" @click.stop="selectCategory(option.value)">
                <span class="checkmark" v-if="selectedCategory === option.value">&#10003;</span>
                {{ option.label }}
              </div>
            </div>
          </div>
        </div>

        <!-- 数据源 -->
        <div class="dropdown-item" :title="selectedDataSourceText" @click="toggleDataSourceDropdown">
          <span class="dropdown-text">{{ selectedDataSourceText }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isDataSourceOpen && dataSourceOptions?.length" @click.stop>
            <div class="options-list">
              <div v-for="option in dataSourceOptions" :key="option.value" class="dropdown-option"
                :class="{ selected: selectedDataSource === option.value }" @click.stop="selectDataSource(option.value)">
                <span class="checkmark" v-if="selectedDataSource === option.value">&#10003;</span>
                {{ option.label }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 重置 + 导出 -->
      <div class="export-container">
        <button class="action-btn reset-btn" @click="handleReset">{{ t('dashboard.signUp.buttons.reset') }}</button>
        <button class="action-btn export-btn" :disabled="exportLoading" @click="handleExport">
          {{ exportLoading ? t('dashboard.signUp.buttons.exporting') : t('dashboard.signUp.buttons.export') }}
        </button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div ref="tableContainerRef" class="table-container">
      <table v-if="tableData.length > 0" class="data-table">
        <thead>
          <tr>
            <th v-for="(header, index) in tableHeaders" :key="index">{{ header }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in tableData" :key="rowIndex">
            <td v-for="(cell, cellIndex) in row" :key="cellIndex"
              :class="cellIndex === 0 ? 'rdc-cell' : 'transport-cell'">
              {{ cell }}
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="no-data-container">
        <div class="no-data-text">{{ t('dashboard.signUp.noData.text') }}</div>
        <div class="no-data-desc">{{ t('dashboard.signUp.noData.description') }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.signup-container {
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

/* 标签页 */
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

/* 筛选器 */
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
  max-width: 4.5rem;
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
.dropdown-item-rdc {
  max-width: 7rem;
  min-width: 6rem;
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
  min-width: 5rem;
  max-width: 8rem;
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

/* 导出按钮 */
.export-container {
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
  gap: 0.5rem;
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

/* 表格样式 */
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
}
.data-table thead th {
  padding: 0.75rem 0.5rem;
  text-align: center;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  border-bottom: 0.0625rem solid rgba(74, 158, 255, 0.3);
  border-right: 0.0625rem solid rgba(74, 158, 255, 0.2);
  background: #0c2545;
  position: sticky;
  top: 0;
  z-index: 100;
  white-space: nowrap;
}
.data-table thead th:nth-child(1) {
  min-width: 120px;
  position: sticky;
  left: 0;
  z-index: 101;
  background: #081F40;
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
}
.data-table tbody td:nth-child(1) {
  min-width: 120px;
  position: sticky;
  left: 0;
  z-index: 10;
  background: #081F40;
}
.data-table tbody td:last-child {
  border-right: none;
}

.rdc-cell {
  font-weight: 600;
  color: #4a9eff;
  background: #081F40 !important;
  text-align: left !important;
  padding-left: 1rem !important;
  position: sticky !important;
  left: 0 !important;
  z-index: 11 !important;
  min-width: 120px !important;
}
.transport-cell {
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
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
</style>
