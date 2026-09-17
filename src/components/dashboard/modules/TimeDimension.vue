<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import { useSelectOptionsStore } from '../../../stores/selectOptionsStore'
import { queryOnTimeRateTime, exportOnTimeRateTime } from '../../../services/transportApi'

// 定义zoom属性
const props = defineProps({
  zoom: {
    type: [Number, String],
    default: 1,
  },
})

// 获取 stores
const selectOptionsStore = useSelectOptionsStore()

// 从Header组件接收的下拉框数据
const headerWarehouseData = ref<string[]>([])
const headerProvinceData = ref<string[]>([])
const headerRdcData = ref<string[]>([])

// 过滤器状态
const selectedDataSource = ref<string[]>([]) // 数据源
const selectedTimeDimension = ref('FICAL_YEAR') // 时间维度（默认财年）
const selectedTransMode = ref('3') // 运输模式（默认端到端，传参值为3）
const selectedLogisticProvider = ref<string[]>([]) // 物流商
const selectedCustomer = ref<string[]>([]) // 客户（改为多选）
const dateRange = ref<any[]>([])

// 下拉框开关状态
const isDataSourceOpen = ref(false)
const isTimeDimensionOpen = ref(false)
const isTransModeOpen = ref(false)
const isLogisticProviderOpen = ref(false)
const isCustomerOpen = ref(false)

// 运输模式选项（固定选项）
const transModeOptions = ref<Array<{ code: string; name: string; value: number }>>([
  { code: '1', name: '干线', value: 1 },
  { code: '2', name: '配送', value: 2 },
  { code: '3', name: '端到端', value: 3 },
])

// 加载状态
const loading = ref(false)
const exportLoading = ref(false)

// 表格容器引用和高度
const tableWrapperRef = ref<HTMLElement | null>(null)
const tableScrollY = ref<number | undefined>(200) // 默认200，会动态计算

// 表格数据 - 动态时间维度列
const tableData = ref<Array<Record<string, any>>>([])
const timeDimensionColumns = ref<string[]>([]) // 动态列：['202501', '202502', '2025Q1', '2025年']

// 时间维度选项（只保留财年、自然年、月）
const timeDimensionOptions = ref([
  { code: 'FICAL_YEAR', name: '财年' },
  { code: 'CALENDAR_YEAR', name: '自然年' },
  { code: 'MONTH', name: '月' },
])

// 数据源选项
const dataSourceOptions = computed(() => selectOptionsStore.dataSourceOptions || [])

// 物流商选项（使用配送商选项）
const logisticProviderOptions = computed(() => selectOptionsStore.deliveryProviderOptions || [])

// 客户选项
const customerOptions = computed(() => selectOptionsStore.customerOptions || [])

// 搜索关键词
const logisticSearch = ref('')
const customerSearch = ref('')

// 过滤后的物流商选项（包含重置选项）
const filteredLogisticProviderOptions = computed(() => {
  let filtered: { code: string; name: string }[] = []
  
  if (!logisticSearch.value.trim()) {
    filtered = logisticProviderOptions.value
  } else {
    const searchLower = logisticSearch.value.toLowerCase()
    filtered = logisticProviderOptions.value.filter((option: { code: string; name: string }) =>
      option.name.toLowerCase().includes(searchLower)
    )
  }
  
  // 在列表开头添加重置选项
  return [{ code: '__reset__', name: '重置' }, ...filtered]
})

// 过滤后的客户选项（包含重置选项）
const filteredCustomerOptions = computed(() => {
  let filtered: { code: string; name: string }[] = []
  
  if (!customerSearch.value.trim()) {
    filtered = customerOptions.value
  } else {
    const searchLower = customerSearch.value.toLowerCase()
    filtered = customerOptions.value.filter((option: { code: string; name: string }) =>
      option.name.toLowerCase().includes(searchLower)
    )
  }
  
  // 在列表开头添加重置选项
  return [{ code: '__reset__', name: '重置' }, ...filtered]
})

// 初始化日期范围（财年）
const getInitialDateRange = () => {
  const now = dayjs()
  const currentMonth = now.month() + 1 // 1-12
  
  // 财年：如果当前时间为1~3月，则默认去年4月1日到当天；否则今年4月1日到当天
  let startDate: any
  if (currentMonth >= 1 && currentMonth <= 3) {
    startDate = now.subtract(1, 'year').month(3).date(1).startOf('day')
  } else {
    startDate = now.month(3).date(1).startOf('day')
  }
  return [startDate, now.endOf('day')]
}

