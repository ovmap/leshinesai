<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'
import { message } from 'ant-design-vue'
import { queryVolumeTableRate } from '../../../services/transportApi'
import { useSelectOptionsStore } from '../../../stores/selectOptionsStore'
import { useGlobalFilterStore } from '../../../stores/globalFilterStore'
import { useDashboardDataStore } from '../../../stores/dashboardDataStore'

// 使用公共 store
const selectOptionsStore = useSelectOptionsStore()
const globalFilterStore = useGlobalFilterStore()
const dataStore = useDashboardDataStore()
const dataSourceOptions = computed(() => selectOptionsStore.dataSourceOptions)
const volumeAggOptions = computed(() => selectOptionsStore.volumeAggOptions)

// 统计维度选项（固定两个选项）
const statDimensionOptions = computed(() => [
  { code: '1', name: '始发仓&目的省份' },
  { code: '2', name: '目的城市' }
])

// 选中的值
const selectedStatDimension = ref<string>('1') // 统计维度，默认选择第一个
const selectedDataSource = ref<string[]>([]) // 数据源，多选
const selectedVolumeAgg = ref<string>('') // 体积，单选

// 日期范围选择 - 默认当月1号到当天
const dateRange = ref<[Dayjs, Dayjs]>([
  dayjs().startOf('month'),
  dayjs()
])

// 下拉框状态
const isStatDimensionOpen = ref(false)
const isDataSourceOpen = ref(false)
const isVolumeAggOpen = ref(false)

// 表格数据
const tableData = ref<any[]>([])
const loading = ref(false)

// 初始化标志，用于避免初始化时的重复请求
const isInitialized = ref(false)

// 表格容器引用
const tableSectionRef = ref<HTMLElement | null>(null)
const tableScrollY = ref<number>(300)

// 获取当前选中的体积选项名称，用于动态设置表头
const currentVolumeAggName = computed(() => {
  if (!selectedVolumeAgg.value) {
    return '体积'
  }
  const option = volumeAggOptions.value.find(opt => opt.code === selectedVolumeAgg.value)
  return option?.name || '体积'
})

// 表格列（根据统计维度动态变化）
const tableColumns = computed(() => {
  if (selectedStatDimension.value === '1') {
    // 始发仓&目的省份
    return [
      {
        title: '排名',
        key: 'rank',
        dataIndex: 'rank',
        width: 80,
        align: 'center' as const,
        customRender: ({ index }: { index: number }) => {
          const rank = String(index + 1).padStart(2, '0')
          return rank
        }
      },
      {
        title: '始发仓',
        key: 'fromWarehouse',
        dataIndex: 'fromWarehouse',
        width: 150,
        align: 'center' as const
      },
      {
        title: '目的省份',
        key: 'toProvince',
        dataIndex: 'toProvince',
        width: 200,
        align: 'center' as const
      },
      {
        title: currentVolumeAggName.value,
        key: 'volume',
        dataIndex: 'volume',
        width: 150,
        align: 'center' as const,
        customRender: ({ text }: { text: number }) => {
          if (text === undefined || text === null) return '0'
          
          // 检查当前选中的体积选项是否是"单台体积/平均运单体积/平均发货单体积"
          const currentVolumeAgg = volumeAggOptions.value.find(opt => opt.code === selectedVolumeAgg.value)
          const volumeAggName = currentVolumeAgg?.name || ''
          const isVolumeType = volumeAggName.includes('单台体积') || 
                               volumeAggName.includes('平均运单体积') || 
                               volumeAggName.includes('平均发货单体积')
          
          // 如果是体积类型，只使用toFixed(2)，不使用toLocaleString
          if (isVolumeType) {
            return text.toFixed(2)
          } else {
            return Math.floor(text).toLocaleString()
          }
        }
      },
      {
        title: '占比',
        key: 'percentage',
        dataIndex: 'percentage',
        width: 150,
        align: 'center' as const,
        customRender: ({ text }: { text: number }) => {
          return (text !== null && text !== undefined) ? `${Number(text).toFixed(2)}%` : '-'
        }
      }
    ]
  } else {
    // 目的城市
    return [
      {
        title: '排名',
        key: 'rank',
        dataIndex: 'rank',
        width: 80,
        align: 'center' as const,
        customRender: ({ index }: { index: number }) => {
          const rank = String(index + 1).padStart(2, '0')
          return rank
        }
      },
      {
        title: '目的城市',
        key: 'toCity',
        dataIndex: 'toCity',
        width: 250,
        align: 'center' as const
      },
      {
        title: currentVolumeAggName.value,
        key: 'volume',
        dataIndex: 'volume',
        width: 150,
        align: 'center' as const,
        customRender: ({ text }: { text: number }) => {
          if (text === undefined || text === null) return '0'
          
          // 检查当前选中的体积选项是否是"单台体积/平均运单体积/平均发货单体积"
          const currentVolumeAgg = volumeAggOptions.value.find(opt => opt.code === selectedVolumeAgg.value)
          const volumeAggName = currentVolumeAgg?.name || ''
          const isVolumeType = volumeAggName.includes('单台体积') || 
                               volumeAggName.includes('平均运单体积') || 
                               volumeAggName.includes('平均发货单体积')
          
          // 如果是体积类型，只使用toFixed(2)，不使用toLocaleString
          if (isVolumeType) {
            return text.toFixed(2)
          } else {
            return Math.floor(text).toLocaleString()
          }
        }
      },
      {
        title: '占比',
        key: 'percentage',
        dataIndex: 'percentage',
        width: 150,
        align: 'center' as const,
        customRender: ({ text }: { text: number }) => {
          return (text !== null && text !== undefined) ? `${Number(text).toFixed(2)}%` : '-'
        }
      }
    ]
  }
})

