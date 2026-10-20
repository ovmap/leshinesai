
<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { queryRiskOrderStats, queryRiskOrderByPage, exportRiskOrder, queryCddAlertStats, queryCddAlertDetails, exportCddAlertDataByFilter, queryAbnormalVehicleStats, queryIsgDelayRisk, queryIsgInTransitAbnormal, queryIsgDeliveryAbnormal, queryIsgRiskAlert, queryFromWarehouse, queryToProvince, queryToRdc, queryLatestWeeklyReportContent, queryLatestPfpAssessmentContent } from '../../../services/transportApi'
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import { useDashboardControlStore } from '../../../stores/dashboardControlStore'
import { useDashboardDataStore } from '../../../stores/dashboardDataStore'

const controlStore = useDashboardControlStore()
const dataStore = useDashboardDataStore()

const props = defineProps<{
  fromWarehouse?: string[]
  toProvince?: string[]
  toRdc?: string[]
}>()

const warehouseOptions = ref<string[]>([])
const provinceOptions = ref<string[]>([])
const rdcOptions = ref<string[]>([])

const loadSelectOptions = async () => {
  try {
    const [whRes, provRes, rdcRes] = await Promise.all([
      queryFromWarehouse(),
      queryToProvince(),
      queryToRdc()
    ])
    // 接口返回对象数组 {code, name}，提取 name 作为字符串
    if (whRes?.data) warehouseOptions.value = Array.isArray(whRes.data) ? whRes.data.map((item: any) => item.name || item) : []
    if (provRes?.data) provinceOptions.value = Array.isArray(provRes.data) ? provRes.data.map((item: any) => item.name || item) : []
    if (rdcRes?.data) rdcOptions.value = Array.isArray(rdcRes.data) ? rdcRes.data.map((item: any) => item.name || item) : []
  } catch (error) {
    console.error('加载筛选选项失败:', error)
  }
}

// 视频引用
const videoRef = ref<HTMLVideoElement | null>(null)

// 容器引用和缩放比例
const cargoContainer = ref<HTMLDivElement | null>(null)
const scaleRatio = ref(1)

// 动画状态
const isAnimating = ref(false)
// 自动动画定时器
let autoAnimationTimer: NodeJS.Timeout | null = null
// 鼠标悬停状态
const isHovered = ref(false)
// 数据加载状态
const dataLoading = ref(false)
// 视频加载完成状态
const videoLoaded = ref(false)

// 智能体异常预警卡片定时刷新定时器
let cargoBannerRefreshTimer: NodeJS.Timeout | null = null

// ISG电子标签预警和车辆安全监控卡片定时刷新定时器
let isgAndVehicleRefreshTimer: NodeJS.Timeout | null = null

// 弹窗相关状态
const modalVisible = ref(false)
const modalTitle = ref('异常预警订单详情')
const modalData = ref<any[]>([])
const modalLoading = ref(false)

// 卡片详情弹窗状态
const cardDetailModalVisible = ref(false)
const selectedCardIndex = ref(-1)
const selectedCardData = ref<any>(null)

// 分页相关状态
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

// 导出相关状态
const exportLoading = ref(false)

// 表格容器引用和高度
const modalTableSectionRef = ref<HTMLElement | null>(null)
const modalTableScrollY = ref<number | undefined>(200)

// ISG弹窗相关状态
const isgActiveTab = ref<'delay' | 'inTransit' | 'delivery'>('delay') // 当前激活的tab
const isgSearchParams = ref({
  dateRange: null as any,
  startDate: '',
  endDate: '',
  invoiceNo: ''
})
const isgTabCounts = ref({
  delay: 0,
  inTransit: 0,
  delivery: 0
})

// ISG 默认时间：当前时刻减一周 ~ 当前时刻（含时分秒）
const buildIsgDefaultSearchParams = () => {
  const end = dayjs()
  const start = dayjs().subtract(7, 'day')
  return {
    dateRange: [start, end],
    startDate: start.format('YYYY-MM-DD HH:mm:ss'),
    endDate: end.format('YYYY-MM-DD HH:mm:ss'),
    invoiceNo: '',
  }
}

// CDD预警弹窗相关状态
const cddSearchParams = ref({
  dateRange: null as any,
  startDate: '',
  endDate: '',
  dataSource: [] as string[],
  customer: [] as string[],
  fromWarehouse: [] as string[],
  toProvince: [] as string[],
  toRdc: [] as string[],
  nonComplianceType: [] as string[],
  modeType: [] as string[]
})

// CDD预警下拉框选项
const cddDataSourceOptions = ref<Array<{ code: string; name: string }>>([])
const cddCustomerOptions = ref<Array<{ code: string; name: string }>>([])
const cddModeTypeOptions = ref<Array<{ code: string; name: string }>>([])
const cddNonComplianceTypeOptions = ref<Array<{ code: string; name: string }>>([])
const isCddDataSourceOpen = ref(false)
const isCddCustomerOpen = ref(false)
const isCddModeTypeOpen = ref(false)
const isCddNonComplianceTypeOpen = ref(false)
const isCddFromWarehouseOpen = ref(false)
const isCddToProvinceOpen = ref(false)
const isCddToRdcOpen = ref(false)

// 文本截断处理
const maxDisplayLength = 15; // 最大显示字符数

// 智能截断函数
const truncateText = (items: string[], maxLength: number) => {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];

  let result = items[0];
  let count = 1;

  for (let i = 1; i < items.length; i++) {
    const nextText = result + ', ' + items[i];
    if (nextText.length <= maxLength) {
      result = nextText;
      count++;
    } else {
      break;
    }
  }

  if (count < items.length) {
    result += ` +${items.length - count}`;
  }

  return result;
};

// 从Header组件接收的下拉框数据
const headerWarehouseData = ref<string[]>([]) // 始发仓库数据
const headerProvinceData = ref<string[]>([]) // 目的省份数据
const headerRdcData = ref<string[]>([]) // 目的RDC数据

// CDD搜索下拉框状态
const cddWarehouseSearch = ref('')
const cddProvinceSearch = ref('')
const cddRdcSearch = ref('')

// 在打开弹窗时同步全局筛选条件到CDD搜索参数
const syncGlobalFiltersToCddParams = () => {
  // 只有当CDD搜索参数为空时才同步全局筛选条件
  // 避免覆盖用户在CDD搜索中已做的选择
  if (cddSearchParams.value.fromWarehouse.length === 0) {
    cddSearchParams.value.fromWarehouse = props.fromWarehouse || [];
  }
  if (cddSearchParams.value.toProvince.length === 0) {
    cddSearchParams.value.toProvince = props.toProvince || [];
  }
  if (cddSearchParams.value.toRdc.length === 0) {
    cddSearchParams.value.toRdc = props.toRdc || [];
  }
};



// CDD搜索下拉框显示文本
const cddDisplayWarehouse = computed(() => {
  if (cddSearchParams.value.fromWarehouse.length === 0) return '始发仓';
  return truncateText(cddSearchParams.value.fromWarehouse, maxDisplayLength);
});

const cddDisplayProvince = computed(() => {
  if (cddSearchParams.value.toProvince.length === 0) return '目的省';
  return truncateText(cddSearchParams.value.toProvince, maxDisplayLength);
});

const cddDisplayRdc = computed(() => {
  if (cddSearchParams.value.toRdc.length === 0) return '目的RDC';
  return truncateText(cddSearchParams.value.toRdc, maxDisplayLength);
});

// CDD搜索下拉框完整文本（用于tooltip）
const cddFullWarehouseText = computed(() =>
  cddSearchParams.value.fromWarehouse.length > 0 ? cddSearchParams.value.fromWarehouse.join(', ') : '始发仓'
);

const cddFullProvinceText = computed(() =>
  cddSearchParams.value.toProvince.length > 0 ? cddSearchParams.value.toProvince.join(', ') : '目的省'
);

const cddFullRdcText = computed(() =>
  cddSearchParams.value.toRdc.length > 0 ? cddSearchParams.value.toRdc.join(', ') : '目的RDC'
);

// 过滤后的选项
const filteredCddWarehouseOptions = computed(() => {
  // 使用完整选项列表，确保即使header数据为空也有选项可显示
  const allAvailableOptions = warehouseOptions.value || [];
  // 确保当前选中的值也在选项列表中，即使它们不在标准选项列表中
  const selectedValues = cddSearchParams.value.fromWarehouse || [];
  const allOptions = [...new Set([...allAvailableOptions, ...selectedValues])];
  
  const filtered = allOptions.filter(option =>
    option.toLowerCase().includes(cddWarehouseSearch.value.toLowerCase())
  );
  // 在列表开头添加重置选项
  return ['重置', ...filtered];
});

const filteredCddProvinceOptions = computed(() => {
  // 使用完整选项列表，确保即使header数据为空也有选项可显示
  const allAvailableOptions = provinceOptions.value || [];
  // 确保当前选中的值也在选项列表中，即使它们不在标准选项列表中
  const selectedValues = cddSearchParams.value.toProvince || [];
  const allOptions = [...new Set([...allAvailableOptions, ...selectedValues])];
  
  const filtered = allOptions.filter(option =>
    option.toLowerCase().includes(cddProvinceSearch.value.toLowerCase())
  );
  // 在列表开头添加重置选项
  return ['重置', ...filtered];
});

const filteredCddRdcOptions = computed(() => {
  // 使用完整选项列表，确保即使header数据为空也有选项可显示
  const allAvailableOptions = rdcOptions.value || [];
  // 确保当前选中的值也在选项列表中，即使它们不在标准选项列表中
  const selectedValues = cddSearchParams.value.toRdc || [];
  const allOptions = [...new Set([...allAvailableOptions, ...selectedValues])];
  
  const filtered = allOptions.filter(option =>
    option.toLowerCase().includes(cddRdcSearch.value.toLowerCase())
  );
  // 在列表开头添加重置选项
  return ['重置', ...filtered];
});

// 计算弹窗表格滚动高度
const calculateModalTableScrollY = () => {
  nextTick(() => {
    if (modalTableSectionRef.value) {
      const containerHeight = modalTableSectionRef.value.clientHeight
      const calculatedHeight = containerHeight > 300 ? containerHeight - 100 : 200
      modalTableScrollY.value = calculatedHeight
    }
  })
}

// 处理Header组件数据变化的函数
const handleFilterChanged = (event: any) => {
  if (event && event.detail) {
    const { warehouse, province, rdc } = event.detail
    headerWarehouseData.value = warehouse || []
    headerProvinceData.value = province || []
    headerRdcData.value = rdc || []
    
    // Header下拉框修改时重新请求数据
    fetchRiskOrderStats()
  }
}

// 获取当月开始和结束日期
const getCurrentMonthRange = () => {
  const now = dayjs()
  const startDate = now.startOf('month').hour(0).minute(0).second(0).format('YYYY-MM-DD HH:mm:ss')
  const endDate = now.endOf('month').hour(23).minute(59).second(59).format('YYYY-MM-DD HH:mm:ss')
  return { startDate, endDate }
}

// 调用CDD预警统计接口
const fetchCddAlertStats = async () => {
  try {
    // 优先使用header组件的数据，如果没有则使用全局筛选条件
    const { startDate, endDate } = getCurrentMonthRange()
    const filterParams = {
      fromWarehouse: headerWarehouseData.value.length > 0 ? headerWarehouseData.value : (props.fromWarehouse || []),
      toProvince: headerProvinceData.value.length > 0 ? headerProvinceData.value : (props.toProvince || []),
      toRdc: headerRdcData.value.length > 0 ? headerRdcData.value : (props.toRdc || []),
      startDate,
      endDate
    }

    const result = await queryCddAlertStats(filterParams)
    // console.log('[CDD] filterParams:', JSON.stringify(filterParams))
    // console.log('[CDD] API result:', JSON.stringify(result))
    
    // 添加保护判断：检查 data 不为 null
    if (result && result.code === 200 && result.data !== null && result.data !== undefined) {
      const { highPriority, normalPriority } = result.data
      const content: string[] = []
      
      // 处理重点关注数据
      if (highPriority && Array.isArray(highPriority) && highPriority.length > 0) {
        // 过滤掉 null、undefined 和无效的 "null" 字符串
        const validHighPriority = highPriority.filter((item: any) => {
          if (item === null || item === undefined) {
            return false
          }
          if (typeof item === 'string') {
            const trimmed = item.trim()
            // 只过滤空字符串和完全等于 "null" 的情况（不区分大小写）
            if (trimmed === '' || trimmed.toLowerCase() === 'null') {
              return false
            }
            // 过滤掉类似 "null 发货单号"、"null发货单号" 这样的无效数据
            const lowerTrimmed = trimmed.toLowerCase()
            if (lowerTrimmed.startsWith('null ') || lowerTrimmed.startsWith('null发货') || lowerTrimmed.startsWith('null-')) {
              return false
            }
            return true
          }
          return true
        })
        
        if (validHighPriority.length > 0) {
          content.push('重点关注')
          validHighPriority.forEach((item: string) => {
            content.push(item)
          })
        }
      }
      
      // 处理一般关注数据
      if (normalPriority && Array.isArray(normalPriority) && normalPriority.length > 0) {
        // 过滤掉 null、undefined 和无效的 "null" 字符串
        const validNormalPriority = normalPriority.filter((item: any) => {
          if (item === null || item === undefined) {
            return false
          }
          if (typeof item === 'string') {
            const trimmed = item.trim()
            // 只过滤空字符串和完全等于 "null" 的情况（不区分大小写）
            if (trimmed === '' || trimmed.toLowerCase() === 'null') {
              return false
            }
            // 过滤掉类似 "null 发货单号"、"null发货单号" 这样的无效数据
            const lowerTrimmed = trimmed.toLowerCase()
            if (lowerTrimmed.startsWith('null ') || lowerTrimmed.startsWith('null发货') || lowerTrimmed.startsWith('null-')) {
              return false
            }
            return true
          }
          return true
        })
        
        if (validNormalPriority.length > 0) {
          content.push('一般关注')
          validNormalPriority.forEach((item: string) => {
            content.push(item)
          })
        }
      }
      
      return content.length > 0 ? content : null
    }
    return null
  } catch (error) {
    console.error('queryCddAlertStats error:', error)
    return null
  }
}

// 车辆数据接口
interface VehicleData {
  carNo: string;
  location: string;
  abnormalMsg: string;
  abnormalTime: string;
}

// 调用车辆异常统计接口
const fetchAbnormalVehicleStats = async () => {
  try {
    const result = await queryAbnormalVehicleStats()
    
    // 添加保护判断：检查 data 不为 null
    if (result && result.code === 200 && result.data !== null && result.data !== undefined && Array.isArray(result.data)) {
      // 保存原始数据
      const rawData: VehicleData[] = result.data.map((item: any) => ({
        carNo: item.carNo || '',
        location: item.location || '',
        abnormalMsg: item.abnormalMsg || '',
        abnormalTime: item.abnormalTime || ''
      }))
      
      // 将数据格式化为卡片需要的格式：车牌号，异常消息，时间
      const content = rawData.map((item) => {
        return `${item.carNo}，${item.abnormalMsg}，${item.abnormalTime}`
      })
      
      return {
        content: content.length > 0 ? content : null,
        rawData: rawData
      }
    }
    return { content: null, rawData: [] }
  } catch (error) {
    console.error('queryAbnormalVehicleStats error:', error)
    return { content: null, rawData: [] }
  }
}

// 调用ISG风险预警接口
const fetchIsgRiskAlert = async () => {
  try {
    const result = await queryIsgRiskAlert()
    
    // 添加保护判断：检查 data 不为 null
    if (result && result.code === 200 && result.data !== null && result.data !== undefined && result.data.content && Array.isArray(result.data.content)) {
      // 接口返回的content数组直接使用，不需要额外处理
      return result.data.content.length > 0 ? result.data.content : null
    }
    return null
  } catch (error) {
    console.error('queryIsgRiskAlert error:', error)
    return null
  }
}

// 独立获取异常预警订单数据
const fetchRiskOrderData = async () => {
  try {
    const filterParams = {
      fromWarehouse: headerWarehouseData.value.length > 0 ? headerWarehouseData.value : (props.fromWarehouse || []),
      toProvince: headerProvinceData.value.length > 0 ? headerProvinceData.value : (props.toProvince || []),
      toRdc: headerRdcData.value.length > 0 ? headerRdcData.value : (props.toRdc || [])
    }
    const riskResult = await queryRiskOrderStats(filterParams)
    // 添加更严格的保护判断：检查 data 不为 null，且 content 存在且为数组
    if (riskResult && riskResult.code === 200 && riskResult.data !== null && riskResult.data !== undefined && riskResult.data.content && Array.isArray(riskResult.data.content)) {
      // 过滤掉 null、undefined 和包含 "null" 字符串的项
      return riskResult.data.content
        .filter((item: any) => {
          // 过滤掉 null、undefined
          if (item === null || item === undefined) {
            return false
          }
          // 如果是字符串，检查是否为空或完全等于 "null"
          if (typeof item === 'string') {
            const trimmed = item.trim()
            // 只过滤空字符串和完全等于 "null" 的情况（不区分大小写）
            // 不过滤包含 "null" 的情况，避免误过滤有效数据
            return trimmed !== '' && trimmed.toLowerCase() !== 'null'
          }
          // 其他类型保留
          return true
        })
        .map((item: string) => `• ${item}`)
    }
    return []
  } catch (error) {
    console.error('fetchRiskOrderData error:', error)
    return []
  }
}

// 独立获取CDD预警数据
const fetchCddAlertData = async () => {
  try {
    const content = await fetchCddAlertStats()
    return content || []
  } catch (error) {
    console.error('fetchCddAlertData error:', error)
    return []
  }
}

