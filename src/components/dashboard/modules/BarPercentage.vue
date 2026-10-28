<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import * as echarts from 'echarts'
import dayjs, { type Dayjs } from 'dayjs'
import { message } from 'ant-design-vue'
import { queryVolumeBarRate, queryVolumeStatType } from '../../../services/transportApi'
import { useSelectOptionsStore } from '../../../stores/selectOptionsStore'
import { useGlobalFilterStore } from '../../../stores/globalFilterStore'
import { useDashboardDataStore } from '../../../stores/dashboardDataStore'

// i18n
const { t } = useI18n()

// 使用公共 store
const selectOptionsStore = useSelectOptionsStore()
const globalFilterStore = useGlobalFilterStore()
const dataStore = useDashboardDataStore()

// 使用 computed 包装，保持响应式并确保类型正确
const dataSourceOptions = computed(() => selectOptionsStore.dataSourceOptions)
const volumeAggOptions = computed(() => selectOptionsStore.volumeAggOptions)

// 统计方式选项
const statTypeOptions = ref<Array<{ code: string, name: string }>>([])

// 选中的值
const selectedStatType = ref<number>(0) // 统计方式是单选，传数字
const selectedDataSource = ref<string[]>([])
const selectedVolumeAgg = ref<string>('') // 体积是单选

// 日期范围选择 - 默认当月1号到当天
const dateRange = ref<[Dayjs, Dayjs]>([
  dayjs().startOf('month'),
  dayjs()
])

// 下拉框状态
const isCustomerOpen = ref(false)
const isDataSourceOpen = ref(false)
const isVolumeAggOpen = ref(false)

// 图表相关
const chartRef = ref<HTMLDivElement | null>(null)
let myChart: echarts.ECharts | null = null
let resizeTimer: ReturnType<typeof setTimeout> | null = null

// 图表数据
const chartData = ref<Array<{ name: string, value: number, percentage: number }>>([])
const loading = ref(false)

// 文本截断处理
const maxDisplayLength = 15

// 智能截断函数
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

// 显示文本
const displayStatType = computed(() => {
  if (!selectedStatType.value) return t('dashboard.barPercentage.placeholders.statType')
  const option = statTypeOptions.value.find(item => Number(item.code) === selectedStatType.value)
  return option ? option.name : String(selectedStatType.value)
})

const displayDataSource = computed(() => {
  if (selectedDataSource.value.length === 0) return t('dashboard.barPercentage.placeholders.dataSource')
  // 将代码转换为名称
  const names = selectedDataSource.value.map(code => {
    const option = dataSourceOptions.value.find(item => item.code === code)
    return option ? option.name : code
  })
  return truncateText(names, maxDisplayLength)
})

const displayVolumeAgg = computed(() => {
  if (!selectedVolumeAgg.value) return t('dashboard.barPercentage.placeholders.volume')
  // 将代码转换为名称
  const options = volumeAggOptions.value || []
  const option = options.find((item: { code: string; name: string }) => item.code === selectedVolumeAgg.value)
  return option ? option.name : selectedVolumeAgg.value
})

// 下拉框开关方法
const toggleCustomerDropdown = () => {
  if (isCustomerOpen.value) {
    isCustomerOpen.value = false
  } else {
    closeAllDropdowns()
    isCustomerOpen.value = true
  }
}

const toggleDataSourceDropdown = () => {
  if (isDataSourceOpen.value) {
    isDataSourceOpen.value = false
  } else {
    closeAllDropdowns()
    isDataSourceOpen.value = true
  }
}

const toggleVolumeAggDropdown = () => {
  if (isVolumeAggOpen.value) {
    isVolumeAggOpen.value = false
  } else {
    closeAllDropdowns()
    isVolumeAggOpen.value = true
  }
}

// 关闭所有下拉框
const closeAllDropdowns = () => {
  isCustomerOpen.value = false
  isDataSourceOpen.value = false
  isVolumeAggOpen.value = false
}

