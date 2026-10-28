<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import * as echarts from 'echarts'
import type { EChartsType } from 'echarts'
import {
  queryHeatMap,
  queryInTransitTruckList,
  queryKeyCustList,
  queryMigrationMapRoute,
  queryTop3HotRoute,
  countNotSign,
  exportAbnormalTruck,
  queryWarehouseList,
} from '../../../../services/transportApi'
import chinaGeo from './china.json'

const { t } = useI18n()

// 类型定义
interface MapDataItem {
  name: string
  value: number
  itemStyle?: {
    areaColor: string
  }
}

interface ColorLevel {
  min: number
  max: number
  color: string
  label: string
}

interface ExtendedResizeObserver extends ResizeObserver {
  debounceTimer?: NodeJS.Timeout
}

interface DebounceFunction {
  (): void
  debounceTimer?: NodeJS.Timeout
}

// 时间切换状态
const timeMode = ref<'current' | 'recent30'>('current')

// 存储API返回的热力图数据
const heatMapData = ref<any[]>([])
// 在途车辆数据
const truckData = ref<any[]>([])

// 地图车辆信息定时刷新定时器
let cargoMapRefreshTimer: NodeJS.Timeout | null = null
// 关键客户数据
const customerData = ref<any[]>([])
// 迁移路线数据
const migrationData = ref<any[]>([])
// 仓库数据
const warehouseData = ref<any[]>([])
// TOP3热门线路数据
const top3Data = ref<any[]>([])

// 统计数据
const statisticsData = ref({
  normalVehicles: 0,
  abnormalVehicles: 0,
  unsignedPackages: 0,
})

// 导出异常车辆加载状态
const exportAbnormalLoading = ref(false)

// 当前悬停的图例范围
const hoveredLegendRange = ref<{ min: number; max: number } | null>(null)
// 图例悬停防抖定时器
let legendHoverDebounceTimer: NodeJS.Timeout | null = null

// CDC轮播相关状态
const cdcCarouselData = ref<any[]>([])
const currentCdcIndex = ref(0)
const cdcCarouselTimer = ref<NodeJS.Timeout | null>(null)

// 图层控制状态
const layerVisibility = ref({
  cdcWarehouse: true,
  rdcWarehouse: true,
  trunkVehicles: true,
  deliveryVehicles: true,
  keyCustomers: true,
  transportRoutes: true,
})

// 加载TOP3热门线路数据
const loadTop3Data = async () => {
  try {
    const params = {
      fromWarehouse: [],
      toProvince: [],
      toRdc: [],
    }

    const result = await queryTop3HotRoute(params)

    if (result && result.data && Array.isArray(result.data)) {
      top3Data.value = result.data
    }
  } catch (error) {
    console.error(t('dashboard.cargoMap.messages.loadTop3Failed'), error)
  }
}

// 加载未签收数据
const loadUnsignedPackagesData = async () => {
  try {
    const now = new Date()
    const sixMonthsAgo = new Date(now)
    sixMonthsAgo.setMonth(now.getMonth() - 6)
    sixMonthsAgo.setHours(0, 0, 0, 0)

    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

    const startDate = formatDateTime(sixMonthsAgo)
    const endDate = formatDateTime(endOfToday)

    const params = {
      fromWarehouse: [],
      toProvince: [],
      toRdc: [],
      startDate: startDate,
      endDate: endDate,
    }

    const result = await countNotSign(params)

    if (result && result.data && result.data.notSignCount !== undefined) {
      statisticsData.value.unsignedPackages = result.data.notSignCount || 0
    }
  } catch (error) {
    console.error(t('dashboard.cargoMap.messages.loadUnsignedFailed'), error)
  }
}

// 自定义弹窗状态
const showModal = ref(false)
const modalData = ref<any>(null)

// 弹窗标题
const modalTitle = computed(() => {
  if (!modalData.value) return ''
  if (modalData.value.fromWarehouse) return t('dashboard.cargoMap.modal.titles.route')
  if (modalData.value.licenseNumber) return t('dashboard.cargoMap.modal.titles.vehicle')
  if (modalData.value.warehouseType) return t('dashboard.cargoMap.modal.titles.warehouse')
  return t('dashboard.cargoMap.modal.titles.customer')
})

// 异常车辆水波纹效果
interface RippleItem {
  id: string
  x: number
  y: number
  longitude: number
  latitude: number
}

const rippleItems = ref<RippleItem[]>([])
const rippleUpdateTimer = ref<NodeJS.Timeout | null>(null)

// 更新异常车辆水波纹位置
const updateRipplePositions = (abnormalTrucks: any[]) => {
  if (!chartInstance.value || !abnormalTrucks || abnormalTrucks.length === 0) {
    rippleItems.value = []
    return
  }

  nextTick(() => {
    try {
      const positionThreshold = 5
      const mergeDistance = 30

      const validPositions: Array<{ x: number; y: number; truck: any; id: string }> = []

      abnormalTrucks.forEach((truck: any, index: number) => {
        try {
          const pixel = chartInstance.value?.convertToPixel('geo', [Number(truck.longitude), Number(truck.latitude)])

          if (pixel && pixel.length === 2 && pixel[0] !== undefined && pixel[1] !== undefined && !isNaN(pixel[0]) && !isNaN(pixel[1])) {
            const newX = Number(pixel[0])
            const newY = Number(pixel[1])
            const id = `ripple-${truck.licenseNumber || truck.id || `truck-${index}`}`

            validPositions.push({
              x: newX,
              y: newY,
              truck: truck,
              id: id,
            })
          }
        } catch (e) {
          // 忽略单个车辆转换失败
        }
      })

      const mergedPositions: RippleItem[] = []
      const processed = new Set<string>()

      validPositions.forEach((pos, index) => {
        if (processed.has(pos.id)) return

        const existingItem = rippleItems.value.find((item) => item.id === pos.id)

        if (existingItem) {
          const deltaX = Math.abs(pos.x - existingItem.x)
          const deltaY = Math.abs(pos.y - existingItem.y)

          if (deltaX < positionThreshold && deltaY < positionThreshold) {
            mergedPositions.push(existingItem)
            processed.add(pos.id)
            return
          }
        }

        let mergedX = pos.x
        let mergedY = pos.y
        let mergeCount = 1
        processed.add(pos.id)

        for (let i = index + 1; i < validPositions.length; i++) {
          const otherPos = validPositions[i]
          if (!otherPos || processed.has(otherPos.id)) continue

          const distance = Math.sqrt(Math.pow(otherPos.x - pos.x, 2) + Math.pow(otherPos.y - pos.y, 2))

          if (distance < mergeDistance) {
            mergedX = (mergedX * mergeCount + otherPos.x) / (mergeCount + 1)
            mergedY = (mergedY * mergeCount + otherPos.y) / (mergeCount + 1)
            mergeCount++
            processed.add(otherPos.id)
          }
        }

        mergedPositions.push({
          id: pos.id,
          x: mergedX,
          y: mergedY,
          longitude: pos.truck.longitude,
          latitude: pos.truck.latitude,
        })
      })

      rippleItems.value = mergedPositions
    } catch (error) {
      console.error(t('dashboard.cargoMap.messages.updateRippleFailed'), error)
      rippleItems.value = []
    }
  })
}

// 停止水波纹位置更新
const stopRippleUpdate = () => {
  if (rippleUpdateTimer.value) {
    clearTimeout(rippleUpdateTimer.value)
    rippleUpdateTimer.value = null
  }
}

// 启动水波纹位置更新
const startRippleUpdate = () => {
  stopRippleUpdate()

  const update = () => {
    if (chartInstance.value && (layerVisibility.value.trunkVehicles || layerVisibility.value.deliveryVehicles)) {
      const validTrucks =
        truckData.value?.filter((truck: any) => {
          const lng = truck.longitude
          const lat = truck.latitude
          return (
            lng &&
            lat &&
            lng !== '0.0' &&
            lat !== '0.0' &&
            !isNaN(Number(lng)) &&
            !isNaN(Number(lat)) &&
            Number(lng) !== 0 &&
            Number(lat) !== 0
          )
        }) || []

      const trunkTrucks = validTrucks.filter((truck: any) => truck.transType === 1)
      const deliveryTrucks = validTrucks.filter((truck: any) => truck.transType === 2)

      const visibleTrucks: any[] = []
      if (layerVisibility.value.trunkVehicles) {
        visibleTrucks.push(...trunkTrucks)
      }
      if (layerVisibility.value.deliveryVehicles) {
        visibleTrucks.push(...deliveryTrucks)
      }

      const abnormalTrucks = visibleTrucks.filter((truck: any) => truck.logisticsStatus === 0)
      updateRipplePositions(abnormalTrucks)
    } else {
      rippleItems.value = []
    }
    rippleUpdateTimer.value = setTimeout(update, 500)
  }

  update()
}

// 切换图层显示状态
const toggleLayer = (layerKey: string) => {
  layerVisibility.value[layerKey as keyof typeof layerVisibility.value] =
    !layerVisibility.value[layerKey as keyof typeof layerVisibility.value]

  nextTick(() => {
    if (layerKey === 'cdcWarehouse' || layerKey === 'rdcWarehouse') {
      updateWarehouseImages()
    } else if (layerKey === 'transportRoutes') {
      updateTransportRoutes()
    } else {
      updateOtherLayers()
    }
  })
}

// 更新仓库图片显示
const updateWarehouseImages = () => {
  updateMapWithWarehouses()
}

// 更新线路的显示/隐藏
const updateTransportRoutes = () => {
  if (layerVisibility.value.transportRoutes) {
    if (cdcCarouselData.value.length > 0) {
      startCdcCarousel()
    } else {
      prepareCdcCarouselData()
      startCdcCarousel()
    }
  } else {
    stopCdcCarousel()
    updateMapWithMigration()
  }
}