// 独立获取车辆安全监控数据
const fetchVehicleData = async () => {
  try {
    const vehicleResult = await fetchAbnormalVehicleStats()
    const vehicleContentRaw: string[] = vehicleResult?.content || []
    const vehicleContent = vehicleContentRaw.map((item: string) => `• ${item}`)
    const vehicleRawData = vehicleResult?.rawData && vehicleResult.rawData.length > 0 ? vehicleResult.rawData : []
    return {
      content: vehicleContent,
      rawData: vehicleRawData
    }
  } catch (error) {
    console.error('fetchVehicleData error:', error)
    return {
      content: [],
      rawData: []
    }
  }
}

// 独立获取ISG预警数据
const fetchIsgData = async () => {
  try {
    const content = await fetchIsgRiskAlert()
    return content || []
  } catch (error) {
    console.error('fetchIsgData error:', error)
    return []
  }
}

// 调用异常预警订单统计接口
const fetchRiskOrderStats = async () => {
  // 不隐藏卡片，让卡片和标题先显示出来
  dataLoading.value = false
  
  try {
    // 并行调用六个接口，每个接口都有独立的错误处理，互不影响
    const [riskContent, cddContent, vehicleData, isgContent, cddWeeklyReport, pfpAssessment] = await Promise.allSettled([
      fetchRiskOrderData(),
      fetchCddAlertData(),
      fetchVehicleData(),
      fetchIsgData(),
      queryLatestWeeklyReportContent({
        startTime: '2026-06-11 00:00:00',
        endTime: '2026-07-18 15:32:11'
      }),
      queryLatestPfpAssessmentContent({
        startTime: '2026-06-11 00:00:00',
        endTime: '2026-07-18 15:32:11',
        month: 5
      })
    ])
    
    // 处理各个接口返回的数据，即使某个接口失败也不影响其他接口
    const finalRiskContent = riskContent.status === 'fulfilled' ? riskContent.value : []
    const finalCddContent = cddContent.status === 'fulfilled' ? cddContent.value : []
    const finalVehicleData = vehicleData.status === 'fulfilled' ? vehicleData.value : { content: [], rawData: [] }
    const finalIsgContent = isgContent.status === 'fulfilled' ? isgContent.value : []
    const finalCddWeeklyReport = cddWeeklyReport.status === 'fulfilled' && cddWeeklyReport.value?.code === 200
      ? cddWeeklyReport.value.data : null
    const finalPfpAssessment = pfpAssessment.status === 'fulfilled' && pfpAssessment.value?.code === 200
      ? pfpAssessment.value.data : null
    
    // 更新卡片数据 - 4个卡片：去掉PFP和底部中间的卡片，保留左右两侧
    dataCards.value = [
      {
        title: '当月CDD预警',
        content: Array.isArray(finalCddContent) ? finalCddContent : []
      },
      {
        title: '车辆安全监控',
        content: Array.isArray(finalVehicleData.content) ? finalVehicleData.content : [],
        rawData: Array.isArray(finalVehicleData.rawData) ? finalVehicleData.rawData : []
      },
      //ISG预警卡片
      {
        title: 'ISG电子标签预警',
        content: Array.isArray(finalIsgContent) ? finalIsgContent : []
      },
      {
        title: '超7天异常预警',
        content: Array.isArray(finalRiskContent) ? finalRiskContent : []
      }
    ]

    // 推送数据到 Store，供智能体使用
    dataStore.updateModuleData('cargoBanner', {
      cards: dataCards.value,
      cddWeeklyReport: finalCddWeeklyReport,
      pfpAssessment: finalPfpAssessment
    })
  } catch (error) {
    console.error('fetchRiskOrderStats error:', error)
    // 即使整体失败，也确保卡片数组存在，避免页面崩溃，4个卡片
    if (!dataCards.value || dataCards.value.length === 0) {
      dataCards.value = [
        {
          title: '当月CDD预警',
          content: []
        },
        {
          title: '车辆安全监控',
          content: [],
          rawData: []
        },
        //ISG预警卡片
        {
          title: 'ISG电子标签预警',
          content: []
        },
        {
          title: '异常预警大于7天未解决',
          content: []
        }
      ]
    }
  } finally {
    // 数据加载完成后显示卡片
    dataLoading.value = false
  }
}

// 基础设计尺寸
const BASE_WIDTH = 840
const BASE_HEIGHT = 480

// 计算缩放比例
const calculateScaleRatio = () => {
  if (!cargoContainer.value) return

  const rect = cargoContainer.value.getBoundingClientRect()
  const containerWidth = rect.width
  const containerHeight = rect.height

  // 检查容器尺寸是否有效，如果为0或太小则使用默认值
  if (containerWidth <= 0 || containerHeight <= 0) {
    console.log('容器尺寸异常，使用默认缩放比例')
    scaleRatio.value = 1
    return
  }

  // 计算基于宽度和高度的缩放比例
  const widthRatio = containerWidth / BASE_WIDTH
  const heightRatio = containerHeight / BASE_HEIGHT

  // 使用较小的比例，确保内容完全适应容器
  const newScaleRatio = Math.min(widthRatio, heightRatio)

  // 限制缩放比例范围，避免过大或过小
  scaleRatio.value = Math.max(0.5, Math.min(1.5, newScaleRatio))

  // 应用动态缩放到文本框
  applyTextScaling()
}

// 应用文本框的动态缩放
const applyTextScaling = () => {
  if (!cargoContainer.value) return

  // 获取容器尺寸，用于判断小屏/大屏
  const containerRect = cargoContainer.value.getBoundingClientRect()
  const containerWidth = containerRect.width
  // 小于 1200px 为小屏，大于等于 1200px 为大屏
  const isSmallScreen = containerWidth < 1200

  const textCards = cargoContainer.value.querySelectorAll('.text-card')

  textCards.forEach((card) => {
    const htmlCard = card as HTMLElement

    // 基础文本框尺寸
    const baseWidth = 208  // 基础宽度（从192增大到208，约8%）
    const baseHeight = 140 // 基础高度（从130增大到140，约8%）
    const baseFontSize = 10 // 基础字体大小 - 改小一点
    const baseHeaderFontSize = 12 // 基础标题字体大小 - 改小一点

    // 计算缩放后的尺寸
    const scaledWidth = baseWidth * scaleRatio.value
    const scaledHeight = baseHeight * scaleRatio.value
    const scaledFontSize = baseFontSize * scaleRatio.value
    const scaledHeaderFontSize = baseHeaderFontSize * scaleRatio.value

    // 应用动态样式
    htmlCard.style.width = `${scaledWidth}px`
    htmlCard.style.height = `${scaledHeight}px`

    // 调整字体大小
    const cardContent = htmlCard.querySelector('.card-content') as HTMLElement
    const cardHeader = htmlCard.querySelector('.card-header h3') as HTMLElement
    const cardHeaderElement = htmlCard.querySelector('.card-header') as HTMLElement

    if (cardContent) {
      const finalFontSize = Math.max(scaledFontSize, 6)
      cardContent.style.fontSize = `${finalFontSize}px`

      // 根据屏幕尺寸设置行高
      if (isSmallScreen) {
        // 小屏：动态计算行高
        let lineHeightRatio = 1.4 // 基础行高比例
        if (scaleRatio.value > 1.5) {
          // 屏幕放大时，减小行高比例
          lineHeightRatio = 1.2 - (scaleRatio.value - 1.5) * 0.1
          lineHeightRatio = Math.max(lineHeightRatio, 1.1) // 最小行高比例
        }
        const calculatedLineHeight = finalFontSize * lineHeightRatio
        cardContent.style.lineHeight = `${Math.max(calculatedLineHeight, 8)}px`
      } else {
        // 大屏：固定行高为 1.6
        cardContent.style.lineHeight = '1.6'
      }
    }

    if (cardHeader) {
      const finalHeaderFontSize = Math.max(scaledHeaderFontSize, 8)
      cardHeader.style.fontSize = `${finalHeaderFontSize}px`

      // 标题行高也采用动态计算
      let headerLineHeightRatio = 1.3 // 基础标题行高比例
      if (scaleRatio.value > 1.5) {
        headerLineHeightRatio = 1.1 - (scaleRatio.value - 1.5) * 0.05
        headerLineHeightRatio = Math.max(headerLineHeightRatio, 1.0) // 最小行高比例
      }

      const calculatedHeaderLineHeight = finalHeaderFontSize * headerLineHeightRatio
      cardHeader.style.lineHeight = `${Math.max(calculatedHeaderLineHeight, 10)}px`
    }

    // 动态调整 card-header 的 margin
    if (cardHeaderElement) {
      // 基于容器实际宽度判断
      // 小于 1200px 为小屏，大于等于 1200px 为大屏
      if (isSmallScreen) {
        // 小屏显示时的 margin
        cardHeaderElement.style.setProperty('margin', '0.1rem 0 0 0.6rem', 'important')
      } else {
        // 大屏显示时的 margin
        cardHeaderElement.style.setProperty('margin', '0.7rem 0 0.5rem 1.3rem', 'important')
      }
    }

    // 动态调整段落间距
    const paragraphs = htmlCard.querySelectorAll('.card-content p')
    paragraphs.forEach(p => {
      const htmlP = p as HTMLElement
      let marginBottom = 2 // 基础段落间距(px)

      if (scaleRatio.value > 1.5) {
        // 屏幕放大时，适当增加段落间距，但不要过大
        marginBottom = 2 + (scaleRatio.value - 1.5) * 1
        marginBottom = Math.min(marginBottom, 4) // 最大段落间距4px
      }

      htmlP.style.marginBottom = `${marginBottom}px`
    })
  })
}


// 数据卡片类型定义
interface DataCard {
  title: string;
  content: string[];
  rawData?: VehicleData[]; // 保存车辆原始数据（仅车辆安全监控卡片使用）
}

// 数据卡片配置 - 初始化为默认数据，先显示卡片和标题，后续通过API更新内容
const dataCards = ref<DataCard[]>([
  {
    title: '当月CDD预警',
    content: []
  },
  {
    title: '车辆安全监控',
    content: [],
    rawData: []
  },
  //ISG预警卡片
  {
    title: 'ISG电子标签预警',
    content: []
  },
  {
    title: '异常预警大于7天未解决',
    content: []
  }
])

// 计算有效卡片数量
const validCardsCount = computed(() => {
  return dataCards.value.filter(card => card.title && card.content.length > 0).length
})

// 重置所有卡片位置到CSS类定义的位置
const resetAllCardPositions = () => {
  if (!cargoContainer.value) return
  
  // 获取所有卡片元素（通过位置类查找）
  const allCards = cargoContainer.value.querySelectorAll('.cargo-data-card')
  
  allCards.forEach((card) => {
    const cardElement = card as HTMLElement
    // 清除所有位置相关的内联样式，让CSS类生效
    cardElement.style.removeProperty('left')
    cardElement.style.removeProperty('right')
    cardElement.style.removeProperty('top')
    cardElement.style.removeProperty('bottom')
    cardElement.style.removeProperty('transform')
  })
}



// 根据卡片数量和索引获取正确的位置类名
// 现在显示4个卡片：位置2（左中）、位置3（左上）、位置4（右上）、位置5（右中）
const getCardPositionClass = (index: number) => {
  // 映射索引到位置：0->2, 1->3, 2->4, 3->5
  const positionMap = [2, 3, 4, 5]
  return `card-position-${positionMap[index] || index + 2}`
}

// 自动触发动画
const startAutoAnimation = () => {
  // 如果鼠标悬停或正在动画中，则跳过
  if (!isAnimating.value && !isHovered.value) {
    // 检查是否有足够的卡片进行动画（需要3个或更多卡片）
    const validCards = dataCards.value.filter(card => card.title && card.content.length > 0)
    if (validCards.length >= 3) {
    // 随机选择一个卡片索引触发动画（0-4）
    const randomIndex = Math.floor(Math.random() * 5)
    startArcAnimation(randomIndex)
    }
  }
}

// 启动自动动画定时器
const startAutoAnimationTimer = () => {
  // 清除之前的定时器
  if (autoAnimationTimer) {
    clearInterval(autoAnimationTimer)
  }
  
  // 设置新的定时器，每10秒触发一次
  autoAnimationTimer = setInterval(() => {
    startAutoAnimation()
  }, 10000)
}

// 停止自动动画定时器
const stopAutoAnimationTimer = () => {
  if (autoAnimationTimer) {
    clearInterval(autoAnimationTimer)
    autoAnimationTimer = null
  }
}

// 处理鼠标进入事件
const handleMouseEnter = () => {
  isHovered.value = true
}

// 处理鼠标离开事件
const handleMouseLeave = () => {
  isHovered.value = false
}

// 处理卡片展开（放大按钮）
const handleCardExpand = (index: number) => {
  if (index >= 0 && index < dataCards.value.length) {
    selectedCardIndex.value = index
    selectedCardData.value = { ...dataCards.value[index] }
    cardDetailModalVisible.value = true
  }
}

// 关闭卡片详情弹窗
const handleCardDetailModalClose = () => {
  cardDetailModalVisible.value = false
  selectedCardIndex.value = -1
  selectedCardData.value = null
}

// 监听控制 Store 的操作队列（支持智能体指令打开/关闭卡片详情）
watch(
  () => controlStore.pendingActions,
  (actions) => {
    actions.forEach(action => {
      if (action.module !== 'cargoBanner') return
      switch (action.action) {
        case 'openCardDetail': {
          const idx = action.params?.cardIndex
          if (typeof idx === 'number' && idx >= 0 && idx < dataCards.value.length) {
            const card = dataCards.value[idx]
            // 无数据的卡片不打开弹窗
            const hasData = Array.isArray(card?.content) && card.content.length > 0
            if (hasData) {
              handleCardExpand(idx)
            }
          }
          break
        }
        case 'closeCardDetail':
          handleCardDetailModalClose()
          break
      }
      controlStore.consumeAction(action.id)
    })
  },
  { deep: true }
)

// 关闭CDD搜索下拉框
const closeCddSearchDropdowns = () => {
  isCddFromWarehouseOpen.value = false;
  isCddToProvinceOpen.value = false;
  isCddToRdcOpen.value = false;
  cddWarehouseSearch.value = '';
  cddProvinceSearch.value = '';
  cddRdcSearch.value = '';
};

// 处理弹窗内容区域点击
const handleCddModalBodyClick = (event: Event) => {
  const target = event.target as HTMLElement;
  
  // 检查是否点击在下拉框内部
  const isClickInsideDropdown = target.closest('.dropdown-item') || 
                               target.closest('.dropdown-content') ||
                               target.closest('.search-input') ||
                               target.closest('.dropdown-option');
  
  if (!isClickInsideDropdown) {
    // 关闭所有下拉框
    closeCddSearchDropdowns();
  }
};

// 处理卡片点击事件
const handleCardClick = (clickedIndex: number) => {
  // 获取点击的卡片信息
  const clickedCard = dataCards.value[clickedIndex]
  if (!clickedCard) return
  
  // 根据卡片标题决定是否显示弹窗
  const cardTitle = clickedCard.title
  
  // "异常预警大于7天未解决"、"ISG电子标签预警"和"当月CDD预警"显示弹窗
  if (cardTitle === '异常预警大于7天未解决') {
    modalTitle.value = '异常预警订单详情'
    modalVisible.value = true
    currentPage.value = 1
    total.value = 0
    fetchModalData()
    
    // 计算表格滚动高度
  } else if (cardTitle === '当月CDD预警') {
    modalTitle.value = 'CDD预警详情'
    modalVisible.value = true
    currentPage.value = 1
    total.value = 0
    
    // 同步全局筛选条件到CDD搜索参数
    syncGlobalFiltersToCddParams();
    
    // 初始化默认日期范围（上一周）
    const [startDate, endDate] = getInitialDateRange()
    cddSearchParams.value.dateRange = [startDate, endDate]
    cddSearchParams.value.startDate = startDate.format('YYYY-MM-DD HH:mm:ss')
    cddSearchParams.value.endDate = endDate.format('YYYY-MM-DD HH:mm:ss')
    // 加载下拉框选项
    loadCddDropdownOptions()
    fetchCddData(1)
    nextTick(() => {
      calculateModalTableScrollY()
    })
  } else if (cardTitle === 'ISG电子标签预警') {
    modalTitle.value = 'ISG电子标签预警详情'
    modalVisible.value = true
    currentPage.value = 1
    total.value = 0
    
    // 计算表格滚动高度
    nextTick(() => {
      calculateModalTableScrollY()
    })
    isgActiveTab.value = 'delay'
    isgSearchParams.value = buildIsgDefaultSearchParams()
    // 获取ISG电子标签预警详情数据
    fetchISGData()
  }
  // "车辆安全监控"不显示弹窗，直接返回
}

const selectedVehicleIndex = ref<number | null>(null)
const selectedVehicleCardIndex = ref<number | null>(null)
const vehicleDetailPosition = ref<{ x: number; y: number } | null>(null)

const closeVehicleDetail = () => {
  selectedVehicleIndex.value = null
  selectedVehicleCardIndex.value = null
  vehicleDetailPosition.value = null
  
  // 如果鼠标不在卡片上，恢复轮播
  if (!isHovered.value) {
    startAutoAnimationTimer()
  }
}

