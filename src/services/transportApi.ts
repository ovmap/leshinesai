import axios from 'axios'

// Transport Dashboard API 客户端（直连，不经过网关）
const transportDashboardClient = axios.create({
  baseURL: import.meta.env.VITE_TRANSPORT_DASHBOARD_URL || 'https://transport-service-dashboard-tst.t-sy-in.earth.xcloud.lenovo.com',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Transport AI API 客户端（直连，不经过网关）
const transportAiClient = axios.create({
  baseURL: import.meta.env.VITE_TRANSPORT_AI_URL || 'https://transport-service-ai-tst.t-sy-in.earth.xcloud.lenovo.com',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 响应拦截器 - 统一处理错误
transportDashboardClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[Transport Dashboard API Error]:', error.message)
    return Promise.reject(error)
  }
)

transportAiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[Transport AI API Error]:', error.message)
    return Promise.reject(error)
  }
)

// ============ Transport Dashboard API 接口 ============

/**
 * 查询货量总量（日/月/年）
 * dataType: '1'=日, '2'=月, '3'=年
 */
export async function queryTotalVolume(
  dataType: string,
  fromWarehouse?: string,
  toProvince?: string[],
  toRdc?: string[]
) {
  let url = `/kanban/v1/volume/queryTotalVolume?dataType=${dataType}`
  if (fromWarehouse) url += `&fromWarehouse=${fromWarehouse}`
  if (toProvince && toProvince.length > 0) url += `&toProvince=${toProvince.join(',')}`
  if (toRdc && toRdc.length > 0) url += `&toRdc=${toRdc.join(',')}`
  const response = await transportDashboardClient.get(url)
  return response.data
}

/**
 * 查询应签未签明细
 */
export async function queryAbnormalOrderItem(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/abnormal/queryAbnormalOrderItem', data)
  return response.data
}

/**
 * 导出应签未签明细
 */
export async function exportAbnormalOrderItem(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/abnormal/exportAbnormalOrderItem', data)
  return response.data
}

/**
 * 查询区域列表
 */
export async function queryRegionList(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/select/queryRegionList', data)
  return response.data
}

/**
 * 查询异常分类列表
 */
export async function queryAbnormalTypeList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryAbnormalTypeList')
  return response.data
}

/**
 * 查询数据源列表
 */
export async function queryDataSourceList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryDataSourceList')
  return response.data
}

/**
 * 查询运输方式列表
 */
export async function queryTransTypeList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryTransTypeList')
  return response.data
}

/**
 * 查询时间类型列表
 */
export async function queryTimeTypeList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryTimeTypeList')
  return response.data
}

/**
 * 查询城市级别列表
 */
export async function queryCityLevelList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryCityLevelList')
  return response.data
}

/**
 * 查询商品类型列表
 */
export async function queryProductTypeList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryProductTypeList')
  return response.data
}

/**
 * 查询货量数据
 */
export async function queryVolume(data: {
  fromWarehouse?: string[]
  toProvince?: string[]
  toRdc?: string[]
  startDate: string
  endDate: string
  timeType: string
  agg: string
  customer?: string[]
  bizType?: string[]
  transType?: string[]
  cityLevel?: string[]
  dataSource?: string[]
  productType?: string[]
}) {
  const defaultParams = {
    fromWarehouse: [],
    toProvince: [],
    toRdc: [],
    customer: [],
    bizType: [],
    transType: [],
    cityLevel: [],
    dataSource: ['TMS', 'LESTMS', 'BTCP', 'SEC'],
    productType: [],
    ...data,
  }
  const response = await transportDashboardClient.post('/kanban/v1/volume/queryVolume', defaultParams)
  return response.data
}

/**
 * 查询签收信息（已签收/待签收数量）
 */
export async function querySign(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/sign/querySign', data)
  return response.data
}

/**
 * 查询未签收订单
 */
export async function queryNotSignItemByPage(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/sign/queryNotSignItemByPage', data)
  return response.data
}

/**
 * 导出未签收明细
 */
export async function exportNotSignItem(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/sign/exportNotSignItem', data)
  return response.data
}

/**
 * 查询准时交付率
 */
export async function queryOnTimeRateCard(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/onTimeRate/queryOnTimeRateCard', data)
  return response.data
}

/**
 * 查询运输物流商 KPI 评分
 */
export async function queryTransKpiSummary(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/logisticKpi/queryTransKpiSummary', data)
  return response.data
}

/**
 * 查询热力图数据
 */
export async function queryHeatMap(startDate: string, endDate: string) {
  const response = await transportDashboardClient.get(`/kanban/v1/map/queryHeatMap?startDate=${startDate}&endDate=${endDate}`)
  return response.data
}

/**
 * 查询在途车辆列表
 */
export async function queryInTransitTruckList() {
  const response = await transportDashboardClient.get('/kanban/v1/map/queryInTransitTruckList')
  return response.data
}

/**
 * 查询重点客户地理位置及基本信息
 */
export async function queryKeyCustList() {
  const response = await transportDashboardClient.get('/kanban/v1/map/queryKeyCustList')
  return response.data
}