// 选择统计方式（单选）
const selectStatType = (option: { code: string, name: string }) => {
  selectedStatType.value = Number(option.code)
  closeAllDropdowns()
}

const selectDataSource = (option: { code: string, name: string }) => {
  const index = selectedDataSource.value.indexOf(option.code)
  if (index > -1) {
    selectedDataSource.value.splice(index, 1)
  } else {
    selectedDataSource.value.push(option.code)
  }
}

const selectVolumeAgg = (option: { code: string, name: string }) => {
  // 体积是单选，直接赋值
  selectedVolumeAgg.value = option.code
  closeAllDropdowns()
}

// 处理窗口大小变化
const handleResize = () => {
  if (resizeTimer) {
    clearTimeout(resizeTimer)
  }
  resizeTimer = setTimeout(() => {
    if (myChart) {
      myChart.resize()
    }
  }, 100)
}

// 加载下拉框选项（使用公共 store）
const loadDropdownOptions = async () => {
  await selectOptionsStore.ensureDataLoaded()

  // 加载统计方式选项
  try {
    const response = await queryVolumeStatType()
    if (response && response.code === 200 && response.data) {
      statTypeOptions.value = Array.isArray(response.data) ? response.data : []
    }
  } catch (error) {
    console.error(t('dashboard.barPercentage.messages.loadStatTypeFailed'), error)
  }
}

// 获取图表数据
const fetchChartData = async () => {
  try {
    loading.value = true

    const params: any = {
      startDate: dateRange.value[0].startOf('day').format('YYYY-MM-DD HH:mm:ss'),
      endDate: dateRange.value[1].endOf('day').format('YYYY-MM-DD HH:mm:ss'),
    }

    // 三大筛选：始发仓、目的省、目的RDC（统一从全局筛选store获取，均为数组）
    const filterParams = globalFilterStore.getFilterParams()
    params.fromWarehouse = filterParams.fromWarehouse || []
    params.toProvince = filterParams.toProvince || []
    params.toRdc = filterParams.toRdc || []

    if (selectedStatType.value) {
      params.statType = Number(selectedStatType.value)
    }
    // 数据源参数，如果没有选择则传空数组
    params.dataSource = selectedDataSource.value.length > 0 ? selectedDataSource.value : []
    if (selectedVolumeAgg.value) {
      params.agg = selectedVolumeAgg.value
    }

    const result = await queryVolumeBarRate(params)

    if (result && result.code === 200 && result.data) {
      dataStore.updateModuleData('barPercentage', result.data)
      const data = Array.isArray(result.data) ? result.data : []

      chartData.value = data.map((item: any) => {
        // 解析 value（字符串转数字）
        const value = typeof item.value === 'number'
          ? item.value
          : (typeof item.value === 'string' ? parseFloat(item.value) || 0 : 0)

        // 解析 rate（去掉 % 符号，转数字）
        let percentage = 0
        if (item.rate) {
          const rateStr = typeof item.rate === 'string' ? item.rate.replace('%', '') : String(item.rate)
          percentage = parseFloat(rateStr) || 0
        }

        return {
          name: item.key || item.name || '',
          value: value,
          percentage: percentage
        }
      }).sort((a: { value: number }, b: { value: number }) => a.value - b.value)

      updateChart()
    } else {
      chartData.value = []
      updateChart()
    }
  } catch (error) {
    console.error(t('dashboard.barPercentage.messages.fetchDataFailed'), error)
    message.error(t('dashboard.barPercentage.messages.fetchDataFailed'))
    chartData.value = []
    updateChart()
  } finally {
    loading.value = false
  }
}

