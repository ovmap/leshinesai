<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import { message, Modal } from 'ant-design-vue'
import {
  queryTransConfirmStat,
  exportTransNotConfirm,
  queryExportProgress,
  queryCustomerList,
} from '../../../services/transportApi'

const props = defineProps<{
  fromWarehouse?: string[]
  toProvince?: string[]
  toRdc?: string[]
}>()

// 图表相关
const chartRef = ref<HTMLDivElement | null>(null)
let myChart: echarts.ECharts | null = null

// 组件状态
const isMounted = ref(false)

// 返单数据
const returnData = ref({
  confirmed: 0,
  notConfirm: 0,
  notConfirmWithin30d: 0,
  notConfirm30dTo60d: 0,
  notConfirmOver60d: 0,
})

// 加载状态
const loading = ref(false)

// 导出状态
const exportLoading = ref(false)
const exportProgressVisible = ref(false)
const exportProgressPercent = ref(0)
const exportProgressTimer = ref<NodeJS.Timeout | null>(null)
const exportStartTime = ref<number>(0)
const exportRedisKey = ref<string>('')
const elapsedTimeSeconds = ref(0)
const elapsedTimeTimer = ref<NodeJS.Timeout | null>(null)

// 防抖定时器
let debounceTimer: NodeJS.Timeout | null = null
let clickDebounceTimer: NodeJS.Timeout | null = null

// 日期范围选择 - 默认最近一年
const dateRange = ref([dayjs().subtract(1, 'year'), dayjs()])

// 客户选择
const selectedCustomer = ref<string[]>([])

// 下拉框状态
const isCustomerOpen = ref(false)
const customerSearch = ref('')

// 图例轮播控制
const legendStartIndex = ref(0)
const legendPageSize = 3

// 客户选项数据
const customerOptions = ref<{ value: string; label: string }[]>([])

// 文本截断
const maxDisplayLength = 15

const truncateText = (items: string[], maxLength: number) => {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  let result = items[0]
  let count = 1
  for (let i = 1; i < items.length; i++) {
    const nextText = result + ', ' + items[i]
    if (nextText.length <= maxLength) {
      result = nextText
      count++
    } else {
      break
    }
  }
  if (count < items.length) {
    result += ` +${items.length - count}`
  }
  return result
}

const displayCustomer = computed(() => {
  if (selectedCustomer.value.length === 0) return '客户'
  const selectedLabels = selectedCustomer.value.map((value) => {
    const option = customerOptions.value.find((opt) => opt.value === value)
    return option ? option.label : value
  })
  return truncateText(selectedLabels, maxDisplayLength)
})

const fullCustomerText = computed(() => {
  if (selectedCustomer.value.length === 0) return '客户'
  const selectedLabels = selectedCustomer.value.map((value) => {
    const option = customerOptions.value.find((opt) => opt.value === value)
    return option ? option.label : value
  })
  return selectedLabels.join(', ')
})

const filteredCustomerOptions = computed(() => {
  const filtered = customerOptions.value.filter((option) =>
    option.label.toLowerCase().includes(customerSearch.value.toLowerCase()),
  )
  return [{ value: '__reset__', label: '重置' }, ...filtered]
})

// 图例数据
const legendData = computed(() => [
  { name: '已返', icon: 'rect', itemStyle: { color: '#2563EB' } },
  { name: '未返', icon: 'rect', itemStyle: { color: '#00AEEF' } },
  { name: '30天内', icon: 'rect', itemStyle: { color: '#FFD700' } },
  { name: '30-60天', icon: 'rect', itemStyle: { color: '#F5A623' } },
  { name: '60天以上', icon: 'rect', itemStyle: { color: '#FF4500' } },
])

const currentPageLegends = computed(() => {
  const endIndex = Math.min(legendStartIndex.value + legendPageSize, legendData.value.length)
  return legendData.value.slice(legendStartIndex.value, endIndex)
})

const canPrevLegend = computed(() => legendStartIndex.value > 0)
const canNextLegend = computed(() => legendStartIndex.value + legendPageSize < legendData.value.length)

// 加载客户选项
const loadCustomerOptions = async () => {
  try {
    const result = await queryCustomerList()
    if (result?.code === 200 && Array.isArray(result.data)) {
      customerOptions.value = result.data.map((item: any) => ({
        value: item.code || item.value,
        label: item.name || item.label,
      }))
    }
  } catch (error) {
    console.error('加载客户选项失败:', error)
  }
}