/**
 * 查询迁徙图路线数据
 */
export async function queryMigrationMapRoute(startDate: string, endDate: string) {
  const response = await transportDashboardClient.get(`/kanban/v1/map/queryMigrationMapRoute?startDate=${startDate}&endDate=${endDate}`)
  return response.data
}

/**
 * 查询TOP3热门线路
 */
export async function queryTop3HotRoute(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/map/queryTop3HotRoute', data)
  return response.data
}

/**
 * 查询未签收数量
 */
export async function countNotSign(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/map/countNotSign', data)
  return response.data
}

/**
 * 导出异常车辆
 */
export async function exportAbnormalTruck(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/map/exportAbnormalTruck', data)
  return response.data
}

/**
 * 查询仓库列表
 */
export async function queryWarehouseList() {
  const response = await transportDashboardClient.get('/kanban/v1/map/queryWarehouseList')
  return response.data
}

/**
 * 查询始发仓列表
 */
export async function queryFromWarehouse() {
  const response = await transportDashboardClient.get('/kanban/v1/common/queryFromWarehouse')
  return response.data
}

/**
 * 查询目的 RDC 列表
 */
export async function queryToRdc() {
  const response = await transportDashboardClient.get('/kanban/v1/common/queryToRdc')
  return response.data
}

/**
 * 查询目的省份列表
 */
export async function queryToProvince() {
  const response = await transportDashboardClient.get('/kanban/v1/common/queryToProvince')
  return response.data
}

// ============ 智能体异常预警 (cargoBanner) API 接口 ============

/** 查询异常预警订单统计 */
export async function queryRiskOrderStats(data: object) {
  const response = await transportAiClient.post('/ai/v1/riskAlert/queryRiskOrderStats', data)
  return response.data
}

/** 分页查询异常预警订单数据 */
export async function queryRiskOrderByPage(data: object) {
  const response = await transportAiClient.post('/ai/v1/riskAlert/queryRiskOrderByPage', data)
  return response.data
}

/** 导出异常预警订单数据 */
export async function exportRiskOrder(data: object) {
  const response = await transportAiClient.post('/ai/v1/riskAlert/exportRiskOrder', data)
  return response.data
}

/** 查询CDD预警统计 */
export async function queryCddAlertStats(data: object) {
  const response = await transportAiClient.post('/ai/v1/cddAlert/queryCddAlertStats', data)
  return response.data
}

/** 查询CDD预警详情（支持多种筛选条件） */
export async function queryCddAlertDetails(data: object) {
  const response = await transportAiClient.post('/ai/v1/cddAlert/queryCddAlertDetails', data)
  return response.data
}

/** 导出CDD预警数据 */
export async function exportCddAlertDataByFilter(data: object) {
  const response = await transportAiClient.post('/ai/v1/cddAlert/exportCddAlertDetails', data)
  return response.data
}

/** 查询车辆预警 */
export async function queryAbnormalVehicleStats() {
  const response = await transportAiClient.get('/ai/v1/vehicleAlert/queryAbnormalVehicleStats')
  return response.data
}

/** 查询ISG延迟风险 */
export async function queryIsgDelayRisk(data: object) {
  const response = await transportAiClient.post('/ai/v1/isgAlert/queryIsgDelayRisk', data)
  return response.data
}

/** 查询ISG在途异常 */
export async function queryIsgInTransitAbnormal(data: object) {
  const response = await transportAiClient.post('/ai/v1/isgAlert/queryIsgInTransitAbnormal', data)
  return response.data
}

/** 查询ISG交付异常 */
export async function queryIsgDeliveryAbnormal(data: object) {
  const response = await transportAiClient.post('/ai/v1/isgAlert/queryIsgDeliveryAbnormal', data)
  return response.data
}

/** 查询ISG风险预警 */
export async function queryIsgRiskAlert() {
  const response = await transportAiClient.get('/ai/v1/isgAlert/queryIsgRiskAlert')
  return response.data
}

// ============ 业务指标卡片 API 接口 ============

/** 查询能源价格（汽油/柴油/航空燃油） */
export async function queryEnergyPrice(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/price/queryEnergyPrice', data)
  return response.data
}

/** 查询干单价 */
export async function queryTrunkLinePrice(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/price/queryTrunkLinePrice', data)
  return response.data
}

/** 查询配单价 */
export async function queryDeliveryPrice(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/price/queryDeliveryPrice', data)
  return response.data
}

/** 查询揽收及时率 */
export async function queryPickupRate(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/pickupRate/queryPickupRate', data)
  return response.data
}

/** 导出揽收及时率明细 */
export async function exportPickupRateByPage(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/pickupRate/exportPickupRateByPage', data)
  return response.data
}

// ============ 运输异常 API 接口 ============

/** 查询未签收订单统计（矩形树图） */
export async function statNotSignOrder(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/transAbnormal/statNotSignOrder', data)
  return response.data
}

/** 分页查询未签收订单 */
export async function statNotSignOrderByPage(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/transAbnormal/statNotSignOrderByPage', data)
  return response.data
}