const handleVehicleItemClick = (event: MouseEvent, cardIndex: number, itemIndex: number) => {
  event.stopPropagation()
  
  const card = dataCards.value[cardIndex]
  if (!card || card.title !== '车辆安全监控' || !card.rawData || itemIndex >= card.rawData.length) {
    return
  }
  
  if (selectedVehicleCardIndex.value === cardIndex && selectedVehicleIndex.value === itemIndex) {
    closeVehicleDetail()
    return
  }
  
  // 显示详情框时，停止轮播
  stopAutoAnimationTimer()
  
  selectedVehicleCardIndex.value = cardIndex
  selectedVehicleIndex.value = itemIndex
  
  nextTick(() => {
    const contentWrapper = cargoContainer.value?.querySelector('.content-wrapper') as HTMLElement
    if (!contentWrapper) return
    
    const clickedElement = event.target as HTMLElement
    const cardElement = clickedElement.closest('.cargo-data-card') as HTMLElement
    if (!cardElement) return
    
    const wrapperRect = contentWrapper.getBoundingClientRect()
    const cardRect = cardElement.getBoundingClientRect()
    const itemRect = clickedElement.getBoundingClientRect()
    
    const x = cardRect.right - wrapperRect.left + 50
    const y = itemRect.top - wrapperRect.top + 10
    
    vehicleDetailPosition.value = { x, y }
  })
}

// 处理全局点击事件，点击详情框外部时关闭详情框
const handleGlobalClick = (event: MouseEvent) => {
  if (!selectedVehicleData.value || !vehicleDetailPosition.value) {
    return
  }
  
  const target = event.target as HTMLElement
  
  // 检查点击是否在详情框内
  const detailBox = target.closest('.vehicle-detail-box')
  // 检查点击是否在车辆项上
  const vehicleItem = target.closest('.vehicle-item')
  
  // 如果点击的不是详情框和车辆项，则关闭详情框
  if (!detailBox && !vehicleItem) {
    closeVehicleDetail()
  }
}

const selectedVehicleData = computed(() => {
  if (selectedVehicleCardIndex.value === null || selectedVehicleIndex.value === null) {
    return null
  }
  
  const card = dataCards.value[selectedVehicleCardIndex.value]
  if (!card || !card.rawData || selectedVehicleIndex.value >= card.rawData.length) {
    return null
  }
  
  return card.rawData[selectedVehicleIndex.value]
})

// 获取弹窗详细数据
const fetchModalData = async (currentPageNum: number = currentPage.value) => {
  try {
    modalLoading.value = true
    
    // 优先使用header组件的数据，如果没有则使用全局筛选条件
    const filterParams = {
      fromWarehouse: headerWarehouseData.value.length > 0 ? headerWarehouseData.value : (props.fromWarehouse || []),
      toProvince: headerProvinceData.value.length > 0 ? headerProvinceData.value : (props.toProvince || []),
      toRdc: headerRdcData.value.length > 0 ? headerRdcData.value : (props.toRdc || [])
    }
    
    // 调用异常预警订单分页查询API
    const result = await queryRiskOrderByPage({
      page: currentPageNum,
      pageSize: pageSize.value,
      sortName: "",
      sortBy: "",
      fromWarehouse: filterParams.fromWarehouse,
      toProvince: filterParams.toProvince,
      toRdc: filterParams.toRdc
    })

    // 添加保护判断：检查 data 不为 null
    if (result && result.code === 200 && result.data !== null && result.data !== undefined) {
      // 使用API返回的total字段
      total.value = result.total || 0
      
      // 根据API返回的数据结构设置modalData
      if (Array.isArray(result.data)) {
        modalData.value = result.data
      } else if (result.data.list && Array.isArray(result.data.list)) {
        modalData.value = result.data.list
      } else if (result.data.records && Array.isArray(result.data.records)) {
        modalData.value = result.data.records
      } else {
        modalData.value = []
      }
    } else {
      modalData.value = []
      total.value = 0
    }
    
  } catch (error: any) {
    // 超时错误静默处理，其他错误记录日志
    if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
      console.log('请求超时，可能是网络较慢或服务器响应慢')
    } else {
      console.error('获取弹窗数据失败:', error)
    }
    modalData.value = []
    total.value = 0
  } finally {
    modalLoading.value = false
  }
}

// 获取CDD预警详情数据
const fetchCddData = async (currentPageNum: number = currentPage.value) => {
  try {
    modalLoading.value = true
    
    const filterParams = {
      page: currentPageNum,
      pageSize: pageSize.value,
      startDate: cddSearchParams.value.startDate || '',
      endDate: cddSearchParams.value.endDate || '',
      dataSource: cddSearchParams.value.dataSource || [],
      customer: cddSearchParams.value.customer || [],
      fromWarehouse: cddSearchParams.value.fromWarehouse,
      toProvince: cddSearchParams.value.toProvince,
      toRdc: cddSearchParams.value.toRdc,
      nonComplianceType: cddSearchParams.value.nonComplianceType || [],
      modeType: cddSearchParams.value.modeType || []
    }
    
    const result = await queryCddAlertDetails(filterParams)
    if (result && result.code === 200 && Array.isArray(result.data)) {
      total.value = result.data.length
      modalData.value = result.data
    } else {
      modalData.value = []
      total.value = 0
    }
  } catch (error: any) {
    if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
      console.log('请求超时，可能是网络较慢或服务器响应慢')
    } else {
      console.error('获取CDD数据失败:', error)
    }
    modalData.value = []
    total.value = 0
  } finally {
    modalLoading.value = false
  }
}

// 获取ISG电子标签预警详情数据
const fetchISGData = async (currentPageNum: number = currentPage.value) => {
  try {
    modalLoading.value = true
    
    const filterParams = {
      page: currentPageNum,
      pageSize: pageSize.value,
      startDate: isgSearchParams.value.startDate || '',
      endDate: isgSearchParams.value.endDate || ''
    }
    const invoiceNo = (isgSearchParams.value.invoiceNo || '').trim()
    if (invoiceNo) {
      (filterParams as any).invoiceNo = invoiceNo
    }
    
    let result
    // 根据当前激活的tab调用不同的接口
    if (isgActiveTab.value === 'delay') {
      result = await queryIsgDelayRisk(filterParams)
    } else if (isgActiveTab.value === 'inTransit') {
      result = await queryIsgInTransitAbnormal(filterParams)
    } else if (isgActiveTab.value === 'delivery') {
      result = await queryIsgDeliveryAbnormal(filterParams)
    }

    // 添加保护判断：检查 data 不为 null
    if (result && result.code === 200 && result.data !== null && result.data !== undefined) {
      // 设置总数和表格数据
      total.value = result.total || result.data?.total || 0
      
      // 更新tab的计数（如果有的话）
      if (result.data?.count !== undefined) {
        isgTabCounts.value[isgActiveTab.value] = result.data.count
      }
      
      // 根据API返回的数据结构设置modalData
      if (Array.isArray(result.data)) {
        modalData.value = result.data
      } else if (result.data?.list && Array.isArray(result.data.list)) {
        modalData.value = result.data.list
      } else if (result.data?.records && Array.isArray(result.data.records)) {
        modalData.value = result.data.records
      } else if (result.data?.data && Array.isArray(result.data.data)) {
        modalData.value = result.data.data
      } else {
        modalData.value = []
      }
    } else {
      modalData.value = []
      total.value = 0
    }
    
  } catch (error: any) {
    // 超时错误静默处理，其他错误记录日志
    if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
      console.log('请求超时，可能是网络较慢或服务器响应慢')
    } else {
      console.error('获取ISG数据失败:', error)
    }
    modalData.value = []
    total.value = 0
  } finally {
    modalLoading.value = false
  }
}

// ISG tab切换
const handleIsgTabChange = (tab: 'delay' | 'inTransit' | 'delivery') => {
  isgActiveTab.value = tab
  currentPage.value = 1
  fetchISGData(1)
}

// 处理CDD搜索
const handleCddSearch = () => {
  currentPage.value = 1
  fetchCddData(1)
}



// CDD 重置
const handleCddReset = () => {
  // 重置为全局筛选条件（类似signingInformation组件的处理方式）
  cddSearchParams.value = {
    dateRange: null,
    startDate: '',
    endDate: '',
    dataSource: [],
    customer: [],
    fromWarehouse: props.fromWarehouse || [],
    toProvince: props.toProvince || [],
    toRdc: props.toRdc || [],
    nonComplianceType: [],
    modeType: []
  }
  currentPage.value = 1
  fetchCddData(1)
}

// 加载CDD预警下拉框选项
const loadCddDropdownOptions = () => {
  // 数据源使用固定数据
  cddDataSourceOptions.value = [
    { code: 'TMS', name: 'TMS' },
    { code: 'SEC', name: 'SEC' }
  ]
  
  // 客户使用固定数据
  cddCustomerOptions.value = [
    { code: '分销外包', name: '分销外包' },
    { code: '华致酒行', name: '华致酒行' },
    { code: '联想成品业务', name: '联想成品业务' },
    { code: '来酷科技', name: '来酷科技' },
    { code: '有道', name: '有道' }
  ]
  
  // 运输模式使用固定数据
  cddModeTypeOptions.value = [
    { code: '直送', name: '直送' },
    { code: '区配', name: '区配' }
  ]
  
  // 不达标类型使用固定数据
  cddNonComplianceTypeOptions.value = [
    { code: 'ete', name: '端到端迟到' },
    { code: 'trunkline', name: '干线迟到' },
    { code: 'distribution', name: '配送迟到' }
  ]
}

// CDD下拉框开关方法
const toggleCddDataSourceDropdown = () => {
  if (isCddDataSourceOpen.value) {
    isCddDataSourceOpen.value = false
  } else {
    closeCddFilterDropdowns()
    isCddDataSourceOpen.value = true
  }
}

const toggleCddCustomerDropdown = () => {
  if (isCddCustomerOpen.value) {
    isCddCustomerOpen.value = false
  } else {
    closeCddFilterDropdowns()
    isCddCustomerOpen.value = true
  }
}

const toggleCddModeTypeDropdown = () => {
  if (isCddModeTypeOpen.value) {
    isCddModeTypeOpen.value = false
  } else {
    closeCddFilterDropdowns()
    isCddModeTypeOpen.value = true
  }
}

const toggleCddNonComplianceTypeDropdown = () => {
  if (isCddNonComplianceTypeOpen.value) {
    isCddNonComplianceTypeOpen.value = false
  } else {
    closeCddFilterDropdowns()
    isCddNonComplianceTypeOpen.value = true
  }
}

// 关闭CDD筛选下拉框
const closeCddFilterDropdowns = () => {
  isCddDataSourceOpen.value = false
  isCddCustomerOpen.value = false
  isCddModeTypeOpen.value = false
  isCddNonComplianceTypeOpen.value = false
}

// 选择CDD筛选条件
const selectCddDataSource = (option: { code: string; name: string }) => {
  const index = cddSearchParams.value.dataSource.indexOf(option.code)
  if (index > -1) {
    cddSearchParams.value.dataSource.splice(index, 1)
  } else {
    cddSearchParams.value.dataSource.push(option.code)
  }
}

const selectCddCustomer = (option: { code: string; name: string }) => {
  const index = cddSearchParams.value.customer.indexOf(option.code)
  if (index > -1) {
    cddSearchParams.value.customer.splice(index, 1)
  } else {
    cddSearchParams.value.customer.push(option.code)
  }
}

const selectCddModeType = (option: { code: string; name: string }) => {
  const index = cddSearchParams.value.modeType.indexOf(option.code)
  if (index > -1) {
    cddSearchParams.value.modeType.splice(index, 1)
  } else {
    cddSearchParams.value.modeType.push(option.code)
  }
}

const selectCddNonComplianceType = (option: { code: string; name: string }) => {
  const index = cddSearchParams.value.nonComplianceType.indexOf(option.code)
  if (index > -1) {
    cddSearchParams.value.nonComplianceType.splice(index, 1)
  } else {
    cddSearchParams.value.nonComplianceType.push(option.code)
  }
}

// 切换始发仓下拉框
const toggleCddFromWarehouse = () => {
  // 如果当前下拉框已经打开，则关闭它；否则关闭其他下拉框并打开当前下拉框
  if (isCddFromWarehouseOpen.value) {
    isCddFromWarehouseOpen.value = false;
    cddWarehouseSearch.value = '';
  } else {
    // 关闭其他下拉框
    isCddToProvinceOpen.value = false;
    isCddToRdcOpen.value = false;
    cddProvinceSearch.value = '';
    cddRdcSearch.value = '';
    
    isCddFromWarehouseOpen.value = true;
    cddWarehouseSearch.value = '';
  }
}

// 切换目的省份下拉框
const toggleCddToProvince = () => {
  // 如果当前下拉框已经打开，则关闭它；否则关闭其他下拉框并打开当前下拉框
  if (isCddToProvinceOpen.value) {
    isCddToProvinceOpen.value = false;
    cddProvinceSearch.value = '';
  } else {
    // 关闭其他下拉框
    isCddFromWarehouseOpen.value = false;
    isCddToRdcOpen.value = false;
    cddWarehouseSearch.value = '';
    cddRdcSearch.value = '';
    
    isCddToProvinceOpen.value = true;
    cddProvinceSearch.value = '';
  }
}

// 切换目的RDC下拉框
const toggleCddToRdc = () => {
  // 如果当前下拉框已经打开，则关闭它；否则关闭其他下拉框并打开当前下拉框
  if (isCddToRdcOpen.value) {
    isCddToRdcOpen.value = false;
    cddRdcSearch.value = '';
  } else {
    // 关闭其他下拉框
    isCddFromWarehouseOpen.value = false;
    isCddToProvinceOpen.value = false;
    cddWarehouseSearch.value = '';
    cddProvinceSearch.value = '';
    
    isCddToRdcOpen.value = true;
    cddRdcSearch.value = '';
  }
}

// 选择始发仓选项
const selectCddFromWarehouse = (option: string) => {
  if (option === '重置') {
    // 重置选择
    cddSearchParams.value.fromWarehouse = [];
    return;
  }
  
  const index = cddSearchParams.value.fromWarehouse.indexOf(option);
  if (index > -1) {
    // 如果已选中，则取消选中
    cddSearchParams.value.fromWarehouse.splice(index, 1);
  } else {
    // 如果未选中，则添加到选中列表
    cddSearchParams.value.fromWarehouse.push(option);
  }
  // 不自动关闭下拉框，保持多选状态
}

// 初始化默认日期范围（提前一周）
const getInitialDateRange = (): [any, any] => {
  const now = dayjs();
  const sevenDaysAgo = now.subtract(7, 'day');
  return [sevenDaysAgo.startOf('day'), now.endOf('day')];
};

// 处理CDD时间范围变化
const handleCddDateRangeChange = (dates: any[]) => {
  if (dates && dates.length === 2) {
    cddSearchParams.value.startDate = dayjs(dates[0]).format('YYYY-MM-DD HH:mm:ss')
    cddSearchParams.value.endDate = dayjs(dates[1]).format('YYYY-MM-DD HH:mm:ss')
  } else {
    cddSearchParams.value.startDate = ''
    cddSearchParams.value.endDate = ''
  }
}

// 选择目的省份选项
const selectCddToProvince = (option: string) => {
  if (option === '重置') {
    // 重置选择
    cddSearchParams.value.toProvince = [];
    return;
  }
  
  const index = cddSearchParams.value.toProvince.indexOf(option);
  if (index > -1) {
    // 如果已选中，则取消选中
    cddSearchParams.value.toProvince.splice(index, 1);
  } else {
    // 如果未选中，则添加到选中列表
    cddSearchParams.value.toProvince.push(option);
  }
  // 不自动关闭下拉框，保持多选状态
}

// 选择目的RDC选项
const selectCddToRdc = (option: string) => {
  if (option === '重置') {
    // 重置选择
    cddSearchParams.value.toRdc = [];
    return;
  }
  
  const index = cddSearchParams.value.toRdc.indexOf(option);
  if (index > -1) {
    // 如果已选中，则取消选中
    cddSearchParams.value.toRdc.splice(index, 1);
  } else {
    // 如果未选中，则添加到选中列表
    cddSearchParams.value.toRdc.push(option);
  }
  // 不自动关闭下拉框，保持多选状态
}

// 显示CDD筛选文本
const displayCddDataSource = computed(() => {
  if (cddSearchParams.value.dataSource.length === 0) {
    return '数据源'
  }
  const names = cddSearchParams.value.dataSource.map(code => {
    const option = cddDataSourceOptions.value.find(item => item.code === code)
    return option ? option.name : code
  })
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
})

const displayCddCustomer = computed(() => {
  if (cddSearchParams.value.customer.length === 0) {
    return '客户'
  }
  const names = cddSearchParams.value.customer.map(code => {
    const option = cddCustomerOptions.value.find(item => item.code === code)
    return option ? option.name : code
  })
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
})

const displayCddModeType = computed(() => {
  if (cddSearchParams.value.modeType.length === 0) {
    return '运输模式'
  }
  const names = cddSearchParams.value.modeType.map(code => {
    const option = cddModeTypeOptions.value.find(item => item.code === code)
    return option ? option.name : code
  })
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
})

const displayCddNonComplianceType = computed(() => {
  if (cddSearchParams.value.nonComplianceType.length === 0) {
    return '不达标类型'
  }
  const names = cddSearchParams.value.nonComplianceType.map(code => {
    const option = cddNonComplianceTypeOptions.value.find(item => item.code === code)
    return option ? option.name : code
  })
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
})

// ISG 搜索
const handleIsgSearch = () => {
  currentPage.value = 1
  fetchISGData(1)
}

// ISG 重置
const handleIsgReset = () => {
  isgSearchParams.value = buildIsgDefaultSearchParams()
  currentPage.value = 1
  fetchISGData(1)
}

