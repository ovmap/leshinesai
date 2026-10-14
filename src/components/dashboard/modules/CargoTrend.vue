<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import {
  queryVolume,
  queryTransTypeList,
  queryTimeTypeList,
  queryCityLevelList,
  queryProductTypeList,
  queryDataSourceList,
} from '../../../services/transportApi'
import { useDashboardControlStore } from '../../../stores/dashboardControlStore'
import { useDashboardDataStore } from '../../../stores/dashboardDataStore'

const controlStore = useDashboardControlStore()
const dataStore = useDashboardDataStore()

// 接收模块专属筛选（来自 ModulesRender 传递的控制 Store 筛选）
const props = defineProps<{
  fromWarehouse?: string[]
  toProvince?: string[]
  toRdc?: string[]
  timeType?: string
  dateRange?: string
  dataSource?: string[]
  metric?: string
}>()

const chartRef = ref<HTMLDivElement | null>(null)
let myChart: echarts.ECharts | null = null
let resizeTimer: NodeJS.Timeout | null = null

// 控制面板数据
const selectedYear = ref('CALENDAR_YEAR')
const selectedDateTimeRange = ref<any>(null)
const selectedDataSource = ref<string[]>([])
const selectedMetric = ref('VOLUME')

// 下拉框状态
const isYearOpen = ref(false)
const isTimePickerOpen = ref(false)
const isDataSourceOpen = ref(false)
const isMetricOpen = ref(false)

// 选项数据
const yearOptions = ref<{ code: string; name: string }[]>([])
const dataSourceOptions = ref<{ code: string; name: string }[]>([])
const metricOptions = ref<{ code: string; name: string }[]>([
  { code: 'VOLUME', name: '订单数量' },
  { code: 'WEIGHT', name: '重量' },
  { code: 'VOLUME_SIZE', name: '体积' },
])

// 时间预设
const timePresets = [
  {
    label: '本月',
    value: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return [dayjs(start), dayjs(end)]
    },
  },
  {
    label: '上月',
    value: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return [dayjs(start), dayjs(end)]
    },
  },
  {
    label: '近3个月',
    value: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return [dayjs(start), dayjs(end)]
    },
  },
  {
    label: '今年',
    value: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), 0, 1)
      const end = new Date(now.getFullYear(), 11, 31)
      return [dayjs(start), dayjs(end)]
    },
  },
  {
    label: '去年',
    value: () => {
      const now = new Date()
      const start = new Date(now.getFullYear() - 1, 0, 1)
      const end = new Date(now.getFullYear() - 1, 11, 31)
      return [dayjs(start), dayjs(end)]
    },
  },
]

// 根据时间维度计算默认日期范围
const getDefaultDateRange = (timeType: string) => {
  const today = dayjs()
  switch (timeType) {
    case 'CALENDAR_YEAR':
      return [dayjs().subtract(2, 'year').startOf('year'), today]
    case 'FICAL_YEAR':
      const twoYearsAgo = dayjs().subtract(2, 'year')
      return [twoYearsAgo.month(3).startOf('month'), today]
    case 'CALENDAR_QUARTER':
      return [dayjs().subtract(1, 'year').startOf('year'), today]
    case 'FICAL_QUARTER':
      const oneYearAgo = dayjs().subtract(1, 'year')
      return [oneYearAgo.month(3).startOf('month'), today]
    case 'MONTH':
      return [dayjs().subtract(1, 'year').startOf('year'), today]
    case 'WEEK':
      const eightWeeksAgo = dayjs().subtract(8, 'week').startOf('week')
      return [eightWeeksAgo.add(1, 'day'), today]
    case 'DAY':
      return [dayjs().subtract(30, 'day'), today]
    default:
      return [dayjs().subtract(2, 'year').startOf('year'), today]
  }
}