dateRange.value = getInitialDateRange()

// 默认选中所有数据源
watch(() => dataSourceOptions.value, (options) => {
  if (options.length > 0 && selectedDataSource.value.length === 0) {
    selectedDataSource.value = options.map((item: { code: string; name: string }) => item.code)
  }
}, { immediate: true })

// 显示文本
const selectedDataSourceText = computed(() => {
  if (selectedDataSource.value.length === 0) return '数据源'
  const names = selectedDataSource.value.map((code: string) => {
    const option = dataSourceOptions.value.find((item: { code: string; name: string }) => item.code === code)
    return option ? option.name : code
  })
  return names.join(', ') || '数据源'
})

const selectedTimeDimensionText = computed(() => {
  const option = timeDimensionOptions.value.find(item => item.code === selectedTimeDimension.value)
  return option ? option.name : '时间维度'
})

const selectedTransModeText = computed(() => {
  if (!selectedTransMode.value) return '运输模式'
  const option = transModeOptions.value.find(item => item.code === selectedTransMode.value)
  return option ? option.name : '运输模式'
})

const selectedLogisticProviderText = computed(() => {
  if (selectedLogisticProvider.value.length === 0) return '物流商'
  const names = selectedLogisticProvider.value.map((code: string) => {
    const option = logisticProviderOptions.value.find((item: { code: string; name: string }) => item.code === code)
    return option ? option.name : code
  })
  return names.join(', ') || '物流商'
})

const selectedCustomerText = computed(() => {
  if (selectedCustomer.value.length === 0) return '客户'
  const names = selectedCustomer.value.map((code: string) => {
    const option = customerOptions.value.find((item: { code: string; name: string }) => item.code === code)
    return option ? option.name : code
  })
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
})

// 下拉框切换方法
const toggleDataSourceDropdown = () => {
  if (isDataSourceOpen.value) {
    isDataSourceOpen.value = false
  } else {
    closeAllDropdowns()
    isDataSourceOpen.value = true
  }
}

const toggleTimeDimensionDropdown = () => {
  if (isTimeDimensionOpen.value) {
    isTimeDimensionOpen.value = false
  } else {
    closeAllDropdowns()
    isTimeDimensionOpen.value = true
  }
}

const toggleTransModeDropdown = () => {
  if (isTransModeOpen.value) {
    isTransModeOpen.value = false
  } else {
    closeAllDropdowns()
    isTransModeOpen.value = true
  }
}

const toggleLogisticProviderDropdown = () => {
  if (isLogisticProviderOpen.value) {
    isLogisticProviderOpen.value = false
    logisticSearch.value = '' // 关闭时清空搜索
    loadData() // 关闭时触发数据加载
  } else {
    closeAllDropdowns()
    isLogisticProviderOpen.value = true
    logisticSearch.value = '' // 打开时清空搜索
  }
}

const toggleCustomerDropdown = () => {
  if (isCustomerOpen.value) {
    isCustomerOpen.value = false
    customerSearch.value = '' // 关闭时清空搜索
    loadData() // 关闭时触发数据加载
  } else {
    closeAllDropdowns()
    isCustomerOpen.value = true
    customerSearch.value = '' // 打开时清空搜索
  }
}

// 关闭所有下拉框
const closeAllDropdowns = () => {
  isDataSourceOpen.value = false
  isTimeDimensionOpen.value = false
  isTransModeOpen.value = false
  isLogisticProviderOpen.value = false
  isCustomerOpen.value = false
  // 清空搜索关键词
  logisticSearch.value = ''
  customerSearch.value = ''
}

// 选择方法
const selectDataSource = (code: string) => {
  const index = selectedDataSource.value.indexOf(code)
  if (index > -1) {
    selectedDataSource.value.splice(index, 1)
  } else {
    selectedDataSource.value.push(code)
  }
}