// 显示文本
const displayStatDimension = computed(() => {
  const option = statDimensionOptions.value.find(opt => opt.code === selectedStatDimension.value)
  return option?.name || '统计维度'
})

const displayDataSource = computed(() => {
  if (selectedDataSource.value.length === 0) {
    return '数据源'
  }
  if (selectedDataSource.value.length === dataSourceOptions.value.length) {
    return '数据源'
  }
  if (selectedDataSource.value.length === 1) {
    const option = dataSourceOptions.value.find(opt => opt.code === selectedDataSource.value[0])
    return option?.name || selectedDataSource.value[0]
  }
  return `数据源(${selectedDataSource.value.length})`
})

const displayVolumeAgg = computed(() => {
  const option = volumeAggOptions.value.find(opt => opt.code === selectedVolumeAgg.value)
  return option?.name || '体积'
})

// 下拉框切换
const toggleStatDimensionDropdown = () => {
  isStatDimensionOpen.value = !isStatDimensionOpen.value
  if (isStatDimensionOpen.value) {
    closeOtherDropdowns('statDimension')
  }
}

const toggleDataSourceDropdown = () => {
  isDataSourceOpen.value = !isDataSourceOpen.value
  if (isDataSourceOpen.value) {
    closeOtherDropdowns('dataSource')
  }
}

const toggleVolumeAggDropdown = () => {
  isVolumeAggOpen.value = !isVolumeAggOpen.value
  if (isVolumeAggOpen.value) {
    closeOtherDropdowns('volumeAgg')
  }
}

const closeAllDropdowns = () => {
  isStatDimensionOpen.value = false
  isDataSourceOpen.value = false
  isVolumeAggOpen.value = false
}

const closeOtherDropdowns = (current: string) => {
  if (current !== 'statDimension') isStatDimensionOpen.value = false
  if (current !== 'dataSource') isDataSourceOpen.value = false
  if (current !== 'volumeAgg') isVolumeAggOpen.value = false
}

// 选择选项
const selectStatDimension = (option: { code: string, name: string }) => {
  selectedStatDimension.value = option.code
  isStatDimensionOpen.value = false
  fetchTableData()
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
  selectedVolumeAgg.value = option.code
  isVolumeAggOpen.value = false
  fetchTableData()
}