// 获取时间选择器的弹出容器
const getPickerPopupContainer = (triggerNode: HTMLElement) => {
  return triggerNode.parentElement || document.body;
}

// 关闭弹窗
const handleModalClose = () => {
  modalVisible.value = false
  modalData.value = []
  currentPage.value = 1
  total.value = 0
  // 重置ISG相关状态
  isgActiveTab.value = 'delay'
  isgSearchParams.value = {
    dateRange: null,
    startDate: '',
    endDate: '',
    invoiceNo: ''
  }
  // 重置CDD相关状态
  cddSearchParams.value = {
    dateRange: null,
    startDate: '',
    endDate: '',
    dataSource: [],
    customer: [],
    fromWarehouse: [],
    toProvince: [],
    toRdc: [],
    nonComplianceType: [],
    modeType: []
  }
}

// 处理分页变化
const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current
  pageSize.value = pagination.pageSize
  
  // 根据当前弹窗类型调用不同的数据获取函数
  if (modalTitle.value === 'CDD预警详情') {
    fetchCddData(pagination.current)
  } else if (modalTitle.value === 'ISG电子标签预警详情') {
    fetchISGData(pagination.current)
  } else {
    fetchModalData(pagination.current)
  }
}

// 处理CDD导出
const handleCddExport = async () => {
  try {
    exportLoading.value = true
    
    const filterParams = {
      startDate: cddSearchParams.value.startDate || '',
      endDate: cddSearchParams.value.endDate || '',
      dataSource: cddSearchParams.value.dataSource || [],
      customer: cddSearchParams.value.customer || [],
      fromWarehouse: cddSearchParams.value.fromWarehouse || [],
      toProvince: cddSearchParams.value.toProvince || [],
      toRdc: cddSearchParams.value.toRdc || [],
      nonComplianceType: cddSearchParams.value.nonComplianceType || [],
      modeType: cddSearchParams.value.modeType || []
    }
    
    const result = await exportCddAlertDataByFilter(filterParams)
    
    if (result && result.code === 200 && result.data) {
      downloadFile(result.data)
    }
    
  } catch (error: any) {
    console.error('导出CDD失败:', error)
    const errCode = error?.code;
    if (errCode === 409 || errCode === 504 || errCode === 505) {
      message.error(error.msg || '导出数据量过大，请缩小范围');
    } else {
      message.error(error.msg || '导出失败');
    }
  } finally {
    exportLoading.value = false
  }
}

// 计算总页数
const totalPages = computed(() => {
  return Math.ceil(total.value / pageSize.value)
})

// 导出数据
const handleExport = async () => {
  try {
    exportLoading.value = true
    
    // 使用header组件的数据，如果没有则使用全局筛选条件
    const filterParams = {
      fromWarehouse: headerWarehouseData.value.length > 0 ? headerWarehouseData.value : (props.fromWarehouse || []),
      toProvince: headerProvinceData.value.length > 0 ? headerProvinceData.value : (props.toProvince || []),
      toRdc: headerRdcData.value.length > 0 ? headerRdcData.value : (props.toRdc || [])
    }

    const result = await exportRiskOrder({
      page: currentPage.value,
      pageSize: pageSize.value,
      sortName: "",
      sortBy: "",
      fromWarehouse: filterParams.fromWarehouse,
      toProvince: filterParams.toProvince,
      toRdc: filterParams.toRdc
    })
    
    // 如果导出成功，下载文件
    if (result && result.code === 200 && result.data) {
      downloadFile(result.data)
    }
    
  } catch (error: any) {
    console.error('导出失败:', error)
    
    // 检查是否是409或504状态码
    const errCode = error?.code;
    if (errCode === 409 || errCode === 504 || errCode === 505) {
      message.error(error.msg || '导出数据量过大，请缩小范围');
    } else {
      message.error(error.msg || '导出失败');
    }
  } finally {
    exportLoading.value = false
  }
}

// 下载文件函数
const downloadFile = (url: string) => {
  try {
    const link = document.createElement('a')
    link.href = url
    const downloadFilename = '导出文件.xlsx';
    
    link.download = downloadFilename
    
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    window.open(url, '_blank')
  }
}


// 表格列配置
const tableColumns = [
    {
      title: '数据源',
      dataIndex: 'dataSource',
      key: 'dataSource',
      width: 100,
      align: 'center' as const,
    },
  {
    title: '客户',
    dataIndex: 'customer',
    key: 'customer',
    width: 120,
    align: 'center' as const,
  },
  {
    title: '客户订单号',
    dataIndex: 'custOrderNo',
    key: 'custOrderNo',
    width: 150,
    align: 'center' as const,
  },
  {
    title: '发货单号',
    dataIndex: 'invoiceNo',
    key: 'invoiceNo',
    width: 200,
    align: 'center' as const,
  },
  {
    title: '始发仓',
    dataIndex: 'fromWarehouse',
    key: 'fromWarehouse',
    width: 120,
    align: 'center' as const,
  },
  {
    title: '目的RDC',
    dataIndex: 'toRdc',
    key: 'toRdc',
    width: 120,
    align: 'center' as const,
  },
  {
    title: '承运商',
    dataIndex: 'carrierName',
    key: 'carrierName',
    width: 100,
    align: 'center' as const,
  },
  {
    title: '配送商',
    dataIndex: 'deliveryName',
    key: 'deliveryName',
    width: 100,
    align: 'center' as const,
  },
  {
    title: '异常代码',
    dataIndex: 'abnormalCode',
    key: 'abnormalCode',
    width: 120,
    align: 'center' as const,
  },
  {
    title: '异常时间',
    dataIndex: 'abnormalTime',
    key: 'abnormalTime',
    width: 160,
    align: 'center' as const,
  },
  {
    title: '异常描述',
    dataIndex: 'abnormalDesc',
    key: 'abnormalDesc',
    width: 200,
    align: 'center' as const,
  },
  {
    title: '异常次数',
    dataIndex: 'abnormalCount',
    key: 'abnormalCount',
    width: 100,
    align: 'center' as const,
  },
  {
    title: '产品编号',
    dataIndex: 'productNo',
    key: 'productNo',
    width: 150,
    align: 'center' as const,
  },
  {
    title: '产品名称',
    dataIndex: 'productName',
    key: 'productName',
    width: 200,
    align: 'center' as const,
  },
  {
    title: '处理建议',
    dataIndex: 'actionAdvice',
    key: 'actionAdvice',
    width: 180,
    align: 'center' as const,
  },
];

// ISG表格列定义 - ISG客户迟到风险订单
const isgDelayTableColumns = [
  {
    title: '数据校验时间',
    dataIndex: 'dataCheckTime',
    key: 'dataCheckTime',
    width: 160,
  },
  {
    title: '发货单号',
    dataIndex: 'invoiceNo',
    key: 'invoiceNo',
    width: 120,
  },
  {
    title: '位置',
    dataIndex: 'location',
    key: 'location',
    width: 150,
  },
  {
    title: '预计到达时间',
    dataIndex: 'predictArriveTime',
    key: 'predictArriveTime',
    width: 160,
  },
  {
    title: '风险信息',
    dataIndex: 'riskInfo',
    key: 'riskInfo',
    width: 100,
  },
  {
    title: '原因',
    dataIndex: 'reason',
    key: 'reason',
    width: 180,
  },
  {
    title: '处理措施',
    dataIndex: 'measure',
    key: 'measure',
    width: 180,
  },
];

// ISG表格列定义 - ISG客户订单在途异常
const isgInTransitTableColumns = [
  {
    title: '数据校验时间',
    dataIndex: 'dataCheckTime',
    key: 'dataCheckTime',
    width: 160,
  },
  {
    title: '发货单号',
    dataIndex: 'invoiceNo',
    key: 'invoiceNo',
    width: 120,
  },
  {
    title: '电子标签SN',
    dataIndex: 'etagSn',
    key: 'etagSn',
    width: 150,
  },
  {
    title: '收货地址',
    dataIndex: 'consigneeAddress',
    key: 'consigneeAddress',
    width: 200,
  },
  {
    title: '异常类型',
    dataIndex: 'abnormalType',
    key: 'abnormalType',
    width: 120,
  },
  {
    title: '异常时间',
    dataIndex: 'abnormalTime',
    key: 'abnormalTime',
    width: 160,
  },
  {
    title: '原因',
    dataIndex: 'reason',
    key: 'reason',
    width: 180,
  },
  {
    title: '处理措施',
    dataIndex: 'measure',
    key: 'measure',
    width: 180,
  },
];

// 按需达客户交付异常订单：abnormalInfo（string）枚举展示
const ISG_DELIVERY_ABNORMAL_INFO_MAP: Record<string, string> = {
  '1': '按需达时间、签收时间不在同一天',
  '2': '电子标签与货物未解绑，但是订单签收',
  '3': '货物到达客户处又离开且电子标签未解绑',
};

const formatIsgDeliveryAbnormalInfo = (text: unknown): string => {
  if (text === null || text === undefined || text === '') return '-';
  const key = String(text).trim();
  return ISG_DELIVERY_ABNORMAL_INFO_MAP[key] ?? key;
};

// ISG表格列定义 - 按需达客户交付异常订单（不含异常原因、处理措施；运输模式取 transType）
const isgDeliveryTableColumns = [
  {
    title: '数据校验时间',
    dataIndex: 'dataCheckTime',
    key: 'dataCheckTime',
    width: 160,
  },
  {
    title: '联想订单号',
    dataIndex: 'lenovoOrderNo',
    key: 'lenovoOrderNo',
    width: 100,
  },
  {
    title: '发货单号',
    dataIndex: 'invoiceNo',
    key: 'invoiceNo',
    width: 160,
  },
  {
    title: '物流商',
    dataIndex: 'logisticName',
    key: 'logisticName',
    width: 100,
  },
  {
    title: '运输模式',
    dataIndex: 'transType',
    key: 'transType',
    width: 120,
  },
  {
    title: '按需达时间',
    dataIndex: 'onDemandTime',
    key: 'onDemandTime',
    width: 160,
  },
  {
    title: '始发仓',
    dataIndex: 'fromWarehouse',
    key: 'fromWarehouse',
    width: 100,
  },
  {
    title: '目的省',
    dataIndex: 'toProvince',
    key: 'toProvince',
    width: 100,
  },
  {
    title: '目的市',
    dataIndex: 'toCity',
    key: 'toCity',
    width: 100,
  },
  {
    title: '收货地址',
    dataIndex: 'consigneeAddress',
    key: 'consigneeAddress',
    width: 400,
  },
  {
    title: '异常情况',
    dataIndex: 'abnormalInfo',
    key: 'abnormalInfo',
    width: 360,
  },
];

// CDD预警表格列定义
const cddAlertTableColumns = [
  {
    title: '数据源',
    dataIndex: 'dataSource',
    key: 'dataSource',
    width: 100,
  },
  {
    title: '客户',
    dataIndex: 'customer',
    key: 'customer',
    width: 120,
  },
  {
    title: '客户订单号',
    dataIndex: 'custOrderNo',
    key: 'custOrderNo',
    width: 150,
  },
  {
    title: '始发仓',
    dataIndex: 'fromWarehouse',
    key: 'fromWarehouse',
    width: 120,
  },
  {
    title: '目的RDC',
    dataIndex: 'toRdc',
    key: 'toRdc',
    width: 120,
  },
  {
    title: '目的省',
    dataIndex: 'toProvince',
    key: 'toProvince',
    width: 100,
  },
  {
    title: '目的市',
    dataIndex: 'toCity',
    key: 'toCity',
    width: 100,
  },
  {
    title: '运输单号',
    dataIndex: 'transNo',
    key: 'transNo',
    width: 150,
  },
  {
    title: '发货单号',
    dataIndex: 'invoiceNo',
    key: 'invoiceNo',
    width: 150,
  },
  {
    title: '承运商',
    dataIndex: 'carrierName',
    key: 'carrierName',
    width: 120,
  },
  {
    title: '配送商',
    dataIndex: 'deliveryName',
    key: 'deliveryName',
    width: 120,
  },
  {
    title: '运输模式',
    dataIndex: 'modeType',
    key: 'modeType',
    width: 100,
  },
  {
    title: '端到端准时',
    dataIndex: 'eteOnTime',
    key: 'eteOnTime',
    width: 100,
  },
  {
    title: '干线准时',
    dataIndex: 'mainLineOnTime',
    key: 'mainLineOnTime',
    width: 120,
  },
  {
    title: '配送准时',
    dataIndex: 'deliveryOnTime',
    key: 'deliveryOnTime',
    width: 120,
  },
  {
    title: '最后异常代码',
    dataIndex: 'lastAbnormalCode',
    key: 'lastAbnormalCode',
    width: 150,
  },
  {
    title: '发运确认时间',
    dataIndex: 'shipConfirmTime',
    key: 'shipConfirmTime',
    width: 160,
  },
  {
    title: '签收时间',
    dataIndex: 'signTime',
    key: 'signTime',
    width: 160,
  },
  {
    title: '分类',
    dataIndex: 'category',
    key: 'category',
    width: 100,
  },
  {
    title: '原因',
    dataIndex: 'reason',
    key: 'reason',
    width: 200,
  },
  {
    title: '处理措施',
    dataIndex: 'measure',
    key: 'measure',
    width: 200,
  },
];

// 根据弹窗类型和当前tab返回不同的表格列
const currentTableColumns = computed(() => {
  if (modalTitle.value === 'CDD预警详情') {
    return cddAlertTableColumns
  }
  if (modalTitle.value === 'ISG电子标签预警详情') {
    if (isgActiveTab.value === 'delay') {
      return isgDelayTableColumns
    } else if (isgActiveTab.value === 'inTransit') {
      return isgInTransitTableColumns
    } else if (isgActiveTab.value === 'delivery') {
      return isgDeliveryTableColumns
    }
    return isgDelayTableColumns
  }
  return tableColumns
})

// 3个卡片的动画（位置1、3、4）
const animateThreeCards = (card1Element: HTMLElement, card3Element: HTMLElement, card4Element: HTMLElement, containerRect: DOMRect, duration: number) => {
  const startTime = performance.now()

  // 获取卡片位置
  const card1Rect = card1Element.getBoundingClientRect()
  const card3Rect = card3Element.getBoundingClientRect()
  const card4Rect = card4Element.getBoundingClientRect()

  const card1X = ((card1Rect.left - containerRect.left) / containerRect.width) * 100
  const card1Y = ((containerRect.bottom - card1Rect.bottom) / containerRect.height) * 100
  const card3X = ((card3Rect.left - containerRect.left) / containerRect.width) * 100
  const card3Y = ((containerRect.bottom - card3Rect.bottom) / containerRect.height) * 100
  const card4X = ((card4Rect.left - containerRect.left) / containerRect.width) * 100
  const card4Y = ((containerRect.bottom - card4Rect.bottom) / containerRect.height) * 100

  // 3个卡片的循环：1->3->4->1
  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const t = progress

    // 卡片1移动到卡片3的位置（最下到左上）
    const controlX1 = (card1X + card3X) / 2 - 15
    const controlY1 = Math.min(card1Y, card3Y) - 20
    const x1 = Math.pow(1 - t, 2) * card1X + 2 * (1 - t) * t * controlX1 + Math.pow(t, 2) * card3X
    const y1 = Math.pow(1 - t, 2) * card1Y + 2 * (1 - t) * t * controlY1 + Math.pow(t, 2) * card3Y

    // 卡片3移动到卡片4的位置（左上到右上）
    const controlX3 = (card3X + card4X) / 2 + 8
    const controlY3 = Math.max(card3Y, card4Y) + 12
    const x3 = Math.pow(1 - t, 2) * card3X + 2 * (1 - t) * t * controlX3 + Math.pow(t, 2) * card4X
    const y3 = Math.pow(1 - t, 2) * card3Y + 2 * (1 - t) * t * controlY3 + Math.pow(t, 2) * card4Y

    // 卡片4移动到卡片1的位置（右上到最下）
    const controlX4 = card4X + 15
    const controlY4 = card4Y - 25
    const x4 = Math.pow(1 - t, 2) * card4X + 2 * (1 - t) * t * controlX4 + Math.pow(t, 2) * card1X
    const y4 = Math.pow(1 - t, 2) * card4Y + 2 * (1 - t) * t * controlY4 + Math.pow(t, 2) * card1Y

    // 应用位置
    card1Element.style.right = 'auto'
    card1Element.style.top = 'auto'
    card1Element.style.left = `${x1}%`
    card1Element.style.bottom = `${y1}%`

    card3Element.style.right = 'auto'
    card3Element.style.top = 'auto'
    card3Element.style.left = `${x3}%`
    card3Element.style.bottom = `${y3}%`

    card4Element.style.right = 'auto'
    card4Element.style.top = 'auto'
    card4Element.style.left = `${x4}%`
    card4Element.style.bottom = `${y4}%`

    if (progress < 1) {
      requestAnimationFrame(animate)
    } else {
      // 确保最后一帧动画完成
      requestAnimationFrame(() => {
        // 动画完成，轮转数据
        // 3个卡片时的数据轮转：位置1->3, 位置3->4, 位置4->1
        // dataCards 实际索引：[0, 1, 2] 对应位置 [1, 3, 4]
        const originalData = [...dataCards.value]
        
        // 找到有效的卡片（过滤掉空卡片）
        const validCards = originalData.filter(card => card.title && card.content.length > 0)
        
        if (validCards.length === 3) {
          // 3个卡片的循环：索引0(位置1)->索引1(位置3)->索引2(位置4)->索引0(位置1)
          dataCards.value = [validCards[2]!, validCards[0]!, validCards[1]!]
        }
        
        // 重置位置到原始位置
        card1Element.style.right = 'auto'
        card1Element.style.top = 'auto'
        card1Element.style.left = '44%'
        card1Element.style.bottom = '3%'
        
        card3Element.style.right = 'auto'
        card3Element.style.bottom = 'auto'
        card3Element.style.left = '15%'
        card3Element.style.top = '30%'
        
        card4Element.style.left = 'auto'
        card4Element.style.bottom = 'auto'
        card4Element.style.right = '12%'
        card4Element.style.top = '30%'

        // 视频现在自动循环播放，不再需要手动控制

        isAnimating.value = false
      })
    }
  }

  requestAnimationFrame(animate)
}