const selectTimeDimension = (code: string) => {
  selectedTimeDimension.value = code
  // 切换时间维度时，自动更新日期范围
  const now = dayjs()
  const currentMonth = now.month() + 1
  
  if (code === 'FICAL_YEAR') {
    // 财年：4月1日作为开始日期
    let startDate: any
    if (currentMonth >= 1 && currentMonth <= 3) {
      startDate = now.subtract(1, 'year').month(3).date(1).startOf('day')
    } else {
      startDate = now.month(3).date(1).startOf('day')
    }
    dateRange.value = [startDate, now.endOf('day')]
  } else if (code === 'CALENDAR_YEAR') {
    // 自然年：1月1日作为开始日期
    const startDate = now.month(0).date(1).startOf('day')
    dateRange.value = [startDate, now.endOf('day')]
  } else if (code === 'MONTH') {
    // 月：当前月的1号作为开始日期
    const startDate = now.date(1).startOf('day')
    dateRange.value = [startDate, now.endOf('day')]
  }
  closeAllDropdowns()
  loadData()
}

const selectTransMode = (code: string) => {
  selectedTransMode.value = selectedTransMode.value === code ? '' : code
  closeAllDropdowns()
  loadData()
}

const selectLogisticProvider = (code: string) => {
  // 如果是重置选项
  if (code === '__reset__') {
    selectedLogisticProvider.value = []
    logisticSearch.value = ''
    // 重置时不关闭下拉框，不触发请求，让用户继续选择
    return
  }
  
  const index = selectedLogisticProvider.value.indexOf(code)
  if (index > -1) {
    selectedLogisticProvider.value.splice(index, 1)
  } else {
    selectedLogisticProvider.value.push(code)
  }
}

const selectCustomer = (code: string) => {
  // 如果是重置选项
  if (code === '__reset__') {
    selectedCustomer.value = []
    customerSearch.value = ''
    // 重置时不关闭下拉框，不触发请求，让用户继续选择
    return
  }
  
  const index = selectedCustomer.value.indexOf(code)
  if (index > -1) {
    selectedCustomer.value.splice(index, 1)
  } else {
    selectedCustomer.value.push(code)
  }
  // 多选时不关闭下拉框，不触发请求
}

// 加载数据
const loadData = async () => {
  try {
    loading.value = true

    const params = {
      fromWarehouse: headerWarehouseData.value.length > 0 
        ? headerWarehouseData.value 
        : [],
      toProvince: headerProvinceData.value.length > 0 
        ? headerProvinceData.value 
        : [],
      toRdc: headerRdcData.value.length > 0 
        ? headerRdcData.value 
        : [],
      dataSource: selectedDataSource.value || [],
      timeType: selectedTimeDimension.value,
      startDate: dateRange.value[0] 
        ? dateRange.value[0].startOf('day').format('YYYY-MM-DD HH:mm:ss')
        : dayjs().subtract(2, 'month').startOf('month').startOf('day').format('YYYY-MM-DD HH:mm:ss'),
      endDate: dateRange.value[1] 
        ? dateRange.value[1].endOf('day').format('YYYY-MM-DD HH:mm:ss')
        : dayjs().endOf('month').endOf('day').format('YYYY-MM-DD HH:mm:ss'),
      transMode: selectedTransMode.value ? parseInt(selectedTransMode.value) : null,
      logisticName: selectedLogisticProvider.value || [],
      customer: selectedCustomer.value || [],
      standardType: ''
    }

    const result = await queryOnTimeRateTime(params)

    if (result && result.code === 200 && result.data) {
      // 处理返回的数据
      processApiData(result.data)
      } else {
        tableData.value = []
      timeDimensionColumns.value = []
      if (result && result.msg) {
        message.error(result.msg)
      }
    }
  } catch (error) {
    console.error('加载数据失败:', error)
    message.error('加载数据失败')
    tableData.value = []
    timeDimensionColumns.value = []
  } finally {
    loading.value = false
  }
}

// 处理API返回的数据
const processApiData = (data: any) => {
  // data 是一个数组，每个元素包含 columnName 和 eteOnTimeRate
  if (Array.isArray(data) && data.length > 0) {
    // 从数组中提取所有 columnName 作为时间维度列
    timeDimensionColumns.value = data.map((item: any) => item.columnName || '').filter((col: string) => col)
    
    // 将数据转换为表格行格式
    // 每一行数据中，columnName 作为列名，eteOnTimeRate 作为该列的值
    const row: Record<string, any> = {}
    data.forEach((item: any) => {
      if (item.columnName) {
        // eteOnTimeRate 已经是百分比格式的字符串（如 "100.00%"），直接使用
        row[item.columnName] = item.eteOnTimeRate || ''
      }
    })
    
    tableData.value = [row]
  } else {
    timeDimensionColumns.value = []
    tableData.value = []
  }
}