// 更新其他图层的显示/隐藏
const updateOtherLayers = () => {
  if (!chartInstance.value) return

  const currentOption = chartInstance.value.getOption()
  const series = Array.isArray(currentOption.series) ? currentOption.series : []

  const updatedSeries = series.map((s: any) => {
    if (s.name === '干线车辆') {
      if (s.data && Array.isArray(s.data)) {
        s.data = layerVisibility.value.trunkVehicles ? s.data : []
      }
    } else if (s.name === '配送车辆') {
      if (s.data && Array.isArray(s.data)) {
        s.data = layerVisibility.value.deliveryVehicles ? s.data : []
      }
    } else if (s.name === '重点客户') {
      if (s.data && Array.isArray(s.data)) {
        s.data = layerVisibility.value.keyCustomers ? s.data : []
      }
    }
    return s
  })

  chartInstance.value.setOption(
    {
      series: updatedSeries,
    },
    false,
  )

  setTimeout(() => {
    if (chartInstance.value) {
      chartInstance.value.dispatchAction({
        type: 'updateAxisPointer',
        currTrigger: 'mousemove',
      })
    }
  }, 10)

  if (layerVisibility.value.trunkVehicles || layerVisibility.value.deliveryVehicles) {
    const validTrucks = truckData.value.filter((truck: any) => {
      const lng = truck.longitude
      const lat = truck.latitude
      return (
        lng &&
        lat &&
        lng !== '0.0' &&
        lat !== '0.0' &&
        !isNaN(Number(lng)) &&
        !isNaN(Number(lat)) &&
        Number(lng) !== 0 &&
        Number(lat) !== 0
      )
    })

    const trunkTrucks = validTrucks.filter((truck: any) => truck.transType === 1)
    const deliveryTrucks = validTrucks.filter((truck: any) => truck.transType === 2)

    const visibleTrucks: any[] = []
    if (layerVisibility.value.trunkVehicles) {
      visibleTrucks.push(...trunkTrucks)
    }
    if (layerVisibility.value.deliveryVehicles) {
      visibleTrucks.push(...deliveryTrucks)
    }

    const abnormalTrucks = visibleTrucks.filter((truck: any) => truck.logisticsStatus === 0)
    updateRipplePositions(abnormalTrucks)
  } else {
    rippleItems.value = []
  }

  if ((layerVisibility.value.trunkVehicles || layerVisibility.value.deliveryVehicles) && truckData.value.length > 0) {
    updateMapWithTrucks()
  }

  if (layerVisibility.value.keyCustomers && customerData.value.length > 0) {
    updateMapWithCustomers()
  }
}

// 关闭弹窗
const closeModal = () => {
  showModal.value = false
  modalData.value = null

  setTimeout(() => {
    const modalOverlay = document.querySelector('.custom-modal-overlay') as HTMLElement
    if (modalOverlay && modalOverlay.parentNode) {
      if (modalOverlay.parentNode === document.body) {
        document.body.removeChild(modalOverlay)
      }
    }
  }, 100)
}

// 格式化日期为 "YYYY-MM-DD HH:mm:ss" 格式
const formatDateTime = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// 计算时间范围
const getTimeRange = () => {
  const now = new Date()

  if (timeMode.value === 'current') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    return {
      startDate: formatDateTime(startOfMonth),
      endDate: formatDateTime(endOfToday),
    }
  } else {
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(now.getDate() - 30)
    thirtyDaysAgo.setHours(0, 0, 0, 0)

    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    return {
      startDate: formatDateTime(thirtyDaysAgo),
      endDate: formatDateTime(endOfToday),
    }
  }
}

// 切换时间模式
const switchTimeMode = (mode: 'current' | 'recent30') => {
  timeMode.value = mode
  loadMapData()
  loadMigrationData()
}

// 加载地图数据
const loadMapData = async () => {
  const { startDate, endDate } = getTimeRange()
  try {
    const result = await queryHeatMap(startDate, endDate)
    updateMapData(result)
  } catch (error) {
    console.error('Failed to load map data:', error)
    updateMapData(null)
  }
}

// 加载在途车辆数据
const loadTruckData = async () => {
  try {
    const result = await queryInTransitTruckList()

    if (result && result.data && Array.isArray(result.data)) {
      truckData.value = result.data
      updateMapWithTrucks()
      calculateVehicleStatistics()
    }
  } catch (error) {
    console.error(t('dashboard.cargoMap.messages.loadTruckDataFailed'), error)
  }
}

// 计算车辆统计数据
const calculateVehicleStatistics = () => {
  if (!truckData.value || truckData.value.length === 0) {
    statisticsData.value.normalVehicles = 0
    statisticsData.value.abnormalVehicles = 0
    return
  }

  const normalCount = truckData.value.filter((truck: any) => truck.logisticsStatus === 1).length
  const abnormalCount = truckData.value.filter((truck: any) => truck.logisticsStatus === 0).length

  statisticsData.value.normalVehicles = normalCount
  statisticsData.value.abnormalVehicles = abnormalCount
}

// 加载关键客户数据
const loadCustomerData = async () => {
  try {
    const result = await queryKeyCustList()

    if (result && result.data && Array.isArray(result.data)) {
      customerData.value = result.data
      updateMapWithCustomers()
    }
  } catch (error) {
    console.error(t('dashboard.cargoMap.messages.loadCustomerDataFailed'), error)
  }
}

// 加载仓库数据
const loadWarehouseData = async () => {
  try {
    const result = await queryWarehouseList()

    if (result && result.data && Array.isArray(result.data)) {
      const filteredWarehouses = result.data.filter((warehouse: any) =>
        warehouse.warehouseLatitude !== null &&
        warehouse.warehouseLongitude !== null &&
        warehouse.warehouseLatitude !== undefined &&
        warehouse.warehouseLongitude !== undefined
      )

      warehouseData.value = filteredWarehouses
      updateMapWithWarehouses()
    }
  } catch (error) {
    console.error(t('dashboard.cargoMap.messages.loadWarehouseDataFailed'), error)
  }
}

// 加载迁移路线数据
const loadMigrationData = async () => {
  try {
    const { startDate, endDate } = getTimeRange()
    const result = await queryMigrationMapRoute(startDate, endDate)

    if (result && result.data && Array.isArray(result.data)) {
      migrationData.value = result.data
      updateMapWithMigration()
    }
  } catch (error) {
    console.error(t('dashboard.cargoMap.messages.loadMigrationFailed'), error)
  }
}

// 更新地图显示车辆位置
const updateMapWithTrucks = (animated = true) => {
  if (!chartInstance.value || !truckData.value || truckData.value.length === 0) return

  const currentOption = chartInstance.value.getOption()

  const validTrucks = truckData.value.filter((truck: any) => {
    const lng = truck.longitude
    const lat = truck.latitude
    return (
      lng &&
      lat &&
      lng !== '0.0' &&
      lat !== '0.0' &&
      !isNaN(Number(lng)) &&
      !isNaN(Number(lat)) &&
      Number(lng) !== 0 &&
      Number(lat) !== 0
    )
  })

  if (validTrucks.length === 0) {
    return
  }

  const trunkTrucks = validTrucks.filter((truck: any) => truck.transType === 1)
  const deliveryTrucks = validTrucks.filter((truck: any) => truck.transType === 2)

  const seriesToAdd: any[] = []

  if (trunkTrucks.length > 0 && layerVisibility.value.trunkVehicles) {
    const trunkSeries = {
      name: '干线车辆',
      type: 'scatter',
      coordinateSystem: 'geo',
      data: trunkTrucks.map((truck: any) => {
        const isAbnormal = truck.logisticsStatus === 0
        const carIcon = isAbnormal ? 'mapcar1-warning.png' : 'map-car1.png'

        return {
          name: truck.licenseNumber || '干线车辆',
          value: [Number(truck.longitude), Number(truck.latitude)],
          itemStyle: {
            color: isAbnormal ? '#ff4d4f' : '#3b82f6',
          },
          symbol: `image:///dashboard/images/${carIcon}`,
          symbolSize: [28, 28],
          symbolKeepAspect: true,
          symbolOffset: [0, 0],
          symbolRotate: 0,
          label: {
            show: false,
          },
          emphasis: {
            itemStyle: {
              borderColor: '#fff',
              borderWidth: 2,
            },
          },
          tooltip: {
            show: false,
          },
        }
      }),
      zlevel: 15,
      z: 15,
    }
    seriesToAdd.push(trunkSeries)
  }

  if (deliveryTrucks.length > 0 && layerVisibility.value.deliveryVehicles) {
    const deliverySeries = {
      name: '配送车辆',
      type: 'scatter',
      coordinateSystem: 'geo',
      data: deliveryTrucks.map((truck: any) => {
        const isAbnormal = truck.logisticsStatus === 0
        const carIcon = isAbnormal ? 'mapcar2-warning.png' : 'map-car2.png'

        return {
          name: truck.licenseNumber || '配送车辆',
          value: [Number(truck.longitude), Number(truck.latitude)],
          itemStyle: {
            color: isAbnormal ? '#ff4d4f' : '#f59e0b',
          },
          symbol: `image:///dashboard/images/${carIcon}`,
          symbolSize: [28, 28],
          symbolKeepAspect: true,
          symbolOffset: [0, 0],
          symbolRotate: 0,
          label: {
            show: false,
          },
          emphasis: {
            itemStyle: {
              borderColor: '#fff',
              borderWidth: 2,
            },
          },
          tooltip: {
            show: false,
          },
        }
      }),
      zlevel: 15,
      z: 15,
    }
    seriesToAdd.push(deliverySeries)
  }

  if (layerVisibility.value.trunkVehicles || layerVisibility.value.deliveryVehicles) {
    const visibleTrucks: any[] = []
    if (layerVisibility.value.trunkVehicles) {
      visibleTrucks.push(...trunkTrucks)
    }
    if (layerVisibility.value.deliveryVehicles) {
      visibleTrucks.push(...deliveryTrucks)
    }
    const abnormalTrucks = visibleTrucks.filter((truck: any) => truck.logisticsStatus === 0)
    updateRipplePositions(abnormalTrucks)
  } else {
    rippleItems.value = []
  }

  const existingSeries = Array.isArray(currentOption.series)
    ? currentOption.series.filter(
        (s: any) =>
          s.name !== '车辆数据' &&
          s.name !== '干线车辆' &&
          s.name !== '配送车辆' &&
          s.name !== '异常车辆水波纹',
      )
    : []

  const newOption = {
    ...currentOption,
    series: [...existingSeries, ...seriesToAdd],
  }

  chartInstance.value.setOption(newOption, animated)

  setupClickEventListeners()
  startRippleUpdate()
}