// 更新图表
const updateChart = () => {
  if (!myChart || !chartRef.value) {
    return
  }

  // 如果容器还没有尺寸，延迟执行
  if (chartRef.value.offsetWidth === 0 || chartRef.value.offsetHeight === 0) {
    setTimeout(() => {
      if (myChart && chartRef.value && chartRef.value.offsetWidth > 0 && chartRef.value.offsetHeight > 0) {
        updateChart()
      }
    }, 100)
    return
  }

  const dataCount = chartData.value.length
  const showDataZoom = dataCount > 12

  const defaultShowCount = 15
  const dataZoomStart = dataCount > defaultShowCount
    ? Math.round(((dataCount - defaultShowCount) / dataCount) * 100)
    : 0
  const dataZoomEnd = 100

  // 捕获当前值到局部变量，避免异步回调中访问响应式数据时为 undefined
  const currentVolumeAggOptions = volumeAggOptions.value || []
  const currentSelectedVolumeAgg = selectedVolumeAgg.value

  // 标签始终显示在柱子末端（右侧）

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent', // 去掉背景色
    tooltip: {
      trigger: 'axis',
      confine: true, // 保持true，但通过position调整位置
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params: any) => {
        const param = Array.isArray(params) ? params[0] : params
        const data = param.data

        // 检查当前选中的体积选项是否是"单台体积/平均运单体积/平均发货单体积"
        const currentVolumeAgg = currentVolumeAggOptions.find((opt: { code: string; name: string }) => opt.code === currentSelectedVolumeAgg)
        const volumeAggName = currentVolumeAgg?.name || ''
        const isVolumeType = volumeAggName.includes('单台体积') ||
                             volumeAggName.includes('平均运单体积') ||
                             volumeAggName.includes('平均发货单体积')

        // 格式化数值
        let formattedValue = ''
        if (isVolumeType && data.value < 1000) {
          formattedValue = data.value.toFixed(2)
        } else {
          formattedValue = data.value.toLocaleString()
        }

        return `${param.name}<br/>${t('dashboard.barPercentage.tooltip.valueLabel')}: ${formattedValue}<br/>${t('dashboard.barPercentage.tooltip.percentageLabel')}: ${data.percentage.toFixed(2)}%`
      },
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: '#4a9eff',
      borderWidth: 1,
      textStyle: {
        color: '#FFFFFF'
      },
      position: function (point: any, _params: any, _dom: any, _rect: any, size: any) {
        // 自定义tooltip位置，确保在最下面时也能显示
        const [x, y] = point
        const viewHeight = size.viewSize[1]
        const boxWidth = size.contentSize[0]
        const boxHeight = size.contentSize[1]

        // 如果鼠标在底部区域，将tooltip显示在上方
        if (y > viewHeight * 0.7) {
          return [x - boxWidth / 2, y - boxHeight - 10]
        }
        // 默认显示在右侧
        return [x + 10, y - boxHeight / 2]
      },
      z: 99999,
      zlevel: 99999
    },
    grid: {
      left: '5%', // 靠着最左边
      right: '15%', // 为标签留出空间
      top: '5%', // 增加顶部空间，确保第一条数据完整显示
      bottom: showDataZoom ? '10%' : '5%', // 有滚动缩放时增加底部空间
      containLabel: true
    },
    // 数据缩放配置 - 使用 inside 类型，支持鼠标滚轮缩放和拖拽
    dataZoom: showDataZoom ? [
      {
        type: 'inside',
        yAxisIndex: [0], // 横向条形图，类别在 Y 轴
        start: dataZoomStart, // 从数组末尾往前数 N 条数据的起始位置
        end: dataZoomEnd, // 显示到数组末尾（图表最上面）
        zoomOnMouseWheel: true, // 启用鼠标滚轮缩放
        moveOnMouseMove: true, // 启用鼠标拖拽移动
        moveOnMouseWheel: true, // 启用滚轮移动（按住Ctrl+滚轮或直接滚轮移动）
        preventDefaultMouseMove: false, // 允许鼠标移动
        filterMode: 'filter' // 过滤模式，只显示范围内的数据
      }
    ] : [],
    xAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => {
          if (value >= 1000000) {
            return (value / 1000000).toFixed(1) + 'M'
          } else if (value >= 1000) {
            return (value / 1000).toFixed(1) + 'K'
          }
          return value.toString()
        },
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 12
      },
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      }
    },
    yAxis: {
      type: 'category',
      data: chartData.value.map(item => item.name),
      axisLabel: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: dataCount > 30 ? 11 : 12, // 数据很多时稍微减小字体
        width: 120, // 增加宽度，避免标签被截断
        overflow: 'truncate',
        margin: 8, // 标签与轴线的距离
        interval: 0 // 强制显示所有可见的标签
      },
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      boundaryGap: true // 确保类别之间有间距，确保第一条和最后一条数据完整显示
    },
    series: [
      {
        name: t('dashboard.barPercentage.chart.seriesName'),
        type: 'bar',
        data: chartData.value.map(item => ({
          value: item.value,
          percentage: item.percentage
        })),
        label: {
          show: true,
          position: 'right', // 横向柱状图，标签显示在柱子末端（右侧）
          formatter: (params: any) => {
            const value = params.value
            const percentage = params.data?.percentage || 0

            // 检查当前选中的体积选项是否是"单台体积/平均运单体积/平均发货单体积"
            const currentVolumeAgg = currentVolumeAggOptions.find((opt: { code: string; name: string }) => opt.code === currentSelectedVolumeAgg)
            const volumeAggName = currentVolumeAgg?.name || ''
            const isVolumeType = volumeAggName.includes('单台体积') ||
                                 volumeAggName.includes('平均运单体积') ||
                                 volumeAggName.includes('平均发货单体积')

            // 格式化数值
            let formattedValue = ''
            if (value >= 1000000) {
              formattedValue = (value / 1000000).toFixed(1) + 'M'
            } else if (value >= 1000) {
              formattedValue = (value / 1000).toFixed(1) + 'K'
            } else {
              // 如果是体积类型（单台体积/平均运单体积/平均发货单体积），保留两位小数
              if (isVolumeType) {
                formattedValue = value.toFixed(2)
              } else {
                // 其他情况，如果是小数也保留两位小数
                formattedValue = Number.isInteger(value) ? value.toString() : value.toFixed(2)
              }
            }

            // 在数值后面加上括号显示占比
            return `${formattedValue} (${percentage.toFixed(2)}%)`
          },
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize: 12,
          fontWeight: 'normal'
        },
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#4A90E2' },
            { offset: 1, color: '#2873CC' }
          ])
        },
        barWidth: '70%',
        barCategoryGap: '20%',
        // 确保条形图在容器内完整显示
        clip: false
      }
    ]
  }

  myChart.setOption(option, true)

  // 确保图表正确渲染
  nextTick(() => {
    if (myChart) {
      myChart.resize()
    }
  })
}