// 4个卡片的动画（位置1、2、3、4）
const animateFourCards = (card1Element: HTMLElement, card2Element: HTMLElement, card3Element: HTMLElement, card4Element: HTMLElement, containerRect: DOMRect, duration: number) => {
  const startTime = performance.now()

  // 获取卡片位置
      const card1Rect = card1Element.getBoundingClientRect()
      const card2Rect = card2Element.getBoundingClientRect()
      const card3Rect = card3Element.getBoundingClientRect()
      const card4Rect = card4Element.getBoundingClientRect()

  const card1X = ((card1Rect.left - containerRect.left) / containerRect.width) * 100
  const card1Y = ((containerRect.bottom - card1Rect.bottom) / containerRect.height) * 100
  const card2X = ((card2Rect.left - containerRect.left) / containerRect.width) * 100
  const card2Y = ((containerRect.bottom - card2Rect.bottom) / containerRect.height) * 100
  const card3X = ((card3Rect.left - containerRect.left) / containerRect.width) * 100
  const card3Y = ((containerRect.bottom - card3Rect.bottom) / containerRect.height) * 100
  const card4X = ((card4Rect.left - containerRect.left) / containerRect.width) * 100
  const card4Y = ((containerRect.bottom - card4Rect.bottom) / containerRect.height) * 100

  // 4个卡片的循环：1->2->3->4->1
  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const t = progress

    // 卡片1到卡片2（最下到左下）
    const controlX1 = (card1X + card2X) / 2 - 10
    const controlY1 = Math.min(card1Y, card2Y) - 8
    const x1 = Math.pow(1 - t, 2) * card1X + 2 * (1 - t) * t * controlX1 + Math.pow(t, 2) * card2X
    const y1 = Math.pow(1 - t, 2) * card1Y + 2 * (1 - t) * t * controlY1 + Math.pow(t, 2) * card2Y

    // 卡片2到卡片3（左下到左上）
    const controlX2 = (card2X + card3X) / 2 - 15
    const controlY2 = Math.min(card2Y, card3Y) - 12
    const x2 = Math.pow(1 - t, 2) * card2X + 2 * (1 - t) * t * controlX2 + Math.pow(t, 2) * card3X
    const y2 = Math.pow(1 - t, 2) * card2Y + 2 * (1 - t) * t * controlY2 + Math.pow(t, 2) * card3Y

    // 卡片3到卡片4（左上到右上）
    const controlX3 = (card3X + card4X) / 2 + 8
    const controlY3 = Math.max(card3Y, card4Y) + 10
    const x3 = Math.pow(1 - t, 2) * card3X + 2 * (1 - t) * t * controlX3 + Math.pow(t, 2) * card4X
    const y3 = Math.pow(1 - t, 2) * card3Y + 2 * (1 - t) * t * controlY3 + Math.pow(t, 2) * card4Y

    // 卡片4到卡片1（右上到最下）
    const controlX4 = card4X + 12
    const controlY4 = card4Y - 20
    const x4 = Math.pow(1 - t, 2) * card4X + 2 * (1 - t) * t * controlX4 + Math.pow(t, 2) * card1X
    const y4 = Math.pow(1 - t, 2) * card4Y + 2 * (1 - t) * t * controlY4 + Math.pow(t, 2) * card1Y

    // 应用位置
    card1Element.style.right = 'auto'
    card1Element.style.top = 'auto'
    card1Element.style.left = `${x1}%`
    card1Element.style.bottom = `${y1}%`

    card2Element.style.right = 'auto'
    card2Element.style.top = 'auto'
    card2Element.style.left = `${x2}%`
    card2Element.style.bottom = `${y2}%`

    card3Element.style.right = 'auto'
    card3Element.style.top = 'auto'
    card3Element.style.left = `${x3}%`
    card3Element.style.bottom = `${y3}%`

    card4Element.style.right = 'auto'
    card4Element.style.top = 'auto'
    card4Element.style.left = `${x4}%`
    card4Element.style.bottom = `${y4}%`

    if (progress < 1) {
      requestAnimationFrame(animate)
    } else {
      // 确保最后一帧动画完成
      requestAnimationFrame(() => {
        // 动画完成，轮转数据
        const originalData = [...dataCards.value]
        dataCards.value[0] = originalData[3]! // 位置4的数据移到位置1
        dataCards.value[1] = originalData[0]! // 位置1的数据移到位置2
        dataCards.value[2] = originalData[1]! // 位置2的数据移到位置3
        dataCards.value[3] = originalData[2]! // 位置3的数据移到位置4
        
        // 重置位置到原始位置
        card1Element.style.right = 'auto'
        card1Element.style.top = 'auto'
        card1Element.style.left = '44%'
        card1Element.style.bottom = '3%'
        
        card2Element.style.right = 'auto'
        card2Element.style.bottom = 'auto'
        card2Element.style.left = '5%'
        card2Element.style.top = '62%'
        
        card3Element.style.right = 'auto'
        card3Element.style.bottom = 'auto'
        card3Element.style.left = '15%'
        card3Element.style.top = '30%'
        
        card4Element.style.left = 'auto'
        card4Element.style.bottom = 'auto'
        card4Element.style.right = '12%'
        card4Element.style.top = '30%'

        // 视频现在自动循环播放，不再需要手动控制

        isAnimating.value = false
      })
    }
  }

  requestAnimationFrame(animate)
}

// 5个卡片的动画（所有位置）
const animateFiveCards = (card1Element: HTMLElement, card2Element: HTMLElement, card3Element: HTMLElement, card4Element: HTMLElement, card5Element: HTMLElement, containerRect: DOMRect, duration: number) => {
      const startTime = performance.now()

  // 获取卡片位置
  const card1Rect = card1Element.getBoundingClientRect()
  const card2Rect = card2Element.getBoundingClientRect()
  const card3Rect = card3Element.getBoundingClientRect()
  const card4Rect = card4Element.getBoundingClientRect()
  const card5Rect = card5Element.getBoundingClientRect()

  const card1X = ((card1Rect.left - containerRect.left) / containerRect.width) * 100
  const card1Y = ((containerRect.bottom - card1Rect.bottom) / containerRect.height) * 100
  const card2X = ((card2Rect.left - containerRect.left) / containerRect.width) * 100
  const card2Y = ((containerRect.bottom - card2Rect.bottom) / containerRect.height) * 100
  const card3X = ((card3Rect.left - containerRect.left) / containerRect.width) * 100
  const card3Y = ((containerRect.bottom - card3Rect.bottom) / containerRect.height) * 100
  const card4X = ((card4Rect.left - containerRect.left) / containerRect.width) * 100
  const card4Y = ((containerRect.bottom - card4Rect.bottom) / containerRect.height) * 100
  const card5X = ((card5Rect.left - containerRect.left) / containerRect.width) * 100
  const card5Y = ((containerRect.bottom - card5Rect.bottom) / containerRect.height) * 100

  // 5个卡片的循环：1->2->3->4->5->1
  const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        const t = progress

    // 卡片1到卡片2（最下到左下）
    const controlX1 = (card1X + card2X) / 2 - 10
    const controlY1 = Math.min(card1Y, card2Y) - 8
    const x1 = Math.pow(1 - t, 2) * card1X + 2 * (1 - t) * t * controlX1 + Math.pow(t, 2) * card2X
    const y1 = Math.pow(1 - t, 2) * card1Y + 2 * (1 - t) * t * controlY1 + Math.pow(t, 2) * card2Y

    // 卡片2到卡片3（左下到左上）
    const controlX2 = (card2X + card3X) / 2 - 15
    const controlY2 = Math.min(card2Y, card3Y) - 12
    const x2 = Math.pow(1 - t, 2) * card2X + 2 * (1 - t) * t * controlX2 + Math.pow(t, 2) * card3X
    const y2 = Math.pow(1 - t, 2) * card2Y + 2 * (1 - t) * t * controlY2 + Math.pow(t, 2) * card3Y

    // 卡片3到卡片4（左上到右上）
    const controlX3 = (card3X + card4X) / 2 + 8
    const controlY3 = Math.max(card3Y, card4Y) + 10
    const x3 = Math.pow(1 - t, 2) * card3X + 2 * (1 - t) * t * controlX3 + Math.pow(t, 2) * card4X
    const y3 = Math.pow(1 - t, 2) * card3Y + 2 * (1 - t) * t * controlY3 + Math.pow(t, 2) * card4Y

    // 卡片4到卡片5（右上到右下）
    const controlX4 = (card4X + card5X) / 2 + 5
    const controlY4 = Math.max(card4Y, card5Y) + 8
    const x4 = Math.pow(1 - t, 2) * card4X + 2 * (1 - t) * t * controlX4 + Math.pow(t, 2) * card5X
    const y4 = Math.pow(1 - t, 2) * card4Y + 2 * (1 - t) * t * controlY4 + Math.pow(t, 2) * card5Y

    // 卡片5到卡片1（右下到最下）
    const controlX5 = card5X + 10
    const controlY5 = card5Y - 25
    const x5 = Math.pow(1 - t, 2) * card5X + 2 * (1 - t) * t * controlX5 + Math.pow(t, 2) * card1X
    const y5 = Math.pow(1 - t, 2) * card5Y + 2 * (1 - t) * t * controlY5 + Math.pow(t, 2) * card1Y

    // 应用位置
        card1Element.style.right = 'auto'
        card1Element.style.top = 'auto'
        card1Element.style.left = `${x1}%`
        card1Element.style.bottom = `${y1}%`

    card2Element.style.right = 'auto'
    card2Element.style.top = 'auto'
    card2Element.style.left = `${x2}%`
    card2Element.style.bottom = `${y2}%`

    card3Element.style.right = 'auto'
    card3Element.style.top = 'auto'
    card3Element.style.left = `${x3}%`
    card3Element.style.bottom = `${y3}%`

    card4Element.style.right = 'auto'
    card4Element.style.top = 'auto'
    card4Element.style.left = `${x4}%`
    card4Element.style.bottom = `${y4}%`

        card5Element.style.right = 'auto'
        card5Element.style.top = 'auto'
    card5Element.style.left = `${x5}%`
    card5Element.style.bottom = `${y5}%`

    if (progress < 1) {
      requestAnimationFrame(animate)
    } else {
      // 确保最后一帧动画完成
      requestAnimationFrame(() => {
        // 动画完成，轮转数据
        const originalData = [...dataCards.value]
        dataCards.value[0] = originalData[4]! // 位置5的数据移到位置1
        dataCards.value[1] = originalData[0]! // 位置1的数据移到位置2
        dataCards.value[2] = originalData[1]! // 位置2的数据移到位置3
        dataCards.value[3] = originalData[2]! // 位置3的数据移到位置4
        dataCards.value[4] = originalData[3]! // 位置4的数据移到位置5
        
        // 重置位置到原始位置
        card1Element.style.right = 'auto'
        card1Element.style.top = 'auto'
        card1Element.style.left = '44%'
        card1Element.style.bottom = '3%'
        
        card2Element.style.right = 'auto'
        card2Element.style.bottom = 'auto'
        card2Element.style.left = '5%'
        card2Element.style.top = '62%'
        
        card3Element.style.right = 'auto'
        card3Element.style.bottom = 'auto'
        card3Element.style.left = '15%'
        card3Element.style.top = '30%'
        
        card4Element.style.left = 'auto'
        card4Element.style.bottom = 'auto'
        card4Element.style.right = '12%'
        card4Element.style.top = '30%'
        
        card5Element.style.left = 'auto'
        card5Element.style.bottom = 'auto'
        card5Element.style.right = '3%'
        card5Element.style.top = '62%'

        // 视频现在自动循环播放，不再需要手动控制

        isAnimating.value = false
      })
    }
  }

  requestAnimationFrame(animate)
}

// 开始平滑弧形动画
const startArcAnimation = (clickedIndex: number) => {
  if (isAnimating.value) return

  // 检查是否有足够的卡片进行动画（需要3个或更多卡片）
  const validCards = dataCards.value.filter(card => card.title && card.content.length > 0)
  if (validCards.length < 3) {
    return
  }

  isAnimating.value = true

  // 等待DOM完全渲染
  nextTick(() => {
    // 获取所有卡片元素
    const card1Element = cargoContainer.value?.querySelector('.card-position-1') as HTMLElement
    const card2Element = cargoContainer.value?.querySelector('.card-position-2') as HTMLElement
    const card3Element = cargoContainer.value?.querySelector('.card-position-3') as HTMLElement
    const card4Element = cargoContainer.value?.querySelector('.card-position-4') as HTMLElement
    const card5Element = cargoContainer.value?.querySelector('.card-position-5') as HTMLElement

    if (!cargoContainer.value) {
      isAnimating.value = false
      return
    }
    
    // 根据有效卡片数量检查必需的元素
    if (validCards.length === 3) {
      if (!card1Element || !card3Element || !card4Element) {
        isAnimating.value = false
        return
      }
    } else if (validCards.length === 4) {
      if (!card1Element || !card2Element || !card3Element || !card4Element) {
        isAnimating.value = false
        return
      }
    } else if (validCards.length === 5) {
      if (!card1Element || !card2Element || !card3Element || !card4Element || !card5Element) {
        isAnimating.value = false
        return
      }
    }

    // 获取容器位置
    const containerRect = cargoContainer.value.getBoundingClientRect()

    // 检查元素是否有效
    if (containerRect.width === 0 || containerRect.height === 0) {
      setTimeout(() => {
        isAnimating.value = false
        startArcAnimation(clickedIndex)
      }, 100)
      return
    }

    // 根据卡片数量重置对应的卡片到原始位置
    if (validCards.length === 3) {
      // 3个卡片：只重置位置1、3、4
      card1Element.style.right = 'auto'
      card1Element.style.top = 'auto'
      card1Element.style.left = '44%'
      card1Element.style.bottom = '3%'

      card3Element.style.right = 'auto'
      card3Element.style.bottom = 'auto'
      card3Element.style.left = '12%'
      card3Element.style.top = '30%'

      card4Element.style.left = 'auto'
      card4Element.style.bottom = 'auto'
      card4Element.style.right = '12%'
      card4Element.style.top = '30%'
    } else if (validCards.length === 4) {
      // 4个卡片：重置位置1、2、3、4
      card1Element.style.right = 'auto'
      card1Element.style.top = 'auto'
      card1Element.style.left = '44%'
      card1Element.style.bottom = '3%'

      card2Element.style.right = 'auto'
      card2Element.style.bottom = 'auto'
      card2Element.style.left = '3%'
      card2Element.style.top = '62%'

      card3Element.style.right = 'auto'
      card3Element.style.bottom = 'auto'
      card3Element.style.left = '12%'
      card3Element.style.top = '30%'

      card4Element.style.left = 'auto'
      card4Element.style.bottom = 'auto'
      card4Element.style.right = '12%'
      card4Element.style.top = '30%'
    } else if (validCards.length === 5) {
      // 5个卡片：重置所有位置
      card1Element.style.right = 'auto'
      card1Element.style.top = 'auto'
      card1Element.style.left = '44%'
      card1Element.style.bottom = '3%'

      card2Element.style.right = 'auto'
      card2Element.style.bottom = 'auto'
      card2Element.style.left = '3%'
      card2Element.style.top = '62%'

      card3Element.style.right = 'auto'
      card3Element.style.bottom = 'auto'
      card3Element.style.left = '12%'
      card3Element.style.top = '30%'

      card4Element.style.left = 'auto'
      card4Element.style.bottom = 'auto'
      card4Element.style.right = '12%'
      card4Element.style.top = '30%'

      card5Element.style.left = 'auto'
      card5Element.style.bottom = 'auto'
      card5Element.style.right = '3%'
      card5Element.style.top = '62%'
    }

    // 根据卡片数量调用对应的动画方法
    const duration = 2000 // 2秒
    
    if (validCards.length === 3) {
      // 3个卡片：位置1、3、4
      animateThreeCards(card1Element, card3Element, card4Element, containerRect, duration)
    } else if (validCards.length === 4) {
      // 4个卡片：位置1、2、3、4
      animateFourCards(card1Element, card2Element, card3Element, card4Element, containerRect, duration)
    } else if (validCards.length === 5) {
      // 5个卡片：所有位置
      animateFiveCards(card1Element, card2Element, card3Element, card4Element, card5Element, containerRect, duration)
    }
  })
}

// ResizeObserver 监听容器尺寸变化
let resizeObserver: ResizeObserver | null = null

// 初始化ResizeObserver
const initResizeObserver = () => {
  if (!cargoContainer.value) return

  resizeObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) {
        // 防抖处理
        setTimeout(() => {
          calculateScaleRatio()
        }, 100)
      }
    }
  })

  resizeObserver.observe(cargoContainer.value)
}