// 显示弹窗的公共函数
const showModalWithData = (data: any) => {
  modalData.value = data
  showModal.value = true

  nextTick(() => {
    setTimeout(() => {
      const modalOverlay = document.querySelector('.custom-modal-overlay') as HTMLElement
      const modal = document.querySelector('.custom-modal') as HTMLElement

      if (modalOverlay) {
        if (modalOverlay.parentNode !== document.body) {
          document.body.appendChild(modalOverlay)
        }

        modalOverlay.style.zIndex = '2147483647'
        modalOverlay.style.position = 'fixed'
        modalOverlay.style.top = '0'
        modalOverlay.style.left = '0'
        modalOverlay.style.width = '100vw'
        modalOverlay.style.height = '100vh'
        modalOverlay.style.display = 'flex'
        modalOverlay.style.alignItems = 'center'
        modalOverlay.style.justifyContent = 'center'
        modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
        modalOverlay.style.pointerEvents = 'auto'
      }

      if (modal) {
        modal.style.zIndex = '2147483647'
        modal.style.position = 'relative'
      }
    }, 10)
  })
}

// 设置点击事件监听器
const setupClickEventListeners = () => {
  if (!chartInstance.value) return

  chartInstance.value.off('click')
  chartInstance.value.on('click', (params: any) => {
    if ((params.seriesName === '干线车辆' || params.seriesName === '配送车辆') && params.data) {
      const truck = truckData.value.find((t: any) => {
        return Number(t.longitude) === params.data.value[0] && Number(t.latitude) === params.data.value[1]
      })

      if (truck) {
        showModalWithData(truck)
        return
      }
    } else if (params.seriesName === '仓库数据' && params.data) {
      const warehouse = warehouseData.value.find((w: any) => {
        return (
          Number(w.warehouseLongitude) === params.data.value[0] &&
          Number(w.warehouseLatitude) === params.data.value[1]
        )
      })

      if (warehouse) {
        showModalWithData(warehouse)
        return
      }
    } else if (params.seriesName && params.seriesName.startsWith('迁徙路线') && params.data) {
      const seriesNameParts = params.seriesName.split('_')
      if (seriesNameParts.length >= 4) {
        const fromWarehouse = seriesNameParts[1] || '未知仓库'
        const toProvince = seriesNameParts[2] || '未知省份'
        const routeType = seriesNameParts[3] || '1'

        const route = migrationData.value.find(
          (r: any) =>
            (r.fromWarehouse || '未知仓库') === fromWarehouse &&
            (r.toProvince || '未知省份') === toProvince &&
            (r.routeType || 1).toString() === routeType,
        )

        if (route) {
          showModalWithData(route)
        }
      }
    }
  })
}

// 更新地图显示仓库位置
const updateMapWithWarehouses = () => {
  if (!chartInstance.value || !warehouseData.value || warehouseData.value.length === 0) return

  const currentOption = chartInstance.value.getOption()

  const validWarehouses = warehouseData.value.filter((warehouse: any) => {
    const lng = warehouse.warehouseLongitude
    const lat = warehouse.warehouseLatitude
    const isValidCoord =
      lng &&
      lat &&
      lng !== '0.0' &&
      lat !== '0.0' &&
      !isNaN(Number(lng)) &&
      !isNaN(Number(lat)) &&
      Number(lng) !== 0 &&
      Number(lat) !== 0

    if (!isValidCoord) return false

    const isCDC = warehouse.warehouseType === 1
    const shouldShow =
      (isCDC && layerVisibility.value.cdcWarehouse) || (!isCDC && layerVisibility.value.rdcWarehouse)
    return shouldShow
  })

  const existingSeries = Array.isArray(currentOption.series)
    ? currentOption.series.filter((s: any) => s.name !== '仓库数据')
    : []

  let newSeries
  if (validWarehouses.length === 0) {
    newSeries = existingSeries
  } else {
    const warehouseSeries = {
      name: '仓库数据',
      type: 'scatter',
      coordinateSystem: 'geo',
      data: validWarehouses.map((warehouse: any) => {
        const isCDC = warehouse.warehouseType === 1
        return {
          value: [Number(warehouse.warehouseLongitude), Number(warehouse.warehouseLatitude)],
          itemStyle: {
            color: isCDC ? '#4DD0E1' : '#9575CD',
          },
          symbol: `image:///dashboard/images/${isCDC ? 'CDC1.png' : 'RDC1.png'}`,
          symbolSize: isCDC ? [18, 18] : [30, 30],
          symbolKeepAspect: true,
          symbolBoundingData: [28, 28],
          symbolOffset: [0, 0],
          symbolRotate: 0,
        }
      }),
      tooltip: {
        show: false,
      },
      zlevel: 10,
      z: 10,
    }

    newSeries = [...existingSeries, warehouseSeries]
  }

  chartInstance.value.setOption(
    {
      ...currentOption,
      series: newSeries,
    },
    true,
  )

  setupClickEventListeners()
}

// 更新地图显示客户位置
const updateMapWithCustomers = (animated = true) => {
  if (!chartInstance.value || !customerData.value || customerData.value.length === 0) {
    return
  }

  const currentOption = chartInstance.value.getOption()

  const validCustomers = customerData.value.filter((customer: any) => {
    const lng = customer.longitude
    const lat = customer.latitude
    const isValid =
      lng &&
      lat &&
      lng !== '0.0' &&
      lat !== '0.0' &&
      !isNaN(Number(lng)) &&
      !isNaN(Number(lat)) &&
      Number(lng) !== 0 &&
      Number(lat) !== 0

    return isValid
  })

  if (validCustomers.length === 0) {
    return
  }

  const customerScatterSeries = {
    name: '重点客户',
    type: 'scatter',
    coordinateSystem: 'geo',
    data: validCustomers.map((customer: any) => {
      return {
        name: customer.custName || customer.customerName || '客户',
        value: [Number(customer.longitude), Number(customer.latitude)],
        itemStyle: {
          color: '#10b981',
        },
        symbol: 'image:///dashboard/images/customer1.png',
        symbolSize: [28, 28],
        symbolOffset: [0, 0],
        symbolKeepAspect: true,
        symbolBoundingData: [28, 28],
        symbolRotate: 0,
        label: {
          show: false,
        },
        emphasis: {
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 2,
          },
        },
        tooltip: {
          formatter: (params: any) => {
            const customer = validCustomers.find((c: any) => {
              return Number(c.longitude) === params.value[0] && Number(c.latitude) === params.value[1]
            })

            if (!customer) return t('dashboard.cargoMap.tooltip.customerInfoUnknown')

            return t('dashboard.cargoMap.tooltip.customerNameLabel', { name: customer.custName || customer.customerName || t('dashboard.cargoMap.messages.unknownWarehouse') })
          },
        },
      }
    }),
    zlevel: 15,
    z: 15,
  }

  const existingSeries = Array.isArray(currentOption.series)
    ? currentOption.series.filter((s: any) => s.name !== '重点客户')
    : []

  const newOption = {
    ...currentOption,
    series: [...existingSeries, customerScatterSeries],
  }

  chartInstance.value.setOption(newOption, animated)

  setTimeout(() => {
    if (chartInstance.value) {
      chartInstance.value.dispatchAction({
        type: 'updateAxisPointer',
        currTrigger: 'mousemove',
      })
    }
  }, 10)
}

// 准备CDC轮播数据
const prepareCdcCarouselData = () => {
  if (!migrationData.value || migrationData.value.length === 0) {
    return
  }

  const fixedWarehouseOrder = [
    { name: '东莞道滘CDC', type: 1 },
    { name: '合肥CDC', type: 1 },
    { name: '武汉CDC', type: 1 },
    { name: '苏州吴江CDC', type: 1 },
    { name: '天津宁河CDC', type: 1 },
    { name: '重庆渝北CDC', type: 1 },
    { name: '天津CDC', type: 1 },
  ]

  const warehouseGroups: { [key: string]: any[] } = {}

  migrationData.value.forEach((route: any) => {
    const fromWarehouse = route.fromWarehouse || '未知仓库'
    const warehouseType = route.warehouseType || 1

    const key = `${fromWarehouse}_${warehouseType}`

    if (!warehouseGroups[key]) {
      warehouseGroups[key] = []
    }
    warehouseGroups[key].push(route)
  })

  const orderedWarehouses: Array<{ cdcName: string; warehouseType: number; routes: any[] }> = []

  fixedWarehouseOrder.forEach((fixedWarehouse) => {
    const fixedName = fixedWarehouse.name
    const fixedType = fixedWarehouse.type

    const exactKey = `${fixedName}_${fixedType}`

    if (warehouseGroups[exactKey] && warehouseGroups[exactKey].length > 0) {
      orderedWarehouses.push({
        cdcName: fixedName,
        warehouseType: fixedType,
        routes: warehouseGroups[exactKey] || [],
      })
    } else {
      const normalizedFixedName = fixedName.trim().toUpperCase()
      const matchedKey = Object.keys(warehouseGroups).find((key) => {
        const parts = key.split('_')
        const dataName = parts[0]
        const dataType = parts[1]

        if (!dataName || !dataType) {
          return false
        }

        const normalizedDataName = dataName.trim().toUpperCase()

        if (dataType !== String(fixedType)) {
          return false
        }

        return (
          normalizedDataName === normalizedFixedName ||
          normalizedDataName.includes(normalizedFixedName) ||
          normalizedFixedName.includes(normalizedDataName)
        )
      })

      if (matchedKey && warehouseGroups[matchedKey] && warehouseGroups[matchedKey].length > 0) {
        orderedWarehouses.push({
          cdcName: fixedName,
          warehouseType: fixedType,
          routes: warehouseGroups[matchedKey] || [],
        })
      }
    }
  })

  cdcCarouselData.value = orderedWarehouses
}