// 防抖定时器
let dateRangeDebounceTimer: ReturnType<typeof setTimeout> | null = null

// 监听选择变化（包括header的筛选条件）
watch([selectedStatType, selectedDataSource, selectedVolumeAgg, dateRange, () => globalFilterStore.selectedWarehouse, () => globalFilterStore.selectedProvince, () => globalFilterStore.selectedRdc], () => {
  // 如果 dateRange 变化，使用防抖
  if (dateRangeDebounceTimer) {
    clearTimeout(dateRangeDebounceTimer)
  }
  dateRangeDebounceTimer = setTimeout(() => {
    fetchChartData()
    dateRangeDebounceTimer = null
  }, 300)
}, { deep: true })

// 组件挂载
onMounted(async () => {
  await nextTick()

  // 等待容器渲染完成
  await nextTick()

  // 使用 ResizeObserver 和多重检查确保容器有尺寸后再初始化
  const initChart = () => {
    if (!chartRef.value) return

    // 尝试获取容器尺寸
    const rect = chartRef.value.getBoundingClientRect()
    const hasSize = rect.width > 0 && rect.height > 0

    if (hasSize && !myChart) {
      myChart = echarts.init(chartRef.value)
      // 初始化时先设置一个空配置
      myChart.setOption({
        xAxis: { type: 'value' },
        yAxis: { type: 'category', data: [] },
        series: [{ type: 'bar', data: [] }]
      })
      myChart.resize()
    } else if (!hasSize) {
      // 如果还没有尺寸，延迟重试
      setTimeout(initChart, 100)
    }
  }

  // 使用 ResizeObserver 监听容器尺寸变化
  if (chartRef.value) {
    const resizeObserver = new ResizeObserver(() => {
      if (chartRef.value) {
        const rect = chartRef.value.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          if (!myChart) {
            initChart()
          } else {
            myChart.resize()
          }
        }
      }
    })
    resizeObserver.observe(chartRef.value)

    // 保存 observer 以便卸载时清理
    ;(chartRef.value as any)._resizeObserver = resizeObserver
  }

  // 延迟初始化，确保 DOM 已渲染
  setTimeout(initChart, 100)

  window.addEventListener('resize', handleResize)
  await loadDropdownOptions()

  // 等待数据加载完成，确保 volumeAggOptions 有数据
  await nextTick()

  // 设置统计方式默认选择第一个（单选）
  if (statTypeOptions.value.length > 0) {
    selectedStatType.value = Number(statTypeOptions.value[0]?.code) || 0
  }

  // 设置数据源默认全选（和 cargoTrend 一样）
  if (dataSourceOptions.value.length > 0) {
    selectedDataSource.value = dataSourceOptions.value.map((item: { code: string; name: string }) => item.code)
  }

  // 设置体积默认选择第一个（单选）- 确保使用最新的数据
  if (volumeAggOptions.value && volumeAggOptions.value.length > 0) {
    selectedVolumeAgg.value = volumeAggOptions.value[0]?.code || ''
  }

  await fetchChartData()
})

