<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import {
  queryOnTimeDeliveryRate,
  exportOnTimeDeliveryRateItem,
  exportOnTimeDeliveryRate,
} from '../../../services/transportApi'
import { useSelectOptionsStore } from '../../../stores/selectOptionsStore'
import dayjs, { type Dayjs } from 'dayjs'

// 接口数据类型定义
interface WarehouseItem {
  key: string // 始发仓名称
  childList?: WarehouseItem[] | null // 子列表，null表示没有子级
  itemList?: any // 不用管
  rateList?: string[] // 时间维度的数据数组
  [key: string]: any // 其他字段
}

// 表格数据（处理后的扁平化数据）
interface TableRow {
  key: string // 行唯一标识
  originWarehouse: string // 始发仓（第一层）
  destinationWarehouse: string // 目的仓（第二层）
  logisticProvider: string // 物流商（第三层）
  level?: number // 层级（用于缩进）
  [key: string]: any // 动态时间列
  isParent: boolean // 是否为父行（第一层）
  children?: TableRow[] // 子行数据
  expanded?: boolean // 是否展开
  hasChildren?: boolean // 是否有子数据
}

const props = defineProps<{
  fromWarehouse?: string[]
  toProvince?: string[]
  toRdc?: string[]
}>()

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

// 当前选中的tab
const activeTab = ref('ON_TIME_RATE') // 默认选中"准时交付率"

// 筛选表单初始值
const getInitialFilterForm = () => ({
  indicatorCombination: 'ON_TIME_RATE', // 指标组合，默认准时交付率
  dataSource: [] as string[], // 数据源
  timeDimension: 'FICAL_YEAR', // 默认财年
  dateRange: getInitialDateRange(),
  transMode: '3', // 运输模式（默认端到端，传参值为3）
  logisticProvider: [] as string[], // 物流商（原deliveryProvider）
  customer: [] as string[],
})

const filterForm = ref(getInitialFilterForm())

// 获取 selectOptions store
const selectOptionsStore = useSelectOptionsStore()

// 下拉框选项
const timeDimensionOptions = ref<Array<{ code: string; name: string }>>([
  { code: 'FICAL_YEAR', name: '财年' },
  { code: 'CALENDAR_YEAR', name: '自然年' },
  { code: 'MONTH', name: '月' },
])
const dataSourceOptions = computed(() => selectOptionsStore.dataSourceOptions || [])
const logisticProviderOptions = computed(() => selectOptionsStore.deliveryProviderOptions)
const customerOptions = computed(() => selectOptionsStore.customerOptions)

// 搜索关键词
const logisticProviderSearch = ref('')
const customerSearch = ref('')

// 过滤后的物流商选项
const filteredLogisticProviderOptions = computed(() => {
  if (!logisticProviderSearch.value.trim()) {
    return logisticProviderOptions.value
  }
  const searchLower = logisticProviderSearch.value.toLowerCase()
  return logisticProviderOptions.value.filter((option: { code: string; name: string }) =>
    option.name.toLowerCase().includes(searchLower)
  )
})

// 过滤后的客户选项
const filteredCustomerOptions = computed(() => {
  if (!customerSearch.value.trim()) {
    return customerOptions.value
  }
  const searchLower = customerSearch.value.toLowerCase()
  return customerOptions.value.filter((option: { code: string; name: string }) =>
    option.name.toLowerCase().includes(searchLower)
  )
})

// 运输模式选项（固定选项）
const transModeOptions = ref<Array<{ code: string; name: string; value: number }>>([
  { code: '1', name: '干线', value: 1 },
  { code: '2', name: '配送', value: 2 },
  { code: '3', name: '端到端', value: 3 },
])

// 下拉框状态
const isDataSourceOpen = ref(false)
const isTimeDimensionOpen = ref(false)
const isTransModeOpen = ref(false)
const isLogisticProviderOpen = ref(false)
const isCustomerOpen = ref(false)

// 表格数据
const tableData = ref<TableRow[]>([])
const loading = ref(false)
// 导出加载状态
const exportLoading = ref(false)
// 导出表格加载状态
const exportTableLoading = ref(false)

// 表格容器引用和高度
const tableSectionRef = ref<HTMLElement | null>(null)
const tableScrollY = ref<number | undefined>(200) // 默认200，会动态计算

// 原始数据（用于展开/折叠）
const originalData = ref<WarehouseItem[]>([])

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

