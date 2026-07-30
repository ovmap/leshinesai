<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { queryEnergyPrice } from '../../../services/transportApi'

// Tab切换状态
const activeTab = ref<'domestic' | 'international'>('domestic')

// 能源价格数据
const energyPriceData = ref({
  domestic: null as any,
  international: null as any
})

const loading = ref(false)

// 计算时间范围 - 近6个月
const getTimeRange = () => {
  const now = new Date()
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1)
  const startDate = new Date(now.getFullYear(), now.getMonth() - 4)
  return {
    startDate: startDate.toISOString().slice(0, 7),
    endDate: endDate.toISOString().slice(0, 7)
  }
}

// 图表相关
const chartRef = ref<HTMLDivElement | null>(null)
let myChart: echarts.ECharts | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// 加载数据
const loadData = async (isInternational: boolean) => {
  try {
    loading.value = true
    const { startDate, endDate } = getTimeRange()
    const result = await queryEnergyPrice({ startDate, endDate, international: isInternational })
    if (result?.code === 200 && result.data) {
      if (isInternational) {
        energyPriceData.value.international = result.data
      } else {
        energyPriceData.value.domestic = result.data
      }
      updateChart()
    }
  } catch (error) {
    console.error('获取能源价格数据失败:', error)
  } finally {
    loading.value = false
  }
}

// Tab切换
const switchTab = (tab: 'domestic' | 'international') => {
  activeTab.value = tab
  if (tab === 'domestic' && !energyPriceData.value.domestic) {
    loadData(false)
  } else if (tab === 'international' && !energyPriceData.value.international) {
    loadData(true)
  } else {
    nextTick(() => updateChart())
  }
}

// 初始化图表
const initChart = () => {
  if (!chartRef.value) return
  if (myChart) {
    myChart.dispose()
    myChart = null
  }
  myChart = echarts.init(chartRef.value)
  myChart.setOption(chartOptions.value)
}

// 更新图表
const updateChart = () => {
  if (!myChart) {
    initChart()
    return
  }

  const currentData = activeTab.value === 'domestic' ? energyPriceData.value.domestic : energyPriceData.value.international
  if (!currentData?.items) return

  const months = currentData.items.map((item: any) => `${item.month}月`)
  const gasolineData = currentData.items.map((item: any) => ({ value: parseFloat(item.gasoline), event: item.event }))
  const dieselData = currentData.items.map((item: any) => ({ value: item.diesel, event: item.event }))
  const aircraftFuelData = currentData.items.map((item: any) => ({ value: item.aircraftFuel, event: item.event }))

  const isDomestic = activeTab.value === 'domestic'

  const series = [
    {
      name: '汽油',
      type: 'line',
      data: gasolineData,
      itemStyle: { color: '#F5A623' },
      lineStyle: { color: '#F5A623', width: 3 },
      smooth: 0.5,
      symbol: 'none',
      symbolSize: 10,
      showSymbol: false,
      yAxisIndex: !isDomestic ? 1 : 0,
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(245, 166, 35, 0.3)' },
            { offset: 1, color: 'rgba(245, 166, 35, 0.05)' }
          ]
        }
      },
      emphasis: {
        symbol: 'circle', symbolSize: 10,
        itemStyle: { color: '#F5A623', borderColor: '#FFFFFF', borderWidth: 2 }
      }
    },
    {
      name: '柴油',
      type: isDomestic ? 'line' : 'bar',
      data: dieselData,
      itemStyle: isDomestic ? { color: '#00D4AA' } : {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: '#4DD4B8' },
            { offset: 1, color: '#00D4AA' }
          ]
        },
        borderRadius: [8, 8, 0, 0],
        shadowColor: 'rgba(0, 212, 170, 0.3)',
        shadowBlur: 8,
        shadowOffsetY: 4
      },
      lineStyle: { color: '#00D4AA', width: 3 },
      smooth: isDomestic ? 0.5 : false,
      symbol: isDomestic ? 'none' : 'circle',
      symbolSize: 10,
      showSymbol: false,
      yAxisIndex: 0,
      barWidth: 12,
      barGap: '15%',
      barCategoryGap: '25%',
      areaStyle: isDomestic ? {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(0, 212, 170, 0.3)' },
            { offset: 1, color: 'rgba(0, 212, 170, 0.05)' }
          ]
        }
      } : undefined,
      emphasis: isDomestic ? {
        symbol: 'circle', symbolSize: 10,
        itemStyle: { color: '#00D4AA', borderColor: '#FFFFFF', borderWidth: 2 }
      } : undefined
    },
    {
      name: '航空燃油',
      type: isDomestic ? 'line' : 'bar',
      data: aircraftFuelData,
      itemStyle: isDomestic ? { color: '#9C88FF' } : {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: '#B8A9FF' },
            { offset: 1, color: '#9C88FF' }
          ]
        },
        borderRadius: [8, 8, 0, 0],
        shadowColor: 'rgba(156, 136, 255, 0.3)',
        shadowBlur: 8,
        shadowOffsetY: 4
      },
      lineStyle: { color: '#9C88FF', width: 3 },
      smooth: isDomestic ? 0.5 : false,
      symbol: isDomestic ? 'none' : 'circle',
      symbolSize: 10,
      showSymbol: false,
      yAxisIndex: 0,
      barWidth: 12,
      barGap: '15%',
      barCategoryGap: '25%',
      areaStyle: isDomestic ? {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(156, 136, 255, 0.3)' },
            { offset: 1, color: 'rgba(156, 136, 255, 0.05)' }
          ]
        }
      } : undefined,
      emphasis: isDomestic ? {
        symbol: 'circle', symbolSize: 10,
        itemStyle: { color: '#9C88FF', borderColor: '#FFFFFF', borderWidth: 2 }
      } : undefined
    }
  ]

  const option = {
    ...chartOptions.value,
    xAxis: { ...chartOptions.value.xAxis, data: months },
    series
  }

  myChart.setOption(option, true)
  setTimeout(() => { myChart?.resize() }, 100)
}