// 组件卸载
onUnmounted(() => {
  if (resizeTimer) {
    clearTimeout(resizeTimer)
  }
  if (dateRangeDebounceTimer) {
    clearTimeout(dateRangeDebounceTimer)
    dateRangeDebounceTimer = null
  }
  window.removeEventListener('resize', handleResize)

  // 清理 ResizeObserver
  if (chartRef.value && (chartRef.value as any)._resizeObserver) {
    (chartRef.value as any)._resizeObserver.disconnect()
  }

  if (myChart) {
    myChart.dispose()
    myChart = null
  }
})

// 点击外部关闭下拉框
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target.closest('.dropdown-item') && !target.closest('.dropdown-content')) {
    closeAllDropdowns()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="bar-percentage-container">
    <!-- 标题栏 -->
    <div class="header-bar">
      <h2 class="header-title">{{ t('dashboard.barPercentage.title') }}</h2>
    </div>

    <!-- 控制面板 -->
    <div class="control-panel">
      <div class="dropdown-group">
        <!-- 日期范围选择器 -->
        <a-range-picker
          v-model:value="dateRange"
          format="YYYY-MM-DD"
          :separator="t('dashboard.dateRange.separator')"
          class="date-range-picker"
          :show-time="false"
        />
        <!-- 统计方式下拉框 -->
        <div class="dropdown-item" @click.stop="toggleCustomerDropdown">
          <span class="dropdown-text">{{ displayStatType }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isCustomerOpen" @click.stop>
            <div class="options-list">
              <div
                v-for="option in statTypeOptions"
                :key="option.code"
                class="dropdown-option"
                :class="{ 'selected': selectedStatType === Number(option.code) }"
                @click.stop="selectStatType(option)"
              >
                <span class="checkmark" v-if="selectedStatType === Number(option.code)">&#10003;</span>
                {{ option.name }}
              </div>
            </div>
          </div>
        </div>

        <!-- 数据源下拉框 -->
        <div class="dropdown-item" @click.stop="toggleDataSourceDropdown">
          <span class="dropdown-text">{{ displayDataSource }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isDataSourceOpen" @click.stop>
            <div class="options-list">
              <div
                v-for="option in dataSourceOptions"
                :key="option.code"
                class="dropdown-option"
                :class="{ 'selected': selectedDataSource.includes(option.code) }"
                @click.stop="selectDataSource(option)"
              >
                <span class="checkmark" v-if="selectedDataSource.includes(option.code)">&#10003;</span>
                {{ option.name }}
              </div>
            </div>
          </div>
        </div>

        <!-- 体积下拉框 -->
        <div class="dropdown-item" @click.stop="toggleVolumeAggDropdown">
          <span class="dropdown-text">{{ displayVolumeAgg }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isVolumeAggOpen" @click.stop>
            <div class="options-list">
              <div
                v-for="option in volumeAggOptions"
                :key="option.code"
                class="dropdown-option"
                :class="{ 'selected': selectedVolumeAgg === option.code }"
                @click.stop="selectVolumeAgg(option)"
              >
                <span class="checkmark" v-if="selectedVolumeAgg === option.code">&#10003;</span>
                {{ option.name }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 图表区域 -->
    <div class="chart-section">
      <div v-if="loading" class="loading-overlay">
        <div class="loading-spinner"></div>
      </div>
      <div ref="chartRef" class="chart-container"></div>
    </div>
  </div>
</template>

<style scoped>
.bar-percentage-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
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

/* 控制面板 */
.control-panel {
  width: 100%;
  height: 60px;
  min-height: 60px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 20px;
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
  position: relative;
  z-index: 50;
}

.dropdown-group {
  display: flex;
  gap: 0.4rem;
  flex-wrap: nowrap;
  justify-content: flex-start;
  width: 100%;
  align-items: center;
}

.dropdown-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.3rem;
  background: #081F40;
  border: 0.0625rem solid #2873CC;
  border-radius: 0.2rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(0.625rem);
  flex: 0 0 auto;
  min-width: 8rem;
  padding: 0.3rem 0.5rem;
}

.dropdown-item:hover {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}

.dropdown-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-icon {
  width: 0.8rem;
  height: 0.8rem;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.7);
  transition: transform 0.3s ease;
}

.dropdown-content {
  position: absolute;
  top: calc(100% + 0.2rem);
  left: 0;
  right: 0;
  background: #081F40;
  border: 0.0625rem solid rgba(59, 130, 246, 0.6);
  border-radius: 0.1875rem;
  box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.2);
  z-index: 1001;
  max-height: 12rem;
  overflow-y: auto;
  backdrop-filter: blur(0.625rem);
}

.options-list {
  max-height: 7.6rem;
  padding: 0.2rem;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(59, 130, 246, 0.6) rgba(0, 0, 0, 0.3);
}

.options-list::-webkit-scrollbar {
  width: 6px;
}

.options-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  margin: 2px 0;
}

.options-list::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.6) 0%, rgba(74, 158, 255, 0.6) 100%);
  border-radius: 3px;
  border: 1px solid rgba(59, 130, 246, 0.3);
  transition: all 0.3s ease;
}