// 下拉框控制
const toggleCustomerDropdown = () => {
  if (isCustomerOpen.value) {
    isCustomerOpen.value = false
    customerSearch.value = ''
  } else {
    isCustomerOpen.value = true
    customerSearch.value = ''
  }
}

const selectCustomer = (option: { value: string; label: string }) => {
  if (option.value === '__reset__') {
    selectedCustomer.value = []
    customerSearch.value = ''
    return
  }
  if (selectedCustomer.value.includes(option.value)) {
    selectedCustomer.value = selectedCustomer.value.filter((item) => item !== option.value)
  } else {
    selectedCustomer.value.push(option.value)
  }
}

const prevLegend = () => {
  if (canPrevLegend.value) {
    legendStartIndex.value = Math.max(0, legendStartIndex.value - legendPageSize)
  }
}

const nextLegend = () => {
  if (canNextLegend.value) {
    legendStartIndex.value = Math.min(
      legendData.value.length - legendPageSize,
      legendStartIndex.value + legendPageSize,
    )
  }
}

// 获取返单数据
const fetchReturnData = async () => {
  try {
    loading.value = true
    const params = {
      fromWarehouse: props.fromWarehouse || [],
      toProvince: props.toProvince || [],
      toRdc: props.toRdc || [],
      startDate: dateRange.value[0].format('YYYY-MM-DD') + ' 00:00:00',
      endDate: dateRange.value[1].format('YYYY-MM-DD') + ' 23:59:59',
      customer: selectedCustomer.value.length > 0 ? selectedCustomer.value : [],
    }
    const result = await queryTransConfirmStat(params)
    if (result && result.data) {
      returnData.value = {
        confirmed: result.data.confirmed || 0,
        notConfirm: result.data.notConfirm || 0,
        notConfirmWithin30d: result.data.notConfirmWithin30d || 0,
        notConfirm30dTo60d: result.data.notConfirm30dTo60d || 0,
        notConfirmOver60d: result.data.notConfirmOver60d || 0,
      }
    }
  } catch (error: any) {
    const errCode = error?.response?.data?.code
    if (errCode === 500) {
      message.error('服务器错误')
    }
    returnData.value = {
      confirmed: 0,
      notConfirm: 0,
      notConfirmWithin30d: 0,
      notConfirm30dTo60d: 0,
      notConfirmOver60d: 0,
    }
  } finally {
    loading.value = false
    nextTick(() => {
      if (isMounted.value && myChart && !myChart.isDisposed()) {
        myChart.setOption(donutOptions.value, true)
        myChart.off('click', handleChartClick)
        myChart.on('click', handleChartClick)
      }
    })
  }
}

const debouncedFetchReturnData = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    if (isMounted.value) {
      fetchReturnData()
    }
  }, 500)
}

// 导出进度
const startExportProgress = (redisKey: string) => {
  exportProgressVisible.value = true
  exportProgressPercent.value = 0
  exportStartTime.value = Date.now()
  exportRedisKey.value = redisKey
  elapsedTimeSeconds.value = 0

  if (exportProgressTimer.value) clearInterval(exportProgressTimer.value)
  if (elapsedTimeTimer.value) clearInterval(elapsedTimeTimer.value)

  elapsedTimeTimer.value = setInterval(() => {
    if (exportStartTime.value) {
      elapsedTimeSeconds.value = Math.floor((Date.now() - exportStartTime.value) / 1000)
    }
  }, 1000)

  pollExportProgress()
  exportProgressTimer.value = setInterval(() => {
    pollExportProgress()
  }, 3000)
}

const pollExportProgress = async () => {
  if (!exportRedisKey.value) return
  try {
    const result = await queryExportProgress(exportRedisKey.value)
    if (result && (result.code === 0 || result.code === 200) && result.data) {
      const { done, total, success, flag, data: exportData, error } = result.data
      if (total > 0) {
        exportProgressPercent.value = Math.floor((done / total) * 100)
      }
      if (done === total && success === true) {
        if (exportData) {
          downloadFile(exportData, exportRedisKey.value)
          stopExportProgress(true)
          message.success('导出成功')
        } else {
          stopExportProgress(false)
          message.error(error?.msg || '导出失败')
        }
      } else if (success === false && flag === false) {
        stopExportProgress(false)
        message.error(error?.msg || '导出失败')
      }
    }
  } catch (error) {
    console.error('查询导出进度失败:', error)
  }
}

