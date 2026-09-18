<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { queryEndToEndDeliveryRateCust, exportEndToEndDeliveryRateCust } from '../../../services/transportApi'
import { useSelectOptionsStore } from '../../../stores/selectOptionsStore'
import dayjs, { type Dayjs } from 'dayjs'
import { message } from 'ant-design-vue'

// 接口数据类型定义
interface CustomerItem {
  key: string // 用户名称
  childList?: CustomerItem[] | null // 子列表，null表示没有子级
  itemList?: any // 不用管
  rateList?: string[] // 时间维度的数据数组
  [key: string]: any // 其他字段
}

// 表格数据（处理后的扁平化数据）
interface TableRow {
  key: string // 行唯一标识
  customerName: string // 客户名称（第一层）
  fromProvince: string // 始发省份（第二层）
  toProvince: string // 目的省份（第三层）
  deliveryProvider: string // 配送商（第四层）
  level?: number // 层级（用于缩进）
  [key: string]: any // 动态时间列
  isParent: boolean // 是否为父行（第一层）
  children?: TableRow[] // 子行数据
  expanded?: boolean // 是否展开
  hasChildren?: boolean // 是否有子数据
}

// 筛选表单数据
// 初始化默认日期范围（财年）
const getInitialDateRange = (): [Dayjs, Dayjs] => {
  const now = dayjs()
  const currentMonth = now.month() + 1 // 1-12
  
  // 财年：如果当前时间为1~3月，则默认去年4月1日到当天；否则今年4月1日到当天
  let startDate: Dayjs
  if (currentMonth >= 1 && currentMonth <= 3) {
    startDate = now.subtract(1, 'year').month(3).date(1).startOf('day')
  } else {
    startDate = now.month(3).date(1).startOf('day')
  }
  return [startDate, now.endOf('day')]
}

const filterForm = ref({
  timeDimension: 'FICAL_YEAR', // 默认财年
  dateRange: getInitialDateRange(),
  deliveryProvider: [] as string[],
  customer: [] as string[]
})

// 获取 selectOptions store
const selectOptionsStore = useSelectOptionsStore()

// 下拉框选项
const timeDimensionOptions = ref<Array<{ code: string; name: string }>>([
  { code: 'FICAL_YEAR', name: '财年' },
  { code: 'CALENDAR_YEAR', name: '自然年' },
  { code: 'MONTH', name: '月' }
])
const deliveryProviderOptions = computed(() => selectOptionsStore.deliveryProviderOptions)
const customerOptions = computed(() => selectOptionsStore.customerOptions)

// 搜索关键词
const deliveryProviderSearch = ref('')
const customerSearch = ref('')