/** 导出未签收订单 */
export async function exportStatNotSignOrder(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/transAbnormal/exportStatNotSignOrder', data)
  return response.data
}

/** 查询承运商列表 */
export async function queryCarrierList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryCarrierList')
  return response.data
}

// ============ 运力池 API 接口 ============

/** 查询运力池列表 */
export async function queryPowerPool() {
  const response = await transportDashboardClient.get('/kanban/v1/capacity/queryCapacityPool')
  return response.data
}

/** 分页查询运力池明细 */
export async function queryPowerPoolItemByPage(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/capacity/queryCapacityPoolItemByPage', data)
  return response.data
}

/** 查询始发城市列表 */
export async function queryFromCityList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryFromCityList')
  return response.data
}

/** 查询目的城市列表 */
export async function queryToCityList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryToCityList')
  return response.data
}

/** 查询物流商列表 */
export async function queryLogisticList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryLogisticList')
  return response.data
}

// ============ 加急&重点客户风险 API 接口 ============

/** 查询加急订单列表 */
export async function queryUrgentOrdersByPage(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/order/queryUrgentOrdersByPage', data)
  return response.data
}

/** 分页查询加急订单明细 */
export async function queryUrgentOrdersItemByPage(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/order/queryUrgentOrdersItemByPage', data)
  return response.data
}

/** 导出加急订单明细 */
export async function exportUrgentOrdersItem(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/order/exportUrgentOrdersItem', data)
  return response.data
}

/** 查询风险列表 */
export async function queryRiskList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryRiskList')
  return response.data
}

/** 查询订单状态列表 */
export async function queryOrderStatusList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryOrderStatusList')
  return response.data
}

// ============ 重大活动&极端天气影响 API 接口 ============

/** 查询交通信息 */
export async function queryTrafficInfo() {
  const response = await transportDashboardClient.get('/kanban/v1/importEvent/queryTrafficInfo')
  return response.data
}

/** 分页查询影响订单明细 */
export async function queryAffectOrderItemByPage(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/importEvent/queryAffectOrderItemByPage', data)
  return response.data
}

/** 导出影响订单明细 */
export async function exportAffectOrderItem(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/importEvent/exportAffectOrderItem', data)
  return response.data
}

// ============ 返单进展 API 接口 ============

/** 查询客户列表 */
export async function queryCustomerList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryCustomerList')
  return response.data
}

/** 查询运输返单统计信息 */
export async function queryTransConfirmStat(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/confirm/trans/queryTransConfirmStat', data)
  return response.data
}

/** 导出运输返单统计信息（返回 redisKey） */
export async function exportTransNotConfirm(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/confirm/trans/exportTransNotConfirm', data)
  return response.data
}

/** 查询导出进度 */
export async function queryExportProgress(key: string) {
  const response = await transportDashboardClient.get(`/kanban/v1/common/getExportResult?key=${key}`)
  return response.data
}

// ============ 准时交付率（仓储物流） API 接口 ============

/** 查询准时交付率数据 */
export async function queryOnTimeDeliveryRate(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/onTimeRate/queryOnTimeDeliveryRate', data)
  return response.data
}

/** 导出准时交付率明细 */
export async function exportOnTimeDeliveryRateItem(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/onTimeRate/exportOnTimeDeliveryRateItem', data)
  return response.data
}

/** 导出准时交付率表格 */
export async function exportOnTimeDeliveryRate(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/onTimeRate/exportOnTimeDeliveryRate', data)
  return response.data
}

/** 查询配送商列表（物流商） */
export async function queryDeliveryList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryDeliveryList')
  return response.data
}

// ============ 准时交付率（时间维度） API 接口 ============

/** 查询时间维度准时交付率数据 */
export async function queryOnTimeRateTime(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/onTimeRateTime/queryOnTimeRateTime', data)
  return response.data
}

/** 导出时间维度准时交付率数据 */
export async function exportOnTimeRateTime(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/onTimeRateTime/exportOnTimeRateTime', data)
  return response.data
}

// ============ 准时交付率-客户（LenovoCustomer） API 接口 ============

/** 查询端到端交付率原因分析数据 */
export async function queryEndToEndDeliveryRateReason(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/onTimeRate/queryEndToEndDeliveryRateReason', data)
  return response.data
}

/** 查询产品类型分组列表 */
export async function queryProductGroupList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryProductGroupList')
  return response.data
}

/** 查询 BTCP 指标列表（业务类型） */
export async function queryBtcpIndicateList() {
  const response = await transportDashboardClient.get('/kanban/v1/select/queryBtcpIndicateList')
  return response.data
}

// ============ 准时交付率-非联想客户（NonLenovoCustomer） API 接口 ============

/** 查询端到端交付率（非联想客户）数据 */
export async function queryEndToEndDeliveryRateCust(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/onTimeRate/queryEndToEndDeliveryRateCust', data)
  return response.data
}

/** 导出端到端交付率（非联想客户）数据 */
export async function exportEndToEndDeliveryRateCust(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/onTimeRate/exportEndToEndDeliveryRateCust', data)
  return response.data
}

export { transportDashboardClient, transportAiClient }