const stopExportProgress = (success: boolean = true) => {
  if (exportProgressTimer.value) {
    clearInterval(exportProgressTimer.value)
    exportProgressTimer.value = null
  }
  if (elapsedTimeTimer.value) {
    clearInterval(elapsedTimeTimer.value)
    elapsedTimeTimer.value = null
  }
  if (success) {
    exportProgressPercent.value = 100
    setTimeout(() => {
      exportProgressVisible.value = false
      exportProgressPercent.value = 0
      exportRedisKey.value = ''
      elapsedTimeSeconds.value = 0
      exportStartTime.value = 0
    }, 500)
  } else {
    exportProgressVisible.value = false
    exportProgressPercent.value = 0
    exportRedisKey.value = ''
    elapsedTimeSeconds.value = 0
    exportStartTime.value = 0
  }
}

const downloadFile = (url: string, filename: string) => {
  try {
    const link = document.createElement('a')
    link.href = url
    const xlsxMatch = filename.match(/([^/]+\.xlsx)$/)
    const downloadFilename = xlsxMatch ? xlsxMatch[1]! : filename
    link.download = downloadFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    window.location.href = url
  }
}

const handleExport = async (notConfirmType: number | null = null) => {
  try {
    exportLoading.value = true
    const params = {
      fromWarehouse: props.fromWarehouse || [],
      toProvince: props.toProvince || [],
      toRdc: props.toRdc || [],
      startDate: dateRange.value[0].format('YYYY-MM-DD') + ' 00:00:00',
      endDate: dateRange.value[1].format('YYYY-MM-DD') + ' 23:59:59',
      customer: selectedCustomer.value.length > 0 ? selectedCustomer.value : [],
      notConfirmType: notConfirmType,
    }
    const result = await exportTransNotConfirm(params)
    if (result && (result.code === 409 || result.code === 504 || result.code === 505)) {
      message.error(result.msg)
      return
    }
    if (result && result.code === 200 && result.data) {
      startExportProgress(result.data)
    } else {
      message.error(result.message || '导出失败')
    }
  } catch (error: any) {
    console.error('导出失败:', error)
    stopExportProgress(false)
    const errCode = error?.code || error?.response?.data?.code || error?.response?.status
    if (errCode === 500) {
      message.error('服务器错误，请重试')
    } else if (errCode === 409 || errCode === 504 || errCode === 505) {
      const errorMsg = error?.msg || error?.response?.data?.msg || error?.message
      message.error(errorMsg)
    } else if (errCode === 'ECONNABORTED' || error?.message?.includes('timeout')) {
      message.error('导出超时')
    } else {
      message.error('导出失败，请重试')
    }
  } finally {
    exportLoading.value = false
  }
}

// 图表点击
const handleChartClick = (params: any) => {
  if (clickDebounceTimer) clearTimeout(clickDebounceTimer)
  clickDebounceTimer = setTimeout(() => {
    if (params && params.name) {
      let notConfirmType: number | null = null
      let confirmTitle = ''

      if (params.seriesName === '返单进度') {
        if (params.name === '未返') {
          notConfirmType = null
          confirmTitle = '未返'
        }
      } else if (params.seriesName === '内圈时间分布') {
        switch (params.name) {
          case '30天内':
            notConfirmType = 1
            confirmTitle = '30天内'
            break
          case '30-60天':
            notConfirmType = 2
            confirmTitle = '30-60天'
            break
          case '60天以上':
            notConfirmType = 3
            confirmTitle = '60天以上'
            break
        }
      }

      if (confirmTitle) {
        Modal.confirm({
          title: '确认导出',
          content: `确定要导出「${confirmTitle}」的数据吗？`,
          okText: '确定',
          cancelText: '取消',
          onOk: () => {
            handleExport(notConfirmType)
          },
        })
      }
    }
  }, 300)
}

// 数据完整性检查
const isDataComplete = computed(() => {
  return (
    returnData.value.confirmed > 0 &&
    returnData.value.notConfirm > 0 &&
    returnData.value.notConfirmWithin30d >= 0 &&
    returnData.value.notConfirm30dTo60d >= 0 &&
    returnData.value.notConfirmOver60d >= 0
  )
})