// 启动CDC轮播
const startCdcCarousel = () => {
  if (cdcCarouselData.value.length === 0) {
    return
  }

  const validCdcs = cdcCarouselData.value.filter((cdc) => cdc.routes.length > 0)

  if (validCdcs.length === 0) {
    return
  }

  if (cdcCarouselTimer.value) {
    clearInterval(cdcCarouselTimer.value)
  }

  currentCdcIndex.value = 0

  showCurrentCdc()

  cdcCarouselTimer.value = setInterval(() => {
    const currentValidCdcs = cdcCarouselData.value.filter((cdc) => cdc.routes.length > 0)
    if (currentValidCdcs.length === 0) {
      stopCdcCarousel()
      return
    }

    currentCdcIndex.value = (currentCdcIndex.value + 1) % currentValidCdcs.length
    showCurrentCdc()
  }, 5000)
}

// 显示当前CDC的线路
const showCurrentCdc = () => {
  if (cdcCarouselData.value.length === 0) {
    return
  }

  const validCdcs = cdcCarouselData.value.filter((cdc) => cdc.routes.length > 0)

  if (validCdcs.length === 0) {
    return
  }

  const currentCdc = validCdcs[currentCdcIndex.value]

  updateMapWithMigration(currentCdc.cdcName, currentCdc.warehouseType)
}

// 停止CDC轮播
const stopCdcCarousel = () => {
  if (cdcCarouselTimer.value) {
    clearInterval(cdcCarouselTimer.value)
    cdcCarouselTimer.value = null
  }
}

// 更新地图显示迁移路线
const updateMapWithMigration = (showSpecificCdc?: string, showSpecificWarehouseType?: number) => {
  if (!chartInstance.value || !migrationData.value || migrationData.value.length === 0) {
    return
  }

  const routeSeries: any[] = []

  migrationData.value.forEach((route: any) => {
    const fromLng = route.fromWarehouseLongitude
    const fromLat = route.fromWarehouseLatitude
    const toLng = route.toProvinceLongitude
    const toLat = route.toProvinceLatitude

    if (
      fromLng !== null &&
      fromLat !== null &&
      toLng !== null &&
      toLat !== null &&
      fromLng !== undefined &&
      fromLat !== undefined &&
      toLng !== undefined &&
      toLat !== undefined &&
      fromLng !== '' &&
      fromLat !== '' &&
      toLng !== '' &&
      toLat !== '' &&
      fromLng !== '0.0' &&
      fromLat !== '0.0' &&
      toLng !== '0.0' &&
      toLat !== '0.0' &&
      !isNaN(Number(fromLng)) &&
      !isNaN(Number(fromLat)) &&
      !isNaN(Number(toLng)) &&
      !isNaN(Number(toLat))
    ) {
      const warehouseType = route.warehouseType || 1
      const fromWarehouse = route.fromWarehouse || '未知仓库'
      const toProvince = route.toProvince || '未知省份'
      const routeType = route.routeType || 1
      const totalVolume = route.totalVolume || 0

      if (!layerVisibility.value.transportRoutes && !showSpecificCdc) {
        if (warehouseType !== 1) {
          return
        }
        return
      }

      if (showSpecificCdc) {
        if (showSpecificWarehouseType !== undefined && warehouseType !== showSpecificWarehouseType) {
          return
        }

        const normalizedShowName = showSpecificCdc.trim().toUpperCase()
        const normalizedFromWarehouse = fromWarehouse.trim().toUpperCase()

        const isMatch =
          normalizedFromWarehouse === normalizedShowName ||
          normalizedFromWarehouse.includes(normalizedShowName) ||
          normalizedShowName.includes(normalizedFromWarehouse)

        if (!isMatch) {
          return
        }
      } else {
        if (warehouseType !== 1) {
          return
        }

        return
      }

      const symbolColor = '#4a9eff'

      let endLng = Number(toLng)
      let endLat = Number(toLat)

      if (Number(fromLng) === endLng && Number(fromLat) === endLat) {
        endLng += 0.01
        endLat += 0.01
      }

      let routeStyle: any = {
        name: `迁徙路线${fromWarehouse}_${toProvince}_${routeType}`,
        type: 'lines',
        coordinateSystem: 'geo',
        data: [
          {
            coords: [
              [Number(fromLng), Number(fromLat)],
              [endLng, endLat],
            ],
            lineStyle: {
              color: symbolColor,
              width: Math.max(2, Math.min(8, totalVolume / 10000)),
              curveness: 0.4,
              shadowColor: symbolColor,
              shadowBlur: 15,
              shadowOffsetX: 0,
              shadowOffsetY: 0,
              opacity: 0.8,
            },
          },
        ],
        zlevel: 2,
      }

      const shouldShowEffect = layerVisibility.value.transportRoutes

      if (shouldShowEffect) {
        if (routeType === 1) {
          const planeIcon = 'plane.png'
          routeStyle.effect = {
            show: true,
            period: 6,
            trailLength: 0,
            symbol: `image:///dashboard/images/${planeIcon}`,
            symbolSize: 20,
            shadowColor: symbolColor,
            shadowBlur: 8,
          }
        } else if (routeType === 2) {
          routeStyle.effect = {
            show: true,
            period: 4,
            trailLength: 0,
            symbol: 'circle',
            symbolSize: 8,
            color: symbolColor,
            shadowColor: symbolColor,
            shadowBlur: 10,
          }
        } else if (routeType === 3) {
          routeStyle.effect = {
            show: true,
            period: 3,
            trailLength: 0,
            symbol: 'triangle',
            symbolSize: 12,
            color: symbolColor,
            shadowColor: symbolColor,
            shadowBlur: 10,
          }
        }
      } else {
        routeStyle.effect = null
      }

      routeSeries.push(routeStyle)
    }
  })

  const currentOption = chartInstance.value.getOption()

  const existingSeries = Array.isArray(currentOption.series)
    ? currentOption.series.filter(
        (s: any) => s.type !== 'lines' || !s.name.startsWith('迁徙路线'),
      )
    : []

  const newOption = {
    ...currentOption,
    series: [...existingSeries, ...routeSeries],
  }

  chartInstance.value.setOption(newOption, true)

  setTimeout(() => {
    if (chartInstance.value) {
      chartInstance.value.dispatchAction({
        type: 'updateAxisPointer',
        currTrigger: 'mousemove',
      })
    }
  }, 10)

  setupClickEventListeners()
}

// 更新地图数据
const updateMapData = (data: any) => {
  if (data && data.data && Array.isArray(data.data)) {
    heatMapData.value = data.data
  } else if (data && Array.isArray(data)) {
    heatMapData.value = data
  } else {
    heatMapData.value = []
  }

  if (chartInstance.value) {
    try {
      const currentOption = chartInstance.value.getOption()
      const series = Array.isArray(currentOption.series) ? currentOption.series : []
      const newOption = {
        ...currentOption,
        series: series.map((series: any) => {
          if (series.name === '货量数据') {
            return {
              ...series,
              data: getMapData(),
            }
          }
          return series
        }),
      }
      chartInstance.value.setOption(newOption, false)
    } catch (error) {
      console.error('Failed to update chart:', error)
    }
  }
}

// 处理图例悬停
const handleLegendHover = (min: number, max: number) => {
  if (legendHoverDebounceTimer) {
    clearTimeout(legendHoverDebounceTimer)
    legendHoverDebounceTimer = null
  }

  hoveredLegendRange.value = { min, max }

  legendHoverDebounceTimer = setTimeout(() => {
    updateMapHighlight()
    legendHoverDebounceTimer = null
  }, 300)
}

// 更新地图高亮
const updateMapHighlight = () => {
  if (!chartInstance.value) return

  try {
    const mapData = getMapData()
    const highlightedProvinces = mapData
      .filter((item: any) => item.itemStyle?.borderWidth === 3)
      .map((item: any) => item.name)

    chartInstance.value.dispatchAction({
      type: 'downplay',
      seriesIndex: 0,
    })

    chartInstance.value.setOption(
      {
        series: [
          {
            name: '货量数据',
            data: mapData,
          },
        ],
      },
      false,
    )

    if (highlightedProvinces.length > 0) {
      setTimeout(() => {
        highlightedProvinces.forEach((provinceName: string) => {
          chartInstance.value?.dispatchAction({
            type: 'highlight',
            seriesIndex: 0,
            name: provinceName,
          })
        })
      }, 50)
    }
  } catch (error) {
    console.error('Failed to update map highlight:', error)
  }
}

// 处理图例移出
const handleLegendLeave = () => {
  if (legendHoverDebounceTimer) {
    clearTimeout(legendHoverDebounceTimer)
    legendHoverDebounceTimer = null
  }

  hoveredLegendRange.value = null
  updateMapHighlight()
}

// 组件状态
const mapContainer = ref<HTMLDivElement | null>(null)
const chartInstance = ref<EChartsType | null>(null)
let resizeObserver: ExtendedResizeObserver | null = null