// 过滤后的配送商选项（包含重置选项）
const filteredDeliveryProviderOptions = computed(() => {
  let filtered: { code: string; name: string }[] = []
  
  if (!deliveryProviderSearch.value.trim()) {
    filtered = deliveryProviderOptions.value
  } else {
    const searchLower = deliveryProviderSearch.value.toLowerCase()
    filtered = deliveryProviderOptions.value.filter((option: { code: string; name: string }) =>
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

// 下拉框状态
const isTimeDimensionOpen = ref(false)
const isDeliveryProviderOpen = ref(false)
const isCustomerOpen = ref(false)

// 表格数据
const tableData = ref<TableRow[]>([])
const loading = ref(false)
// 导出加载状态
const exportLoading = ref(false)

// 表格容器引用和高度
const tableSectionRef = ref<HTMLElement | null>(null)
const tableScrollY = ref<number | undefined>(200) // 默认200，会动态计算

// 原始数据（用于展开/折叠）
const originalData = ref<CustomerItem[]>([])

// 展开的行keys
const expandedRowKeys = ref<string[]>([])

// 时间列（动态生成）
const timeColumns = ref<string[]>([])
// 时间列在heardList中的起始索引（用于从rateList中正确读取数据）
const timeStartIndex = ref<number>(0)

// 根据时间维度计算默认日期范围
const getDefaultDateRange = (timeDimension: string): [Dayjs, Dayjs] => {
  const now = dayjs()
  const currentMonth = now.month() + 1 // 1-12
  
  if (timeDimension === 'FICAL_YEAR') {
    // 财年：4月1日作为开始日期，当天作为结束日期
    // 如果当前时间为1~3月，则默认去年4月1日到当天
    let startDate: Dayjs
    if (currentMonth >= 1 && currentMonth <= 3) {
      // 当前是1-3月，从去年4月1日开始
      startDate = now.subtract(1, 'year').month(3).date(1).startOf('day')
    } else {
      // 当前是4-12月，从今年4月1日开始
      startDate = now.month(3).date(1).startOf('day')
    }
    return [startDate, now.endOf('day')]
  } else if (timeDimension === 'CALENDAR_YEAR') {
    // 自然年：1月1日作为开始日期，当天作为结束日期
    const startDate = now.month(0).date(1).startOf('day')
    return [startDate, now.endOf('day')]
  } else if (timeDimension === 'MONTH') {
    // 月：当前月的1号作为开始日期，当天作为结束日期
    const startDate = now.date(1).startOf('day')
    return [startDate, now.endOf('day')]
  } else {
    // 默认返回财年
    let startDate: Dayjs
    if (currentMonth >= 1 && currentMonth <= 3) {
      startDate = now.subtract(1, 'year').month(3).date(1).startOf('day')
    } else {
      startDate = now.month(3).date(1).startOf('day')
    }
    return [startDate, now.endOf('day')]
  }
}

// 加载下拉选项数据
const loadOptions = async () => {
  // 确保数据已加载（如果未加载则加载）
  await selectOptionsStore.ensureDataLoaded()
}

// 从heardList中提取时间列（排除固定的列名）
const extractTimeColumns = (heardList: string[]): { columns: string[], timeStartIndex: number } => {
  if (!heardList || !Array.isArray(heardList)) {
    return { columns: [], timeStartIndex: 0 }
  }
  
  // 固定的列名，需要排除
  const fixedColumns = ['客户名称', '始发省份', '目的省份', '配送商']
  
  // 找到时间列开始的位置（固定列名的数量）
  const timeStartIndex = fixedColumns.length
  
  // 过滤出时间列（不在固定列名中的）
  const columns = heardList.filter(col => !fixedColumns.includes(col))
  
  return { columns, timeStartIndex }
}

// 递归处理数据，转换为表格需要的扁平化格式
const processTableData = (
  data: CustomerItem[], 
  parentPath: string = '', 
  level: number = 0
): TableRow[] => {
  const result: TableRow[] = []
  
  // 时间列已在loadTableData中从heardList提取，这里不需要再生成
  
  data.forEach((item, index) => {
    const rowKey = parentPath ? `${parentPath}-${index}` : `parent-${index}`
    const isExpanded = expandedRowKeys.value.includes(rowKey)
    
    // 检查是否有子数据（childList不为null且不为空数组）
    const hasChildren = item.childList !== null && 
                       item.childList !== undefined && 
                       Array.isArray(item.childList) && 
                       item.childList.length > 0
    
    // 根据层级设置不同的字段，每个层级只显示自己的key
    let customerName = ''
    let fromProvince = ''
    let toProvince = ''
    let deliveryProvider = ''
    
    if (level === 0) {
      // 第一层：客户名称
      customerName = item.key || ''
    } else if (level === 1) {
      // 第二层：始发省份（不显示客户名称）
      fromProvince = item.key || ''
    } else if (level === 2) {
      // 第三层：目的省份（不显示客户名称和始发省份）
      toProvince = item.key || ''
    } else if (level === 3) {
      // 第四层：配送商（不显示其他层级）
      deliveryProvider = item.key || ''
    }
    
    // 构建行数据
    const row: TableRow = {
      key: rowKey,
      customerName: customerName,
      fromProvince: fromProvince,
      toProvince: toProvince,
      deliveryProvider: deliveryProvider,
      level: level, // 记录层级
      isParent: level === 0, // 只有第一层是父行
      expanded: isExpanded,
      hasChildren: hasChildren,
      children: undefined
    }
    
    // 添加时间列数据（从rateList中获取）
    if (item.rateList && Array.isArray(item.rateList)) {
      timeColumns.value.forEach((col, colIndex) => {
        // 从rateList中获取对应索引的值
        // 如果rateList包含heardList的所有列，需要从timeStartIndex开始读取
        // 如果rateList只包含时间列，则直接从colIndex读取
        // 这里假设rateList只包含时间列数据，索引从0开始对应第一个时间列
        const rateValue = item.rateList?.[colIndex]
        row[col] = rateValue !== undefined && rateValue !== null ? rateValue : ''
      })
    } else {
      // 如果没有rateList，所有时间列都设为空
      timeColumns.value.forEach((col) => {
        row[col] = ''
      })
    }
    
    result.push(row)
    
    // 如果展开且有子数据，递归处理子级
    if (isExpanded && hasChildren) {
      const childRows = processTableData(item.childList!, rowKey, level + 1)
      result.push(...childRows)
    }
  })
  
  return result
}

// 加载表格数据
const loadTableData = async () => {
  try {
    loading.value = true
    
    const params = {
      fromWarehouse: [],
      toProvince: [],
      toRdc: [],
      timeType: filterForm.value.timeDimension,
      startDate: filterForm.value.dateRange[0].startOf('day').format('YYYY-MM-DD HH:mm:ss'),
      endDate: filterForm.value.dateRange[1].endOf('day').format('YYYY-MM-DD HH:mm:ss'),
      deliveryName: filterForm.value.deliveryProvider || [],
      customer: filterForm.value.customer || []
    }
    
    const result = await queryEndToEndDeliveryRateCust(params)
    
    if (result && result.code === 200 && result.data) {
      // 从heardList中提取时间列
      if (result.data.heardList && Array.isArray(result.data.heardList)) {
        const { columns, timeStartIndex: startIndex } = extractTimeColumns(result.data.heardList)
        timeColumns.value = columns
        timeStartIndex.value = startIndex
      } else {
        timeColumns.value = []
        timeStartIndex.value = 0
      }
      
      // 从treeList中获取树形数据
      let dataArray: CustomerItem[] = []
      if (result.data.treeList && Array.isArray(result.data.treeList)) {
        dataArray = result.data.treeList
      } else if (Array.isArray(result.data)) {
        dataArray = result.data
      } else if (result.data.list && Array.isArray(result.data.list)) {
        dataArray = result.data.list
      } else if (result.data.records && Array.isArray(result.data.records)) {
        dataArray = result.data.records
      } else if (result.data.data && Array.isArray(result.data.data)) {
        dataArray = result.data.data
      }
      
      // 保存原始数据
      originalData.value = dataArray
      // 处理数据并转换为表格格式
      tableData.value = processTableData(dataArray)
    } else {
      originalData.value = []
      tableData.value = []
      timeColumns.value = []
    }
  } catch (error) {
    console.error('获取数据失败:', error)
    tableData.value = []
    message.error('获取数据失败')
  } finally {
    loading.value = false
  }
}

// 日期范围变化处理
const handleDateRangeChange = () => {
  expandedRowKeys.value = []
  loadTableData()
}

// 格式化百分比（从rateList中获取的值）
const formatPercentage = (value: any): string => {
  // 处理空字符串、null、undefined
  if (value === '' || value === null || value === undefined) return ''
  // 处理 "-" 值，直接返回
  if (value === '-') return '-'
  // 处理0值
  if (value === 0 || value === '0') {
    const numValue = typeof value === 'string' ? parseFloat(value) : value
    const percentageValue = numValue > 1 ? numValue : numValue * 100
    return `${percentageValue.toFixed(2)}%`
  }
  // 如果已经是百分比格式，直接返回
  if (typeof value === 'string' && value.includes('%')) {
    return value
  }
  // 转换为数字
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return ''
  // rateList中的值是小数形式（如1.0000表示100%），需要转换为百分比
  // 如果值大于1，说明已经是百分比形式，直接显示；否则乘以100
  const percentageValue = numValue > 1 ? numValue : numValue * 100
  return `${percentageValue.toFixed(2)}%`
}

// 获取百分比的状态图标
const getPercentageStatus = (value: any): string => {
  if (!value && value !== 0 && value !== '0') return ''
  // 如果是 "-"，不显示状态图标
  if (value === '-') return ''
  let numValue: number
  if (typeof value === 'string') {
    // 如果包含%，去掉%后转换
    const cleanValue = value.replace('%', '')
    numValue = parseFloat(cleanValue)
  } else {
    numValue = value
  }
  if (isNaN(numValue)) return ''
  
  // rateList中的值是小数形式（如1.0000表示100%），需要转换为百分比进行比较
  // 如果值大于1，说明已经是百分比形式；否则乘以100
  const percentageValue = numValue > 1 ? numValue : numValue * 100
  
  if (percentageValue >= 96) return '✓' // 绿色对勾
  if (percentageValue >= 60) return '−' // 黄色横杠（使用更短的减号）
  return '✗' // 红色叉叉
}

// 获取百分比文字颜色
const getTextColor = (value: any): string => {
  const status = getPercentageStatus(value)
  if (status === '✓') return '#52c41a'
  if (status === '−') return '#faad14'
  if (status === '✗') return '#ff4d4f'
  return ''
}


// 切换行展开/折叠
const toggleRowExpand = (key: string) => {
  const index = expandedRowKeys.value.indexOf(key)
  if (index > -1) {
    expandedRowKeys.value.splice(index, 1)
  } else {
    expandedRowKeys.value.push(key)
  }
  
  // 使用原始数据重新处理表格数据
  tableData.value = processTableData(originalData.value)
}

// 下拉框开关方法
const toggleTimeDimensionDropdown = () => {
  if (isTimeDimensionOpen.value) {
    isTimeDimensionOpen.value = false
    // 关闭时触发请求
    expandedRowKeys.value = []
    loadTableData()
  } else {
    closeAllDropdowns()
    isTimeDimensionOpen.value = true
  }
}

const toggleDeliveryProviderDropdown = () => {
  if (isDeliveryProviderOpen.value) {
    isDeliveryProviderOpen.value = false
    deliveryProviderSearch.value = '' // 关闭时清空搜索
    // 关闭时触发请求
    expandedRowKeys.value = []
    loadTableData()
  } else {
    closeAllDropdowns()
    isDeliveryProviderOpen.value = true
    deliveryProviderSearch.value = '' // 打开时清空搜索
  }
}

const toggleCustomerDropdown = () => {
  if (isCustomerOpen.value) {
    isCustomerOpen.value = false
    customerSearch.value = '' // 关闭时清空搜索
    // 关闭时触发请求
    expandedRowKeys.value = []
    loadTableData()
  } else {
    closeAllDropdowns()
    isCustomerOpen.value = true
    customerSearch.value = '' // 打开时清空搜索
  }
}

// 关闭所有下拉框
const closeAllDropdowns = () => {
  isTimeDimensionOpen.value = false
  isDeliveryProviderOpen.value = false
  isCustomerOpen.value = false
  // 清空搜索关键词
  deliveryProviderSearch.value = ''
  customerSearch.value = ''
}

// 选择时间维度
const selectTimeDimension = (option: { code: string; name: string }) => {
  filterForm.value.timeDimension = option.code
  // 切换时间维度时，自动更新日期范围
  filterForm.value.dateRange = getDefaultDateRange(option.code)
  closeAllDropdowns()
  // 选择后触发请求
  expandedRowKeys.value = []
  loadTableData()
}

// 选择配送商（多选，不关闭下拉框）
const selectDeliveryProvider = (option: { code: string; name: string }) => {
  // 如果是重置选项
  if (option.code === '__reset__') {
    filterForm.value.deliveryProvider = []
    deliveryProviderSearch.value = ''
    // 重置时不关闭下拉框，不触发请求，让用户继续选择
    return
  }
  
  const index = filterForm.value.deliveryProvider.indexOf(option.code)
  if (index > -1) {
    filterForm.value.deliveryProvider.splice(index, 1)
  } else {
    filterForm.value.deliveryProvider.push(option.code)
  }
  // 多选时不关闭下拉框，不触发请求
}

// 选择客户（多选，不关闭下拉框）
const selectCustomer = (option: { code: string; name: string }) => {
  // 如果是重置选项
  if (option.code === '__reset__') {
    filterForm.value.customer = []
    customerSearch.value = ''
    // 重置时不关闭下拉框，不触发请求，让用户继续选择
    return
  }
  
  const index = filterForm.value.customer.indexOf(option.code)
  if (index > -1) {
    filterForm.value.customer.splice(index, 1)
  } else {
    filterForm.value.customer.push(option.code)
  }
  // 多选时不关闭下拉框，不触发请求
}

// 显示文本
const displayTimeDimension = computed(() => {
  const option = timeDimensionOptions.value.find(item => item.code === filterForm.value.timeDimension)
  return option ? option.name : '财年'
})

const displayDeliveryProvider = computed(() => {
  if (filterForm.value.deliveryProvider.length === 0) {
    return '配送商'
  }
  const names = filterForm.value.deliveryProvider.map(code => {
    const option = deliveryProviderOptions.value.find(item => item.code === code)
    return option ? option.name : code
  })
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
})

const displayCustomer = computed(() => {
  if (filterForm.value.customer.length === 0) {
    return '客户'
  }
  const names = filterForm.value.customer.map(code => {
    const option = customerOptions.value.find(item => item.code === code)
    return option ? option.name : code
  })
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
})

// 导出
const handleExport = async () => {
  try {
    exportLoading.value = true
    
    const params = {
      fromWarehouse: [],
      toProvince: [],
      toRdc: [],
      timeType: filterForm.value.timeDimension,
      startDate: filterForm.value.dateRange[0].startOf('day').format('YYYY-MM-DD HH:mm:ss'),
      endDate: filterForm.value.dateRange[1].endOf('day').format('YYYY-MM-DD HH:mm:ss'),
      deliveryName: filterForm.value.deliveryProvider || [],
      customer: filterForm.value.customer || []
    }
    
    const result = await exportEndToEndDeliveryRateCust(params)
    
    // 检查返回状态码
    if (result.code === 409 || result.code === 504 || result.code === 505) {
      // 导出数量超过限制
      message.error(result.msg || '导出数据量过大，请缩小查询范围')
      return
    }
    
    // 如果接口返回文件下载链接，可以触发下载
    if (result && result.data && result.data.downloadUrl) {
      window.open(result.data.downloadUrl, '_blank')
      message.success('导出成功')
    } else if (result && result.data) {
      // 如果返回的是文件URL，创建下载链接
      const url = result.data
      const link = document.createElement('a')
      link.href = url
      // 从URL中提取文件名，如果没有则使用默认名称
      const xlsxMatch = url.match(/([^/]+\.xlsx)$/)
      const downloadFilename = xlsxMatch ? xlsxMatch[1] : `端到端准时交付率_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`
      link.download = downloadFilename
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      message.success('导出成功')
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

// 点击外部关闭下拉框
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement
  // 检查是否点击在下拉框相关区域（包括搜索输入框）
  const isClickInsideDropdown = target.closest('.dropdown-item') || 
                                 target.closest('.dropdown-content') ||
                                 target.closest('.search-input') ||
                                 target.closest('.search-box')
  
  if (!isClickInsideDropdown) {
    // 检查是否有下拉框正在打开
    const hadOpenDropdown = isDeliveryProviderOpen.value || isCustomerOpen.value || isTimeDimensionOpen.value
    closeAllDropdowns()
    // 如果有下拉框被关闭，触发请求
    if (hadOpenDropdown) {
      expandedRowKeys.value = []
      loadTableData()
    }
  }
}

// 计算表格滚动高度
const calculateTableScrollY = () => {
  nextTick(() => {
    if (tableSectionRef.value) {
      const containerHeight = tableSectionRef.value.clientHeight
      // 减去一些边距和头部高度，确保有滚动条
      // 如果容器高度很大，使用一个合理的最大值，否则使用计算值
      const calculatedHeight = containerHeight > 300 ? containerHeight - 100 : 200
      tableScrollY.value = calculatedHeight
    }
  })
}

// 组件挂载
onMounted(() => {
  loadOptions()
  loadTableData()
  document.addEventListener('click', handleClickOutside)
  
  // 计算表格滚动高度
  calculateTableScrollY()
  
  // 监听窗口大小变化
  window.addEventListener('resize', calculateTableScrollY)
  
  // 使用 ResizeObserver 监听容器大小变化
  if (tableSectionRef.value) {
    const resizeObserver = new ResizeObserver(() => {
      calculateTableScrollY()
    })
    resizeObserver.observe(tableSectionRef.value)
    
    // 保存 observer 以便卸载时清理
    ;(tableSectionRef.value as any)._resizeObserver = resizeObserver
  }
})

// 组件卸载
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', calculateTableScrollY)
  
  // 清理 ResizeObserver
  if (tableSectionRef.value && (tableSectionRef.value as any)._resizeObserver) {
    ;(tableSectionRef.value as any)._resizeObserver.disconnect()
  }
})
</script>

<template>
  <div class="non-lenovo-customer-container">
    <div class="header-bar">
      <h2 class="header-title">端到端准时交付率-非联想客户</h2>
    </div>
    <!-- 筛选区域 -->
    <div class="filter-section">
      <div class="filter-form">
        <div class="dropdown-group">
          <!-- 日期范围选择器 -->
          <a-range-picker
            v-model:value="filterForm.dateRange"
            format="YYYY-MM-DD"
            separator="至"
            class="date-range-picker"
            :show-time="false"
            @change="handleDateRangeChange"
          />
          <!-- 时间维度下拉框 -->
          <div class="dropdown-item" @click.stop="toggleTimeDimensionDropdown">
            <span class="dropdown-text">{{ displayTimeDimension }}</span>
            <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
            <div class="dropdown-content" v-show="isTimeDimensionOpen" @click.stop>
              <div class="options-list">
                <div 
                  v-for="option in timeDimensionOptions" 
                  :key="option.code" 
                  class="dropdown-option"
                  :class="{ 'selected': filterForm.timeDimension === option.code }" 
                  @click.stop="selectTimeDimension(option)"
                >
                  <span class="checkmark" v-if="filterForm.timeDimension === option.code">✓</span>
                  {{ option.name }}
                </div>
              </div>
            </div>
          </div>

          <!-- 配送商下拉框 -->
          <div class="dropdown-item" @click.stop="toggleDeliveryProviderDropdown">
            <span class="dropdown-text">{{ displayDeliveryProvider }}</span>
            <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
            <div class="dropdown-content" v-show="isDeliveryProviderOpen" @click.stop>
              <div class="search-box">
                <input 
                  v-model="deliveryProviderSearch" 
                  type="text" 
                  placeholder="搜索配送商..." 
                  class="search-input"
                  @click.stop 
                />
              </div>
              <div class="options-list">
                <div 
                  v-for="option in filteredDeliveryProviderOptions" 
                  :key="option.code" 
                  class="dropdown-option"
                  :class="{ 
                    'selected': option.code !== '__reset__' && filterForm.deliveryProvider.includes(option.code),
                    'reset-option': option.code === '__reset__'
                  }" 
                  @click.stop="selectDeliveryProvider(option)"
                >
                  <span class="checkmark" v-if="option.code !== '__reset__' && filterForm.deliveryProvider.includes(option.code)">✓</span>
                  {{ option.name }}
                </div>
                <div v-if="filteredDeliveryProviderOptions.length === 1 && deliveryProviderSearch" class="no-results">
                  暂无搜索结果
                </div>
              </div>
            </div>
          </div>

          <!-- 客户下拉框 -->
          <div class="dropdown-item" @click.stop="toggleCustomerDropdown">
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
                  :key="option.code" 
                  class="dropdown-option"
                  :class="{ 
                    'selected': option.code !== '__reset__' && filterForm.customer.includes(option.code),
                    'reset-option': option.code === '__reset__'
                  }" 
                  @click.stop="selectCustomer(option)"
                >
                  <span class="checkmark" v-if="option.code !== '__reset__' && filterForm.customer.includes(option.code)">✓</span>
                  {{ option.name }}
                </div>
                <div v-if="filteredCustomerOptions.length === 1 && customerSearch" class="no-results">
                  暂无搜索结果
                </div>
              </div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="filter-actions">
            <a-button @click="handleExport" :loading="exportLoading">导出</a-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 表格区域 -->
    <div class="table-section" ref="tableSectionRef">
      <a-spin :spinning="loading">
        <a-table
          :columns="[
            {
              title: '客户名称',
              dataIndex: 'customerName',
              key: 'customerName',
              width: 150,
            },
            {
              title: '始发省份',
              dataIndex: 'fromProvince',
              key: 'fromProvince',
              width: 120,
              align: 'center',
              customCell: (record: any) => {
                // 第一级：合并三列（始发省份、目的省份、配送商）
                if (record.level === 0) {
                  return { colspan: 3, rowspan: 1 }
                }
                return {}
              }
            },
            {
              title: '目的省份',
              dataIndex: 'toProvince',
              key: 'toProvince',
              width: 120,
              align: 'center',
              customCell: (record: any) => {
                // 第一级：不显示（被始发省份合并）
                if (record.level === 0) {
                  return { colspan: 0, rowspan: 0 }
                }
                // 第二级：合并两列（目的省份、配送商）
                if (record.level === 1) {
                  return { colspan: 2, rowspan: 1 }
                }
                return {}
              }
            },
            {
              title: '配送商',
              dataIndex: 'deliveryProvider',
              key: 'deliveryProvider',
              width: 120,
              align: 'center',
              customCell: (record: any) => {
                // 第一级：不显示（被始发省份合并）
                if (record.level === 0) {
                  return { colspan: 0, rowspan: 0 }
                }
                // 第二级：不显示（被目的省份合并）
                if (record.level === 1) {
                  return { colspan: 0, rowspan: 0 }
                }
                return {}
              }
            },
            ...timeColumns.map(col => ({
              title: col,
              dataIndex: col,
              key: col,
              width: 120,
              align: 'center'
            }))
          ]"
          :data-source="tableData"
          :pagination="false"
          size="small"
          :scroll="{ x: 1000, y: tableScrollY }"
          :expandable="{ expandRowByClick: false, showExpandColumn: false }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'customerName'">
              <span class="parent-row" :style="{ paddingLeft: `${(record.level || 0) * 1.5}rem` }">
                <span 
                  v-if="record.hasChildren && record.level === 0"
                  class="expand-icon" 
                  @click.stop="toggleRowExpand(record.key)"
                  :class="{ expanded: record.expanded }"
                >
                  {{ record.expanded ? '−' : '+' }}
                </span>
                <span v-else-if="record.level === 0" class="expand-icon-placeholder"></span>
                <span class="customer-text">{{ record.customerName || '' }}</span>
              </span>
            </template>
            <template v-else-if="column.key === 'fromProvince'">
              <!-- 第一级：显示"小计"（合并三列） -->
              <span v-if="record.level === 0" class="subtotal-text">小计</span>
              <!-- 其他级别：显示始发省份 -->
              <span v-else class="parent-row">
                <span 
                  v-if="record.hasChildren && record.level === 1"
                  class="expand-icon" 
                  @click.stop="toggleRowExpand(record.key)"
                  :class="{ expanded: record.expanded }"
                >
                  {{ record.expanded ? '−' : '+' }}
                </span>
                <span v-else-if="record.level === 1" class="expand-icon-placeholder"></span>
                <span>{{ record.fromProvince || '' }}</span>
              </span>
            </template>
            <template v-else-if="column.key === 'toProvince'">
              <!-- 第二级：显示"小计"（合并两列） -->
              <span v-if="record.level === 1" class="subtotal-text">小计</span>
              <!-- 其他级别：显示目的省份 -->
              <span v-else class="parent-row">
                <span 
                  v-if="record.hasChildren && record.level === 2"
                  class="expand-icon" 
                  @click.stop="toggleRowExpand(record.key)"
                  :class="{ expanded: record.expanded }"
                >
                  {{ record.expanded ? '−' : '+' }}
                </span>
                <span v-else-if="record.level === 2" class="expand-icon-placeholder"></span>
                <span>{{ record.toProvince || '' }}</span>
              </span>
            </template>
            <template v-else-if="column.key === 'deliveryProvider'">
              <!-- 第三级：显示"小计" -->
              <span v-if="record.level === 2" class="subtotal-text">小计</span>
              <!-- 其他级别：显示配送商 -->
              <span v-else>{{ record.deliveryProvider || '' }}</span>
            </template>
            <template v-else-if="timeColumns.includes(column.key as string)">
              <span class="percentage-cell">
                <span 
                  v-if="getPercentageStatus(record[column.key as string])"
                  :style="{ color: getTextColor(record[column.key as string]) }"
                >
                  {{ getPercentageStatus(record[column.key as string]) }}
                </span>
                {{ formatPercentage(record[column.key as string]) }}
              </span>
            </template>
          </template>
        </a-table>
      </a-spin>
    </div>
  </div>
</template>

<style scoped>
.non-lenovo-customer-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0;
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
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.filter-section {
  margin-bottom: 0;
  border-radius: 0;
  padding: 0;
  position: relative;
  z-index: 50;
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
  flex-shrink: 0;
}

.filter-section .filter-form {
  display: flex;
  align-items: center;
  padding: 0.75rem 0;
}

.filter-section .filter-form .dropdown-group {
  display: flex;
  gap: 0.4rem;
  flex-wrap: nowrap;
  justify-content: flex-start;
  width: 100%;
  align-items: center;
}

.filter-section .filter-form .dropdown-group .dropdown-item {
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
}

.filter-section .filter-form .dropdown-group .dropdown-item:hover {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  max-width: 100%;
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-icon {
  width: 0.8rem;
  height: 0.8rem;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.7);
  transition: transform 0.3s ease;
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content {
  position: absolute;
  top: calc(100% + 0.2rem);
  left: 0;
  right: 0;
  background: #081F40;
  border: 0.0625rem solid rgba(59, 130, 246, 0.6);
  border-radius: 0.1875rem;
  box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.2);
  z-index: 1002;
  max-height: 12rem;
  overflow: hidden;
  backdrop-filter: blur(0.625rem);
  display: flex;
  flex-direction: column;
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .search-box {
  padding: 0.2rem;
  border-bottom: 0.0625rem solid rgba(59, 130, 246, 0.3);
  flex-shrink: 0;
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .search-box .search-input {
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

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .search-box .search-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .search-box .search-input:focus {
  border-color: rgba(59, 130, 246, 0.8);
  background: rgba(0, 0, 0, 0.5);
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 7.6rem;
  padding: 0.2rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(59, 130, 246, 0.6) rgba(0, 0, 0, 0.3);
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list::-webkit-scrollbar {
  width: 6px;
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  margin: 2px 0;
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.6) 0%, rgba(74, 158, 255, 0.6) 100%);
  border-radius: 3px;
  border: 1px solid rgba(59, 130, 246, 0.3);
  transition: all 0.3s ease;
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.8) 0%, rgba(74, 158, 255, 0.8) 100%);
  border-color: rgba(59, 130, 246, 0.5);
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list .dropdown-option {
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

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list .dropdown-option:hover {
  background: rgba(59, 130, 246, 0.3);
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list .dropdown-option.selected {
  background: rgba(59, 130, 246, 0.5);
  color: #60a5fa;
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list .dropdown-option.reset-option {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
  border-bottom: 0.0625rem solid rgba(59, 130, 246, 0.3);
  margin-bottom: 0.1rem;
  padding-bottom: 0.3rem;
  position: relative;
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list .dropdown-option.reset-option::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 0.0625rem;
  background: rgba(59, 130, 246, 0.3);
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list .dropdown-option.reset-option:hover {
  background: rgba(59, 130, 246, 0.3);
  color: rgba(255, 255, 255, 1);
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list .dropdown-option .checkmark {
  color: #00ff88;
  font-weight: bold;
  font-size: 0.8rem;
}

.filter-section .filter-form .dropdown-group .dropdown-item .dropdown-content .options-list .no-results {
  padding: 0.5rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.7rem;
  font-style: italic;
}

.filter-section .filter-form .dropdown-group .date-range-picker {
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

.filter-section .filter-form .dropdown-group .date-range-picker:hover {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}

.filter-section .filter-form .dropdown-group .date-range-picker :deep(.ant-picker-input) input {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
}

.filter-section .filter-form .dropdown-group .date-range-picker :deep(.ant-picker-separator) {
  color: rgba(255, 255, 255, 0.7);
}

.filter-section .filter-form .dropdown-group .date-range-picker :deep(.ant-picker-suffix) {
  color: rgba(255, 255, 255, 0.7);
}

.filter-section .filter-form .dropdown-group .filter-actions {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
  flex-shrink: 0;
}

.filter-section .filter-form .dropdown-group .filter-actions .ant-btn {
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

.filter-section .filter-form .dropdown-group .filter-actions .ant-btn:hover:not(:disabled) {
  background: #1e6cc8;
  box-shadow:
    1px 1px 1px 0px #1c5fb8,
    inset 0px 1px 1px 0px #b8d5ff;
}

.filter-section .filter-form .dropdown-group .filter-actions .ant-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.table-section {
  flex: 1;
  overflow: hidden;
  min-height: 0;
  border-radius: 8px;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
}

.table-section :deep(.ant-spin-container) {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-section :deep(.ant-table-wrapper) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-section :deep(.ant-table-container) {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  width: 100%;
}

.table-section :deep(.ant-table) {
  background: transparent;
}

.table-section :deep(.ant-table) .ant-table-expand-icon-col {
  display: none !important;
  width: 0 !important;
  padding: 0 !important;
}

.table-section :deep(.ant-table) .ant-table-thead > tr > th {
  padding: 0.75rem 0.5rem;
  text-align: center;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  border-bottom: 1px solid rgba(74, 158, 255, 0.3);
  background: rgba(0, 0, 0, 0.2);
  white-space: nowrap;
  font-size: 0.75rem;
}

.table-section :deep(.ant-table) .ant-table-tbody > tr > td {
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(74, 158, 255, 0.1);
  color: white;
  font-size: 0.7rem;
  text-align: center;
}

.table-section :deep(.ant-table) .ant-table-tbody > tr:nth-child(even) > td {
  background: rgba(255, 255, 255, 0.02);
}

.table-section :deep(.ant-table) .ant-table-tbody > tr:hover > td {
  background: rgba(74, 158, 255, 0.1);
}

.table-section :deep(.ant-table) .ant-table-row-expand-icon,
.table-section :deep(.ant-table) .ant-table-row-expand-icon-cell {
  display: none !important;
}

.table-section .subtotal-text {
  display: block;
  text-align: center;
  width: 100%;
}

.table-section .parent-row {
  display: flex;
  align-items: center;
  justify-content: start;
  gap: 8px;
  margin-left: 0.5rem;
}

.table-section .parent-row .expand-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 1px solid rgba(74, 158, 255, 0.6);
  border-radius: 4px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.9);
  font-weight: bold;
  transition: all 0.3s;
  user-select: none;
  flex-shrink: 0;
}

.table-section .parent-row .expand-icon:hover {
  background: rgba(74, 158, 255, 0.2);
  border-color: #4a9eff;
}

.table-section .parent-row .expand-icon.expanded {
  background: rgba(74, 158, 255, 0.3);
}

.table-section .parent-row .expand-icon-placeholder {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.table-section .parent-row .customer-text {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
}

.table-section .child-row {
  display: flex;
  align-items: center;
}

.table-section .child-row .child-indent {
  display: inline-block;
  width: 28px;
}

.table-section .percentage-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.table-section .percentage-cell .status-icon {
  font-size: 0.9rem;
  font-weight: bold;
}

.table-section .percentage-cell .status-icon.status-success {
  color: #52c41a;
}

.table-section .percentage-cell .status-icon.status-warning {
  color: #faad14;
  display: inline-block;
  line-height: 1;
  vertical-align: middle;
  font-size: 0.8rem;
  font-weight: 900;
  width: 0.6rem;
  text-align: center;
}

.table-section .percentage-cell .status-icon.status-error {
  color: #ff4d4f;
}

.table-section .no-data {
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  padding: 2rem;
  font-style: italic;
}

.table-section :deep(.ant-table-body) {
  scrollbar-width: thin;
  scrollbar-color: rgba(74, 158, 255, 0.3) rgba(0, 0, 0, 0.1);
}

.table-section :deep(.ant-table-body::-webkit-scrollbar) {
  width: 4px;
  height: 4px;
}

.table-section :deep(.ant-table-body::-webkit-scrollbar-track) {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}

.table-section :deep(.ant-table-body::-webkit-scrollbar-thumb) {
  background: rgba(74, 158, 255, 0.3);
  border-radius: 2px;
}

.table-section :deep(.ant-table-body::-webkit-scrollbar-thumb:hover) {
  background: rgba(74, 158, 255, 0.5);
}
</style>