// 初始化视频
const initVideo = () => {
  if (!videoRef.value) return
  
  const video = videoRef.value
  
  // 确保videoLoaded初始为false，卡片不显示
  videoLoaded.value = false
  
  // 配置视频属性：自动播放+循环播放
  video.muted = true
  video.loop = true
  video.autoplay = true
  video.playsInline = true
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
  // 正常播放速度
  video.playbackRate = 1.0
  
  // 从开始播放
  video.currentTime = 0
  
  // 监听视频加载完成事件（只触发一次）
  let hasTriggered = false
  const handleVideoLoaded = () => {
    if (hasTriggered) return
    hasTriggered = true
    
    // 视频加载完成后，立即设置状态并请求数据
    videoLoaded.value = true
    fetchRiskOrderStats()
  }
  
  // 使用canplaythrough事件，表示视频已经加载到可以流畅播放到结尾的程度
  video.addEventListener('canplaythrough', handleVideoLoaded, { once: true })
  
  // 如果视频已经可以播放（缓存情况），立即触发
  if (video.readyState >= 3) { // HAVE_FUTURE_DATA 或更高
    handleVideoLoaded()
  }
  
  // 自动播放视频，触发加载
  video.play().catch((error) => {
    console.warn('视频自动播放失败:', error)
  })
}

// 视频现在自动循环播放，不再需要手动控制
// playVideoForOneSecond 函数已废弃

// 启动智能体异常预警卡片定时刷新
const startCargoBannerRefresh = () => {
  // 清除之前的定时器
  if (cargoBannerRefreshTimer) {
    clearInterval(cargoBannerRefreshTimer)
    cargoBannerRefreshTimer = null
  }
  
  // 从store获取刷新间隔
  const interval = 30000
  
  // 设置定时器
  cargoBannerRefreshTimer = setInterval(() => {
    fetchRiskOrderStats()
  }, interval)
}

// 停止智能体异常预警卡片定时刷新
const stopCargoBannerRefresh = () => {
  if (cargoBannerRefreshTimer) {
    clearInterval(cargoBannerRefreshTimer)
    cargoBannerRefreshTimer = null
  }
}

// 只刷新ISG电子标签预警和车辆安全监控卡片数据
const refreshIsgAndVehicleCards = async () => {
  try {
    // 并行调用车辆安全监控和ISG电子标签预警接口
    const [vehicleData, isgContent] = await Promise.allSettled([
      fetchVehicleData(),
      fetchIsgData()
    ])
    
    // 处理返回的数据
    const finalVehicleData = vehicleData.status === 'fulfilled' ? vehicleData.value : { content: [], rawData: [] }
    const finalIsgContent = isgContent.status === 'fulfilled' ? isgContent.value : []
    
    // 更新对应的卡片数据
    if (dataCards.value && dataCards.value.length >= 4) {
      // 更新车辆安全监控卡片（索引1）
      if (dataCards.value[1]) {
        dataCards.value[1].content = Array.isArray(finalVehicleData.content) ? finalVehicleData.content : []
        dataCards.value[1].rawData = Array.isArray(finalVehicleData.rawData) ? finalVehicleData.rawData : []
      }
      
      // 更新ISG电子标签预警卡片（索引2）
      if (dataCards.value[2]) {
        dataCards.value[2].content = Array.isArray(finalIsgContent) ? finalIsgContent : []
      }
    }
  } catch (error) {
    console.error('refreshIsgAndVehicleCards error:', error)
  }
}

// 启动ISG电子标签预警和车辆安全监控卡片定时刷新
const startIsgAndVehicleRefresh = () => {
  // 清除之前的定时器
  if (isgAndVehicleRefreshTimer) {
    clearInterval(isgAndVehicleRefreshTimer)
    isgAndVehicleRefreshTimer = null
  }
  
  // 从store获取刷新间隔
  const interval = 30000
  
  // 设置定时器
  isgAndVehicleRefreshTimer = setInterval(() => {
    refreshIsgAndVehicleCards()
  }, interval)
}

// 停止ISG电子标签预警和车辆安全监控卡片定时刷新
const stopIsgAndVehicleRefresh = () => {
  if (isgAndVehicleRefreshTimer) {
    clearInterval(isgAndVehicleRefreshTimer)
    isgAndVehicleRefreshTimer = null
  }
}

// 组件挂载
onMounted(async () => {
  // 加载筛选选项
  await loadSelectOptions()
  headerWarehouseData.value = warehouseOptions.value
  headerProvinceData.value = provinceOptions.value
  headerRdcData.value = rdcOptions.value
  
  // 初始化默认日期范围（上一个月）
  const [startDate, endDate] = getInitialDateRange()
  // 确保dateRange是dayjs对象
  cddSearchParams.value.dateRange = [startDate, endDate]
  cddSearchParams.value.startDate = startDate.format('YYYY-MM-DD HH:mm:ss')
  cddSearchParams.value.endDate = endDate.format('YYYY-MM-DD HH:mm:ss')
  
  initVideo()
  
  // 启动智能体异常预警卡片定时刷新
  startCargoBannerRefresh()
  
  // 启动ISG电子标签预警和车辆安全监控卡片定时刷新
  startIsgAndVehicleRefresh()

  nextTick(() => {
    // 延迟初始化，确保DOM完全渲染
    setTimeout(() => {
      // 多次尝试计算缩放比例，确保容器尺寸已经正确渲染
      let attemptCount = 0
      const maxAttempts = 5
      
      const tryCalculateScale = () => {
        attemptCount++
        calculateScaleRatio()
        
        // 如果容器尺寸仍然为0，且未达到最大尝试次数，则继续尝试
        const rect = cargoContainer.value?.getBoundingClientRect()
        if (rect && (rect.width === 0 || rect.height === 0) && attemptCount < maxAttempts) {
          setTimeout(tryCalculateScale, 200)
        } else {
          // 初始化完成，启动 ResizeObserver（已移除自动动画）
          initResizeObserver()
        }
      }
      
      tryCalculateScale()
    }, 300)
  })

  // 监听Header组件的筛选变化
  window.addEventListener('filterChanged', handleFilterChanged as EventListener)
  
  // 监听全局点击事件
  document.addEventListener('click', handleGlobalClick)
  
  // 监听窗口大小变化
  window.addEventListener('resize', calculateModalTableScrollY)
  
  // 监听有效卡片数量变化，重置卡片位置（已移除动画）
  watch(validCardsCount, () => {
    nextTick(() => {
      // 重置所有卡片位置
      resetAllCardPositions()
    })
  })
  
  // 监听弹窗显示状态变化
  watch(modalVisible, (newVal) => {
    if (newVal) {
      nextTick(() => {
        calculateModalTableScrollY();
        // 使用 ResizeObserver 监听容器大小变化
        if (modalTableSectionRef.value) {
          const resizeObserver = new ResizeObserver(() => {
            calculateModalTableScrollY();
          });
          resizeObserver.observe(modalTableSectionRef.value);
          // 保存 observer 以便卸载时清理
          (modalTableSectionRef.value as any)._resizeObserver = resizeObserver;
        }
      });
    } else {
      // 清理 ResizeObserver
      if (modalTableSectionRef.value && (modalTableSectionRef.value as any)._resizeObserver) {
        (modalTableSectionRef.value as any)._resizeObserver.disconnect();
        (modalTableSectionRef.value as any)._resizeObserver = null;
      }
    }
  });
  
  // 不再在这里调用fetchRiskOrderStats，改为在视频加载完成后调用
  // fetchRiskOrderStats()
})

// 监听 props 变化（来自控制 Store 的筛选）
watch(
  () => props,
  (newProps) => {
    if (newProps.fromWarehouse !== undefined) {
      headerWarehouseData.value = newProps.fromWarehouse || []
    }
    if (newProps.toProvince !== undefined) {
      headerProvinceData.value = newProps.toProvince || []
    }
    if (newProps.toRdc !== undefined) {
      headerRdcData.value = newProps.toRdc || []
    }
    fetchRiskOrderStats()
  },
  { deep: true }
)