// 初始化地图
const initMap = () => {
  if (!mapContainer.value) return

  const rect = mapContainer.value.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    setTimeout(() => {
      initMap()
    }, 100)
    return
  }

  chartInstance.value = echarts.init(mapContainer.value)

  echarts.registerMap('china', chinaGeo as any)

  chartInstance.value?.setOption(getChartOption())

  chartInstance.value?.off('click')
  chartInstance.value?.off('mousedown')
  chartInstance.value?.off('mouseup')

  setTimeout(() => {
    const canvas = mapContainer.value?.querySelector('canvas')
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.arc = function (..._args: any[]) {
          return
        }
      }
    }
  }, 10)

  setTimeout(() => {
    chartInstance.value?.resize()
  }, 100)

  window.addEventListener('resize', handleResize)

  if (window.ResizeObserver) {
    resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          clearTimeout(resizeObserver?.debounceTimer)
          if (resizeObserver) {
            resizeObserver.debounceTimer = setTimeout(() => {
              try {
                chartInstance.value?.resize()
              } catch (error) {
                console.warn(t('dashboard.cargoMap.messages.resizeObserverFailed'), error)
              }
            }, 100)
          }
        }
      }
    })
    resizeObserver.observe(mapContainer.value)
  }
}

// 定义8个蓝色等级
const colorLevels: ColorLevel[] = [
  { min: 6000, max: Infinity, color: '#1e3a8a', label: '6000以上' },
  { min: 4000, max: 5999.99, color: '#2563eb', label: '4000-6000' },
  { min: 3000, max: 3999.99, color: '#3b82f6', label: '3000-4000' },
  { min: 2000, max: 2999.99, color: '#60a5fa', label: '2000-3000' },
  { min: 1000, max: 1999.99, color: '#93c5fd', label: '1000-2000' },
  { min: 500, max: 999.99, color: '#bfdbfe', label: '500-1000' },
  { min: 200, max: 499.99, color: '#dbeafe', label: '200-500' },
  { min: 0.01, max: 199.99, color: '#f0f9ff', label: '200以下' },
]

// 根据数值获取对应颜色
const getColorByValue = (value: number): string => {
  for (let level of colorLevels) {
    if (value >= level.min && value <= level.max) {
      return level.color
    }
  }
  return '#e5e7eb'
}

// 生成地图数据
const getMapData = (): MapDataItem[] => {
  const allProvinces = [
    '北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江',
    '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南',
    '湖北', '湖南', '广东', '广西', '海南', '重庆', '四川', '贵州',
    '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆',
  ]

  const provinceDataMap = new Map()

  if (heatMapData.value && Array.isArray(heatMapData.value) && heatMapData.value.length > 0) {
    heatMapData.value.forEach((item: any) => {
      if (item && typeof item === 'object' && item.provinceName && item.totalVolume !== undefined && item.totalVolume !== null) {
        const volume = Math.round(Number(item.totalVolume) * 100) / 100 || 0
        provinceDataMap.set(item.provinceName, volume)
      }
    })
  }

  const provinces = allProvinces.map((provinceName) => {
    const value = provinceDataMap.get(provinceName)

    if (value !== undefined && value !== null && value > 0) {
      const color = getColorByValue(value)

      const isInHoveredRange =
        hoveredLegendRange.value &&
        value >= hoveredLegendRange.value.min &&
        (hoveredLegendRange.value.max === Infinity ? true : value <= hoveredLegendRange.value.max)

      const itemStyle: any = {
        areaColor: isInHoveredRange ? 'rgba(74, 158, 255, 0.5)' : color,
        borderColor: isInHoveredRange ? '#4a9eff' : '#999',
        borderWidth: isInHoveredRange ? 3 : 1,
      }

      if (isInHoveredRange) {
        itemStyle.shadowBlur = 15
        itemStyle.shadowColor = 'rgba(74, 158, 255, 0.6)'
        itemStyle.shadowOffsetX = 0
        itemStyle.shadowOffsetY = 0
      }

      return {
        name: provinceName,
        value: value,
        itemStyle: itemStyle,
      }
    } else {
      return {
        name: provinceName,
        value: 0,
        itemStyle: { areaColor: '#ffffff' },
      }
    }
  })

  return provinces
}

// 获取图表配置项
const getChartOption = () => {
  return {
    tooltip: {
      show: true,
      formatter: function (params: any) {
        if (params.seriesType === 'map') {
          const value = params.value || 0

          if (value === 0 && params.data?.itemStyle?.areaColor === '#ffffff') {
            return `${params.name}<br/>${t('dashboard.cargoMap.tooltip.noData')}`
          }

          const formattedValue = value.toFixed(2)
          return `${params.name}<br/>${t('dashboard.cargoMap.tooltip.volumeLabel', { value: formattedValue })}`
        }
        return `${params.name}`
      },
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: '#ccc',
      textStyle: {
        color: '#fff',
      },
    },
    xAxis: {
      show: false,
    },
    yAxis: {
      show: false,
    },
    visualMap: {
      show: false,
      type: 'piecewise',
      orient: 'vertical',
      right: 20,
      top: 'center',
      min: 0,
      max: 15000,
      pieces: [
        ...colorLevels.map((level) => ({
          min: level.min,
          max: level.max,
          color: level.color,
          label: level.label,
        })),
        {
          min: 0,
          max: 0,
          color: '#ffffff',
          label: t('dashboard.cargoMap.tooltip.noData'),
        },
      ],
      textStyle: {
        color: '#fff',
        fontSize: 12,
      },
      itemWidth: 20,
      itemHeight: 14,
    },
    geo: {
      map: 'china',
      roam: true,
      zoom: 1.2,
      center: [105, 36],
      label: {
        show: false,
      },
      itemStyle: {
        borderColor: '#999',
        borderWidth: 1,
      },
      emphasis: {
        disabled: false,
        itemStyle: {
          borderColor: '#4a9eff',
          borderWidth: 3,
          areaColor: 'rgba(74, 158, 255, 0.3)',
          shadowBlur: 15,
          shadowColor: 'rgba(74, 158, 255, 0.6)',
          shadowOffsetX: 0,
          shadowOffsetY: 0,
        },
        label: {
          show: false,
        },
      },
      select: {
        disabled: true,
      },
      silent: false,
      animation: false,
    },
    series: [
      {
        name: '货量数据',
        type: 'map',
        map: 'china',
        data: getMapData(),
        geoIndex: 0,
        label: {
          show: false,
        },
        emphasis: {
          disabled: false,
          itemStyle: {
            borderColor: '#4a9eff',
            borderWidth: 3,
            areaColor: 'rgba(74, 158, 255, 0.3)',
            shadowBlur: 15,
            shadowColor: 'rgba(74, 158, 255, 0.6)',
            shadowOffsetX: 0,
            shadowOffsetY: 0,
          },
          label: {
            show: false,
          },
        },
        select: {
          disabled: true,
        },
      },
    ],
  }
}

// 处理窗口大小变化
const handleResize: DebounceFunction = () => {
  if (!mapContainer.value || !chartInstance.value) return

  const rect = mapContainer.value.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    setTimeout(() => {
      handleResize()
    }, 100)
    return
  }

  clearTimeout(handleResize.debounceTimer)
  handleResize.debounceTimer = setTimeout(() => {
    try {
      chartInstance.value?.resize()
    } catch (error) {
      console.warn(t('dashboard.cargoMap.messages.resizeFailed'), error)
    }
  }, 100)
}

// 导出异常车辆
const handleExportAbnormalTruck = () => {
  if (!confirm(t('dashboard.cargoMap.transport.exportConfirm'))) {
    return
  }

  ;(async () => {
    try {
      exportAbnormalLoading.value = true
      const result = await exportAbnormalTruck({})

      if (result.code === 409 || result.code === 504 || result.code === 505) {
        alert(result.msg || t('dashboard.cargoMap.transport.exportTooLarge'))
        return
      }

      if (result && result.data && result.data.downloadUrl) {
        window.open(result.data.downloadUrl, '_blank')
        alert(t('dashboard.cargoMap.transport.exportSuccess'))
      } else if (result && result.data) {
        const url = result.data
        const link = document.createElement('a')
        link.href = url
        link.download = `${t('dashboard.cargoMap.transport.exportFileNamePrefix')}_${new Date().getTime()}.xlsx`
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        alert(t('dashboard.cargoMap.transport.exportSuccess'))
      } else {
        alert(result?.msg || t('dashboard.cargoMap.transport.exportFailed'))
      }
    } catch (error: any) {
      console.error(t('dashboard.cargoMap.messages.loadTruckDataFailed'), error)

      const errCode = error?.code || error?.response?.status
      if (errCode === 409 || errCode === 504 || errCode === 505) {
        alert(error.msg || t('dashboard.cargoMap.transport.exportTooLarge'))
      } else {
        alert(error.msg || t('dashboard.cargoMap.transport.exportFailed'))
      }
    } finally {
      exportAbnormalLoading.value = false
    }
  })()
}

// 启动地图车辆信息定时刷新
const startCargoMapRefresh = () => {
  if (cargoMapRefreshTimer) {
    clearInterval(cargoMapRefreshTimer)
    cargoMapRefreshTimer = null
  }

  const interval = 3600000 // 1小时

  cargoMapRefreshTimer = setInterval(() => {
    loadTruckData()
  }, interval)
}

// 停止地图车辆信息定时刷新
const stopCargoMapRefresh = () => {
  if (cargoMapRefreshTimer) {
    clearInterval(cargoMapRefreshTimer)
    cargoMapRefreshTimer = null
  }
}

// 组件挂载时初始化
onMounted(() => {
  try {
    nextTick(() => {
      setTimeout(() => {
        initMap()
        setTimeout(() => {
          loadMapData()
          loadWarehouseData()
          loadTruckData()
          loadCustomerData()
          loadMigrationData()
          loadTop3Data()
          loadUnsignedPackagesData()

          setTimeout(() => {
            prepareCdcCarouselData()
            startCdcCarousel()
          }, 2000)

          startCargoMapRefresh()
        }, 500)
      }, 100)
    })
  } catch (error) {
    console.error(t('dashboard.cargoMap.messages.initMapFailed'), error)
  }
})