// 加载下拉框选项
const loadDropdownOptions = async () => {
  try {
    // 确保公共数据已加载
    await selectOptionsStore.ensureDataLoaded()
  } catch (error) {
    console.error('加载下拉框选项失败:', error)
    message.error('加载下拉框选项失败')
  }
}

// 获取表格数据
const fetchTableData = async () => {
  if (!dateRange.value || !dateRange.value[0] || !dateRange.value[1]) {
    return
  }

  try {
    loading.value = true
    
    const params: any = {
      statType: Number(selectedStatDimension.value), // 转换为数字类型
      startDate: dateRange.value[0].startOf('day').format('YYYY-MM-DD HH:mm:ss'),
      endDate: dateRange.value[1].endOf('day').format('YYYY-MM-DD HH:mm:ss')
    }

    // 添加三大筛选条件：始发仓、目的省、目的RDC（统一从全局筛选store获取，均为数组）
    const filterParams = globalFilterStore.getFilterParams()
    params.fromWarehouse = filterParams.fromWarehouse || []
    params.toProvince = filterParams.toProvince || []
    params.toRdc = filterParams.toRdc || []

    // 添加体积参数
    if (selectedVolumeAgg.value) {
      params.agg = selectedVolumeAgg.value
    }

    // 添加数据源参数，如果没有选择则传空数组
    params.dataSource = selectedDataSource.value.length > 0 ? selectedDataSource.value : []

    const result = await queryVolumeTableRate(params)
    if (result && result.code === 200 && result.data) {
      dataStore.updateModuleData('tablePercentage', result.data)
      const data = Array.isArray(result.data) ? result.data : []
      tableData.value = data.map((item: any, index: number) => {
        // 处理 value：字符串转数字
        const volume = typeof item.value === 'string' 
          ? parseFloat(item.value) || 0 
          : (typeof item.value === 'number' ? item.value : 0)
        
        // 处理 rate：去掉 % 符号并转换为数字
        let percentage = 0
        if (item.rate) {
          const rateStr = typeof item.rate === 'string' 
            ? item.rate.replace('%', '') 
            : String(item.rate)
          percentage = parseFloat(rateStr) || 0
        }
        
        return {
          ...item,
          rank: index + 1,
          volume: volume,
          percentage: percentage,
          fromWarehouse: item.fromWarehouse || '',
          toProvince: item.toProvince || '',
          toCity: item.toCity || ''
        }
      })
    } else {
      tableData.value = []
    }
  } catch (error) {
    console.error('获取表格数据失败:', error)
    message.error('获取表格数据失败')
    tableData.value = []
  } finally {
    loading.value = false
    // 数据加载完成后重新计算滚动高度
    calculateTableScrollY()
  }
}

// 监听统计维度变化
watch(selectedStatDimension, () => {
  if (isInitialized.value) {
    fetchTableData()
  }
})

// 监听数据源变化
watch(selectedDataSource, () => {
  if (isInitialized.value) {
    fetchTableData()
  }
}, { deep: true })

// 监听header的筛选条件变化（始发仓、目的省、目的RDC）
watch([
  () => globalFilterStore.selectedWarehouse,
  () => globalFilterStore.selectedProvince,
  () => globalFilterStore.selectedRdc
], () => {
  if (isInitialized.value) {
    fetchTableData()
  }
}, { deep: true })

// 防抖定时器
let dateRangeDebounceTimer: ReturnType<typeof setTimeout> | null = null

// 监听日期范围变化（使用防抖避免多次请求）
watch(dateRange, () => {
  if (!isInitialized.value) {
    return
  }
  // 清除之前的定时器
  if (dateRangeDebounceTimer) {
    clearTimeout(dateRangeDebounceTimer)
  }
  // 设置新的定时器，300ms 后执行请求
  dateRangeDebounceTimer = setTimeout(() => {
    fetchTableData()
    dateRangeDebounceTimer = null
  }, 300)
}, { deep: true })