onUnmounted(() => {
  // 停止智能体异常预警卡片定时刷新
  stopCargoBannerRefresh()
  
  // 停止ISG电子标签预警和车辆安全监控卡片定时刷新
  stopIsgAndVehicleRefresh()
  
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  // 清理自动动画定时器
  stopAutoAnimationTimer()
  
  // 移除事件监听
  window.removeEventListener('filterChanged', handleFilterChanged as EventListener)
  window.removeEventListener('resize', calculateModalTableScrollY)
  document.removeEventListener('click', handleGlobalClick)
  
  // 清理 ResizeObserver
  if (modalTableSectionRef.value && (modalTableSectionRef.value as any)._resizeObserver) {
    (modalTableSectionRef.value as any)._resizeObserver.disconnect()
  }
})
</script>
<template>
  <div class="cargo-banner" ref="cargoContainer" 
       @mouseenter="handleMouseEnter" 
       @mouseleave="handleMouseLeave">
    

    <div class="content-wrapper">
      <!-- 中央视频 -->
      <div class="central-video">
        <video ref="videoRef" src='/dashboard/video/border.webm' autoPlay muted loop preload='auto'
          class="handbook-bg"></video>
      </div>

      <!-- 固定位置数据卡片 -->
      <div class="cargo-data-cards" :class="{ 'less-than-three': validCardsCount < 3 }" v-show="videoLoaded">
        <div v-for="(card, index) in dataCards" :key="index" class="cargo-data-card"
          :class="[getCardPositionClass(index)]"
          @click="handleCardClick(index)">
          <!-- 车辆图标 -->
          <div class="car-icon-container">
            <img src="/dashboard/images/banner-car.png" :alt="'车辆图标'" />
          </div>

          <!-- 连接箭头 -->
          <div class="connection-arrow"></div>

          <!-- 文字背景卡片 -->
          <div class="text-card">
            <div class="card-header">
              <h3>{{ card.title }}</h3>
              <button 
                v-if="card.content && card.content.length > 0"
                class="card-expand-btn" 
                @click.stop="handleCardExpand(index)"
                :title="'放大查看'"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 3H5C3.89543 3 3 3.89543 3 5V8M21 8V5C21 3.89543 20.1046 3 19 3H16M16 21H19C20.1046 21 21 20.1046 21 19V16M3 16V19C3 20.1046 3.89543 21 5 21H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div class="card-content">
              <template v-if="card.content && card.content.length > 0">
                <p v-for="(item, i) in card.content" :key="i" 
                   :class="{ 
                     'category-title': item === '重点关注' || item === '一般关注',
                     'vehicle-item': card.title === '车辆安全监控'
                   }"
                   @click="card.title === '车辆安全监控' ? handleVehicleItemClick($event, index, i) : null">
                  {{ item }}
                </p>
              </template>
              <div v-else class="empty-content">
                <img src="/dashboard/images/image_empty.png" alt="暂无数据" class="empty-image" />
                <p class="empty-text">暂无数据</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 车辆详情框 -->
      <div v-if="selectedVehicleData && vehicleDetailPosition" 
           class="vehicle-detail-container">
        <div class="vehicle-detail-box"
             :style="{
               left: vehicleDetailPosition.x + 'px',
               top: vehicleDetailPosition.y + 'px'
             }"
             @click.stop>
          <div class="vehicle-detail-content">
            <div class="vehicle-detail-text">
              {{ selectedVehicleData.carNo }}，{{ '当前位置：' }}{{ selectedVehicleData.location }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 自定义弹窗 -->
    <Teleport to="body">
      <div v-if="modalVisible" class="custom-modal-overlay">
        <div class="custom-modal">
        <!-- 弹窗头部 -->
        <div class="modal-header">
          <div class="header-striped-bg"></div>
          <h3 class="modal-title">{{ modalTitle }}</h3>
          <button class="close-btn" @click="handleModalClose">×</button>
        </div>
        
        <!-- 弹窗内容 -->
        <div class="modal-body">
          <!-- CDD预警搜索区域 -->
          <div v-if="modalTitle === 'CDD预警详情'" class="cdd-search-section">
            <div class="search-form">
              <!-- 时间范围 -->
              <div class="time-picker-item">
                <a-range-picker
                  v-model:value="cddSearchParams.dateRange"
                  picker="date"
                  format="YYYY-MM-DD"
                  :separator="'~'"
                  class="date-range-picker"
                  @change="handleCddDateRangeChange"
                  size="small"
                />
              </div>
              <!-- 数据源 -->
              <div class="filter-item">
                <div class="dropdown-item dropdown-item-data-source" @click.stop="toggleCddDataSourceDropdown">
                  <span class="dropdown-text">{{ displayCddDataSource }}</span>
                  <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6,9 12,15 18,9"></polyline>
                  </svg>
                  <div class="dropdown-content" v-show="isCddDataSourceOpen" @click.stop>
                    <div class="options-list">
                      <div 
                        v-for="option in cddDataSourceOptions" 
                        :key="option.code" 
                        class="dropdown-option"
                        :class="{ 'selected': cddSearchParams.dataSource.includes(option.code) }" 
                        @click.stop="selectCddDataSource(option)"
                      >
                        <span class="checkmark" v-if="cddSearchParams.dataSource.includes(option.code)">✓</span>
                        {{ option.name }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 客户 -->
              <div class="filter-item">
                <div class="dropdown-item dropdown-item-customer" @click.stop="toggleCddCustomerDropdown">
                  <span class="dropdown-text">{{ displayCddCustomer }}</span>
                  <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6,9 12,15 18,9"></polyline>
                  </svg>
                  <div class="dropdown-content" v-show="isCddCustomerOpen" @click.stop>
                    <div class="options-list">
                      <div 
                        v-for="option in cddCustomerOptions" 
                        :key="option.code" 
                        class="dropdown-option"
                        :class="{ 'selected': cddSearchParams.customer.includes(option.code) }" 
                        @click.stop="selectCddCustomer(option)"
                      >
                        <span class="checkmark" v-if="cddSearchParams.customer.includes(option.code)">✓</span>
                        {{ option.name }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 始发仓 -->
              <div class="filter-item">
                <div class="dropdown-item dropdown-item-from-warehouse" :title="cddFullWarehouseText" @click="toggleCddFromWarehouse()">
                  <span class="dropdown-text">{{ cddDisplayWarehouse }}</span>
                  <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6,9 12,15 18,9"></polyline>
                  </svg>
                  <div class="dropdown-content" v-show="isCddFromWarehouseOpen" @click.stop>
                    <div class="search-box">
                      <input v-model="cddWarehouseSearch" type="text" :placeholder="'搜索始发仓'" class="search-input" @click.stop />
                    </div>
                    <div class="options-list">
                      <div 
                        v-for="option in filteredCddWarehouseOptions" 
                        :key="option" 
                        class="dropdown-option"
                        :class="{ 'selected': cddSearchParams.fromWarehouse.includes(option) }" 
                        @click.stop="selectCddFromWarehouse(option)"
                      >
                        <span class="checkmark" v-if="cddSearchParams.fromWarehouse.includes(option)">✓</span>
                        {{ option }}
                      </div>
                      <div v-if="filteredCddWarehouseOptions.length === 0" class="no-results">
                        {{ '未找到匹配结果' }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 目的省份 -->
              <div class="filter-item">
                <div class="dropdown-item dropdown-item-to-province" :title="cddFullProvinceText" @click="toggleCddToProvince()">
                  <span class="dropdown-text">{{ cddDisplayProvince }}</span>
                  <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6,9 12,15 18,9"></polyline>
                  </svg>
                  <div class="dropdown-content" v-show="isCddToProvinceOpen" @click.stop>
                    <div class="search-box">
                      <input v-model="cddProvinceSearch" type="text" :placeholder="'搜索目的省'" class="search-input" @click.stop />
                    </div>
                    <div class="options-list">
                      <div 
                        v-for="option in filteredCddProvinceOptions" 
                        :key="option" 
                        class="dropdown-option"
                        :class="{ 'selected': cddSearchParams.toProvince.includes(option) }" 
                        @click.stop="selectCddToProvince(option)"
                      >
                        <span class="checkmark" v-if="cddSearchParams.toProvince.includes(option)">✓</span>
                        {{ option }}
                      </div>
                      <div v-if="filteredCddProvinceOptions.length === 0" class="no-results">
                        {{ '未找到匹配结果' }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 目的RDC -->
              <div class="filter-item">
                <div class="dropdown-item dropdown-item-to-rdc" :title="cddFullRdcText" @click="toggleCddToRdc()">
                  <span class="dropdown-text">{{ cddDisplayRdc }}</span>
                  <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6,9 12,15 18,9"></polyline>
                  </svg>
                  <div class="dropdown-content" v-show="isCddToRdcOpen" @click.stop>
                    <div class="search-box">
                      <input v-model="cddRdcSearch" type="text" :placeholder="'搜索目的RDC'" class="search-input" @click.stop />
                    </div>
                    <div class="options-list">
                      <div 
                        v-for="option in filteredCddRdcOptions" 
                        :key="option" 
                        class="dropdown-option"
                        :class="{ 'selected': cddSearchParams.toRdc.includes(option) }" 
                        @click.stop="selectCddToRdc(option)"
                      >
                        <span class="checkmark" v-if="cddSearchParams.toRdc.includes(option)">✓</span>
                        {{ option }}
                      </div>
                      <div v-if="filteredCddRdcOptions.length === 0" class="no-results">
                        {{ '未找到匹配结果' }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 不达标类型 -->
              <div class="filter-item">
                <div class="dropdown-item dropdown-item-non-compliance-type" @click.stop="toggleCddNonComplianceTypeDropdown">
                  <span class="dropdown-text">{{ displayCddNonComplianceType }}</span>
                  <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6,9 12,15 18,9"></polyline>
                  </svg>
                  <div class="dropdown-content" v-show="isCddNonComplianceTypeOpen" @click.stop>
                    <div class="options-list">
                      <div 
                        v-for="option in cddNonComplianceTypeOptions" 
                        :key="option.code" 
                        class="dropdown-option"
                        :class="{ 'selected': cddSearchParams.nonComplianceType.includes(option.code) }" 
                        @click.stop="selectCddNonComplianceType(option)"
                      >
                        <span class="checkmark" v-if="cddSearchParams.nonComplianceType.includes(option.code)">✓</span>
                        {{ option.name }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 运输模式 -->
              <div class="filter-item">
                <div class="dropdown-item dropdown-item-trans-mode" @click.stop="toggleCddModeTypeDropdown">
                  <span class="dropdown-text">{{ displayCddModeType }}</span>
                  <svg class="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6,9 12,15 18,9"></polyline>
                  </svg>
                  <div class="dropdown-content" v-show="isCddModeTypeOpen" @click.stop>
                    <div class="options-list">
                      <div 
                        v-for="option in cddModeTypeOptions" 
                        :key="option.code" 
                        class="dropdown-option"
                        :class="{ 'selected': cddSearchParams.modeType.includes(option.code) }" 
                        @click.stop="selectCddModeType(option)"
                      >
                        <span class="checkmark" v-if="cddSearchParams.modeType.includes(option.code)">✓</span>
                        {{ option.name }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="search-buttons">
                <a-button type="primary" @click="handleCddSearch" class="action-btn">{{ '搜索' }}</a-button>
                <a-button @click="handleCddReset" class="action-btn">{{ '重置' }}</a-button>
                <a-button type="primary" class="action-btn" @click="handleCddExport" :disabled="exportLoading" > {{ '导出' }}</a-button>
              </div>
            </div>
          </div>

          <!-- ISG搜索区域 -->
          <div v-if="modalTitle === 'ISG电子标签预警详情'" class="isg-search-section">
            <div class="search-form">
              <div class="time-item" @click.stop>
                <a-range-picker 
                  v-model:value="isgSearchParams.dateRange"
                  format="YYYY-MM-DD HH:mm:ss"
                  :separator="'~'"
                  class="date-range-picker"
                  @click.stop
                  :getPopupContainer="getPickerPopupContainer"
                  :showTime="{ format: 'HH:mm:ss' }"
                  :allowClear="true"
                  @change="(dates: any) => {
                    if (dates && dates.length === 2 && dates[0] && dates[1]) {
                      isgSearchParams.startDate = dayjs(dates[0]).format('YYYY-MM-DD HH:mm:ss')
                      isgSearchParams.endDate = dayjs(dates[1]).format('YYYY-MM-DD HH:mm:ss')
                    } else {
                      isgSearchParams.startDate = ''
                      isgSearchParams.endDate = ''
                    }
                  }"
                />
              </div>
              <div class="filter-item">
                <div class="dropdown-item invoice-input">
                  <input 
                    v-model="isgSearchParams.invoiceNo" 
                    type="text" 
                    placeholder="发货单号"
                    class="form-input"
                    @pressEnter="handleIsgSearch"
                  />
                </div>
              </div>
              <div class="search-buttons">
                <a-button type="primary" @click="handleIsgSearch" class="action-btn">{{ '搜索' }}</a-button>
                <a-button @click="handleIsgReset" class="action-btn">{{ '重置' }}</a-button>
              </div>
            </div>
          </div>
          
          <!-- ISG Tab页签 -->
          <div v-if="modalTitle === 'ISG电子标签预警详情'" class="isg-tabs-section">
            <div 
              class="isg-tab-item" 
              :class="{ 'isg-tab-active': isgActiveTab === 'delay' }"
              @click="handleIsgTabChange('delay')"
            >
              <span>{{ 'ISG客户迟到风险' }}</span>
              <span class="isg-tab-badge" v-if="isgTabCounts.delay > 0">{{ isgTabCounts.delay }}</span>
            </div>
            <div 
              class="isg-tab-item" 
              :class="{ 'isg-tab-active': isgActiveTab === 'inTransit' }"
              @click="handleIsgTabChange('inTransit')"
            >
              <span>{{ 'ISG在途异常' }}</span>
              <span class="isg-tab-badge" v-if="isgTabCounts.inTransit > 0">{{ isgTabCounts.inTransit }}</span>
            </div>
            <div 
              class="isg-tab-item" 
              :class="{ 'isg-tab-active': isgActiveTab === 'delivery' }"
              @click="handleIsgTabChange('delivery')"
            >
              <span>{{ '按需达交付异常' }}</span>
              <span class="isg-tab-badge" v-if="isgTabCounts.delivery > 0">{{ isgTabCounts.delivery }}</span>
            </div>
          </div>
          
          <!-- 导出按钮区域 - 仅对异常预警详情弹窗显示 -->
          <div v-if="modalTitle === '异常预警订单详情'" class="export-section">
            <button 
              class="export-btn" 
              @click="handleExport"
              :disabled="exportLoading"
            >
              {{ '导出' }}
            </button>
          </div>
          
          <!-- 表格区域 -->
          <div class="table-section" ref="modalTableSectionRef">
            <a-spin :spinning="modalLoading">
              <a-table 
                :columns="currentTableColumns" 
                :data-source="modalData" 
                :pagination="{
                  current: currentPage,
                  pageSize: pageSize,
                  total: total,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal:  (total: number, range: [number, number]) => {
                    return `第 ${range[0]}-${range[1]} 条/共 ${total} 条 (共 ${totalPages} 页)`;
                  },
                  pageSizeOptions: ['10', '20', '50', '100'],
                  sizeChangerPosition: 'start'
                }" 
                size="small"
                :scroll="{ x: 'max-content', y: modalTableScrollY }"
                @change="handleTableChange"
                :class="['custom-table', modalTitle === 'ISG电子标签预警详情' ? `isg-table-${isgActiveTab}` : '']"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'riskInformType'">
                    <span>{{ Array.isArray(record.riskInformType) ? record.riskInformType.join(', ') : record.riskInformType }}</span>
                  </template>
                  <template v-else-if="column.key === 'abnormalInfo'">
                    <span>{{ formatIsgDeliveryAbnormalInfo(record?.abnormalInfo) }}</span>
                  </template>
                </template>
              </a-table>
            </a-spin>
          </div>
        </div>
        </div>
      </div>
    </Teleport>

    <!-- 卡片详情弹窗 -->
    <Teleport to="body">
      <div v-if="cardDetailModalVisible && selectedCardData" class="card-detail-modal-overlay" @click="handleCardDetailModalClose">
        <div class="card-detail-modal" @click.stop>
          <!-- 弹窗头部 -->
          <div class="card-detail-modal-header">
            <div class="header-striped-bg"></div>
            <h3 class="card-detail-modal-title">{{ selectedCardData.title }}</h3>
            <button class="card-detail-close-btn" @click="handleCardDetailModalClose">×</button>
          </div>
          
          <!-- 弹窗内容 -->
          <div class="card-detail-modal-body">
            <div class="card-detail-content">
              <p 
                v-for="(item, i) in selectedCardData.content" 
                :key="i" 
                :class="{ 
                  'category-title': item === '重点关注' || item === '一般关注',
                  'vehicle-item': selectedCardData.title === '车辆安全监控'
                }"
              >
                {{ item }}
              </p>
              <p v-if="!selectedCardData.content || selectedCardData.content.length === 0" class="empty-content">
                暂无数据
              </p>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>


<style scoped>
.cargo-banner {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 创建一个保持840:480比例的内容容器 */
.content-wrapper {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(100%, 100vh * 840/480); /* 根据高度计算最大宽度 */
  height: min(100%, 100vw * 480/840); /* 根据宽度计算最大高度 */
  aspect-ratio: 840/480; /* 强制保持原始比例 */
  max-width: 100%;
  max-height: 100%;
}

/* 中央视频 - 相对于内容包装器 */
.central-video {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  height: 100%;
  width: 100%;
  z-index: 5;
}

.central-video .handbook-bg {
  height: 100%;
  width: 100%;
  position: absolute;
  top: 0;
}

/* 数据卡片 - 相对于内容包装器 */
.cargo-data-cards {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 5;
}

.cargo-data-cards .cargo-data-card {
  position: absolute;
  width: 8.25rem; /* 基础尺寸，将由JavaScript动态调整 */
  height: 8.25rem; /* 基础尺寸，将由JavaScript动态调整 */
  z-index: 15;
}

/* 卡片1 - 底部中央 */
.cargo-data-cards .cargo-data-card.card-position-1 {
  left: 44%;
  bottom: 3%;
  cursor: pointer;
}

.cargo-data-cards .cargo-data-card.card-position-1 .connection-arrow {
  top: -1.5rem;
  background: url('/dashboard/images/jiantou1.png') center/cover no-repeat;
}

.cargo-data-cards .cargo-data-card.card-position-1 .text-card {
  bottom: 7rem;
  left: 50%;
  transform: translateX(-50%);
}

.cargo-data-cards .cargo-data-card.card-position-1.arc-animating {
  z-index: 20;
  transition: none; /* 禁用CSS过渡，使用JS动画 */
}

/* 卡片2 - 左中 */
.cargo-data-cards .cargo-data-card.card-position-2 {
  left: 5%;
  top: 62%;
  z-index: 16;
}

.cargo-data-cards .cargo-data-card.card-position-2 .connection-arrow {
  top: -1.5rem;
  background: url('/dashboard/images/jiantou2.png') center/cover no-repeat;
}

/* 卡片3 - 左上 */
.cargo-data-cards .cargo-data-card.card-position-3 {
  left: 15%;
  top: 30%;
  z-index: 15;
}

.cargo-data-cards .cargo-data-card.card-position-3 .connection-arrow {
  top: -1.5rem;
  background: url('/dashboard/images/jiantou3.png') center/cover no-repeat;
}

.cargo-data-cards .cargo-data-card.card-position-3 .text-card {
  bottom: 7rem;
  left: 50%;
  transform: translateX(-50%);
}

/* 卡片4 - 右上 */
.cargo-data-cards .cargo-data-card.card-position-4 {
  right: 12%;
  top: 30%;
  z-index: 15;
}

.cargo-data-cards .cargo-data-card.card-position-4 .connection-arrow {
  top: -1.5rem;
  background: url('/dashboard/images/jiantou4.png') center/cover no-repeat;
}

.cargo-data-cards .cargo-data-card.card-position-4 .text-card {
  bottom: 7rem;
  left: 50%;
  transform: translateX(-50%);
}

/* 卡片5 - 右中 */
.cargo-data-cards .cargo-data-card.card-position-5 {
  right: 3%;
  top: 62%;
  z-index: 16;
}

.cargo-data-cards .cargo-data-card.card-position-5 .connection-arrow {
  top: -1.5rem;
  background: url('/static/images/jiantou2.png') center/cover no-repeat;
}

.cargo-data-cards .cargo-data-card.card-position-5 .text-card {
  bottom: 7rem;
  left: 50%;
  transform: translateX(-50%);
}

.cargo-data-cards .cargo-data-card .text-card {
  width: 13rem;
  height: 8.75rem;
  bottom: 7rem;
  left: 50%;
  transform: translateX(-50%);
}

/* 车辆图标容器 */
.cargo-data-cards .cargo-data-card .car-icon-container {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  position: relative;
}

.cargo-data-cards .cargo-data-card .car-icon-container img {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 83.3%;
  height: 83.3%;
  object-fit: contain;
  filter: drop-shadow(0 0.125rem 0.5rem rgba(0, 150, 255, 0.3));
}

/* 连接箭头 */
.cargo-data-cards .cargo-data-card .connection-arrow {
  width: 20%;
  height: 20%;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  background-size: cover;
  background-position: center;
}

/* 文字卡片 */
.cargo-data-cards .cargo-data-card .text-card {
  position: absolute;
  background: url('/dashboard/images/banner-bg.png');
  background-size: 100% 100%;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  box-shadow: 0 0.25rem 1rem rgba(0, 100, 200, 0.3);
  transition: filter 0.3s ease;
}

.cargo-data-cards .cargo-data-card .text-card .card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: 2;
  padding: 0.0625rem 0.125rem;
  /* margin 将通过 JavaScript 动态设置 */
}

.cargo-data-cards .cargo-data-card .text-card .card-header h3 {
  color: #FFFFFF;
  font-size: 0.75rem;
  font-weight: bold;
  margin: 0;
  padding: 0;
  font-family: FZDaLiTiS;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: filter 0.3s ease;
  flex: 1;
  line-height: 1.2;
  display: flex;
  align-items: center;
}

.cargo-data-cards .cargo-data-card .text-card .card-header .card-expand-btn {
  background: rgba(74, 158, 255, 0.4);
  border: 1.5px solid #4a9eff;
  cursor: pointer;
  padding: 0.15rem;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  transition: all 0.3s ease;
  margin-left: 0.5rem;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  line-height: 1;
  border-radius: 0.2rem;
  box-shadow: 0 0 10px rgba(74, 158, 255, 0.8), 0 0 20px rgba(74, 158, 255, 0.4), inset 0 0 10px rgba(74, 158, 255, 0.2);
  backdrop-filter: blur(4px);
}

.cargo-data-cards .cargo-data-card .text-card .card-header .card-expand-btn:hover {
  background: rgba(74, 158, 255, 0.6);
  border-color: #60a5fa;
  color: #ffffff;
  transform: scale(1.15);
  box-shadow: 0 0 15px rgba(74, 158, 255, 1), 0 0 30px rgba(74, 158, 255, 0.6), inset 0 0 15px rgba(74, 158, 255, 0.3);
}

.cargo-data-cards .cargo-data-card .text-card .card-header .card-expand-btn svg {
  width: 13px;
  height: 13px;
  display: block;
  filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.8));
}

.cargo-data-cards .cargo-data-card .text-card .card-content {
  height: 80%;
  font-family: 'Alibaba PuHuiTi 2.0';
  font-weight: normal;
  font-size: 0.625rem;
  color: rgba(255, 255, 255, 0.9);
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  z-index: 1;
  padding-top: 0.25rem;
  cursor: pointer;
  transition: filter 0.3s ease;
}

.cargo-data-cards .cargo-data-card .text-card .card-content::-webkit-scrollbar {
  width: 4px;
}

.cargo-data-cards .cargo-data-card .text-card .card-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.cargo-data-cards .cargo-data-card .text-card .card-content::-webkit-scrollbar-thumb {
  background: rgba(74, 158, 255, 0.6);
  border-radius: 2px;
}

.cargo-data-cards .cargo-data-card .text-card .card-content::-webkit-scrollbar-thumb:hover {
  background: rgba(74, 158, 255, 0.8);
}

.cargo-data-cards .cargo-data-card .text-card .card-content p {
  word-break: break-word;
  margin-top: 0.25rem;
  margin-bottom: 0;
}

.cargo-data-cards .cargo-data-card .text-card .card-content p:first-child {
  margin-top: 0;
}

.cargo-data-cards .cargo-data-card .text-card .card-content p:last-child {
  margin-bottom: 0;
}

.cargo-data-cards .cargo-data-card .text-card .card-content p.category-title {
  font-size: 1.2em;
  font-weight: bold;
  color: rgba(255, 255, 255, 1);
}

.cargo-data-cards .cargo-data-card .text-card .card-content p.vehicle-item {
  cursor: pointer;
}

.cargo-data-cards .cargo-data-card .text-card .card-content .empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0;
  margin: 0;
  min-height: 100%;
  height: 100%;
}

.cargo-data-cards .cargo-data-card .text-card .card-content .empty-content .empty-image {
  width: 4.5rem;
  height: 4.5rem;
  opacity: 0.9;
  object-fit: contain;
  display: block;
}

.cargo-data-cards .cargo-data-card .text-card .card-content .empty-content .empty-text {
  text-align: center;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.65rem;
  margin: 0;
  padding: 0;
  font-family: 'Alibaba PuHuiTi 2.0';
  font-weight: 500;
  white-space: nowrap;
  line-height: 1.2;
  display: block;
}

/* 已移除模糊效果 */

.vehicle-detail-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 100;
}

.vehicle-detail-box {
  position: absolute;
  z-index: 101;
  pointer-events: auto;
}

.vehicle-detail-box .vehicle-detail-content {
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 0.25rem;
  padding: 0.5rem 0.75rem;
  box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.2);
  min-width: 12rem;
  max-width: 20rem;
}

.vehicle-detail-box .vehicle-detail-content .vehicle-detail-text {
  font-size: 0.75rem;
  color: #333;
  line-height: 1.5;
  word-wrap: break-word;
  word-break: break-all;
}