// 组件卸载时清理
onUnmounted(() => {
  try {
    stopCargoMapRefresh()

    if (handleResize.debounceTimer) {
      clearTimeout(handleResize.debounceTimer)
    }
    if (resizeObserver && resizeObserver.debounceTimer) {
      clearTimeout(resizeObserver.debounceTimer)
    }
    if (legendHoverDebounceTimer) {
      clearTimeout(legendHoverDebounceTimer)
      legendHoverDebounceTimer = null
    }

    window.removeEventListener('resize', handleResize)

    stopRippleUpdate()
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (chartInstance.value) {
      chartInstance.value.dispose()
      chartInstance.value = null
    }

    stopCdcCarousel()
  } catch (error) {
    console.error(t('dashboard.cargoMap.messages.cleanupFailed'), error)
  }
})
</script>

<template>
  <div class="china-map">
    <!-- 时间切换按钮 -->
    <div class="time-switch">
      <div class="time-label">{{ t('dashboard.cargoMap.timeSwitch.label') }}</div>
      <div class="radio-group">
        <div class="radio-option" @click="switchTimeMode('current')">
          <div class="radio-circle" :class="{ active: timeMode === 'current' }">
            <div v-if="timeMode === 'current'" class="radio-inner"></div>
          </div>
          <span class="radio-text">{{ t('dashboard.cargoMap.timeSwitch.currentMonth') }}</span>
        </div>
        <div class="radio-option ml-10" @click="switchTimeMode('recent30')">
          <div class="radio-circle" :class="{ active: timeMode === 'recent30' }">
            <div v-if="timeMode === 'recent30'" class="radio-inner"></div>
          </div>
          <span class="radio-text">{{ t('dashboard.cargoMap.timeSwitch.recent30Days') }}</span>
        </div>
      </div>
    </div>

    <!-- 统计面板 -->
    <div class="statistics-panel">
      <div class="stat-item">
        <div class="stat-icon">
          <img src="/dashboard/images/vehicle.png" alt="正常在途车辆" />
        </div>
        <div class="stat-content">
          <div class="stat-label">{{ t('dashboard.cargoMap.statistics.normalVehicles') }}</div>
          <div class="stat-value">
            <span class="stat-digits">
              <span v-for="(digit, index) in String(statisticsData.normalVehicles)" :key="index" class="digit">{{ digit }}</span>
            </span>
            <span class="stat-unit">{{ t('dashboard.cargoMap.statistics.unitVehicle') }}</span>
          </div>
        </div>
      </div>

      <div class="stat-item">
        <div class="stat-icon">
          <img src="/dashboard/images/abnormal-vehicle.png" alt="异常在途车辆" />
        </div>
        <div class="stat-content">
          <div class="stat-label">{{ t('dashboard.cargoMap.statistics.abnormalVehicles') }}</div>
          <div class="stat-value">
            <span class="stat-digits">
              <span v-for="(digit, index) in String(statisticsData.abnormalVehicles)" :key="index" class="digit red-color">{{ digit }}</span>
            </span>
            <span class="stat-unit">{{ t('dashboard.cargoMap.statistics.unitVehicle') }}</span>
          </div>
        </div>
        <div class="stat-action">
          <button
            class="export-btn"
            @click="handleExportAbnormalTruck"
            :disabled="exportAbnormalLoading"
            :title="t('dashboard.cargoMap.statistics.exportAbnormal')"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="7 10 12 15 17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="stat-item">
        <div class="stat-icon">
          <img src="/dashboard/images/package.png" alt="未签收包裹" />
        </div>
        <div class="stat-content">
          <div class="stat-label">{{ t('dashboard.cargoMap.statistics.unsignedPackages') }}</div>
          <div class="stat-value">
            <span class="stat-digits">
              <span v-for="(digit, index) in String(statisticsData.unsignedPackages)" :key="index" class="digit orange-color">{{ digit }}</span>
            </span>
            <span class="stat-unit">{{ t('dashboard.cargoMap.statistics.unitPackage') }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- TOP3热门线路 -->
    <div class="top3-panel">
      <div class="top3-header">
        <h3>{{ t('dashboard.cargoMap.top3.title') }}</h3>
      </div>
      <div class="top3-table">
        <table>
          <thead>
            <tr>
              <th>{{ t('dashboard.cargoMap.top3.rank') }}</th>
              <th>{{ t('dashboard.cargoMap.top3.fromWarehouse') }}</th>
              <th>{{ t('dashboard.cargoMap.top3.toProvince') }}</th>
              <th>{{ t('dashboard.cargoMap.top3.volume') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in top3Data" :key="index">
              <td>
                <div class="rank-badge" :class="`rank-${index + 1}`">
                  NO.{{ index + 1 }}
                </div>
              </td>
              <td>{{ item.fromWarehouse || t('dashboard.cargoMap.top3.unknown') }}</td>
              <td>{{ item.toProvince || t('dashboard.cargoMap.top3.unknown') }}</td>
              <td>{{ ((item.totalVolume || 0) / 10000).toFixed(2) }}{{ t('dashboard.cargoMap.top3.volumeUnit') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="map-container">
      <div ref="mapContainer" class="chart-container"></div>

      <!-- 异常车辆水波纹效果 -->
      <div class="ripple-container">
        <div
          v-for="item in rippleItems"
          :key="item.id"
          class="ripple-wrapper"
          :style="{
            left: item.x + 'px',
            top: item.y + 'px',
          }"
        >
          <div class="ripple-circle ripple-1"></div>
          <div class="ripple-circle ripple-2"></div>
          <div class="ripple-circle ripple-3"></div>
        </div>
      </div>

      <!-- 图层控制面板 -->
      <div class="layer-control-panel">
        <div class="layer-item">
          <div class="layer-icon cdc-icon"></div>
          <span class="layer-text">{{ t('dashboard.cargoMap.layers.cdcWarehouse') }}</span>
          <label class="checkboxouter">
            <input type="checkbox" :checked="layerVisibility.cdcWarehouse" @change="toggleLayer('cdcWarehouse')" />
            <div class="checkbox"></div>
          </label>
        </div>

        <div class="layer-item">
          <div class="layer-icon rdc-icon"></div>
          <span class="layer-text">{{ t('dashboard.cargoMap.layers.rdcWarehouse') }}</span>
          <label class="checkboxouter">
            <input type="checkbox" :checked="layerVisibility.rdcWarehouse" @change="toggleLayer('rdcWarehouse')" />
            <div class="checkbox"></div>
          </label>
        </div>

        <div class="layer-item">
          <div class="layer-icon trunk-vehicle-icon"></div>
          <span class="layer-text">{{ t('dashboard.cargoMap.layers.trunkVehicles') }}</span>
          <label class="checkboxouter">
            <input type="checkbox" :checked="layerVisibility.trunkVehicles" @change="toggleLayer('trunkVehicles')" />
            <div class="checkbox"></div>
          </label>
        </div>

        <div class="layer-item">
          <div class="layer-icon delivery-vehicle-icon"></div>
          <span class="layer-text">{{ t('dashboard.cargoMap.layers.deliveryVehicles') }}</span>
          <label class="checkboxouter">
            <input type="checkbox" :checked="layerVisibility.deliveryVehicles" @change="toggleLayer('deliveryVehicles')" />
            <div class="checkbox"></div>
          </label>
        </div>

        <div class="layer-item">
          <div class="layer-icon customer-icon"></div>
          <span class="layer-text">{{ t('dashboard.cargoMap.layers.keyCustomers') }}</span>
          <label class="checkboxouter">
            <input type="checkbox" :checked="layerVisibility.keyCustomers" @change="toggleLayer('keyCustomers')" />
            <div class="checkbox"></div>
          </label>
        </div>

        <div class="layer-item">
          <div class="layer-icon route-icon"></div>
          <span class="layer-text">{{ t('dashboard.cargoMap.layers.transportRoutes') }}</span>
          <label class="checkboxouter">
            <input type="checkbox" :checked="layerVisibility.transportRoutes" @change="toggleLayer('transportRoutes')" />
            <div class="checkbox"></div>
          </label>
        </div>
      </div>

      <!-- 自定义弹窗 -->
      <div v-if="showModal" class="custom-modal-overlay" @click="closeModal">
        <div class="custom-modal" @click.stop>
          <div class="modal-header">
            <div class="modal-title">
              <span class="title-text">{{ modalTitle }}</span>
            </div>
          </div>
          <div class="modal-body">
            <!-- 线路信息 -->
            <template v-if="modalData?.fromWarehouse">
              <div class="warehouse-info-item">
                <span class="value">{{ modalData?.fromWarehouse || t('dashboard.cargoMap.modal.unknown') }} → {{ modalData?.toProvince || t('dashboard.cargoMap.modal.unknown') }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.route.volume') }}</span>
                <span class="value">{{ modalData?.totalVolume || 0 }}{{ t('dashboard.cargoMap.modal.route.unit') }}</span>
              </div>
            </template>

            <!-- 仓库信息 -->
            <template v-else-if="modalData?.warehouseType">
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.warehouse.name') }}</span>
                <span class="value">{{ modalData?.warehouseName || t('dashboard.cargoMap.modal.unknown') }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.warehouse.province') }}</span>
                <span class="value">{{ modalData?.provinceName || t('dashboard.cargoMap.modal.unknown') }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.warehouse.truckCount') }}</span>
                <span class="value">{{ modalData?.truckCount || 0 }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.warehouse.staffCount') }}</span>
                <span class="value">{{ modalData?.staffCount || 0 }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.warehouse.area') }}</span>
                <span class="value">{{ modalData?.warehouseArea || 0 }}m²</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.warehouse.type') }}</span>
                <span class="value">{{ modalData?.warehouseType === 1 ? t('dashboard.cargoMap.modal.warehouse.typeCdc') : t('dashboard.cargoMap.modal.warehouse.typeRdc') }}</span>
              </div>
            </template>

            <!-- 车辆信息 -->
            <template v-else-if="modalData?.licenseNumber">
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.vehicle.licenseNumber') }}</span>
                <span class="value">{{ modalData?.licenseNumber || t('dashboard.cargoMap.modal.unknown') }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.vehicle.driver') }}</span>
                <span class="value">{{ modalData?.driverName || t('dashboard.cargoMap.modal.unknown') }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.vehicle.phone') }}</span>
                <span class="value">{{ modalData?.phone || t('dashboard.cargoMap.modal.unknown') }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.vehicle.truckType') }}</span>
                <span class="value">{{ modalData?.truckType || t('dashboard.cargoMap.modal.vehicle.notSet') }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.vehicle.location') }}</span>
                <span class="value">{{ modalData?.location || t('dashboard.cargoMap.modal.unknown') }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.vehicle.orderCount') }}</span>
                <span class="value">{{ modalData?.orderCount || 0 }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.vehicle.fromPlace') }}</span>
                <span class="value">{{ modalData?.fromPlace || t('dashboard.cargoMap.modal.unknown') }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.vehicle.toPlace') }}</span>
                <span class="value">{{ modalData?.toPlace || t('dashboard.cargoMap.modal.unknown') }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.vehicle.belongType') }}</span>
                <span class="value">{{ modalData?.belongType || t('dashboard.cargoMap.modal.unknown') }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.vehicle.belongSupplier') }}</span>
                <span class="value">{{ modalData?.belongSupplier || t('dashboard.cargoMap.modal.unknown') }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.vehicle.orderCustomer') }}</span>
                <span class="value">{{ modalData?.orderCustomer || t('dashboard.cargoMap.modal.unknown') }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.vehicle.goodsCount') }}</span>
                <span class="value">{{ modalData?.goodsCount || 0 }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.vehicle.volume') }}</span>
                <span class="value">{{ modalData?.volume ? modalData.volume + 'm³' : '0m³' }}</span>
              </div>
              <div v-if="modalData?.logisticsStatus === 0" class="vehicle-alert-info">
                {{ t('dashboard.cargoMap.modal.vehicle.alert') }}
              </div>
            </template>

            <!-- 客户信息 -->
            <template v-else>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.customer.name') }}</span>
                <span class="value">{{ modalData?.custName || modalData?.customerName || t('dashboard.cargoMap.modal.unknown') }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.customer.address') }}</span>
                <span class="value">{{ modalData?.address || t('dashboard.cargoMap.modal.vehicle.notSet') }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.customer.contactPerson') }}</span>
                <span class="value">{{ modalData?.contactPerson || t('dashboard.cargoMap.modal.vehicle.notSet') }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.customer.contactPhone') }}</span>
                <span class="value">{{ modalData?.contactPhone || t('dashboard.cargoMap.modal.vehicle.notSet') }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.customer.customerType') }}</span>
                <span class="value">{{ modalData?.customerType || t('dashboard.cargoMap.modal.vehicle.notSet') }}</span>
              </div>
              <div class="warehouse-info-item">
                <span class="label">{{ t('dashboard.cargoMap.modal.customer.location') }}</span>
                <span class="value">{{ Number(modalData?.longitude || 0).toFixed(4) }}, {{ Number(modalData?.latitude || 0).toFixed(4) }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- 图例 -->
      <div class="map-legend">
        <div class="legend-item" @mouseenter="handleLegendHover(6000, Infinity)" @mouseleave="handleLegendLeave">
          <div class="legend-color" style="background-color: #1e3a8a;"></div>
          <span class="legend-text">{{ t('dashboard.cargoMap.legend.volumeRanges.over6000') }}</span>
        </div>
        <div class="legend-item" @mouseenter="handleLegendHover(4000, 5999.99)" @mouseleave="handleLegendLeave">
          <div class="legend-color" style="background-color: #2563eb;"></div>
          <span class="legend-text">{{ t('dashboard.cargoMap.legend.volumeRanges.4000to6000') }}</span>
        </div>
        <div class="legend-item" @mouseenter="handleLegendHover(3000, 3999.99)" @mouseleave="handleLegendLeave">
          <div class="legend-color" style="background-color: #3b82f6;"></div>
          <span class="legend-text">{{ t('dashboard.cargoMap.legend.volumeRanges.3000to4000') }}</span>
        </div>
        <div class="legend-item" @mouseenter="handleLegendHover(2000, 2999.99)" @mouseleave="handleLegendLeave">
          <div class="legend-color" style="background-color: #60a5fa;"></div>
          <span class="legend-text">{{ t('dashboard.cargoMap.legend.volumeRanges.2000to3000') }}</span>
        </div>
        <div class="legend-item" @mouseenter="handleLegendHover(1000, 1999.99)" @mouseleave="handleLegendLeave">
          <div class="legend-color" style="background-color: #93c5fd;"></div>
          <span class="legend-text">{{ t('dashboard.cargoMap.legend.volumeRanges.1000to2000') }}</span>
        </div>
        <div class="legend-item" @mouseenter="handleLegendHover(500, 999.99)" @mouseleave="handleLegendLeave">
          <div class="legend-color" style="background-color: #bfdbfe;"></div>
          <span class="legend-text">{{ t('dashboard.cargoMap.legend.volumeRanges.500to1000') }}</span>
        </div>
        <div class="legend-item" @mouseenter="handleLegendHover(200, 499.99)" @mouseleave="handleLegendLeave">
          <div class="legend-color" style="background-color: #dbeafe;"></div>
          <span class="legend-text">{{ t('dashboard.cargoMap.legend.volumeRanges.200to500') }}</span>
        </div>
        <div class="legend-item" @mouseenter="handleLegendHover(0.01, 199.99)" @mouseleave="handleLegendLeave">
          <div class="legend-color" style="background-color: #f0f9ff;"></div>
          <span class="legend-text">{{ t('dashboard.cargoMap.legend.volumeRanges.under200') }}</span>
        </div>
      </div>

      <!-- 车辆和客户图例 -->
      <div class="map-legend-items">
        <div class="legend-item">
          <img src="/dashboard/images/map-car1.png" :alt="t('dashboard.cargoMap.legend.trunkVehicles')" class="legend-icon" />
          <span class="legend-text">{{ t('dashboard.cargoMap.legend.trunkVehicles') }}</span>
        </div>
        <div class="legend-item">
          <img src="/dashboard/images/customer1.png" :alt="t('dashboard.cargoMap.legend.keyCustomers')" class="legend-icon" />
          <span class="legend-text">{{ t('dashboard.cargoMap.legend.keyCustomers') }}</span>
        </div>
        <div class="legend-item">
          <img src="/dashboard/images/CDC1.png" :alt="t('dashboard.cargoMap.legend.cdcWarehouse')" class="legend-icon" />
          <span class="legend-text">{{ t('dashboard.cargoMap.legend.cdcWarehouse') }}</span>
        </div>
        <div class="legend-item">
          <img src="/dashboard/images/RDC1.png" :alt="t('dashboard.cargoMap.legend.rdcWarehouse')" class="legend-icon" />
          <span class="legend-text">{{ t('dashboard.cargoMap.legend.rdcWarehouse') }}</span>
        </div>
      </div>

      <!-- 路线类型图例 -->
      <div class="map-legend-routes">
        <div class="legend-item">
          <div class="legend-line" style="background-color: #4a9eff;"></div>
          <span class="legend-text">{{ t('dashboard.cargoMap.legend.transportRoutes') }}</span>
        </div>
        <div class="legend-item">
          <div class="legend-route-type">✈</div>
          <span class="legend-text">{{ t('dashboard.cargoMap.legend.airRoute') }}</span>
        </div>
        <div class="legend-item">
          <div class="legend-route-type">●</div>
          <span class="legend-text">{{ t('dashboard.cargoMap.legend.railRoute') }}</span>
        </div>
        <div class="legend-item">
          <div class="legend-route-type">▲</div>
          <span class="legend-text">{{ t('dashboard.cargoMap.legend.roadRoute') }}</span>
        </div>
      </div>
    </div>

    <!-- 运输方式图例 -->
    <div class="map-legend-transport">
      <div class="legend-item">
        <div class="legend-transport-icon"><img src="/dashboard/images/exp1.png" :alt="t('dashboard.cargoMap.legend.air')"></div>
        <span class="legend-text">{{ t('dashboard.cargoMap.legend.air') }}</span>
      </div>
      <div class="legend-item">
        <div class="legend-transport-icon"><img src="/dashboard/images/exp2.png" :alt="t('dashboard.cargoMap.legend.rail')"></div>
        <span class="legend-text">{{ t('dashboard.cargoMap.legend.rail') }}</span>
      </div>
      <div class="legend-item">
        <div class="legend-transport-icon"><img src="/dashboard/images/exp3.png" :alt="t('dashboard.cargoMap.legend.road')"></div>
        <span class="legend-text">{{ t('dashboard.cargoMap.legend.road') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.china-map {
  width: 100%;
  height: 100%;
  position: relative;
}

.time-switch {
  position: absolute;
  top: 1rem;
  left: 1rem;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(29, 38, 69, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 0.375rem;
  padding: 0.5rem 1rem;
  border: 1px solid rgba(50, 118, 181, 0.5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.time-label {
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.radio-group {
  display: flex;
  align-items: center;
  gap: 0;
  background: transparent;
  border-radius: 0;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
  transition: opacity 0.2s;
}

.radio-option:hover {
  opacity: 0.8;
}

.ml-10 {
  margin-left: 1rem;
}

.radio-circle {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(59, 130, 246, 0.6);
  border-radius: 50%;
  position: relative;
  transition: all 0.2s;
  flex-shrink: 0;
  background: transparent;
}

.radio-circle.active {
  border-color: #3b82f6;
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
}

.radio-inner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

.radio-text {
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.75rem;
  font-weight: 400;
  transition: color 0.2s;
}

.radio-option .radio-circle.active + .radio-text {
  color: #60a5fa;
  font-weight: 500;
}

.statistics-panel {
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(calc(-50% - 2rem));
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  background: rgba(29, 38, 69, 0.7);
  backdrop-filter: blur(10px);
  border-right: 1px solid #3276b5;
  border-left: 1px solid #3276b5;
  border-radius: 0.375rem;
  padding: 0.75rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 7rem;
}

.stat-icon img {
  width: 2.5rem;
  height: 2.5rem;
  object-fit: contain;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.65rem;
  font-weight: 500;
  white-space: nowrap;
}

.stat-value {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.stat-digits {
  display: inline-flex;
  gap: 0.125rem;
}

.stat-digits .digit {
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: bold;
  line-height: 1;
  background-color: #1890ff;
  padding: 0.15rem 0.175rem;
  border-radius: 0.25rem;
  display: inline-block;
  min-width: 0.9rem;
  text-align: center;
}

.stat-digits .red-color {
  background-color: #ff5349;
}

.stat-digits .orange-color {
  background-color: #fe8141;
}

.stat-unit {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.625rem;
  font-weight: 500;
}

.stat-action {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.export-btn {
  background: transparent;
  border: 1px solid rgba(74, 158, 255, 0.6);
  border-radius: 0.25rem;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  padding: 0.25rem 0.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.export-btn:hover:not(:disabled) {
  background: rgba(74, 158, 255, 0.2);
  border-color: #4a9eff;
  color: #ffffff;
}

.export-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-btn svg {
  width: 14px;
  height: 14px;
}

.map-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.top3-panel {
  position: absolute;
  right: 1rem;
  top: 8rem;
  width: 16rem;
  background: rgba(32, 43, 71, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 0.25rem;
  padding: 0;
  z-index: 1000;
  box-shadow: 0 0.125rem 0.75rem rgba(0, 0, 0, 0.3);
  overflow: hidden;
  min-width: 14rem;
  max-width: 20rem;
}

.top3-header {
  background: rgba(32, 43, 71, 0.8);
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.top3-header h3 {
  color: #A0C0E0;
  font-size: 0.75rem;
  font-weight: 600;
  margin: 0;
  text-align: center;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  line-height: 1.2;
}

.top3-table {
  width: 100%;
  background: rgba(32, 43, 71, 0.3);
  padding: 0.25rem 0.25rem;
}

.top3-table table {
  width: 100%;
  border-collapse: collapse;
  background: transparent;
  border-radius: 0;
  overflow: hidden;
}

.top3-table th {
  background: rgba(32, 43, 71, 0.8);
  color: #A0C0E0;
  padding: 0.375rem 0.5rem;
  text-align: center;
  font-weight: 600;
  font-size: 0.625rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  line-height: 1.2;
}

.top3-table td {
  padding: 0.25rem 0.5rem;
  text-align: center;
  color: #ffffff;
  font-size: 0.625rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  line-height: 1.2;
}

.top3-table td:first-child {
  text-align: center;
}

.top3-table td:last-child {
  text-align: right;
}

.top3-table tr:hover {
  background: rgba(77, 208, 225, 0.1);
}

.top3-table tr:last-child td {
  border-bottom: none;
}

.rank-badge {
  display: inline-block;
  padding: 0.125rem 0.25rem;
  border-radius: 0.125rem;
  font-weight: bold;
  font-size: 0.5rem;
  text-align: center;
  min-width: 1.75rem;
  line-height: 1.2;
}

.rank-badge.rank-1 {
  background: #F7C54B;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.rank-badge.rank-2 {
  background: #6A7B9B;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.rank-badge.rank-3 {
  background: #F78C4B;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.chart-container {
  width: 100%;
  height: 100%;
}

.map-legend {
  position: absolute;
  bottom: 1.5rem;
  left: 1.5rem;
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 2px 8px #3b82f6;
  z-index: 10;
}

.legend-item {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 4px 8px;
  border-radius: 4px;
  margin-left: -8px;
  margin-right: -8px;
}

.legend-item:hover {
  opacity: 0.9;
  background-color: rgba(74, 158, 255, 0.15);
  transform: translateX(4px);
}

.legend-item:last-child {
  margin-bottom: 0;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  margin-right: 8px;
  flex-shrink: 0;
}

.legend-text {
  font-size: 0.625rem;
  color: #fff;
  white-space: nowrap;
}

.map-legend-items {
  margin-top: 0.625rem;
  padding-top: 0.625rem;
  border-top: 1px solid #e5e7eb;
}

.legend-icon {
  width: 20px;
  height: 20px;
  margin-right: 8px;
  flex-shrink: 0;
}

.map-legend-routes {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

.legend-line {
  width: 20px;
  height: 3px;
  margin-right: 8px;
  flex-shrink: 0;
  border-radius: 1px;
}

.legend-route-type {
  width: 20px;
  height: 20px;
  margin-right: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #fff;
}

.map-legend-transport {
  position: absolute;
  bottom: 1.5rem;
  left: 10rem;
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 2px 8px #3b82f6;
  z-index: 10;
}

.legend-transport-icon {
  width: 20px;
  height: 20px;
  margin-right: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #fff;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.legend-transport-icon img {
  width: 16px;
  height: 16px;
}

.custom-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
}

.custom-modal {
  position: relative;
  overflow: hidden;
  width: 15rem;
  height: auto;
  max-width: none;
  max-height: none;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
}

.modal-header {
  background: url('/dashboard/images/map-title-bg.png') center/contain no-repeat;
  background-size: 100% 100%;
  padding: 0.8rem 2.5rem;
}

.modal-title {
  color: #ffffff;
  font-weight: 600;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  margin: 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.title-text {
  color: #ffffff;
}

.modal-body {
  background: #0c162d;
  padding: 1.1rem 1.2rem;
  color: #ffffff;
  position: relative;
  z-index: 2;
  border: 2px solid #243552;
  border-top: 0px;
  border-radius: 4px;
}

.warehouse-info-item {
  display: flex;
  justify-content: start;
  align-items: center;
  padding: 8px 0;
}

.warehouse-info-item:last-child {
  border-bottom: none;
}

.warehouse-info-item .label {
  color: #93c5fd;
  font-weight: 500;
  font-size: 14px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
  flex-shrink: 0;
}

.warehouse-info-item .value {
  color: #ffffff;
  font-weight: 600;
  font-size: 14px;
  padding-left: 0.4rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  word-break: break-word;
  flex: 1;
}

.vehicle-alert-info {
  margin-top: 12px;
  padding: 8px 12px;
  background-color: rgba(255, 77, 79, 0.2);
  border-left: 3px solid #ff4d4f;
  color: #ff4d4f;
  font-size: 14px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.layer-control-panel {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  backdrop-filter: blur(10px);
  border-radius: 8px;
  padding: 12px;
  min-width: 200px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(59, 130, 246, 0.3);
  z-index: 1000;
}

.layer-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  margin: 4px 0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  color: #ffffff;
}

.layer-item:hover {
  background: rgba(59, 130, 246, 0.2);
}

.layer-icon {
  width: 24px;
  height: 24px;
  margin-right: 12px;
  border-radius: 4px;
  flex-shrink: 0;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.cdc-icon {
  background-image: url('/dashboard/images/CDC1.png');
}

.rdc-icon {
  background-image: url('/dashboard/images/RDC1.png');
}

.trunk-vehicle-icon {
  background-image: url('/dashboard/images/map-car1.png');
}

.delivery-vehicle-icon {
  background-image: url('/dashboard/images/map-car2.png');
}

.customer-icon {
  background-image: url('/dashboard/images/customer1.png');
}

.route-icon {
  background-image: url('/dashboard/images/wayline.png');
}

.layer-text {
  flex: 1;
  font-size: 0.625rem;
  font-weight: 500;
  color: #ffffff;
}

.checkboxouter {
  height: 18px;
  width: 18px;
  border-radius: 3px;
  background-color: rgba(30, 58, 138, 0.9);
  display: block;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.5s;
  position: relative;
  flex-shrink: 0;
}

.checkboxouter:hover {
  transform: scale(1.2);
}

input[type="checkbox"] {
  opacity: 0;
  position: absolute;
  cursor: pointer;
  z-index: 1;
  height: 100%;
  width: 100%;
  left: 0;
  top: 0;
}

.checkbox {
  position: absolute;
  border-bottom: 2px solid transparent;
  border-right: 2px solid transparent;
  background-color: transparent;
  height: 8px;
  width: 4px;
  transform: rotate(45deg);
  transform-origin: center;
  transition: all 0.3s;
  top: 50%;
  left: 50%;
  margin-top: -4px;
  margin-left: -2px;
  opacity: 0;
}

input[type="checkbox"]:checked ~ .checkbox {
  opacity: 1;
  border-bottom: 2px solid #4DD0E1;
  border-right: 2px solid #4DD0E1;
}

.ripple-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 14;
  overflow: hidden;
}

.ripple-wrapper {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 0;
  height: 0;
}

.ripple-circle {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 2px solid #ff4d4f;
  background: rgba(255, 77, 79, 0.2);
  pointer-events: none;
}

.ripple-1 {
  width: 35px;
  height: 35px;
  animation: ripple-animation 6s ease-out infinite;
  animation-delay: 0s;
}

.ripple-2 {
  width: 35px;
  height: 35px;
  animation: ripple-animation 6s ease-out infinite;
  animation-delay: 2s;
}

.ripple-3 {
  width: 35px;
  height: 35px;
  animation: ripple-animation 6s ease-out infinite;
  animation-delay: 4s;
}

@keyframes ripple-animation {
  0% {
    width: 35px;
    height: 35px;
    opacity: 0.5;
    border-width: 2px;
    background-color: rgba(255, 77, 79, 0.25);
  }
  30% {
    opacity: 0.4;
    background-color: rgba(255, 77, 79, 0.2);
  }
  60% {
    opacity: 0.25;
    background-color: rgba(255, 77, 79, 0.15);
  }
  100% {
    width: 120px;
    height: 120px;
    opacity: 0;
    border-width: 1px;
    background-color: rgba(255, 77, 79, 0);
  }
}
</style>