// 组件挂载
onMounted(async () => {
  await loadDropdownOptions()
  
  // 等待数据加载完成，确保选项数据有值
  await nextTick()
  
  // 设置数据源默认全选
  if (dataSourceOptions.value && dataSourceOptions.value.length > 0) {
    selectedDataSource.value = dataSourceOptions.value.map(item => item.code)
  }
  
  // 设置体积默认选择第一个 - 确保使用最新的数据
  if (volumeAggOptions.value && volumeAggOptions.value.length > 0) {
    selectedVolumeAgg.value = volumeAggOptions.value[0]?.code || ''
  }
  
  // 初始化完成，调用一次数据获取
  await fetchTableData()
  
  // 标记初始化完成，之后 watch 监听器才会生效
  isInitialized.value = true
  
  // 点击外部关闭下拉框
  document.addEventListener('click', handleClickOutside)
  
  // 等待表格渲染完成后计算滚动高度
  await nextTick()
  calculateTableScrollY()
  
  // 监听窗口大小变化
  window.addEventListener('resize', calculateTableScrollY)
  
  // 使用 ResizeObserver 监听容器大小变化
  if (tableSectionRef.value) {
    const resizeObserver = new ResizeObserver(() => {
      calculateTableScrollY()
    })
    resizeObserver.observe(tableSectionRef.value)
    ;(tableSectionRef.value as any)._resizeObserver = resizeObserver
  }
})

// 组件卸载
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', calculateTableScrollY)
  
  // 清理防抖定时器
  if (dateRangeDebounceTimer) {
    clearTimeout(dateRangeDebounceTimer)
    dateRangeDebounceTimer = null
  }
  
  // 清理 ResizeObserver
  if (tableSectionRef.value && (tableSectionRef.value as any)._resizeObserver) {
    (tableSectionRef.value as any)._resizeObserver.disconnect()
  }
})

// 点击外部关闭下拉框
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target.closest('.dropdown-item') && !target.closest('.dropdown-content')) {
    closeAllDropdowns()
  }
}

// 计算表格滚动高度
const calculateTableScrollY = () => {
  nextTick(() => {
    if (tableSectionRef.value) {
      const containerHeight = tableSectionRef.value.clientHeight
      // 动态测量表头高度
      const tableHeader = tableSectionRef.value.querySelector('.ant-table-thead') as HTMLElement
      const headerHeight = tableHeader ? tableHeader.offsetHeight : 40
      // 扣除表头高度和底部边距
      const calculatedHeight = containerHeight - headerHeight - 16
      tableScrollY.value = Math.max(calculatedHeight, 150)
    }
  })
}
</script>