// 环形图配置
const donutOptions = computed(() => {
  const confirmed = returnData.value.confirmed
  const notConfirm = returnData.value.notConfirm
  const notConfirmWithin30d = returnData.value.notConfirmWithin30d
  const notConfirm30dTo60d = returnData.value.notConfirm30dTo60d
  const notConfirmOver60d = returnData.value.notConfirmOver60d

  return {
    tooltip: {
      trigger: 'item',
      formatter: function (params: any) {
        if (!params.name || params.name === '') return ''
        return `${params.name}: ${params.value}单`
      },
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: '#2563EB',
      confine: true,
      borderWidth: 1,
      textStyle: { color: '#FFFFFF' },
    },
    legend: { show: false },
    series: [
      {
        name: '返单进度',
        type: 'pie',
        radius: ['40%', '60%'],
        center: ['50%', '50%'],
        startAngle: 90,
        minAngle: 5,
        label: {
          show: true,
          position: 'outside',
          formatter: function (params: any) {
            return `${params.name}`
          },
          fontSize: 11,
          fontWeight: 'bold',
          color: '#FFFFFF',
          distance: 10,
          alignTo: 'labelLine',
          edgeDistance: 10,
          bleedMargin: 20,
        },
        labelLine: {
          show: true,
          length: 3,
          length2: 20,
          smooth: true,
          lineStyle: { width: 1 },
        },
        data: [
          { value: confirmed, name: '已返', itemStyle: { color: '#2563EB' } },
          { value: notConfirm, name: '未返', itemStyle: { color: '#00AEEF' } },
        ].filter((item) => item.value > 0),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(37, 99, 235, 0.5)',
          },
        },
      },
      ...(isDataComplete.value
        ? [
            {
              name: '内圈时间分布',
              type: 'pie',
              radius: ['20%', '40%'],
              center: ['50%', '50%'],
              label: { show: false },
              data: [
                {
                  value: confirmed,
                  name: '',
                  itemStyle: { color: 'transparent', opacity: 0 },
                  label: { show: false },
                  labelLine: { show: false },
                  tooltip: { show: false },
                  emphasis: {
                    itemStyle: { opacity: 0, color: 'transparent' },
                    tooltip: { show: false },
                  },
                },
                { value: notConfirmWithin30d, name: '30天内', itemStyle: { color: '#FFD700' } },
                { value: notConfirm30dTo60d, name: '30-60天', itemStyle: { color: '#F5A623' } },
                { value: notConfirmOver60d, name: '60天以上', itemStyle: { color: '#FF4500' } },
              ].filter((item) => item.value > 0 || item.name === ''),
              emphasis: {
                itemStyle: {
                  shadowBlur: 10,
                  shadowOffsetX: 0,
                  shadowColor: 'rgba(74, 158, 255, 0.5)',
                },
              },
            },
          ]
        : []),
    ],
  }
})

const handleDateChange = () => {
  debouncedFetchReturnData()
}

// 窗口大小变化
const handleResize = () => {
  if (myChart) myChart.resize()
}

onMounted(async () => {
  isMounted.value = true
  await nextTick()

  await loadCustomerOptions()
  await fetchReturnData()

  await nextTick()
  if (chartRef.value && isMounted.value) {
    myChart = echarts.init(chartRef.value)
    myChart.setOption(donutOptions.value)
    myChart.on('click', handleChartClick)
  }

  window.addEventListener('resize', handleResize)

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('.dropdown-group') && isCustomerOpen.value) {
      isCustomerOpen.value = false
      customerSearch.value = ''
    }
  })
})

onUnmounted(() => {
  isMounted.value = false
  if (myChart && !myChart.isDisposed()) {
    myChart.dispose()
    myChart = null
  }
  window.removeEventListener('resize', handleResize)
  if (debounceTimer) clearTimeout(debounceTimer)
  if (clickDebounceTimer) clearTimeout(clickDebounceTimer)
  if (exportProgressTimer.value) clearInterval(exportProgressTimer.value)
  if (elapsedTimeTimer.value) clearInterval(elapsedTimeTimer.value)
})

watch(selectedCustomer, () => {
  debouncedFetchReturnData()
}, { deep: true })

watch(
  () => props,
  () => {
    debouncedFetchReturnData()
  },
  { deep: true },
)

const getElapsedTime = computed(() => elapsedTimeSeconds.value)
</script>