// 格式化时间范围
const formatDateRange = (dateRange: any[] | null) => {
  if (dateRange && Array.isArray(dateRange) && dateRange.length === 2 && dateRange[0] && dateRange[1]) {
    return {
      startDate: dateRange[0].format('YYYY-MM-DD') + ' 00:00:00',
      endDate: dateRange[1].format('YYYY-MM-DD') + ' 23:59:59',
    }
  }
  const defaultRange = getDefaultDateRange(selectedYear.value)
  return {
    startDate: defaultRange[0].format('YYYY-MM-DD') + ' 00:00:00',
    endDate: defaultRange[1].format('YYYY-MM-DD') + ' 23:59:59',
  }
}

// 显示文本
const selectedYearText = computed(() => {
  const option = yearOptions.value.find((item) => item.code === selectedYear.value)
  return option ? option.name : '自然年'
})

const selectedDataSourceText = computed(() => {
  if (selectedDataSource.value.length === 0) return '全部数据源'
  const names = selectedDataSource.value.map((code) => {
    const option = dataSourceOptions.value.find((item) => item.code === code)
    return option ? option.name : code
  })
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
})

const selectedMetricText = computed(() => {
  const option = metricOptions.value.find((item) => item.code === selectedMetric.value)
  return option ? option.name : '订单数量'
})

// 下拉框控制
const closeAllDropdowns = () => {
  isYearOpen.value = false
  isTimePickerOpen.value = false
  isDataSourceOpen.value = false
  isMetricOpen.value = false
}