// 日期范围变化处理
const handleDateRangeChange = () => {
  loadData()
}


// 导出功能
const handleExport = async () => {
  try {
    exportLoading.value = true

    // 构建导出参数，与 queryOnTimeRateTime 相同
    const params = {
      fromWarehouse: headerWarehouseData.value.length > 0 
        ? headerWarehouseData.value 
        : [],
      toProvince: headerProvinceData.value.length > 0 
        ? headerProvinceData.value 
        : [],
      toRdc: headerRdcData.value.length > 0 
        ? headerRdcData.value 
        : [],
      dataSource: selectedDataSource.value || [],
      timeType: selectedTimeDimension.value,
      startDate: dateRange.value[0] 
        ? dateRange.value[0].startOf('day').format('YYYY-MM-DD HH:mm:ss')
        : dayjs().subtract(2, 'month').startOf('month').startOf('day').format('YYYY-MM-DD HH:mm:ss'),
      endDate: dateRange.value[1] 
        ? dateRange.value[1].endOf('day').format('YYYY-MM-DD HH:mm:ss')
        : dayjs().endOf('month').endOf('day').format('YYYY-MM-DD HH:mm:ss'),
      transMode: selectedTransMode.value ? parseInt(selectedTransMode.value) : null,
      logisticName: selectedLogisticProvider.value || [],
      customer: selectedCustomer.value || [],
      standardType: ''
    }

    const result = await exportOnTimeRateTime(params)

    // 处理导出结果
    if (result && result.code === 200) {
      // 如果返回的是文件流，创建下载链接
      if (result.data) {
        const link = document.createElement('a')
        link.href = result.data
        // 尝试从 URL 中提取文件名，如果没有则使用默认名称
        const xlsxMatch = result.data.match(/([^/]+\.xlsx)$/)
        const downloadFilename = xlsxMatch ? xlsxMatch[1] : `准时交付率-纯时间维度-${dayjs().format('YYYY-MM-DD')}.xlsx`
        link.download = downloadFilename
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        message.success('导出成功')
      } else {
        message.error('导出失败：未返回文件数据')
      }
    } else {
      message.error(result?.msg || '导出失败')
    }
  } catch (error: any) {
    console.error('导出失败:', error)
    
    // 检查是否是409或504状态码
    const errCode = error?.code || error?.response?.status
    if (errCode === 409 || errCode === 504 || errCode === 505) {
      message.error(error.msg || '导出数据量过大，请缩小查询范围')
    } else {
      message.error(error.msg || '导出失败')
    }
  } finally {
    exportLoading.value = false
  }
}

// 格式化百分比显示
const formatRate = (rate: number | string): string => {
  if (rate === null || rate === undefined || rate === '') return ''
  // 如果已经是百分比格式（包含%），直接返回
  if (typeof rate === 'string' && rate.includes('%')) {
    return rate
  }
  // 如果是数字或数字字符串，转换为百分比格式
  const numRate = typeof rate === 'string' ? parseFloat(rate) : rate
  if (isNaN(numRate)) return ''
  // 如果值大于1，说明已经是百分比形式，直接显示；否则乘以100
  const percentageValue = numRate > 1 ? numRate : numRate * 100
  return `${percentageValue.toFixed(2)}%`
}

// 获取百分比的状态图标（根据百分比值判断状态）
const getStatusIcon = (rate: number | string): string => {
  if (!rate && rate !== 0 && rate !== '0') return ''
  
  let numValue: number
  if (typeof rate === 'string') {
    // 如果包含%，去掉%后转换
    const cleanValue = rate.replace('%', '')
    numValue = parseFloat(cleanValue)
  } else {
    numValue = rate
  }
  if (isNaN(numValue)) return ''
  
  // 如果值大于1，说明已经是百分比形式；否则乘以100
  const percentageValue = numValue > 1 ? numValue : numValue * 100
  
  // 根据百分比值返回图标
  if (percentageValue >= 96) return '✓'
  if (percentageValue >= 60) return '−'
  return '✗'
}