<template>
  <div class="table-percentage-container">
    <!-- 标题栏 -->
    <div class="header-bar">
      <h2 class="header-title">货量(表格占比)</h2>
    </div>

    <!-- 控制面板 -->
    <div class="control-panel">
      <div class="dropdown-group">
        <!-- 日期范围选择器 -->
        <a-range-picker
          v-model:value="dateRange"
          format="YYYY-MM-DD"
          separator="至"
          class="date-range-picker"
          :show-time="false"
        />
        <!-- 统计维度下拉框 -->
        <div class="dropdown-item" @click.stop="toggleStatDimensionDropdown">
          <span class="dropdown-text">{{ displayStatDimension }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isStatDimensionOpen" @click.stop>
            <div class="options-list">
              <div 
                v-for="option in statDimensionOptions" 
                :key="option.code" 
                class="dropdown-option"
                :class="{ 'selected': selectedStatDimension === option.code }" 
                @click.stop="selectStatDimension(option)"
              >
                <span class="checkmark" v-if="selectedStatDimension === option.code">&#10003;</span>
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

    <!-- 表格区域 -->
    <div class="table-section" ref="tableSectionRef">
      <div v-if="loading" class="loading-overlay">
        <div class="loading-spinner"></div>
      </div>
      <a-table 
        :columns="tableColumns" 
        :data-source="tableData" 
        :pagination="false"
        size="small" 
        class="custom-table"
        :scroll="{ x: 1000, y: tableScrollY }"
      />
    </div>
  </div>
</template>

<style scoped>
.table-percentage-container {
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
  padding: 0.2rem;
  max-height: 7.6rem;
  overflow-y: auto;
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

/* 表格区域 */
.table-section {
  flex: 1;
  overflow: hidden;
  min-height: 0;
  padding: 0 0 1rem;
  display: flex;
  flex-direction: column;
  position: relative;
}

.table-section :deep(.ant-spin-nested-loading),
.table-section :deep(.ant-spin-container) {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-section :deep(.ant-table-wrapper) {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.table-section :deep(.ant-table-container) {
  flex: 1;
  overflow-x: auto;
  width: 100%;
  min-height: 0;
}

/* 自定义滚动条样式 */
.table-section::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

.table-section::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}

.table-section::-webkit-scrollbar-thumb {
  background: rgba(74, 158, 255, 0.3);
  border-radius: 2px;
}

.table-section::-webkit-scrollbar-thumb:hover {
  background: rgba(74, 158, 255, 0.5);
}

.table-section::-webkit-scrollbar-corner {
  background: rgba(0, 0, 0, 0.1);
}

/* Firefox 滚动条样式 */
.table-section {
  scrollbar-width: thin;
  scrollbar-color: rgba(74, 158, 255, 0.3) rgba(0, 0, 0, 0.1);
}

.custom-table :deep(.ant-table) {
  background: transparent;
}

.custom-table :deep(.ant-table-thead > tr > th) {
  background: rgba(74, 158, 255, 0.1);
  border-bottom: 1px solid rgba(74, 158, 255, 0.3);
  color: white;
  font-weight: 600;
  font-size: 0.875rem;
}

.custom-table :deep(.ant-table-tbody > tr > td) {
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(74, 158, 255, 0.1);
  color: white;
  font-size: 0.8125rem;
}

.custom-table :deep(.ant-table-tbody > tr:hover > td) {
  background: rgba(74, 158, 255, 0.1);
}

.custom-table :deep(.ant-table-tbody > tr:nth-child(even) > td) {
  background: rgba(255, 255, 255, 0.02);
}

/* 表格容器滚动条样式 */
.custom-table :deep(.ant-table-container)::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

.custom-table :deep(.ant-table-container)::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}

.custom-table :deep(.ant-table-container)::-webkit-scrollbar-thumb {
  background: rgba(74, 158, 255, 0.3);
  border-radius: 2px;
}

.custom-table :deep(.ant-table-container)::-webkit-scrollbar-thumb:hover {
  background: rgba(74, 158, 255, 0.5);
}

.custom-table :deep(.ant-table-container)::-webkit-scrollbar-corner {
  background: rgba(0, 0, 0, 0.1);
}

/* Firefox 滚动条样式 */
.custom-table :deep(.ant-table-container) {
  scrollbar-width: thin;
  scrollbar-color: rgba(74, 158, 255, 0.3) rgba(0, 0, 0, 0.1);
}

/* 表格主体滚动条样式 */
.custom-table :deep(.ant-table-body) {
  scrollbar-width: thin;
  scrollbar-color: rgba(74, 158, 255, 0.3) rgba(0, 0, 0, 0.1);
}

.custom-table :deep(.ant-table-body)::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

.custom-table :deep(.ant-table-body)::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}

.custom-table :deep(.ant-table-body)::-webkit-scrollbar-thumb {
  background: rgba(74, 158, 255, 0.3);
  border-radius: 2px;
}

.custom-table :deep(.ant-table-body)::-webkit-scrollbar-thumb:hover {
  background: rgba(74, 158, 255, 0.5);
}

.custom-table :deep(.ant-table-body)::-webkit-scrollbar-corner {
  background: rgba(0, 0, 0, 0.1);
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