const toggleYearDropdown = () => {
  if (isYearOpen.value) {
    isYearOpen.value = false
  } else {
    closeAllDropdowns()
    isYearOpen.value = true
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

const toggleMetricDropdown = () => {
  if (isMetricOpen.value) {
    isMetricOpen.value = false
  } else {
    closeAllDropdowns()
    isMetricOpen.value = true
  }
}

const selectYear = (yearCode: string) => {
  selectedYear.value = yearCode
  const defaultRange = getDefaultDateRange(yearCode)
  selectedDateTimeRange.value = defaultRange
  closeAllDropdowns()
}

const selectDataSource = (source: string) => {
  const index = selectedDataSource.value.indexOf(source)
  if (index > -1) {
    selectedDataSource.value.splice(index, 1)
  } else {
    selectedDataSource.value.push(source)
  }
}

const selectMetric = (metric: string) => {
  selectedMetric.value = metric
  closeAllDropdowns()
}

// 时间选择器
const handleTimeRangePickerOpenChange = (open: boolean) => {
  isTimePickerOpen.value = open
  if (open) {
    closeAllDropdowns()
  }
}

const handleTimeRangePickerChange = (dates: any) => {
  let actualDates = dates
  if (typeof dates === 'function') {
    actualDates = dates()
  }
  if (!actualDates || !Array.isArray(actualDates) || actualDates.length !== 2) {
    return
  }
  selectedDateTimeRange.value = actualDates
}

// 更新图表数据
const updateChartData = (apiData: any[]) => {
  if (!myChart || !Array.isArray(apiData)) {
    return
  }

  const groupedData = new Map<string, Map<string, number>>()
  const timeDimensionOrder: string[] = []
  const timeDimensionSet = new Set<string>()

  apiData.forEach((timeItem) => {
    const timeDim = timeItem.timeDimension
    if (!timeDimensionSet.has(timeDim)) {
      timeDimensionOrder.push(timeDim)
      timeDimensionSet.add(timeDim)
    }
    let dataSourceMap = groupedData.get(timeDim)
    if (!dataSourceMap) {
      dataSourceMap = new Map<string, number>()
      groupedData.set(timeDim, dataSourceMap)
    }
    if (timeItem.items && Array.isArray(timeItem.items)) {
      timeItem.items.forEach((item: any) => {
        const dataSource = item.dataSource
        const value = parseFloat(item.value) || 0
        if (dataSourceMap!.has(dataSource)) {
          dataSourceMap!.set(dataSource, dataSourceMap!.get(dataSource)! + value)
        } else {
          dataSourceMap!.set(dataSource, value)
        }
      })
    }
  })

  const allDataSources = new Set<string>()
  groupedData.forEach((timeGroup) => {
    timeGroup.forEach((_value: any, dataSource: string) => {
      allDataSources.add(dataSource)
    })
  })

  const seriesData: { [key: string]: number[] } = {}
  allDataSources.forEach((dataSource) => {
    seriesData[dataSource] = []
    timeDimensionOrder.forEach((timeDim) => {
      const dataSourceMap = groupedData.get(timeDim)
      if (dataSourceMap && dataSourceMap.has(dataSource)) {
        seriesData[dataSource]?.push(dataSourceMap.get(dataSource) || 0)
      } else {
        seriesData[dataSource]?.push(0)
      }
    })
  })

  const yoyData: (number | null)[] = []
  const momData: (number | null)[] = []

  timeDimensionOrder.forEach((timeDim) => {
    const timeItem = apiData.find((item) => item.timeDimension === timeDim)
    if (timeItem) {
      const yoy =
        timeItem.totalYoy !== null && timeItem.totalYoy !== undefined
          ? parseFloat(timeItem.totalYoy.replace('%', ''))
          : null
      const mom =
        timeItem.totalMom !== null && timeItem.totalMom !== undefined
          ? parseFloat(timeItem.totalMom.replace('%', ''))
          : null
      yoyData.push(yoy)
      momData.push(mom)
    } else {
      yoyData.push(null)
      momData.push(null)
    }
  })

  const hasYoyData = yoyData.some((val) => val !== null)
  const hasMomData = momData.some((val) => val !== null)

  const legendData = Array.from(allDataSources).map((dataSource) => {
    const option = dataSourceOptions.value.find((item) => item.code === dataSource)
    return option ? option.name : dataSource
  })

  const dataSourceNameMap = new Map<string, string>()
  Array.from(allDataSources).forEach((dataSource) => {
    const option = dataSourceOptions.value.find((item) => item.code === dataSource)
    dataSourceNameMap.set(dataSource, option ? option.name : dataSource)
  })

  const option = {
    legend: {
      data: legendData,
      top: 0,
      left: 'center',
      itemGap: 20,
      textStyle: { color: '#FFFFFF', fontSize: 11 },
      itemWidth: 12,
      itemHeight: 12,
    },
    grid: {
      left: '3%',
      right: '4%',
      top: '20%',
      bottom: timeDimensionOrder.length > 5 ? '12%' : '8%',
      containLabel: true,
    },
    dataZoom:
      timeDimensionOrder.length > 5
        ? [
            {
              type: 'slider',
              show: true,
              xAxisIndex: [0],
              start: 0,
              end: Math.min(100, (5 / timeDimensionOrder.length) * 100),
              bottom: 8,
              height: 16,
              width: '85%',
              left: '7.5%',
              handleStyle: {
                color: '#ffffff',
                borderColor: '#3b82f6',
                borderWidth: 1,
                borderRadius: 8,
                width: 8,
                height: 16,
                cursor: 'pointer',
              },
              textStyle: { color: '#6b7280', fontSize: 10 },
              backgroundColor: 'rgba(59, 130, 246, 0.05)',
              borderColor: 'rgba(59, 130, 246, 0.15)',
              fillerColor: 'rgba(59, 130, 246, 0.08)',
              showDataShadow: false,
              moveOnMouseMove: true,
              moveOnMouseWheel: true,
              preventDefaultMouseMove: true,
              zoomLock: false,
            },
          ]
        : [],
    xAxis: {
      type: 'category',
      data: timeDimensionOrder,
      axisLine: { lineStyle: { color: '#4a9eff' } },
      axisLabel: { color: '#ffffff', fontSize: 12 },
    },
    yAxis: [
      {
        type: 'value',
        name: '',
        min: 0,
        position: 'left',
        scale: true,
        axisLine: { lineStyle: { color: '#4a9eff' } },
        axisLabel: {
          color: '#ffffff',
          fontSize: 12,
          formatter: function (value: number) {
            if (value >= 1000) {
              return Math.round(value / 1000) + 'k'
            } else {
              return value.toString()
            }
          },
        },
        splitLine: { lineStyle: { color: 'rgba(74, 158, 255, 0.2)' } },
      },
      ...(hasYoyData || hasMomData
        ? [
            {
              type: 'value',
              name: '',
              position: 'right',
              axisLine: { lineStyle: { color: '#ff8c00' } },
              axisLabel: {
                color: '#ffffff',
                fontSize: 12,
                formatter: function (value: number) {
                  return value.toFixed(2) + '%'
                },
              },
              splitLine: { show: false },
            },
          ]
        : []),
    ],
    series: [
      ...(hasMomData
        ? [
            {
              name: '环比',
              type: 'line',
              data: momData,
              yAxisIndex: 1,
              z: 20,
              itemStyle: { color: '#ff8c00' },
              lineStyle: { color: '#ff8c00', width: 3 },
              symbol: 'circle',
              symbolSize: 8,
              label: {
                show: true,
                position: 'insideTop',
                color: '#ffff00',
                fontSize: 12,
                fontWeight: 'bold',
                textBorderColor: '#000000',
                textBorderWidth: 1,
                textShadowColor: 'rgba(0, 0, 0, 0.8)',
                textShadowBlur: 2,
                formatter: function (params: any) {
                  return params.value !== null && params.value !== undefined ? params.value.toFixed(2) + '%' : ''
                },
              },
            },
          ]
        : []),
      ...(hasYoyData
        ? [
            {
              name: '同比',
              type: 'line',
              data: yoyData,
              yAxisIndex: 1,
              z: 19,
              itemStyle: { color: '#00ff88' },
              lineStyle: { color: '#00ff88', width: 3 },
              symbol: 'circle',
              symbolSize: 8,
              label: {
                show: true,
                position: 'insideTop',
                color: '#ffff00',
                fontSize: 12,
                fontWeight: 'bold',
                textBorderColor: '#000000',
                textBorderWidth: 1,
                textShadowColor: 'rgba(0, 0, 0, 0.8)',
                textShadowBlur: 2,
                formatter: function (params: any) {
                  return params.value !== null && params.value !== undefined ? params.value.toFixed(2) + '%' : ''
                },
              },
            },
          ]
        : []),
      ...Array.from(allDataSources).map((dataSource, index) => {
        const colors = ['#2946B6', '#6699FF', '#e0f0ff']
        const color = colors[index % colors.length]
        const dataSourceName = dataSourceNameMap.get(dataSource) || dataSource
        return {
          name: dataSourceName,
          type: 'bar',
          stack: 'total',
          data: seriesData[dataSource],
          yAxisIndex: 0,
          barWidth: 28,
          itemStyle: {
            color: color,
            borderWidth: 0,
            shadowBlur: 4,
            shadowColor: 'rgba(0, 0, 0, 0.1)',
            shadowOffsetY: 2,
          },
          label: { show: false },
          emphasis: {
            itemStyle: {
              shadowBlur: 8,
              shadowColor: 'rgba(0, 0, 0, 0.2)',
              shadowOffsetY: 4,
            },
          },
        }
      }),
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: '#4a9eff',
      confine: true,
      textStyle: { color: '#ffffff' },
      z: 99999,
      zlevel: 99999,
      formatter: function (params: any) {
        let result = ''
        if (params && params.length > 0) {
          result += params[0].axisValue + '<br/>'
          const displayedSeries = new Set()
          params.forEach((param: any) => {
            if (displayedSeries.has(param.seriesName)) return
            const isDataSource = param.seriesName !== '环比' && param.seriesName !== '同比'
            if (isDataSource && typeof param.value === 'number' && Math.abs(param.value) < 0.001) return
            if (!isDataSource && (param.value === null || param.value === undefined)) return
            displayedSeries.add(param.seriesName)
            let value
            if (param.seriesName === '环比' || param.seriesName === '同比') {
              if (param.value === null || param.value === undefined) return
              value = typeof param.value === 'number' ? param.value.toFixed(2) + '%' : param.value
            } else {
              if (typeof param.value === 'number') {
                if (param.value >= 1000) {
                  value = Math.round(param.value / 1000) + 'k'
                } else {
                  value = param.value.toFixed(2)
                }
              } else {
                value = param.value
              }
            }
            result += `<span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:${param.color};"></span>`
            result += param.seriesName + ': ' + value + '<br/>'
          })
        }
        return result
      },
    },
  }

  myChart.setOption(option, true)
}

// 缓存最近一次 API 响应数据（供数据 Store 使用）
const lastApiResponse = ref<any[]>([])

// 同步数据到 Store
const syncToDataStore = () => {
  dataStore.updateModuleData(
    'cargoTrend',
    {
      timeSeries: lastApiResponse.value,
      filters: {
        timeType: selectedYear.value,
        metric: selectedMetric.value,
        dataSource: selectedDataSource.value,
        dateRange: selectedDateTimeRange.value
          ? `${selectedDateTimeRange.value[0]?.format('YYYY-MM-DD')} ~ ${selectedDateTimeRange.value[1]?.format('YYYY-MM-DD')}`
          : '未设置',
        fromWarehouse: props.fromWarehouse?.join(',') || '',
        toProvince: props.toProvince?.join(',') || '',
        toRdc: props.toRdc?.join(',') || '',
      },
    },
  )
}

// 调用 queryVolume 接口
const callQueryVolume = async () => {
  try {
    const { startDate, endDate } = formatDateRange(selectedDateTimeRange.value)
    const params = {
      fromWarehouse: props.fromWarehouse || [],
      toProvince: props.toProvince || [],
      toRdc: props.toRdc || [],
      startDate,
      endDate,
      timeType: selectedYear.value,
      agg: selectedMetric.value,
      customer: [],
      bizType: [],
      transType: [],
      cityLevel: [],
      dataSource: selectedDataSource.value.length > 0 ? selectedDataSource.value : [],
      productType: [],
    }
    const response = await queryVolume(params)
    if (response && response.code === 500) {
      message.error(response.message || '服务器错误')
      return
    }
    if (response && response.code === 200 && response.data) {
      lastApiResponse.value = response.data
      updateChartData(response.data)
      // 同步到数据 Store
      syncToDataStore()
    }
  } catch (error) {
    console.error('获取货量趋势数据失败:', error)
  }
}

// 窗口大小变化
const handleResize = () => {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    if (myChart) myChart.resize()
  }, 100)
}