// 根据百分比值返回颜色
const getStatusColor = (value: any): string => {
  if (!value || value === '-') return ''
  
  const numValue = parseFloat(String(value).replace('%', ''))
  if (isNaN(numValue)) return ''
  
  // 如果值大于1，说明已经是百分比形式；否则乘以100
  const percentageValue = numValue > 1 ? numValue : numValue * 100
  
  if (percentageValue >= 96) return '#52c41a'
  if (percentageValue >= 60) return '#faad14'
  return '#ff4d4f'
}

// 点击外部关闭下拉框
const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  // 检查是否点击在下拉框相关区域（包括搜索输入框）
  const isClickInsideDropdown = target.closest('.dropdown-item') || 
                                 target.closest('.dropdown-content') ||
                                 target.closest('.search-input') ||
                                 target.closest('.search-box')
  
  if (!isClickInsideDropdown) {
    const hadOpenDropdown = isDataSourceOpen.value || isTimeDimensionOpen.value || 
                           isTransModeOpen.value || isLogisticProviderOpen.value || isCustomerOpen.value
    closeAllDropdowns()
    // 如果有下拉框被关闭，触发请求（对于多选下拉框，关闭时触发）
    if (hadOpenDropdown) {
      loadData()
    }
  }
}

// 计算表格滚动高度
const calculateTableScrollY = () => {
  nextTick(() => {
    if (tableWrapperRef.value) {
      const containerHeight = tableWrapperRef.value.clientHeight
      // 减去一些边距和头部高度，确保有滚动条
      // 如果容器高度很大，使用一个合理的最大值，否则使用计算值
      const calculatedHeight = containerHeight > 300 ? containerHeight - 100 : 200
      tableScrollY.value = calculatedHeight
    }
  })
}