<template>
  <div class="reorder-progress-wrapper">
    <div class="header-bar">
      <h2 class="header-title">返单进展</h2>
    </div>
    <div class="reorder-progress-container">
      <!-- 控制面板 -->
      <div class="control-panel">
        <div class="date-range-section">
          <div class="date-input-group">
            <a-range-picker
              v-model:value="dateRange"
              format="YYYY-MM-DD"
              separator="~"
              class="date-range-picker"
              :show-time="false"
              @change="handleDateChange"
            />
          </div>
        </div>

        <div class="dropdown-section">
          <div class="dropdown-group">
            <div class="dropdown-item" :title="fullCustomerText" @click="toggleCustomerDropdown">
              <span class="dropdown-text">{{ displayCustomer }}</span>
              <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
              <div class="dropdown-content" v-show="isCustomerOpen" @click.stop>
                <div class="search-box">
                  <input
                    v-model="customerSearch"
                    type="text"
                    placeholder="搜索客户..."
                    class="search-input"
                    @click.stop
                  />
                </div>
                <div class="options-list">
                  <div
                    v-for="option in filteredCustomerOptions"
                    :key="option.value"
                    class="dropdown-option"
                    :class="{ selected: selectedCustomer.includes(option.value) && option.value !== '__reset__' }"
                    @click.stop="selectCustomer(option)"
                  >
                    <span class="checkmark" v-if="selectedCustomer.includes(option.value) && option.value !== '__reset__'">✓</span>
                    {{ option.label }}
                  </div>
                  <div v-if="filteredCustomerOptions.length === 0" class="no-results">无搜索结果</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 图表容器 -->
      <div class="chart-container">
        <div ref="chartRef" class="chart-content"></div>
      </div>

      <!-- 自定义图例轮播 -->
      <div class="legend-carousel" v-if="legendData.length > legendPageSize">
        <button class="legend-nav-btn prev-btn" :class="{ disabled: !canPrevLegend }" @click="prevLegend" :disabled="!canPrevLegend">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"></polyline>
          </svg>
        </button>
        <div class="legend-content">
          <div v-for="legend in currentPageLegends" :key="legend.name" class="legend-item">
            <div class="legend-color" :style="{ backgroundColor: legend.itemStyle.color }"></div>
            <span class="legend-text">{{ legend.name }}</span>
          </div>
        </div>
        <button class="legend-nav-btn next-btn" :class="{ disabled: !canNextLegend }" @click="nextLegend" :disabled="!canNextLegend">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"></polyline>
          </svg>
        </button>
      </div>

      <!-- 静态图例 -->
      <div class="static-legend" v-else>
        <div v-for="legend in legendData" :key="legend.name" class="legend-item">
          <div class="legend-color" :style="{ backgroundColor: legend.itemStyle.color }"></div>
          <span class="legend-text">{{ legend.name }}</span>
        </div>
      </div>
    </div>

    <!-- 导出进度Modal -->
    <a-modal
      v-model:open="exportProgressVisible"
      title="导出中"
      :footer="null"
      :closable="false"
      :maskClosable="false"
      :keyboard="false"
      width="400px"
      centered
    >
      <div class="export-progress-content">
        <div class="progress-info">
          <a-spin size="large" />
          <p class="progress-text">正在导出数据...</p>
          <p class="progress-time">已等待 {{ getElapsedTime }} 秒</p>
        </div>
        <a-progress
          :percent="exportProgressPercent"
          :status="exportProgressPercent >= 90 ? 'active' : 'normal'"
          stroke-color="#4a9eff"
        />
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.reorder-progress-wrapper {
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
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
}