// 加载选项数据
const loadOptions = async () => {
  try {
    const [timeTypeRes, dsRes] = await Promise.all([queryTimeTypeList(), queryDataSourceList()])
    if (timeTypeRes?.code === 200 && timeTypeRes.data) {
      yearOptions.value = timeTypeRes.data
    }
    if (dsRes?.code === 200 && dsRes.data) {
      dataSourceOptions.value = dsRes.data.filter((i: any) => i?.code)
      selectedDataSource.value = dsRes.data.filter((i: any) => i?.code).map((i: any) => i.code)
    }
  } catch (error) {
    console.error('加载选项数据失败:', error)
  }
}

onMounted(async () => {
  await nextTick()
  await loadOptions()

  const defaultRange = getDefaultDateRange(selectedYear.value)
  selectedDateTimeRange.value = defaultRange

  if (chartRef.value) {
    myChart = echarts.init(chartRef.value)
    await callQueryVolume()
  }

  window.addEventListener('resize', handleResize)
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('.dropdown-group')) {
      closeAllDropdowns()
    }
  })
})

onUnmounted(() => {
  if (myChart) {
    myChart.dispose()
    myChart = null
  }
  window.removeEventListener('resize', handleResize)
  if (resizeTimer) clearTimeout(resizeTimer)
})