onMounted(async () => {
  // 确保选项数据已加载
  await selectOptionsStore.ensureDataLoaded()
  loadData()
  document.addEventListener('click', handleClickOutside)
  
  // 计算表格滚动高度
  calculateTableScrollY()
  
  // 监听窗口大小变化
  window.addEventListener('resize', calculateTableScrollY)
  
  // 使用 ResizeObserver 监听容器大小变化
  if (tableWrapperRef.value) {
    const resizeObserver = new ResizeObserver(() => {
      calculateTableScrollY()
    })
    resizeObserver.observe(tableWrapperRef.value)
    
    // 保存 observer 以便卸载时清理
    ;(tableWrapperRef.value as any)._resizeObserver = resizeObserver
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', calculateTableScrollY)
  
  // 清理 ResizeObserver
  if (tableWrapperRef.value && (tableWrapperRef.value as any)._resizeObserver) {
    ;(tableWrapperRef.value as any)._resizeObserver.disconnect()
  }
})
</script>

<template>
  <div class="time-dimension-container">

    <!-- 过滤器行 -->
    <div class="filter-section">
      <div class="dropdown-group">
        <!-- 日期范围选择器（保持与 warehousingLogistics/index.vue 相同的靠前顺序） -->
        <div class="date-range-item">
          <a-range-picker
            v-model:value="dateRange"
            format="YYYY-MM-DD"
            separator="至"
            :placeholder="['开始...', '结束...']"
            class="date-range-picker"
            :show-time="false"
            @change="handleDateRangeChange"
          />
        </div>

        <!-- 数据源的下拉框 -->
        <div class="dropdown-item" :class="{ 'dropdown-open': isDataSourceOpen }" :title="selectedDataSourceText" @click.stop="toggleDataSourceDropdown">
          <span class="dropdown-text">{{ selectedDataSourceText }}</span>
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
                @click.stop="selectDataSource(option.code)"
              >
                <span class="checkmark" v-if="selectedDataSource.includes(option.code)">✓</span>
                {{ option.name }}
              </div>
            </div>
          </div>
        </div>

        <!-- 时间维度下拉框 -->
        <div class="dropdown-item" :class="{ 'dropdown-open': isTimeDimensionOpen }" :title="selectedTimeDimensionText" @click.stop="toggleTimeDimensionDropdown">
          <span class="dropdown-text">{{ selectedTimeDimensionText }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isTimeDimensionOpen" @click.stop>
            <div class="options-list">
              <div
                v-for="option in timeDimensionOptions"
                :key="option.code"
                class="dropdown-option"
                :class="{ 'selected': selectedTimeDimension === option.code }"
                @click.stop="selectTimeDimension(option.code)"
              >
                <span class="checkmark" v-if="selectedTimeDimension === option.code">✓</span>
                {{ option.name }}
              </div>
            </div>
          </div>
        </div>

        <!-- 运输模式下拉框（紧跟时间维度，保持与 warehousingLogistics/index.vue 一致） -->
        <div class="dropdown-item" :class="{ 'dropdown-open': isTransModeOpen }" :title="selectedTransModeText" @click.stop="toggleTransModeDropdown">
          <span class="dropdown-text">{{ selectedTransModeText }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isTransModeOpen" @click.stop>
            <div class="options-list">
              <div
                v-for="option in transModeOptions"
                :key="option.code"
                class="dropdown-option"
                :class="{ 'selected': selectedTransMode === option.code }"
                @click.stop="selectTransMode(option.code)"
              >
                <span class="checkmark" v-if="selectedTransMode === option.code">✓</span>
                {{ option.name }}
              </div>
            </div>
          </div>
        </div>

        <!-- 物流商下拉框 -->
        <div class="dropdown-item" :class="{ 'dropdown-open': isLogisticProviderOpen }" :title="selectedLogisticProviderText" @click.stop="toggleLogisticProviderDropdown">
          <span class="dropdown-text">{{ selectedLogisticProviderText }}</span>
          <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
          <div class="dropdown-content" v-show="isLogisticProviderOpen" @click.stop>
            <div class="search-box">
              <input 
                v-model="logisticSearch" 
                type="text" 
                placeholder="搜索物流商..." 
                class="search-input"
                @click.stop 
              />
            </div>
            <div class="options-list">
              <div
                v-for="option in filteredLogisticProviderOptions"
                :key="option.code"
                class="dropdown-option"
                :class="{ 
                  'selected': option.code !== '__reset__' && selectedLogisticProvider.includes(option.code),
                  'reset-option': option.code === '__reset__'
                }"
                @click.stop="selectLogisticProvider(option.code)"
              >
                <span class="checkmark" v-if="option.code !== '__reset__' && selectedLogisticProvider.includes(option.code)">✓</span>
                {{ option.name }}
              </div>
              <div v-if="filteredLogisticProviderOptions.length === 1 && logisticSearch" class="no-results">
                暂无搜索结果
              </div>
            </div>
          </div>
        </div>

        <!-- 客户下拉框 -->
        <div class="dropdown-item" :class="{ 'dropdown-open': isCustomerOpen }" :title="selectedCustomerText" @click.stop="toggleCustomerDropdown">
          <span class="dropdown-text">{{ selectedCustomerText }}</span>
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
                :key="option.code"
                class="dropdown-option"
                :class="{ 
                  'selected': option.code !== '__reset__' && selectedCustomer.includes(option.code),
                  'reset-option': option.code === '__reset__'
                }"
                @click.stop="selectCustomer(option.code)"
              >
                <span class="checkmark" v-if="option.code !== '__reset__' && selectedCustomer.includes(option.code)">✓</span>
                {{ option.name }}
              </div>
              <div v-if="filteredCustomerOptions.length === 1 && customerSearch" class="no-results">
                暂无搜索结果
              </div>
            </div>
          </div>
        </div>

        <!-- 导出按钮 -->
        <div class="export-item">
          <a-button type="primary" :loading="exportLoading" @click="handleExport" class="export-btn">
            导出
          </a-button>
        </div>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="table-wrapper" ref="tableWrapperRef">
      <a-spin :spinning="loading">
        <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
                <th v-for="(col, index) in timeDimensionColumns" :key="index" class="time-column">
                  {{ col }}
                </th>
            </tr>
          </thead>
            <tbody>
              <tr v-if="tableData.length === 0 && !loading">
                <td :colspan="timeDimensionColumns.length" class="no-data">
                  暂无数据
                </td>
              </tr>
              <tr v-for="(row, rowIndex) in tableData" :key="rowIndex">
                <td v-for="(col, colIndex) in timeDimensionColumns" :key="colIndex" class="data-cell">
                  <div class="cell-content">
                    <span 
                      v-if="getStatusIcon(row[col])"
                      class="status-icon"
                      :style="{ color: getStatusColor(row[col]) }"
                    >
                      {{ getStatusIcon(row[col]) }}
                    </span>
                    <span class="rate-value">{{ formatRate(row[col]) }}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        </a-spin>
    </div>
  </div>
</template>

<style scoped>
.time-dimension-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

.filter-section {
  flex-shrink: 0;
  margin-bottom: 0;
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
  padding: 0.75rem 1rem;
  position: relative;
  z-index: 100;
}

.filter-section .dropdown-group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  justify-content: flex-start;
  width: 100%;
  position: relative;
}