// 图表配置
const chartOptions = computed(() => {
  const isDomestic = activeTab.value === 'domestic'
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: '#4A90E2',
      borderWidth: 1,
      confine: true,
      textStyle: { color: '#FFFFFF', lineHeight: 18 },
      extraCssText: 'max-width: 200px; word-wrap: break-word; white-space: pre-wrap;',
      formatter: function (params: any) {
        let result = `${params[0].axisValue}<br/>`
        params.forEach((item: any) => {
          if (isDomestic) {
            result += `${item.marker}${item.seriesName}: ${item.value}￥/吨<br/>`
          } else {
            const unit = item.seriesName === '汽油' ? '加仑' : '$/桶'
            result += `${item.marker}${item.seriesName}: ${item.value}${unit}<br/>`
          }
        })
        const firstParam = params[0]
        if (firstParam?.data?.event) {
          result += `关键事件: ${firstParam.data.event}`
        }
        return result
      }
    },
    legend: {
      orient: 'horizontal',
      bottom: '1%',
      left: 'center',
      itemGap: 30,
      textStyle: { color: '#FFFFFF', fontSize: 10 },
      itemWidth: 12,
      itemHeight: 8,
      padding: [10, 0]
    },
    grid: {
      left: '8%',
      right: '8%',
      top: '20%',
      bottom: '22%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: [],
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.3)' } },
      axisLabel: { color: '#FFFFFF', fontSize: 12 },
      splitLine: { show: false }
    },
    yAxis: [
      {
        type: 'value',
        name: isDomestic ? '￥/吨' : '$/桶',
        nameTextStyle: { color: '#FFFFFF', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.3)' } },
        axisLabel: { color: '#FFFFFF', fontSize: 11, formatter: '{value}' },
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)', type: 'dashed' } },
        min: isDomestic ? 3000 : 0,
        max: 'dataMax'
      },
      ...(!isDomestic ? [{
        type: 'value',
        name: '加仑',
        nameTextStyle: { color: '#FFFFFF', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.3)' } },
        axisLabel: { color: '#FFFFFF', fontSize: 11, formatter: '{value}' },
        splitLine: { show: false },
        min: 0,
        max: 'dataMax'
      }] : [])
    ],
    series: []
  }
})

// 窗口resize处理
const handleResize = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { myChart?.resize() }, 300)
}

onMounted(async () => {
  await nextTick()
  initChart()
  loadData(false)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (myChart) { myChart.dispose(); myChart = null }
  window.removeEventListener('resize', handleResize)
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
})
</script>

<template>
  <div class="energy-prices-wrapper">
    <div class="header-bar">
      <h2 class="header-title">能源价格趋势</h2>
    </div>
    <div class="energy-prices-container">
      <!-- Tab切换 -->
      <div class="tab-section">
        <div class="tab-container">
          <button
            class="tab-button"
            :class="{ active: activeTab === 'domestic' }"
            @click="switchTab('domestic')"
          >国内</button>
          <button
            class="tab-button"
            :class="{ active: activeTab === 'international' }"
            @click="switchTab('international')"
          >国际</button>
        </div>
      </div>

      <!-- 图表 -->
      <div class="chart-section">
        <div ref="chartRef" class="chart-container"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.energy-prices-wrapper {
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

.energy-prices-container {
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-section {
  padding: 0.2rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tab-container {
  width: 30%;
  margin: 0 auto;
  display: flex;
  justify-content: center;
  gap: 0.5rem;
}

.tab-button {
  padding: 0.2rem 0.8rem;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  white-space: nowrap;
  flex: 0 0 auto;
}

.tab-button:hover {
  color: rgba(255, 255, 255, 0.9);
}

.tab-button.active {
  color: #4A90E2;
  font-weight: 600;
}

.tab-button.active::after {
  content: '';
  position: absolute;
  bottom: -0.3rem;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  height: 2px;
  background: #4A90E2;
}

.chart-section {
  flex: 1;
  min-height: 0;
  position: relative;
}

.chart-container {
  width: 100%;
  height: 100%;
}
</style>