/* 弹窗样式 */
.modal-body {
  padding: 1.25rem;
  background: rgba(15, 23, 42, 0.95);
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* CDD弹窗搜索区域样式 */
.cdd-search-section {
  margin-bottom: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(74, 158, 255, 0.3);
  border-radius: 8px;
  padding: 16px;
  position: relative;
  z-index: 10;
}

.cdd-search-section .search-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.cdd-search-section .search-form .time-picker-item .ant-picker {
  background: #081f40 !important;
  border: 0.0625rem solid #2873cc !important;
  color: rgba(255, 255, 255, 0.7) !important;
  font-size: 0.7rem !important;
  transition: all 0.3s ease !important;
  display: flex !important;
  height: 1.8rem !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 0.3rem !important;
  padding: 0.1rem 0.4rem !important;
  min-height: 1.5rem !important;
  width: 12rem !important;
}

.cdd-search-section .search-form .time-picker-item .ant-picker::deep .ant-picker-input input {
  font-size: 0.6rem !important;
}

.cdd-search-section .search-form .time-picker-item .ant-picker .ant-picker-input input {
  font-size: 0.6rem !important;
}

.cdd-search-section .search-form .time-picker-item .ant-picker::deep .ant-picker-input {
  color: rgba(255, 255, 255, 0.7) !important;
}

.cdd-search-section .search-form .time-picker-item .ant-picker::deep .ant-picker-input input {
  color: rgba(255, 255, 255, 0.7) !important;
  background: transparent !important;
  border: none !important;
}

.cdd-search-section .search-form .time-picker-item .ant-picker::deep .ant-picker-input input::placeholder {
  color: rgba(255, 255, 255, 0.5) !important;
  font-size: 0.6rem !important;
}

.cdd-search-section .search-form .time-picker-item .ant-picker :deep(.ant-picker-input) input {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.7rem;
}

.cdd-search-section .search-form .time-picker-item .ant-picker .ant-picker-separator {
  color: rgba(255, 255, 255, 0.7) !important;
}

.cdd-search-section .search-form .time-picker-item .ant-picker .ant-picker-suffix {
  color: rgba(255, 255, 255, 0.7) !important;
}

.cdd-search-section .search-form .time-picker-item .ant-picker:hover {
  border-color: #4a9eff !important;
  background: rgba(74, 158, 255, 0.1) !important;
}

.cdd-search-section .search-form .filter-item {
  display: flex;
  align-items: center;
  gap: 2px;
}

.cdd-search-section .search-form .filter-item .dropdown-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.1rem;
  padding: 0.3rem 0.5rem;
  background: #081F40;
  border: 0.0625rem solid #2873CC;
  border-radius: 0.2rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.3s ease;
  height: 1.8rem;
}

.cdd-search-section .search-form .filter-item .dropdown-item:hover {
  border-color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}

.cdd-search-section .search-form .filter-item .dropdown-item .dropdown-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cdd-search-section .search-form .filter-item .dropdown-item .dropdown-icon {
  width: 0.8rem;
  height: 0.8rem;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.7);
  transition: transform 0.3s ease;
}

.cdd-search-section .search-form .filter-item .dropdown-item.dropdown-item-data-source {
  width: 5rem;
}

.cdd-search-section .search-form .filter-item .dropdown-item.dropdown-item-customer {
  width: 4rem;
}

.cdd-search-section .search-form .filter-item .dropdown-item.dropdown-item-from-warehouse {
  width: 5.5rem;
}

.cdd-search-section .search-form .filter-item .dropdown-item.dropdown-item-to-province {
  width: 5.5rem;
}

.cdd-search-section .search-form .filter-item .dropdown-item.dropdown-item-to-rdc {
  width: 5.5rem;
}

.cdd-search-section .search-form .filter-item .dropdown-item.dropdown-item-non-compliance-type {
  width: 6rem;
}

.cdd-search-section .search-form .filter-item .dropdown-item.dropdown-item-trans-mode {
  width: 5.5rem;
}

.cdd-search-section .search-form .filter-item .dropdown-item .dropdown-content {
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
  overflow-y: auto;
  backdrop-filter: blur(0.625rem);
}

.cdd-search-section .search-form .filter-item .dropdown-item .dropdown-content .search-box {
  padding: 0.2rem;
  border-bottom: 0.0625rem solid rgba(59, 130, 246, 0.3);
}

.cdd-search-section .search-form .filter-item .dropdown-item .dropdown-content .search-box .search-input {
  width: 100%;
  padding: 0.15rem 0.3rem;
  background: rgba(0, 0, 0, 0.3);
  border: 0.0625rem solid rgba(59, 130, 246, 0.4);
  border-radius: 0.125rem;
  color: white;
  font-size: 0.65rem;
  outline: none;
}

.cdd-search-section .search-form .filter-item .dropdown-item .dropdown-content .search-box .search-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.6rem;
}

.cdd-search-section .search-form .filter-item .dropdown-item .dropdown-content .search-box .search-input:focus {
  border-color: #4a9eff;
  box-shadow: 0 0 0.25rem rgba(74, 158, 255, 0.5);
}

.cdd-search-section .search-form .filter-item .dropdown-item .dropdown-content .options-list {
  max-height: 7.6rem;
  padding: 0.2rem;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(59, 130, 246, 0.6) rgba(0, 0, 0, 0.3);
}

.cdd-search-section .search-form .filter-item .dropdown-item .dropdown-content .options-list::-webkit-scrollbar {
  width: 6px;
}

.cdd-search-section .search-form .filter-item .dropdown-item .dropdown-content .options-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  margin: 2px 0;
}

.cdd-search-section .search-form .filter-item .dropdown-item .dropdown-content .options-list::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.6) 0%, rgba(74, 158, 255, 0.6) 100%);
  border-radius: 3px;
  border: 1px solid rgba(59, 130, 246, 0.3);
  transition: all 0.3s ease;
}

.cdd-search-section .search-form .filter-item .dropdown-item .dropdown-content .options-list::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.8) 0%, rgba(74, 158, 255, 0.8) 100%);
  border-color: rgba(59, 130, 246, 0.5);
}

.cdd-search-section .search-form .filter-item .dropdown-item .dropdown-content .options-list .dropdown-option {
  padding: 0.2rem 0.4rem;
  color: white;
  font-size: 0.7rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  transition: all 0.2s ease;
  border-radius: 0.125rem;
}

.cdd-search-section .search-form .filter-item .dropdown-item .dropdown-content .options-list .dropdown-option:hover {
  background: rgba(74, 158, 255, 0.2);
}

.cdd-search-section .search-form .filter-item .dropdown-item .dropdown-content .options-list .dropdown-option.selected {
  background: rgba(74, 158, 255, 0.3);
  color: white;
}

.cdd-search-section .search-form .filter-item .dropdown-item .dropdown-content .options-list .dropdown-option .checkmark {
  color: #4a9eff;
  font-weight: bold;
}

.cdd-search-section .search-form .search-buttons {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}

.cdd-search-section .search-form .search-buttons .action-btn {
  padding: 0.3rem 0.8rem;
  font-size: 0.75rem;
  height: 1.8rem;
  border-radius: 0.2rem;
  border: none;
  transition: all 0.3s ease;
}

/* ISG搜索区域样式 */
.isg-search-section {
  margin-bottom: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(74, 158, 255, 0.3);
  border-radius: 8px;
  padding: 16px;
  position: relative;
  z-index: 10;
}

.isg-search-section .search-form {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.isg-search-section .search-form .time-item .ant-picker {
  background: #081f40 !important;
  border: 0.0625rem solid #2873cc !important;
  color: rgba(255, 255, 255, 0.7) !important;
  font-size: 0.75rem !important;
  transition: all 0.3s ease !important;
  display: flex !important;
  height: 1.8rem !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 0.3rem !important;
  padding: 0.1rem 0.4rem !important;
  min-height: 1.5rem !important;
  width: 100% !important;
}

.isg-search-section .search-form .time-item .ant-picker .ant-picker-input {
  color: rgba(255, 255, 255, 0.7) !important;
}

.isg-search-section .search-form .time-item .ant-picker .ant-picker-input input {
  color: rgba(255, 255, 255, 0.7) !important;
  background: transparent !important;
  border: none !important;
}

.isg-search-section .search-form .time-item .ant-picker .ant-picker-input input::placeholder {
  color: rgba(255, 255, 255, 0.5) !important;
}

.isg-search-section .search-form .time-item .ant-picker :deep(.ant-picker-input) input {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
}

.isg-search-section .search-form .time-item .ant-picker .ant-picker-separator {
  color: rgba(255, 255, 255, 0.7) !important;
}

.isg-search-section .search-form .time-item .ant-picker .ant-picker-suffix {
  color: rgba(255, 255, 255, 0.7) !important;
}

/* 下拉面板样式 */
.isg-search-section .search-form .time-item :deep(.ant-picker-dropdown) .ant-picker-panel-layout {
  background: #081f40 !important;
  border: 0.0625rem solid #2873cc !important;
  border-radius: 0.25rem !important;
  color: rgba(255, 255, 255, 0.7) !important;
  font-size: 0.8rem !important;
  transition: all 0.3s ease !important;
}

/* 月份年份标题 */
.isg-search-section .search-form .time-item :deep(.ant-picker-dropdown) .ant-picker-header {
  border-bottom: 1px solid #2873cc;
}

.isg-search-section .search-form .time-item :deep(.ant-picker-dropdown) .ant-picker-header .ant-picker-header-view {
  color: rgba(255, 255, 255, 0.9) !important;
  font-size: 0.85rem !important;
  font-weight: 500;
}

.isg-search-section .search-form .time-item :deep(.ant-picker-dropdown) .ant-picker-header .ant-picker-header-super-prev-btn,
.isg-search-section .search-form .time-item :deep(.ant-picker-dropdown) .ant-picker-header .ant-picker-header-prev-btn,
.isg-search-section .search-form .time-item :deep(.ant-picker-dropdown) .ant-picker-header .ant-picker-header-next-btn,
.isg-search-section .search-form .time-item :deep(.ant-picker-dropdown) .ant-picker-header .ant-picker-header-super-next-btn {
  color: rgba(255, 255, 255, 0.7) !important;
}

.isg-search-section .search-form .time-item :deep(.ant-picker-dropdown) .ant-picker-header .ant-picker-header-super-prev-btn:hover,
.isg-search-section .search-form .time-item :deep(.ant-picker-dropdown) .ant-picker-header .ant-picker-header-prev-btn:hover,
.isg-search-section .search-form .time-item :deep(.ant-picker-dropdown) .ant-picker-header .ant-picker-header-next-btn:hover,
.isg-search-section .search-form .time-item :deep(.ant-picker-dropdown) .ant-picker-header .ant-picker-header-super-next-btn:hover {
  color: rgba(255, 255, 255, 1) !important;
}

/* 星期标题 */
.isg-search-section .search-form .time-item :deep(.ant-picker-dropdown) .ant-picker-week-panel-row .ant-picker-cell {
  color: rgba(255, 255, 255, 0.8) !important;
  font-size: 0.75rem !important;
  font-weight: 500;
}

/* 日期单元格 */
.isg-search-section .search-form .time-item :deep(.ant-picker-dropdown) .ant-picker-body .ant-picker-content .ant-picker-cell {
  color: rgba(255, 255, 255, 0.7) !important;
}

.isg-search-section .search-form .time-item :deep(.ant-picker-dropdown) .ant-picker-body .ant-picker-content .ant-picker-cell:hover {
  background: rgba(59, 130, 246, 0.3) !important;
  color: rgba(255, 255, 255, 1) !important;
}

.isg-search-section .search-form .time-item :deep(.ant-picker-dropdown) .ant-picker-body .ant-picker-content .ant-picker-cell.ant-picker-cell-in-range {
  background: rgba(59, 130, 246, 0.2) !important;
}

.isg-search-section .search-form .time-item :deep(.ant-picker-dropdown) .ant-picker-body .ant-picker-content .ant-picker-cell.ant-picker-cell-in-range::before {
  background: rgba(59, 130, 246, 0.2) !important;
}

.isg-search-section .search-form .time-item :deep(.ant-picker-dropdown) .ant-picker-body .ant-picker-content .ant-picker-cell.ant-picker-cell-disabled {
  color: rgba(255, 255, 255, 0.3) !important;
}

.isg-search-section .search-form .time-item :deep(.ant-picker-dropdown) .ant-picker-body .ant-picker-content .ant-picker-cell.ant-picker-cell-other-month {
  color: rgba(255, 255, 255, 0.4) !important;
}

/* 预设面板 */
.isg-search-section .search-form .time-item :deep(.ant-picker-dropdown) .ant-picker-presets {
  background: rgba(8, 31, 64, 0.8);
  border-right: 1px solid #2873cc;
}

.isg-search-section .search-form .time-item :deep(.ant-picker-dropdown) .ant-picker-presets .ant-picker-preset {
  color: rgba(255, 255, 255, 0.8) !important;
}

.isg-search-section .search-form .time-item :deep(.ant-picker-dropdown) .ant-picker-presets .ant-picker-preset:hover {
  background: rgba(59, 130, 246, 0.2) !important;
  color: rgba(255, 255, 255, 1) !important;
}

.isg-search-section .search-form .filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.isg-search-section .search-form .filter-item .dropdown-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  padding: 0.25rem 0.4rem;
  background: #081f40;
  border: 0.0625rem solid rgba(59, 130, 246, 0.6);
  border-radius: 0.2rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 140px;
  height: 1.8rem;
  min-height: 1.8rem;
  z-index: 100;
}

.isg-search-section .search-form .filter-item .dropdown-item:hover {
  color: white;
}

.isg-search-section .search-form .filter-item .dropdown-item .form-input {
  width: 100%;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.7rem;
  outline: none;
}

.isg-search-section .search-form .filter-item .dropdown-item .form-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.isg-search-section .search-form .filter-item .dropdown-item .form-input:focus {
  color: white;
}

.isg-search-section .search-form .filter-item .dropdown-item.invoice-input {
  width: 200px !important;
}

.isg-search-section .search-form .search-buttons {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.isg-search-section .search-form .search-buttons .action-btn {
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
}

.isg-search-section .search-form .search-buttons .action-btn:hover:not(:disabled) {
  background: #1e6cc8;
  box-shadow: 1px 1px 1px 0px #1c5fb8, inset 0px 1px 1px 0px #b8d5ff;
}

.isg-search-section .search-form .search-buttons .action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ISG Tab页签样式 */
.isg-tabs-section {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid rgba(74, 158, 255, 0.3);
}

.isg-tabs-section .isg-tab-item {
  position: relative;
  padding: 0.25rem 0.5rem;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 0.65rem;
  transition: all 0.3s;
  border-bottom: 2px solid transparent;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  white-space: nowrap;
}

.isg-tabs-section .isg-tab-item:hover {
  color: rgba(255, 255, 255, 0.9);
}

.isg-tabs-section .isg-tab-item.isg-tab-active {
  color: #4a9eff;
  border-bottom-color: #4a9eff;
}

.isg-tabs-section .isg-tab-item .isg-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1rem;
  height: 1rem;
  padding: 0 0.15rem;
  background: #ff4d4f;
  color: white;
  border-radius: 50%;
  font-size: 0.6rem;
  font-weight: 500;
  line-height: 1;
}

/* 导出区域 */
.export-section {
  margin-bottom: 1.25rem;
  display: flex;
  justify-content: flex-end;
}

.export-section .export-btn {
  height: 1.6rem;
  padding: 0 0.75rem;
  background: #2873CC;
  box-shadow: 1px 1px 1px 0px #1E6CC8, inset 0px 1px 1px 0px #C5DFFF, 0 0 12px rgba(40, 115, 204, 0.5);
  border-radius: 2px;
  border: 1px solid rgba(74, 158, 255, 0.6);
  color: white;
  font-weight: 600;
  transition: all 0.3s;
  font-size: 0.7rem;
  cursor: pointer;
  white-space: nowrap;
}

.export-section .export-btn:hover:not(:disabled) {
  background: #1E6CC8;
  box-shadow: 1px 1px 1px 0px #1C5FB8, inset 0px 1px 1px 0px #B8D5FF, 0 0 16px rgba(40, 115, 204, 0.7);
  border-color: #4a9eff;
  transform: translateY(-1px);
}

.export-section .export-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: 1px 1px 1px 0px #1E6CC8, inset 0px 1px 1px 0px #C5DFFF;
}

/* 卡片详情弹窗样式 */
.card-detail-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
  margin: 0;
  padding: 0;
  overflow: hidden;
  pointer-events: auto;
  animation: fadeIn 0.3s ease;
}

.card-detail-modal {
  background: url('/dashboard/images/table-bg-lg.png') no-repeat;
  background-size: cover;
  border: 0.125rem solid #4a9eff;
  border-radius: 0.5rem;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0.5rem 2rem rgba(0, 0, 0, 0.3);
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  animation: slideUp 0.3s ease;
}

.card-detail-modal-header {
  position: relative;
  height: 2.2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
  border-bottom: 0.0625rem solid rgba(74, 158, 255, 0.3);
}

.card-detail-modal-header .header-striped-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100%;
}

.card-detail-modal-header .card-detail-modal-title {
  color: white;
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  z-index: 2;
  position: relative;
}

.card-detail-modal-header .card-detail-close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 1.875rem;
  height: 1.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.3s;
  z-index: 2;
  position: relative;
}

.card-detail-modal-header .card-detail-close-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.card-detail-modal-body {
  padding: 1.25rem;
  background: rgba(15, 23, 42, 0.95);
  flex: 1;
  overflow-y: auto;
}

.card-detail-modal-body .card-detail-content {
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
  line-height: 1.8;
  font-family: 'Alibaba PuHuiTi 2.0';
}

.card-detail-modal-body .card-detail-content p {
  margin: 0.75rem 0;
  word-break: break-word;
}

.card-detail-modal-body .card-detail-content p:first-child {
  margin-top: 0;
}

.card-detail-modal-body .card-detail-content p:last-child {
  margin-bottom: 0;
}

.card-detail-modal-body .card-detail-content p.category-title {
  font-size: 1.1em;
  font-weight: bold;
  color: rgba(255, 255, 255, 1);
  margin-top: 1rem;
}

.card-detail-modal-body .card-detail-content p.category-title:first-child {
  margin-top: 0;
}

.card-detail-modal-body .card-detail-content p.empty-content {
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  padding: 2rem 0;
}

/* 自定义滚动条 */
.card-detail-modal-body::-webkit-scrollbar {
  width: 8px;
}

.card-detail-modal-body::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.card-detail-modal-body::-webkit-scrollbar-thumb {
  background: rgba(74, 158, 255, 0.6);
  border-radius: 4px;
}

.card-detail-modal-body::-webkit-scrollbar-thumb:hover {
  background: rgba(74, 158, 255, 0.8);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