.filter-section .dropdown-item {
  position: relative;
  z-index: 100;
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
  min-width: 6rem;
  max-width: 7rem;
  padding: 0.3rem 0.5rem;
  flex-shrink: 1;
}

.filter-section .dropdown-item.dropdown-open {
  z-index: 10000;
}

.filter-section .dropdown-item:hover {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}

.filter-section .dropdown-item .dropdown-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  max-width: 100%;
}

.filter-section .dropdown-item .dropdown-icon {
  width: 0.8rem;
  height: 0.8rem;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.7);
  transition: transform 0.3s ease;
}

.filter-section .dropdown-item .dropdown-content {
  position: absolute;
  top: calc(100% + 0.2rem);
  left: 0;
  right: 0;
  background: #081F40;
  border: 0.0625rem solid rgba(59, 130, 246, 0.6);
  border-radius: 0.1875rem;
  box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.2);
  z-index: 9999;
  max-height: 12rem;
  overflow: hidden;
  backdrop-filter: blur(0.625rem);
  display: flex;
  flex-direction: column;
}

.filter-section .dropdown-item .dropdown-content .search-box {
  padding: 0.2rem;
  border-bottom: 0.0625rem solid rgba(59, 130, 246, 0.3);
  flex-shrink: 0;
}

.filter-section .dropdown-item .dropdown-content .search-box .search-input {
  width: 100%;
  padding: 0.15rem 0.3rem;
  background: rgba(0, 0, 0, 0.3);
  border: 0.0625rem solid rgba(59, 130, 246, 0.4);
  border-radius: 0.125rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.7rem;
  outline: none;
  transition: all 0.2s ease;
}

.filter-section .dropdown-item .dropdown-content .search-box .search-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.filter-section .dropdown-item .dropdown-content .search-box .search-input:focus {
  border-color: rgba(59, 130, 246, 0.8);
  background: rgba(0, 0, 0, 0.5);
}

.filter-section .dropdown-item .dropdown-content .options-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.2rem;
}

.filter-section .dropdown-item .dropdown-content .options-list::-webkit-scrollbar {
  width: 6px;
}

.filter-section .dropdown-item .dropdown-content .options-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  margin: 2px 0;
}

.filter-section .dropdown-item .dropdown-content .options-list::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.6) 0%, rgba(74, 158, 255, 0.6) 100%);
  border-radius: 3px;
  border: 1px solid rgba(59, 130, 246, 0.3);
  transition: all 0.3s ease;
}

.filter-section .dropdown-item .dropdown-content .options-list::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.8) 0%, rgba(74, 158, 255, 0.8) 100%);
  border-color: rgba(59, 130, 246, 0.5);
}

.filter-section .dropdown-item .dropdown-content .options-list {
  scrollbar-width: thin;
  scrollbar-color: rgba(59, 130, 246, 0.6) rgba(0, 0, 0, 0.3);
}

.filter-section .dropdown-item .dropdown-content .options-list .dropdown-option {
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

.filter-section .dropdown-item .dropdown-content .options-list .dropdown-option:hover {
  background: rgba(59, 130, 246, 0.3);
}

.filter-section .dropdown-item .dropdown-content .options-list .dropdown-option.reset-option {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
  border-bottom: 0.0625rem solid rgba(59, 130, 246, 0.3);
  margin-bottom: 0.1rem;
  padding-bottom: 0.3rem;
  position: relative;
}

.filter-section .dropdown-item .dropdown-content .options-list .dropdown-option.reset-option::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 0.0625rem;
  background: rgba(59, 130, 246, 0.3);
}

.filter-section .dropdown-item .dropdown-content .options-list .dropdown-option.reset-option:hover {
  background: rgba(59, 130, 246, 0.3);
  color: rgba(255, 255, 255, 1);
}