// 默认选中所有数据源
watch(
  () => dataSourceOptions.value,
  (options) => {
    if (options.length > 0 && filterForm.value.dataSource.length === 0) {
      filterForm.value.dataSource = options.map((item: { code: string; name: string }) => item.code)
    }
  },
  { immediate: true }
)

// 从heardList中提取时间列（排除固定的列名）
const extractTimeColumns = (heardList: string[]): { columns: string[]; timeStartIndex: number } => {
  if (!heardList || !Array.isArray(heardList)) {
    return { columns: [], timeStartIndex: 0 }
  }

  // 固定的列名，需要排除
  const fixedColumns = ['始发仓', '目的仓', '物流商']

  // 找到时间列开始的位置（固定列名的数量）
  const timeStartIndex = fixedColumns.length

  // 过滤出时间列（不在固定列名中的）
  const columns = heardList.filter((col) => !fixedColumns.includes(col))

  return { columns, timeStartIndex }
}

// 递归处理数据，转换为表格需要的扁平化格式
const processTableData = (data: WarehouseItem[], parentPath: string = '', level: number = 0): TableRow[] => {
  const result: TableRow[] = []

  data.forEach((item, index) => {
    const rowKey = parentPath ? `${parentPath}-${index}` : `parent-${index}`
    const isExpanded = expandedRowKeys.value.includes(rowKey)

    // 检查是否有子数据（childList不为null且不为空数组）
    const hasChildren =
      item.childList !== null &&
      item.childList !== undefined &&
      Array.isArray(item.childList) &&
      item.childList.length > 0

    // 根据层级设置不同的字段，每个层级只显示自己的key
    let originWarehouse = ''
    let destinationWarehouse = ''
    let logisticProvider = ''

    if (level === 0) {
      // 第一层：始发仓
      originWarehouse = item.key || ''
    } else if (level === 1) {
      // 第二层：目的仓（不显示始发仓）
      destinationWarehouse = item.key || ''
    } else if (level === 2) {
      // 第三层：物流商（不显示其他层级）
      logisticProvider = item.key || ''
    }

    // 构建行数据
    const row: TableRow = {
      key: rowKey,
      originWarehouse: originWarehouse,
      destinationWarehouse: destinationWarehouse,
      logisticProvider: logisticProvider,
      level: level, // 记录层级
      isParent: level === 0, // 只有第一层是父行
      expanded: isExpanded,
      hasChildren: hasChildren,
      children: undefined,
    }

    // 根据不同 tab 填充时间维度数据
    if (activeTab.value === 'ON_TIME_RATE') {
      // tab1：准时交付率（使用 rateList）
      if (item.rateList && Array.isArray(item.rateList)) {
        timeColumns.value.forEach((col, colIndex) => {
          // 这里假设 rateList 只包含时间列数据，索引从 0 开始对应第一个时间列
          const rateValue = item.rateList?.[colIndex]
          row[col] = rateValue !== undefined && rateValue !== null ? rateValue : ''
        })
      } else {
        // 如果没有 rateList，所有时间列都设为空
        timeColumns.value.forEach((col) => {
          row[col] = ''
        })
      }
    } else {
      // tab2：总单数 + 不达标单数 + 准时交付率（使用 itemList）
      let timeData: any[] = []
      const itemList = item.itemList

      if (Array.isArray(itemList)) {
        // 兼容 itemList 为二维或一维数组的情况
        if (Array.isArray(itemList[0])) {
          timeData = itemList[0] as any[]
        } else {
          timeData = itemList as any[]
        }
      }

      timeColumns.value.forEach((col) => {
        // 根据接口返回的字段匹配当前时间列
        const record =
          timeData.find((r: any) => r.dateStr === col) ||
          timeData.find((r: any) => r.dateStr === String(col)) ||
          timeData.find((r: any) => r.month === col)

        // 后端已经返回汇总好的数值和标准率，直接使用，避免前端重复计算导致不一致
        const total = record ? record.totalCount ?? '' : ''
        const noStandard = record ? record.noStandardCount ?? '' : ''
        const standardRate = record ? record.standardRate ?? '' : ''

        // 总单数
        row[`${col}_total`] = total
        // 不达标单数
        row[`${col}_noStandard`] = noStandard
        // 准时交付率（可能是带 % 的字符串，例如 "100.00%"）
        row[`${col}_rate`] = standardRate
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
      fromWarehouse: props.fromWarehouse || [],
      toProvince: props.toProvince || [],
      toRdc: props.toRdc || [],
      dataSource: filterForm.value.dataSource || [],
      timeType: filterForm.value.timeDimension,
      startDate: filterForm.value.dateRange[0].startOf('day').format('YYYY-MM-DD HH:mm:ss'),
      endDate: filterForm.value.dateRange[1].endOf('day').format('YYYY-MM-DD HH:mm:ss'),
      transMode: filterForm.value.transMode ? parseInt(filterForm.value.transMode) : null,
      logisticName: filterForm.value.logisticProvider || [],
      customer: filterForm.value.customer || [],
      standardType: activeTab.value === 'ON_TIME_RATE' ? 1 : 2,
    }

    const result = await queryOnTimeDeliveryRate(params)

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
      let dataArray: WarehouseItem[] = []
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
  } finally {
    loading.value = false
  }
}

// 日期范围变化处理
const handleDateRangeChange = () => {
  expandedRowKeys.value = []
  loadTableData()
}

// 日期范围选择器变化处理
const handleDateRangePickerChange = (dates: any) => {
  if (dates && dates.length === 2) {
    filterForm.value.dateRange[0] = dates[0].startOf('day')
    filterForm.value.dateRange[1] = dates[1].endOf('day')
    handleDateRangeChange()
  }
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

  if (percentageValue >= 96) return 'success'
  if (percentageValue >= 60) return 'warning'
  return 'error'
}

// 获取百分比文字颜色
const getTextColor = (value: any): string => {
  const status = getPercentageStatus(value)
  if (status === 'success') return '#52c41a'
  if (status === 'warning') return '#faad14'
  if (status === 'error') return '#ff4d4f'
  return ''
}

// 获取百分比状态图标
const getStatusIcon = (value: any): string => {
  const status = getPercentageStatus(value)
  if (status === 'success') return '✓'
  if (status === 'warning') return '−'
  if (status === 'error') return '✗'
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
const toggleDataSourceDropdown = () => {
  if (isDataSourceOpen.value) {
    isDataSourceOpen.value = false
    // 关闭时触发请求
    expandedRowKeys.value = []
    loadTableData()
  } else {
    closeAllDropdowns()
    isDataSourceOpen.value = true
  }
}

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
    logisticProviderSearch.value = '' // 关闭时清空搜索
    // 关闭时触发请求
    expandedRowKeys.value = []
    loadTableData()
  } else {
    closeAllDropdowns()
    isLogisticProviderOpen.value = true
    logisticProviderSearch.value = '' // 打开时清空搜索
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
  isDataSourceOpen.value = false
  isTimeDimensionOpen.value = false
  isTransModeOpen.value = false
  isLogisticProviderOpen.value = false
  isCustomerOpen.value = false
  // 清空搜索关键词
  logisticProviderSearch.value = ''
  customerSearch.value = ''
}

// 切换tab
const switchTab = (tabCode: string) => {
  activeTab.value = tabCode
  filterForm.value.indicatorCombination = tabCode
  // 切换tab后触发请求
  expandedRowKeys.value = []
  loadTableData()
}

// 选择数据源（多选，不关闭下拉框）
const selectDataSource = (option: { code: string; name: string }) => {
  const index = filterForm.value.dataSource.indexOf(option.code)
  if (index > -1) {
    filterForm.value.dataSource.splice(index, 1)
  } else {
    filterForm.value.dataSource.push(option.code)
  }
  // 多选时不关闭下拉框，不触发请求
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

// 选择运输模式
const selectTransMode = (code: string) => {
  filterForm.value.transMode = filterForm.value.transMode === code ? '' : code
  closeAllDropdowns()
  // 选择后触发请求
  expandedRowKeys.value = []
  loadTableData()
}

// 选择物流商（多选，不关闭下拉框）
const selectLogisticProvider = (option: { code: string; name: string }) => {
  const index = filterForm.value.logisticProvider.indexOf(option.code)
  if (index > -1) {
    filterForm.value.logisticProvider.splice(index, 1)
  } else {
    filterForm.value.logisticProvider.push(option.code)
  }
  // 多选时不关闭下拉框，不触发请求
}

// 选择客户（多选，不关闭下拉框）
const selectCustomer = (option: { code: string; name: string }) => {
  const index = filterForm.value.customer.indexOf(option.code)
  if (index > -1) {
    filterForm.value.customer.splice(index, 1)
  } else {
    filterForm.value.customer.push(option.code)
  }
  // 多选时不关闭下拉框，不触发请求
}

// 显示文本
const displayDataSource = computed(() => {
  if (filterForm.value.dataSource.length === 0) {
    return '数据源'
  }
  const names = filterForm.value.dataSource.map((code) => {
    const option = dataSourceOptions.value.find((item) => item.code === code)
    return option ? option.name : code
  })
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
})

const displayTimeDimension = computed(() => {
  const option = timeDimensionOptions.value.find((item) => item.code === filterForm.value.timeDimension)
  return option ? option.name : '财年'
})

const displayTransMode = computed(() => {
  if (!filterForm.value.transMode) return '运输模式'
  const option = transModeOptions.value.find((item) => item.code === filterForm.value.transMode)
  return option ? option.name : '运输模式'
})

const displayLogisticProvider = computed(() => {
  if (filterForm.value.logisticProvider.length === 0) {
    return '物流商'
  }
  const names = filterForm.value.logisticProvider.map((code) => {
    const option = logisticProviderOptions.value.find((item) => item.code === code)
    return option ? option.name : code
  })
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
})

const displayCustomer = computed(() => {
  if (filterForm.value.customer.length === 0) {
    return '客户'
  }
  const names = filterForm.value.customer.map((code) => {
    const option = customerOptions.value.find((item) => item.code === code)
    return option ? option.name : code
  })
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
})

// 重置
const handleReset = () => {
  // 重置筛选表单为初始值
  filterForm.value = getInitialFilterForm()
  // 清空下拉搜索关键字
  logisticProviderSearch.value = ''
  customerSearch.value = ''
  // 关闭所有下拉并重置展开行
  closeAllDropdowns()
  expandedRowKeys.value = []
  // 重新加载数据
  loadTableData()
}

// 导出
const handleExport = async () => {
  try {
    exportLoading.value = true

    const params = {
      fromWarehouse: props.fromWarehouse || [],
      toProvince: props.toProvince || [],
      toRdc: props.toRdc || [],
      dataSource: filterForm.value.dataSource || [],
      timeType: filterForm.value.timeDimension,
      startDate: filterForm.value.dateRange[0].startOf('day').format('YYYY-MM-DD HH:mm:ss'),
      endDate: filterForm.value.dateRange[1].endOf('day').format('YYYY-MM-DD HH:mm:ss'),
      transMode: filterForm.value.transMode ? parseInt(filterForm.value.transMode) : null,
      logisticName: filterForm.value.logisticProvider || [],
      customer: filterForm.value.customer || [],
      standardType: activeTab.value === 'ON_TIME_RATE' ? 1 : 2,
    }

    const result = await exportOnTimeDeliveryRateItem(params)

    // 检查返回状态码
    if (result.code === 409 || result.code === 504 || result.code === 505) {
      // 导出数量超过限制
      alert(result.msg || '导出数据量过大，请缩小查询范围')
      return
    }

    // 如果接口返回文件下载链接，可以触发下载
    if (result && result.data && result.data.downloadUrl) {
      window.open(result.data.downloadUrl, '_blank')
    } else if (result && result.data) {
      // 如果返回的是文件URL，创建下载链接
      const url = result.data
      const link = document.createElement('a')
      link.href = url
      // 从URL中提取文件名，如果没有则使用默认名称
      const xlsxMatch = url.match(/([^/]+\.xlsx)$/)
      const downloadFilename = xlsxMatch
        ? xlsxMatch[1]
        : `端到端准时交付率_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`
      link.download = downloadFilename
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  } catch (error: any) {
    console.error('导出失败:', error)

    // 检查是否是409或504状态码
    const errCode = error?.code || error?.response?.status
    if (errCode === 409 || errCode === 504 || errCode === 505) {
      alert(error.msg || '导出数据量过大，请缩小查询范围')
    }
  } finally {
    exportLoading.value = false
  }
}

// 导出表格
const handleExportTable = async () => {
  try {
    exportTableLoading.value = true

    // 使用和表格相同的参数
    const params = {
      fromWarehouse: props.fromWarehouse || [],
      toProvince: props.toProvince || [],
      toRdc: props.toRdc || [],
      dataSource: filterForm.value.dataSource || [],
      timeType: filterForm.value.timeDimension,
      startDate: filterForm.value.dateRange[0].startOf('day').format('YYYY-MM-DD HH:mm:ss'),
      endDate: filterForm.value.dateRange[1].endOf('day').format('YYYY-MM-DD HH:mm:ss'),
      transMode: filterForm.value.transMode ? parseInt(filterForm.value.transMode) : null,
      logisticName: filterForm.value.logisticProvider || [],
      customer: filterForm.value.customer || [],
      standardType: activeTab.value === 'ON_TIME_RATE' ? 1 : 2,
    }

    const result = await exportOnTimeDeliveryRate(params)

    // 检查返回状态码
    if (result.code === 409 || result.code === 504 || result.code === 505) {
      // 导出数量超过限制
      alert(result.msg || '导出数据量过大，请缩小查询范围')
      return
    }

    // 如果接口返回文件下载链接，可以触发下载
    if (result && result.data && result.data.downloadUrl) {
      window.open(result.data.downloadUrl, '_blank')
    } else if (result && result.data) {
      // 如果返回的是文件URL，创建下载链接
      const url = result.data
      const link = document.createElement('a')
      link.href = url
      // 从URL中提取文件名，如果没有则使用默认名称
      const xlsxMatch = url.match(/([^/]+\.xlsx)$/)
      const downloadFilename = xlsxMatch
        ? xlsxMatch[1]
        : `准时交付率表格_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`
      link.download = downloadFilename
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  } catch (error: any) {
    console.error('导出表格失败:', error)

    // 检查是否是409或504状态码
    const errCode = error?.code || error?.response?.status
    if (errCode === 409 || errCode === 504 || errCode === 505) {
      alert(error.msg || '导出数据量过大，请缩小查询范围')
    }
  } finally {
    exportTableLoading.value = false
  }
}

// 点击外部关闭下拉框
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement
  // 检查是否点击在下拉框相关区域（包括搜索输入框）
  const isClickInsideDropdown =
    target.closest('.dropdown-item') ||
    target.closest('.dropdown-content') ||
    target.closest('.search-input') ||
    target.closest('.search-box')

  if (!isClickInsideDropdown) {
    // 检查是否有下拉框正在打开
    const hadOpenDropdown =
      isDataSourceOpen.value ||
      isTimeDimensionOpen.value ||
      isTransModeOpen.value ||
      isLogisticProviderOpen.value ||
      isCustomerOpen.value
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
      const calculatedHeight = containerHeight > 300 ? containerHeight - 100 : 180
      tableScrollY.value = calculatedHeight
    }
  })
}

// 监听 props 变化
watch(
  () => props,
  () => {
    expandedRowKeys.value = []
    loadTableData()
  },
  { deep: true }
)

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
  <div class="warehousing-logistics-container">
    <div class="header-bar">
      <h2 class="header-title">仓储物流准时交付率</h2>
    </div>
    <!-- Tab页签 -->
    <div class="tabs-container">
      <div class="tab-item" :class="{ active: activeTab === 'ON_TIME_RATE' }" @click="switchTab('ON_TIME_RATE')">
        准时交付率
      </div>
      <div
        class="tab-item"
        :class="{ active: activeTab === 'TOTAL_ORDERS' }"
        @click="switchTab('TOTAL_ORDERS')"
      >
        总单数+不达标单数+准时交付率
      </div>
    </div>

    <!-- 筛选区域 -->
    <div class="filter-section">
      <div class="filter-form">
        <div class="dropdown-group">
          <!-- 日期范围选择器 -->
          <div class="date-range-item">
            <a-range-picker
              :value="[filterForm.dateRange[0], filterForm.dateRange[1]]"
              format="YYYY-MM-DD"
              separator="至"
              :placeholder="['开始...', '结束...']"
              class="date-range-picker"
              :show-time="false"
              @change="handleDateRangePickerChange"
            />
          </div>
          <!-- 数据源下拉框 -->
          <div
            class="dropdown-item"
            :class="{ 'dropdown-open': isDataSourceOpen }"
            :title="displayDataSource"
            @click.stop="toggleDataSourceDropdown"
          >
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
                  :class="{ selected: filterForm.dataSource.includes(option.code) }"
                  @click.stop="selectDataSource(option)"
                >
                  <span class="checkmark" v-if="filterForm.dataSource.includes(option.code)">✓</span>
                  {{ option.name }}
                </div>
              </div>
            </div>
          </div>

          <!-- 时间维度下拉框 -->
          <div
            class="dropdown-item"
            :class="{ 'dropdown-open': isTimeDimensionOpen }"
            :title="displayTimeDimension"
            @click.stop="toggleTimeDimensionDropdown"
          >
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
                  :class="{ selected: filterForm.timeDimension === option.code }"
                  @click.stop="selectTimeDimension(option)"
                >
                  <span class="checkmark" v-if="filterForm.timeDimension === option.code">✓</span>
                  {{ option.name }}
                </div>
              </div>
            </div>
          </div>

          <!-- 运输模式下拉框 -->
          <div
            class="dropdown-item"
            :class="{ 'dropdown-open': isTransModeOpen }"
            :title="displayTransMode"
            @click.stop="toggleTransModeDropdown"
          >
            <span class="dropdown-text">{{ displayTransMode }}</span>
            <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
            <div class="dropdown-content" v-show="isTransModeOpen" @click.stop>
              <div class="options-list">
                <div
                  v-for="option in transModeOptions"
                  :key="option.code"
                  class="dropdown-option"
                  :class="{ selected: filterForm.transMode === option.code }"
                  @click.stop="selectTransMode(option.code)"
                >
                  <span class="checkmark" v-if="filterForm.transMode === option.code">✓</span>
                  {{ option.name }}
                </div>
              </div>
            </div>
          </div>

          <!-- 物流商下拉框 -->
          <div
            class="dropdown-item"
            :class="{ 'dropdown-open': isLogisticProviderOpen }"
            :title="displayLogisticProvider"
            @click.stop="toggleLogisticProviderDropdown"
          >
            <span class="dropdown-text">{{ displayLogisticProvider }}</span>
            <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
            <div class="dropdown-content" v-show="isLogisticProviderOpen" @click.stop>
              <div class="search-box">
                <input
                  v-model="logisticProviderSearch"
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
                  :class="{ selected: filterForm.logisticProvider.includes(option.code) }"
                  @click.stop="selectLogisticProvider(option)"
                >
                  <span class="checkmark" v-if="filterForm.logisticProvider.includes(option.code)">✓</span>
                  {{ option.name }}
                </div>
                <div v-if="filteredLogisticProviderOptions.length === 0 && logisticProviderSearch" class="no-results">
                  暂无搜索结果
                </div>
              </div>
            </div>
          </div>

          <!-- 客户下拉框 -->
          <div
            class="dropdown-item customer-dropdown"
            :class="{ 'dropdown-open': isCustomerOpen }"
            :title="displayCustomer"
            @click.stop="toggleCustomerDropdown"
          >
            <span class="dropdown-text">{{ displayCustomer }}</span>
            <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
            <div class="dropdown-content" v-show="isCustomerOpen" @click.stop>
              <div class="search-box">
                <input v-model="customerSearch" type="text" placeholder="搜索客户..." class="search-input" @click.stop />
              </div>
              <div class="options-list">
                <div
                  v-for="option in filteredCustomerOptions"
                  :key="option.code"
                  class="dropdown-option"
                  :class="{ selected: filterForm.customer.includes(option.code) }"
                  @click.stop="selectCustomer(option)"
                >
                  <span class="checkmark" v-if="filterForm.customer.includes(option.code)">✓</span>
                  {{ option.name }}
                </div>
                <div v-if="filteredCustomerOptions.length === 0 && customerSearch" class="no-results">暂无搜索结果</div>
              </div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="filter-actions">
            <button class="action-btn" @click="handleReset">重置</button>
            <button class="action-btn" @click="handleExport" :disabled="exportLoading">
              {{ exportLoading ? '导出中...' : '导出明细' }}
            </button>
            <button class="action-btn" @click="handleExportTable" :disabled="exportTableLoading">
              {{ exportTableLoading ? '导出中...' : '导出表格' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 表格区域 -->
    <div class="table-section" ref="tableSectionRef">
      <div v-if="loading" class="loading-overlay">加载中...</div>
      <table class="data-table">
        <thead>
          <tr>
            <th class="fixed-col origin-col">始发仓</th>
            <th class="fixed-col dest-col" :colspan="activeTab === 'ON_TIME_RATE' ? 1 : 1">
              {{ activeTab === 'ON_TIME_RATE' ? '目的仓' : '目的仓' }}
            </th>
            <th v-if="activeTab === 'ON_TIME_RATE'" class="fixed-col logistic-col">物流商</th>
            <template v-if="activeTab === 'ON_TIME_RATE'">
              <th v-for="col in timeColumns" :key="col" class="time-col">{{ col }}</th>
            </template>
            <template v-else>
              <template v-for="col in timeColumns" :key="col">
                <th :colspan="3" class="time-group-col">{{ col }}</th>
              </template>
            </template>
          </tr>
          <tr v-if="activeTab === 'TOTAL_ORDERS'">
            <th class="fixed-col origin-col"></th>
            <th class="fixed-col dest-col"></th>
            <template v-for="col in timeColumns" :key="col + '_sub'">
              <th class="sub-col">总单数</th>
              <th class="sub-col">不达标</th>
              <th class="sub-col">准时率</th>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tableData" :key="row.key" :class="{ 'parent-row': row.level === 0 }">
            <td class="fixed-col origin-col">
              <span class="cell-content" :style="{ paddingLeft: `${(row.level || 0) * 1.5}rem` }">
                <span
                  v-if="row.hasChildren && row.level === 0"
                  class="expand-icon"
                  @click.stop="toggleRowExpand(row.key)"
                  :class="{ expanded: row.expanded }"
                >
                  {{ row.expanded ? '−' : '+' }}
                </span>
                <span v-else-if="row.level === 0" class="expand-icon-placeholder"></span>
                <span class="warehouse-text">{{ row.originWarehouse || '' }}</span>
              </span>
            </td>
            <td class="fixed-col dest-col">
              <template v-if="row.level === 0">
                <span class="subtotal-text">小计</span>
              </template>
              <template v-else>
                <span class="cell-content">
                  <span
                    v-if="row.hasChildren && row.level === 1"
                    class="expand-icon"
                    @click.stop="toggleRowExpand(row.key)"
                    :class="{ expanded: row.expanded }"
                  >
                    {{ row.expanded ? '−' : '+' }}
                  </span>
                  <span v-else-if="row.level === 1" class="expand-icon-placeholder"></span>
                  <span>{{ row.destinationWarehouse || '' }}</span>
                </span>
              </template>
            </td>
            <td v-if="activeTab === 'ON_TIME_RATE'" class="fixed-col logistic-col">
              {{ row.logisticProvider || '' }}
            </td>
            <template v-if="activeTab === 'ON_TIME_RATE'">
              <td v-for="col in timeColumns" :key="col" class="time-col percentage-cell">
                <span v-if="getStatusIcon(row[col])" :style="{ color: getTextColor(row[col]) }">{{ getStatusIcon(row[col]) }}</span>
                {{ formatPercentage(row[col]) }}
              </td>
            </template>
            <template v-else>
              <template v-for="col in timeColumns" :key="col + '_data'">
                <td class="time-col">{{ row[`${col}_total`] }}</td>
                <td class="time-col">{{ row[`${col}_noStandard`] }}</td>
                <td class="time-col percentage-cell">
                  <span v-if="getStatusIcon(row[`${col}_rate`])" :style="{ color: getTextColor(row[`${col}_rate`]) }">{{ getStatusIcon(row[`${col}_rate`]) }}</span>
                  {{ formatPercentage(row[`${col}_rate`]) }}
                </td>
              </template>
            </template>
          </tr>
          <tr v-if="tableData.length === 0 && !loading">
            <td :colspan="activeTab === 'ON_TIME_RATE' ? 3 + timeColumns.length : 3 + timeColumns.length * 3" class="empty-cell">
              暂无数据
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.warehousing-logistics-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: visible;
  position: relative;
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

/* Tab页签样式 */
.tabs-container {
  display: flex;
  gap: 0;
  border-bottom: 0.0625rem solid rgba(74, 158, 255, 0.2);
  flex-shrink: 0;
}

.tab-item {
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: clamp(0.6rem, 0.75vw, 0.75rem);
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

/* 筛选区域 */
.filter-section {
  margin-bottom: 0;
  border-radius: 0;
  padding: 0;
  position: relative;
  z-index: 100;
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
  flex-shrink: 0;
}

.filter-form {
  display: flex;
  align-items: center;
  padding: 0.75rem 0;
  overflow: visible;
}

.dropdown-group {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  justify-content: flex-start;
  width: 100%;
  align-items: center;
  position: relative;
  overflow: visible;
}

.dropdown-item {
  position: relative;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.3rem;
  background: #081f40;
  border: 0.0625rem solid #2873cc;
  border-radius: 0.2rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: clamp(0.6rem, 0.75vw, 0.75rem);
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(0.625rem);
  flex: 0 0 auto;
  min-width: 6rem;
  max-width: 7rem;
  padding: 0.3rem 0.5rem;
  flex-shrink: 1;
}

.dropdown-item.dropdown-open {
  z-index: 10000;
}

.dropdown-item.customer-dropdown {
  min-width: 7rem;
  max-width: 8rem;
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
  min-width: 0;
  max-width: 100%;
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
  background: #081f40;
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

.search-box {
  padding: 0.2rem;
  border-bottom: 0.0625rem solid rgba(59, 130, 246, 0.3);
  flex-shrink: 0;
}

.search-input {
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

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.search-input:focus {
  border-color: rgba(59, 130, 246, 0.8);
  background: rgba(0, 0, 0, 0.5);
}

.options-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 7.6rem;
  padding: 0.2rem;
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

.checkmark {
  color: #00ff88;
  font-weight: bold;
  font-size: 0.8rem;
}

.no-results {
  padding: 0.5rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.7rem;
  font-style: italic;
}

/* 日期选择器 */
.date-range-item {
  flex-shrink: 1;
}

.date-range-item .date-range-picker {
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

.date-range-item .date-range-picker:hover {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}

.date-range-item .date-range-picker :deep(.ant-picker-input) input {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
}

.date-range-item .date-range-picker :deep(.ant-picker-separator) {
  color: rgba(255, 255, 255, 0.7);
}

.date-range-item .date-range-picker :deep(.ant-picker-separator) svg {
  display: none !important;
}

.date-range-item .date-range-picker :deep(.ant-picker-suffix) {
  color: rgba(255, 255, 255, 0.7);
}

/* 操作按钮 */
.filter-actions {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
  flex-shrink: 0;
  flex-grow: 0;
  min-width: fit-content;
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
  font-size: clamp(0.6rem, 0.7vw, 0.7rem);
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

/* 表格区域 */
.table-section {
  flex: 1;
  overflow: auto;
  min-height: 0;
  padding: 0 0 0.5rem;
  position: relative;
  z-index: 1;
  scrollbar-width: thin;
  scrollbar-color: rgba(74, 158, 255, 0.3) rgba(0, 0, 0, 0.1);
}

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

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  z-index: 10;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.data-table th,
.data-table td {
  padding: 0.4rem 0.5rem;
  text-align: center;
  font-size: clamp(0.6rem, 0.7vw, 0.7rem);
  border: 1px solid rgba(74, 158, 255, 0.2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.data-table th {
  background: rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 5;
}

.data-table td {
  color: white;
  background: transparent;
}

.data-table tbody tr:hover {
  background: rgba(74, 158, 255, 0.1);
}

.fixed-col {
  position: sticky;
  z-index: 2;
  background: rgba(8, 31, 64, 0.95);
}

.origin-col {
  left: 0;
  width: 8rem;
}

.dest-col {
  left: 8rem;
  width: 7rem;
}

.logistic-col {
  left: 15rem;
  width: 7rem;
}

.time-col {
  width: 5rem;
}

.time-group-col {
  width: 15rem;
}

.sub-col {
  width: 5rem;
}

.parent-row {
  font-weight: 600;
}

.cell-content {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}

.expand-icon {
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

.expand-icon:hover {
  background: rgba(74, 158, 255, 0.2);
  border-color: #4a9eff;
}

.expand-icon.expanded {
  background: rgba(74, 158, 255, 0.3);
}

.expand-icon-placeholder {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.warehouse-text {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
}

.subtotal-text {
  display: block;
  text-align: center;
  width: 100%;
  color: rgba(255, 255, 255, 0.7);
}

.percentage-cell {
  text-align: center;
}

.percentage-cell-content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.data-table td.text-success {
  color: #52c41a !important;
}

.data-table td.text-warning {
  color: #faad14 !important;
}

.data-table td.text-error {
  color: #ff4d4f !important;
}

.empty-cell {
  text-align: center;
  padding: 2rem;
  color: rgba(255, 255, 255, 0.5);
}
</style>