.options-list::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.8) 0%, rgba(74, 158, 255, 0.8) 100%);
  border-color: rgba(59, 130, 246, 0.5);
}

.options-list::-webkit-scrollbar-thumb:active {
  background: linear-gradient(135deg, rgba(59, 130, 246, 1) 0%, rgba(74, 158, 255, 1) 100%);
}

.options-list::-webkit-scrollbar-corner {
  background: rgba(0, 0, 0, 0.3);
}

.dropdown-option {
  padding: 0.2rem 0.4rem;
  color: white;
  font-size: 0.7rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  line-height: 1.1;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  border-radius: 0.1rem;
  margin-bottom: 0.05rem;
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

.date-range-picker {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.3rem;
  background: #081F40;
  border: 0.0625rem solid #2873CC;
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

.date-range-picker:hover {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}

.date-range-picker :deep(.ant-picker-input) input {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
}

.date-range-picker :deep(.ant-picker-separator) {
  color: rgba(255, 255, 255, 0.7);
}

.date-range-picker :deep(.ant-picker-suffix) {
  color: rgba(255, 255, 255, 0.7);
}

/* 图表区域 */
.chart-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  padding: 1rem;
  position: relative;
}

.chart-container {
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 0;
  border-radius: 8px;
  position: relative;
  z-index: 1 !important;
  overflow: visible;
  background: transparent;
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
  to {
    transform: rotate(360deg);
  }
}
</style>