.filter-section .dropdown-item .dropdown-content .options-list .dropdown-option.selected {
  background: rgba(59, 130, 246, 0.5);
  color: #60a5fa;
}

.filter-section .dropdown-item .dropdown-content .options-list .dropdown-option .checkmark {
  color: #00ff88;
  font-weight: bold;
  font-size: 0.8rem;
}

.filter-section .dropdown-item .dropdown-content .options-list .no-results {
  padding: 0.5rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.7rem;
  font-style: italic;
}

.filter-section .date-range-item {
  flex-shrink: 1;
}

.filter-section .date-range-item .date-range-picker {
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
  min-width: 8rem;
  max-width: 10rem;
  padding: 0.3rem 0.5rem;
}

.filter-section .date-range-item .date-range-picker:hover {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}

.filter-section .date-range-item .date-range-picker :deep(.ant-picker-input) input {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
}

.filter-section .date-range-item .date-range-picker :deep(.ant-picker-separator) {
  color: rgba(255, 255, 255, 0.7);
}

.filter-section .date-range-item .date-range-picker :deep(.ant-picker-separator) svg {
  display: none !important;
}

.filter-section .date-range-item .date-range-picker :deep(.ant-picker-suffix) {
  color: rgba(255, 255, 255, 0.7);
}

.filter-section .export-item {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
  flex-shrink: 0;
  flex-grow: 0;
  min-width: fit-content;
}

.filter-section .export-item .export-btn {
  height: 1.6rem;
  background: #2873cc;
  box-shadow:
    1px 1px 1px 0px #1e6cc8,
    inset 0px 1px 1px 0px #c5dfff;
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

.filter-section .export-item .export-btn:hover:not(:disabled) {
  background: #1e6cc8;
  box-shadow:
    1px 1px 1px 0px #1c5fb8,
    inset 0px 1px 1px 0px #b8d5ff;
}

.filter-section .export-item .export-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.table-wrapper {
  flex: 1;
  overflow: hidden;
  min-height: 0;
  padding: 0 0 1rem;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
}

.table-wrapper .table-container {
  width: 100%;
  height: 100%;
  overflow-x: auto;
  overflow-y: auto;
}

.table-wrapper .data-table {
  width: 100%;
  border-collapse: collapse;
  color: white;
  font-size: 0.75rem;
}

.table-wrapper .data-table thead th {
  padding: 0.75rem 0.5rem;
  text-align: center;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  border-bottom: 1px solid rgba(74, 158, 255, 0.3);
  background: rgba(0, 0, 0, 0.2);
  white-space: nowrap;
}

.table-wrapper .data-table thead th.time-column {
  min-width: 100px;
}

.table-wrapper .data-table tbody tr {
  border-bottom: 1px solid rgba(74, 158, 255, 0.1);
  transition: background 0.2s ease;
}

.table-wrapper .data-table tbody tr:hover {
  background: rgba(74, 158, 255, 0.1);
}

.table-wrapper .data-table tbody td {
  padding: 0.75rem 0.5rem;
  vertical-align: middle;
  text-align: center;
}

.table-wrapper .data-table tbody td.no-data {
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  padding: 2rem;
  font-style: italic;
}

.table-wrapper .data-table tbody td.data-cell .cell-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.table-wrapper .data-table tbody td.data-cell .cell-content .status-icon {
  font-family: 'yhzt', 'Segoe UI Symbol', 'Arial', sans-serif;
  font-size: 0.9rem;
  font-weight: bold;
}

.table-wrapper .data-table tbody td.data-cell .cell-content .status-icon.status-success {
  color: #52c41a;
}

.table-wrapper .data-table tbody td.data-cell .cell-content .status-icon.status-warning {
  color: #faad14;
}

.table-wrapper .data-table tbody td.data-cell .cell-content .status-icon.status-error {
  color: #ff4d4f;
}

.table-wrapper .data-table tbody td.data-cell .cell-content .rate-value {
  color: white;
  font-weight: 600;
}

/* 滚动条样式 */
.table-container::-webkit-scrollbar {
  width: 4px;
  height: 4px;
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

.table-container {
  scrollbar-width: thin;
  scrollbar-color: rgba(74, 158, 255, 0.3) rgba(0, 0, 0, 0.1);
}
</style>