watch([selectedDateTimeRange, selectedYear, selectedMetric, selectedDataSource], () => {
  callQueryVolume()
}, { deep: true })

// 监听 props 变化（来自控制 Store 的筛选）
watch(
  () => props,
  (newProps) => {
    let changed = false
    if (newProps.timeType && newProps.timeType !== selectedYear.value) {
      selectedYear.value = newProps.timeType
      const defaultRange = getDefaultDateRange(newProps.timeType)
      selectedDateTimeRange.value = defaultRange
      changed = true
    }
    if (newProps.metric && newProps.metric !== selectedMetric.value) {
      selectedMetric.value = newProps.metric
      changed = true
    }
    if (newProps.dataSource && Array.isArray(newProps.dataSource) && newProps.dataSource.length > 0) {
      selectedDataSource.value = newProps.dataSource
      changed = true
    }
    if (newProps.dateRange && typeof newProps.dateRange === 'string') {
      const parts = newProps.dateRange.split('~').map(s => s.trim())
      if (parts.length === 2) {
        const start = dayjs(parts[0])
        const end = dayjs(parts[1])
        if (start.isValid() && end.isValid()) {
          selectedDateTimeRange.value = [start, end]
          changed = true
        }
      }
    }
    // fromWarehouse/toProvince/toRdc 变化时重新请求
    if (changed || newProps.fromWarehouse || newProps.toProvince || newProps.toRdc) {
      callQueryVolume()
    }
  },
  { deep: true }
)