.header-title {
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  margin: 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.reorder-progress-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 控制面板 */
.control-panel {
  width: 100%;
  min-height: 2rem;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0.4rem;
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
  position: relative;
  z-index: 100;
  background: rgba(0, 0, 0, 0.1);
}

.date-range-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-input-group {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.date-range-picker {
  background: #081F40 !important;
  border: 1px solid #2873CC !important;
  color: rgba(255, 255, 255, 0.7) !important;
  font-size: 0.6rem !important;
  height: 1.6rem !important;
  width: 10rem;
}

:global(.date-range-picker .ant-picker) {
  background: #081F40 !important;
  border: 1px solid #2873CC !important;
  color: rgba(255, 255, 255, 0.7) !important;
  font-size: 0.6rem !important;
  height: 1.6rem !important;
}

:global(.date-range-picker .ant-picker-input input) {
  color: rgba(255, 255, 255, 0.7) !important;
  font-size: 0.6rem !important;
}

:global(.date-range-picker .ant-picker-separator) {
  color: rgba(255, 255, 255, 0.7) !important;
}

:global(.date-range-picker .ant-picker-suffix) {
  color: rgba(255, 255, 255, 0.7) !important;
}

.dropdown-section {
  display: flex;
  align-items: center;
}

.dropdown-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dropdown-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.2rem;
  padding: 0.1rem 0.3rem;
  background: #081F40;
  border: 1px solid rgba(59, 130, 246, 0.6);
  border-radius: 0.2rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.6rem;
  cursor: pointer;
  transition: all 0.3s ease;
  height: 1.6rem;
  min-height: 1.6rem;
  width: 5rem;
  min-width: 5rem;
  max-width: 6rem;
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
  right: 0;
  background: #081F40;
  border: 1px solid rgba(59, 130, 246, 0.6);
  border-radius: 0.15rem;
  box-shadow: 0 0.1rem 0.4rem rgba(0, 0, 0, 0.2);
  z-index: 1000;
  margin-top: 0.05rem;
  min-width: 6rem;
  max-width: 9rem;
}

.search-box {
  padding: 0.2rem;
  border-bottom: 1px solid rgba(59, 130, 246, 0.3);
}

.search-input {
  width: 100%;
  padding: 0.1rem 0.3rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 0.1rem;
  color: white;
  font-size: 0.6rem;
  outline: none;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.options-list {
  max-height: 5rem;
  overflow-y: auto;
}

.options-list::-webkit-scrollbar {
  width: 0.2rem;
}

.options-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}

.options-list::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.6);
  border-radius: 0.1rem;
}

.dropdown-option {
  padding: 0.15rem 0.4rem;
  color: white;
  font-size: 0.6rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.dropdown-option:hover {
  background: rgba(59, 130, 246, 0.3);
}

.dropdown-option.selected {
  background: rgba(59, 130, 246, 0.5);
  color: #00AEEF;
}

.checkmark {
  color: #00ff88;
  font-weight: bold;
  font-size: 0.7rem;
}

.no-results {
  padding: 0.15rem 0.4rem;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.6rem;
  text-align: center;
  font-style: italic;
}

/* 图表容器 */
.chart-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  overflow: hidden;
}

.chart-content {
  width: 100%;
  height: 100%;
  min-height: 6rem;
}

/* 图例轮播 */
.legend-carousel {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  background: rgba(0, 0, 0, 0.1);
  padding: 0.25rem 0;
}

.legend-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.2rem;
  height: 1.2rem;
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 0.2rem;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.3s ease;
}

.legend-nav-btn svg {
  width: 0.6rem;
  height: 0.6rem;
}

.legend-nav-btn:hover:not(.disabled) {
  background: rgba(59, 130, 246, 0.4);
  border-color: rgba(59, 130, 246, 0.6);
  color: white;
}

.legend-nav-btn.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.legend-content {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex: 1;
  justify-content: center;
}

.static-legend {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  padding: 0.3rem 0.5rem;
  background: rgba(0, 0, 0, 0.1);
  border-top: 1px solid rgba(74, 158, 255, 0.2);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.legend-color {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 0.1rem;
  flex-shrink: 0;
}

.legend-text {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.6rem;
  white-space: nowrap;
}

/* 导出进度 */
:global(.ant-modal-mask) {
  background: rgba(0, 0, 0, 0.6) !important;
}

:global(.ant-modal-wrap) {
  z-index: 2147483647;
}

:global(.ant-modal-content) {
  background: #0f172a;
  border: 2px solid #4a9eff;
  border-radius: 0.5rem;
}

:global(.ant-modal-header) {
  background: transparent;
  border-bottom: 1px solid rgba(74, 158, 255, 0.3);
}

:global(.ant-modal-title) {
  color: #ffffff !important;
}

:global(.ant-modal-body) {
  padding: 1rem;
  background: rgba(15, 23, 42, 0.95);
}

.export-progress-content {
  padding: 0;
  text-align: center;
}

.progress-info {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.progress-text {
  color: #ffffff;
  font-size: 0.8rem;
  margin: 0;
}

.progress-time {
  color: rgba(74, 158, 255, 0.9);
  font-size: 0.7rem;
  margin: 0;
  padding: 0.2rem 0.5rem;
  background: rgba(74, 158, 255, 0.1);
  border: 1px solid rgba(74, 158, 255, 0.3);
  border-radius: 0.2rem;
}
</style>