// 监听控制 Store 的操作队列
watch(
  () => controlStore.pendingActions,
  (actions) => {
    actions.forEach(action => {
      if (action.module !== 'cargoTrend') return
      switch (action.action) {
        case 'refresh':
          callQueryVolume()
          break
        case 'changeTimeType':
          if (action.params?.timeType) {
            selectedYear.value = action.params.timeType
          }
          break
        case 'changeMetric':
          if (action.params?.metric) {
            selectedMetric.value = action.params.metric
          }
          break
      }
      controlStore.consumeAction(action.id)
    })
  },
  { deep: true }
)
</script>

<template>
  <div class="cargo-trend-wrapper">
    <div class="header-bar">
      <h2 class="header-title">货量趋势</h2>
    </div>
    <div class="cargo-trend-container">
    <!-- 控制面板 -->
    <div class="control-panel">
      <div class="dropdown-group">
        <!-- 时间类型 -->
        <div class="dropdown-item" :title="selectedYearText" @click="toggleYearDropdown">
          <span class="dropdown-text">{{ selectedYearText }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isYearOpen" @click.stop>
            <div class="options-list">
              <div
                v-for="option in yearOptions"
                :key="option.code"
                class="dropdown-option"
                :class="{ selected: selectedYear === option.code }"
                @click.stop="selectYear(option.code)"
              >
                <span class="checkmark" v-if="selectedYear === option.code">✓</span>
                {{ option.name }}
              </div>
            </div>
          </div>
        </div>

        <!-- 时间范围 -->
        <div class="time-picker-item">
          <a-tooltip :title="selectedDateTimeRange ? `${selectedDateTimeRange[0]?.format('YYYY-MM-DD')} ~ ${selectedDateTimeRange[1]?.format('YYYY-MM-DD')}` : ''" :mouseEnterDelay="0.5" placement="bottom">
            <a-range-picker
              v-model:value="selectedDateTimeRange"
              placeholder="开始日期"
              format="YYYY-MM-DD"
              separator="~"
              class="time-picker"
              :presets="timePresets"
              @openChange="handleTimeRangePickerOpenChange"
              @change="handleTimeRangePickerChange"
              @calendarChange="handleTimeRangePickerChange"
              @ok="handleTimeRangePickerChange"
            />
          </a-tooltip>
        </div>

        <!-- 数据源 -->
        <div class="dropdown-item" :title="selectedDataSourceText" @click="toggleDataSourceDropdown">
          <span class="dropdown-text">{{ selectedDataSourceText }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isDataSourceOpen" @click.stop>
            <div class="options-list">
              <div
                v-for="source in dataSourceOptions"
                :key="source.code"
                class="dropdown-option"
                :class="{ selected: selectedDataSource.includes(source.code) }"
                @click.stop="selectDataSource(source.code)"
              >
                <span class="checkmark" v-if="selectedDataSource.includes(source.code)">✓</span>
                {{ source.name }}
              </div>
            </div>
          </div>
        </div>

        <!-- 指标 -->
        <div class="dropdown-item" :title="selectedMetricText" @click="toggleMetricDropdown">
          <span class="dropdown-text">{{ selectedMetricText }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isMetricOpen" @click.stop>
            <div class="options-list">
              <div
                v-for="metric in metricOptions"
                :key="metric.code"
                class="dropdown-option"
                :class="{ selected: selectedMetric === metric.code }"
                @click.stop="selectMetric(metric.code)"
              >
                <span class="checkmark" v-if="selectedMetric === metric.code">✓</span>
                {{ metric.name }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 图表区域 -->
    <div class="chart-section">
      <div ref="chartRef" class="chart-container"></div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.cargo-trend-wrapper {
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

.cargo-trend-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.control-panel {
  width: 100%;
  height: 2rem;
  min-height: 2rem;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid rgba(74, 158, 255, 0.25);
  position: relative;
  z-index: 50;
  padding: 0 8px;
  background: linear-gradient(180deg, rgba(10, 20, 40, 0.6) 0%, rgba(15, 30, 55, 0.4) 100%);
}

.dropdown-group {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
  justify-content: flex-start;
  align-items: center;
  width: 100%;
}

.dropdown-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 3px;
  padding: 2px 6px;
  background: url('/dashboard/dlbg.png') center/cover no-repeat,
              rgba(8, 31, 64, 0.9);
  border: 1px solid #2873cc;
  border-radius: 3px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  flex: 1;
  min-width: 0;
  max-width: 100px;
}

.dropdown-item:hover {
  color: white;
  border-color: rgba(74, 158, 255, 0.7);
}

.dropdown-icon {
  width: 10px;
  height: 10px;
  color: rgba(255, 255, 255, 0.7);
  transition: color 0.3s ease;
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

.dropdown-content {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: url('/dashboard/dlbg.png') center/cover no-repeat,
              #081f40;
  border: 1px solid #2873cc;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  z-index: 50;
  margin-top: 4px;
  min-width: 100px;
}

.options-list {
  max-height: 200px;
  overflow-y: auto;
}

.options-list::-webkit-scrollbar {
  width: 4px;
}

.options-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}

.options-list::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.6);
  border-radius: 2px;
}

.dropdown-option {
  padding: 4px 8px;
  color: white;
  font-size: 10px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
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
}

.time-picker-item {
  position: relative;
  z-index: 50;
  flex: 1;
  min-width: 0;
  max-width: 160px;
}

.time-picker {
  width: 100%;
}

:global(.control-panel .time-picker-item .ant-picker) {
  background: url('/dashboard/dlbg.png') center/cover no-repeat,
              #081f40 !important;
  border: 1px solid #2873cc !important;
  color: rgba(255, 255, 255, 0.7) !important;
  font-size: 10px !important;
  height: 22px !important;
}

:global(.control-panel .time-picker-item .ant-picker-input input) {
  color: rgba(255, 255, 255, 0.7) !important;
  font-size: 10px !important;
}

:global(.control-panel .time-picker-item .ant-picker-separator) {
  color: rgba(255, 255, 255, 0.7) !important;
}

:global(.control-panel .time-picker-item .ant-picker-suffix) {
  color: rgba(255, 255, 255, 0.7) !important;
}

.chart-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  padding: 0;
}

.chart-container {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  position: relative;
}
</style>
