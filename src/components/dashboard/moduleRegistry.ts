import { defineAsyncComponent, type Component } from 'vue'

/**
 * 网格配置 — 参考 refer 项目的 GridConfig
 */
export interface GridConfig {
  gridCols: number   // 网格列数
  gridRows: number   // 网格行数
  gridGap: number    // 网格间距 (px)
}

/**
 * 组件位置配置 — 参考 refer 项目的 componentItem
 */
export interface ComponentPosition {
  name: string       // 模块名称（对应 moduleRegistry 中的 name）
  x: number          // 列位置（从 1 开始）
  y: number          // 行位置（从 1 开始）
  width: number      // 占据列数
  height: number     // 占据行数
  zoom?: number      // 缩放比例（0.5-1.5），默认 1
}

/**
 * 页面元数据接口 — 参考 refer 项目的 Zone/Module 概念
 * 每个页面是一个独立的全屏视图，通过 QuickBar 切换
 */
export interface PageMeta {
  name: string                      // 页面标识符（唯一 key）
  title: string                     // 页面标题
  icon: string                      // 图标 key（QuickBar 导航用）
  gridConfig: GridConfig            // 该页面的网格配置
  components: ComponentPosition[]   // 页面内的组件布局
}

/**
 * 模块动作定义
 */
export interface ModuleAction {
  name: string           // 动作名称
  description: string    // 动作描述
  params?: {             // 参数定义
    [key: string]: {
      type: string       // 参数类型
      description: string // 参数描述
      required?: boolean  // 是否必填
    }
  }
}

/**
 * 模块元数据接口
 * 参考 refer 项目的 pageModules 数据结构
 */
export interface ModuleMeta {
  name: string          // 模块标识符（唯一 key）
  title: string         // 中文标题
  icon: string          // 图标 key（内置 SVG 映射）
  component: Component  // 异步组件
  defaultSpan?: number  // 默认网格跨度（1-24），scroll 模式下忽略
  order: number         // 排序序号
  actions?: ModuleAction[] // 模块支持的指令列表
}

/**
 * 页面注册表 — 每个页面是一个独立的全屏视图
 * 参考 refer 项目的 Zone 概念，通过 QuickBar 切换页面
 */
export const pageRegistry: PageMeta[] = [
  {
    name: 'cargoBanner',
    title: '智能体中心',
    icon: 'icon-yujing',
    gridConfig: { gridCols: 48, gridRows: 27, gridGap: 12 },
    components: [
      // 左侧 3 个卡片（各占 4×3 格子，横向排列）
      { name: 'cargoVolume',      x: 1,  y: 1, width: 4, height: 3, zoom: 1 },
      { name: 'onTime',           x: 5,  y: 1, width: 4, height: 3, zoom: 1 },
      { name: 'endToEnd',         x: 9,  y: 1, width: 4, height: 3, zoom: 1 },
      // 左侧下方：货量趋势
      { name: 'cargoTrend',       x: 1,  y: 4, width: 12, height: 8, zoom: 1 },
      // 左侧下方：签收信息
      { name: 'signingInformation', x: 1,  y: 12, width: 12, height: 8, zoom: 1 },
      // 左侧最下方：返单进展
      { name: 'reorderProgress', x: 1,  y: 20, width: 12, height: 8, zoom: 1 },
      // 中央：运输智能体
      { name: 'cargoBanner',      x: 13, y: 1, width: 24, height: 18, zoom: 1 },
      // 右侧 3 个卡片（各占 4×3 格子）
      { name: 'energyPricesCard', x: 37, y: 1,  width: 4, height: 3, zoom: 1 },
      { name: 'unitPrice',        x: 41, y: 1, width: 4, height: 3, zoom: 1 },
      { name: 'dryPrice',         x: 45, y: 1, width: 4, height: 3, zoom: 1 },
      // 右侧下方：能源价格图表
      { name: 'energyPrices',     x: 37, y: 4, width: 12, height: 8, zoom: 1 },
      // 右侧下方：运输异常图表
      { name: 'abnormalTransportation', x: 37, y: 12, width: 12, height: 8, zoom: 1 },
      // 右侧下方：运力池
      { name: 'capacityPool', x: 37, y: 20, width: 12, height: 8, zoom: 1 },
      // 中央下方：加急&重点客户风险（左）
      { name: 'urgentCustomer', x: 13, y: 19, width: 12, height: 9, zoom: 1 },
      // 中央下方：重大活动&极端天气影响（右）
      { name: 'majorEvents', x: 25, y: 19, width: 12, height: 9, zoom: 1 },
    ]
  },
  {
    name: 'mapPage',
    title: '地图',
    icon: 'icon-shuzihuadaping',
    gridConfig: { gridCols: 48, gridRows: 27, gridGap: 12 },
    components: [
      // 预留：后续在这里添加地图相关组件
      { name: 'mapPage', x: 1, y: 1, width: 48, height: 27, zoom: 1 },
    ]
  },
  {
    name: 'onTimeDelivery',
    title: '准时交付率',
    icon: 'icon-tubiao-zhexiantu',
    gridConfig: { gridCols: 48, gridRows: 27, gridGap: 12 },
    components: [
      // 仓储物流准时交付率模块（占 48x13）
      { name: 'warehousingLogistics', x: 1, y: 1, width: 48, height: 13, zoom: 1 },
      // 准时交付率-时间维度模块（占 48x14，两个模块合计占满 48x27）
      { name: 'timeDimension', x: 1, y: 14, width: 48, height: 14, zoom: 1 },
    ]
  },
  {
    name: 'onTimeDeliveryCustomer',
    title: '准时交付率-客户',
    icon: 'icon-wushuju',
    gridConfig: { gridCols: 48, gridRows: 27, gridGap: 12 },
    components: [
      // 准时交付率-客户模块（占 48x13）
      { name: 'lenovoCustomer', x: 1, y: 1, width: 48, height: 13, zoom: 1 },
      // 端到端准时交付率-非联想客户模块（占 48x14，两个模块合计占满 48x27）
      { name: 'nonLenovoCustomer', x: 1, y: 14, width: 48, height: 14, zoom: 1 },
    ]
  },
  {
    name: 'pfpKpiWarehouse',
    title: 'PFP KPI-仓库',
    icon: 'icon-shuzihuayingxiao',
    gridConfig: { gridCols: 48, gridRows: 27, gridGap: 12 },
    components: [
      { name: 'tobWarehousingCard', x: 1, y: 1, width: 48, height: 13, zoom: 1 },
      { name: 'tobWarehousingRank', x: 1, y: 14, width: 48, height: 14, zoom: 1 },
    ]
  },
  {
    name: 'pfpKpiTransport',
    title: 'PFP KPI-运输',
    icon: 'icon-falv',
    gridConfig: { gridCols: 48, gridRows: 27, gridGap: 12 },
    components: [
      { name: 'transportationLogisticsScores', x: 1, y: 1, width: 48, height: 13, zoom: 1 },
      { name: 'transportationLogisticsRank', x: 1, y: 14, width: 48, height: 14, zoom: 1 },
    ]
  },
  {
    name: 'pfpKpiCityDelivery',
    title: 'PFP KPI-城配',
    icon: 'icon-bumendongtai',
    gridConfig: { gridCols: 48, gridRows: 27, gridGap: 12 },
    components: [
      { name: 'cityLogisticsScores', x: 1, y: 1, width: 48, height: 13, zoom: 1 },
      { name: 'cityLogisticsRank', x: 1, y: 14, width: 48, height: 14, zoom: 1 },
    ]
  },
  {
    name: 'pfpKpiCustomer',
    title: 'PFP KPI-客户',
    icon: 'icon-guke',
    gridConfig: { gridCols: 48, gridRows: 27, gridGap: 12 },
    components: [
      { name: 'tclWarehousingScores', x: 1, y: 1, width: 48, height: 13, zoom: 1 },
      { name: 'transStorageKpiScore', x: 1, y: 14, width: 48, height: 14, zoom: 1 },
    ]
  },
  {
    name: 'pfpKpiToC',
    title: 'PFP KPI-ToC',
    icon: 'icon-daili',
    gridConfig: { gridCols: 48, gridRows: 27, gridGap: 12 },
    components: [
      { name: 'transportationDoaScores', x: 1, y: 1, width: 48, height: 13, zoom: 1 },
      { name: 'tocWarehousingScores', x: 1, y: 14, width: 48, height: 14, zoom: 1 },
    ]
  },
  {
    name: 'pfpKpiExpress',
    title: 'PFP KPI-运输快递业务',
    icon: 'icon-lianwangzhongxin',
    gridConfig: { gridCols: 48, gridRows: 27, gridGap: 12 },
    components: [
      { name: 'transportationOpenScores', x: 1, y: 1, width: 48, height: 13, zoom: 1 },
      { name: 'transportationExpressScores', x: 1, y: 14, width: 48, height: 14, zoom: 1 },
    ]
  },
]

/**
 * 模块注册表 — 所有可用的看板组件
 */
export const moduleRegistry: ModuleMeta[] = [
  {
    name: 'cargoBanner',
    title: '智能体中心',
    icon: 'alert',
    component: defineAsyncComponent(() => import('./modules/CargoBanner.vue')),
    defaultSpan: 24,
    order: 0,
    actions: [
      {
        name: 'openCardDetail',
        description: '放大查看指定卡片的详情弹窗（该模块不支持 single 全屏，只能通过此指令放大卡片）',
        params: {
          cardIndex: { type: 'number', description: '卡片索引（0=CDD达成率预警, 1=ISG电子标签预警, 2=超七天异常预警, 3=车辆安全监控）', required: true },
        },
      },
      {
        name: 'closeCardDetail',
        description: '关闭卡片详情弹窗',
      },
    ],
  },
  {
    name: 'mapPage',
    title: '地图',
    icon: 'map',
    component: defineAsyncComponent(() => import('./modules/cargoMap/MapPage.vue')),
    defaultSpan: 24,
    order: 15,
  },
  {
    name: 'warehousingLogistics',
    title: '仓储物流准时交付率',
    icon: 'delivery',
    component: defineAsyncComponent(() => import('./modules/WarehousingLogistics.vue')),
    defaultSpan: 24,
    order: 16,
  },
  {
    name: 'timeDimension',
    title: '准时交付率-时间维度',
    icon: 'delivery',
    component: defineAsyncComponent(() => import('./modules/TimeDimension.vue')),
    defaultSpan: 24,
    order: 17,
  },
  {
    name: 'lenovoCustomer',
    title: '准时交付率-客户',
    icon: 'delivery',
    component: defineAsyncComponent(() => import('./modules/LenovoCustomer.vue')),
    defaultSpan: 24,
    order: 18,
  },
  {
    name: 'nonLenovoCustomer',
    title: '端到端准时交付率-非联想客户',
    icon: 'delivery',
    component: defineAsyncComponent(() => import('./modules/NonLenovoCustomer.vue')),
    defaultSpan: 24,
    order: 19,
  },
  {
    name: 'tobWarehousingCard',
    title: 'PFP KPI-仓库',
    icon: 'delivery',
    component: defineAsyncComponent(() => import('./modules/TobWarehousingCard.vue')),
    defaultSpan: 24,
    order: 20,
  },
  {
    name: 'tobWarehousingRank',
    title: 'PFP KPI-仓库排名',
    icon: 'delivery',
    component: defineAsyncComponent(() => import('./modules/TobWarehousingRank.vue')),
    defaultSpan: 24,
    order: 21,
  },
  {
    name: 'transportationLogisticsScores',
    title: 'PFP KPI-运输',
    icon: 'delivery',
    component: defineAsyncComponent(() => import('./modules/TransportationLogisticsScores.vue')),
    defaultSpan: 24,
    order: 22,
  },
  {
    name: 'transportationLogisticsRank',
    title: 'PFP KPI-运输排名',
    icon: 'delivery',
    component: defineAsyncComponent(() => import('./modules/TransportationLogisticsRank.vue')),
    defaultSpan: 24,
    order: 23,
  },
  {
    name: 'cityLogisticsScores',
    title: 'PFP KPI-城配',
    icon: 'delivery',
    component: defineAsyncComponent(() => import('./modules/CityLogisticsScores.vue')),
    defaultSpan: 24,
    order: 24,
  },
  {
    name: 'cityLogisticsRank',
    title: 'PFP KPI-城配排名',
    icon: 'delivery',
    component: defineAsyncComponent(() => import('./modules/CityLogisticsRank.vue')),
    defaultSpan: 24,
    order: 25,
  },
  {
    name: 'tclWarehousingScores',
    title: 'TCL华星物流商KPI评分',
    icon: 'delivery',
    component: defineAsyncComponent(() => import('./modules/TclWarehousingScores.vue')),
    defaultSpan: 24,
    order: 26,
  },
  {
    name: 'transStorageKpiScore',
    title: '运输仓储多业务KPI评分',
    icon: 'delivery',
    component: defineAsyncComponent(() => import('./modules/TransStorageKpiScore.vue')),
    defaultSpan: 24,
    order: 27,
  },
  {
    name: 'transportationDoaScores',
    title: '运输DOA KPI评分',
    icon: 'delivery',
    component: defineAsyncComponent(() => import('./modules/TransportationDoaScores.vue')),
    defaultSpan: 24,
    order: 28,
  },
  {
    name: 'tocWarehousingScores',
    title: 'ToC物流商KPI评分',
    icon: 'delivery',
    component: defineAsyncComponent(() => import('./modules/TocWarehousingScores.vue')),
    defaultSpan: 24,
    order: 29,
  },
  {
    name: 'transportationOpenScores',
    title: '运输开放业务KPI评分',
    icon: 'delivery',
    component: defineAsyncComponent(() => import('./modules/TransportationOpenScores.vue')),
    defaultSpan: 24,
    order: 30,
  },
  {
    name: 'transportationExpressScores',
    title: '运输快递KPI评分',
    icon: 'delivery',
    component: defineAsyncComponent(() => import('./modules/TransportationExpressScores.vue')),
    defaultSpan: 24,
    order: 31,
  },
  // ====== 左侧卡片 ======
  {
    name: 'cargoVolume',
    title: '累计货量',
    icon: 'volume',
    component: defineAsyncComponent(() => import('./modules/CargoVolume.vue')),
    defaultSpan: 8,
    order: 1,
  },
  {
    name: 'pickupRate',
    title: '提货及时率',
    icon: 'rate',
    component: defineAsyncComponent(() => import('./modules/PickupRate.vue')),
    defaultSpan: 8,
    order: 2,
  },
  {
    name: 'onTime',
    title: '提货及时率',
    icon: 'time',
    component: defineAsyncComponent(() => import('./modules/OnTime.vue')),
    defaultSpan: 8,
    order: 3,
  },
  {
    name: 'endToEnd',
    title: '准时交付率',
    icon: 'delivery',
    component: defineAsyncComponent(() => import('./modules/EndToEnd.vue')),
    defaultSpan: 8,
    order: 4,
  },
  // ====== 右侧卡片 ======
  {
    name: 'energyPricesCard',
    title: '能源价格',
    icon: 'energy',
    component: defineAsyncComponent(() => import('./modules/EnergyPricesCard.vue')),
    defaultSpan: 8,
    order: 5,
  },
  {
    name: 'energyPrices',
    title: '能源价格趋势',
    icon: 'energy',
    component: defineAsyncComponent(() => import('./modules/EnergyPrices.vue')),
    defaultSpan: 12,
    order: 10,
  },
  {
    name: 'abnormalTransportation',
    title: '运输异常',
    icon: 'alert',
    component: defineAsyncComponent(() => import('./modules/AbnormalTransportation.vue')),
    defaultSpan: 12,
    order: 11,
  },
  {
    name: 'capacityPool',
    title: '运力池',
    icon: 'truck',
    component: defineAsyncComponent(() => import('./modules/CapacityPool.vue')),
    defaultSpan: 12,
    order: 12,
  },
  {
    name: 'urgentCustomer',
    title: '加急&重点客户风险',
    icon: 'alert',
    component: defineAsyncComponent(() => import('./modules/UrgentCustomer.vue')),
    defaultSpan: 12,
    order: 13,
  },
  {
    name: 'majorEvents',
    title: '重大活动&极端天气影响',
    icon: 'alert',
    component: defineAsyncComponent(() => import('./modules/MajorEvents.vue')),
    defaultSpan: 12,
    order: 14,
  },
  {
    name: 'unitPrice',
    title: '干单价',
    icon: 'price',
    component: defineAsyncComponent(() => import('./modules/UnitPrice.vue')),
    defaultSpan: 8,
    order: 6,
  },
  {
    name: 'dryPrice',
    title: '配单价',
    icon: 'delivery',
    component: defineAsyncComponent(() => import('./modules/DryPrice.vue')),
    defaultSpan: 8,
    order: 7,
  },
  // ====== 其他模块 ======
  {
    name: 'cargoTrend',
    title: '货量趋势',
    icon: 'trend',
    component: defineAsyncComponent(() => import('./modules/CargoTrend.vue')),
    defaultSpan: 12,
    order: 8,
  },
  {
    name: 'signingInformation',
    title: '签收信息',
    icon: 'sign',
    component: defineAsyncComponent(() => import('./modules/SigningInformation.vue')),
    defaultSpan: 12,
    order: 9,
    actions: [
      {
        name: 'openDetail',
        description: '打开未签收明细弹窗',
      },
      {
        name: 'closeDetail',
        description: '关闭弹窗',
      },
      {
        name: 'setFilters',
        description: '设置筛选条件（所有参数可选，只传需要设置的字段）',
        params: {
          fromWarehouse: { type: 'string', description: '始发仓' },
          toProvince: { type: 'string', description: '目的省' },
          toRdc: { type: 'string', description: '目的RDC' },
          modeType: { type: 'string', description: '配送模式（区配/直送）' },
        },
      },
      {
        name: 'setPage',
        description: '设置表格页码',
        params: {
          page: { type: 'number', description: '页码', required: true },
        },
      },
      {
        name: 'setPageSize',
        description: '设置每页显示条数',
        params: {
          size: { type: 'number', description: '每页条数', required: true },
        },
      },
      {
        name: 'resetFilters',
        description: '重置所有筛选条件',
      },
      {
        name: 'export',
        description: '导出数据',
      },
    ],
  },
  {
    name: 'reorderProgress',
    title: '返单进展',
    icon: 'progress',
    component: defineAsyncComponent(() => import('./modules/ReorderProgress.vue')),
    defaultSpan: 12,
    order: 10,
  },
]

/** 按 order 排序后的模块列表 */
export function sortedModules(): ModuleMeta[] {
  return [...moduleRegistry].sort((a, b) => a.order - b.order)
}

/** 按 name 查找模块 */
export function getModuleByName(name: string): ModuleMeta | undefined {
  return moduleRegistry.find(m => m.name === name)
}

/** 获取所有模块 name 列表（按 order 排序） */
export function getModuleNames(): string[] {
  return sortedModules().map(m => m.name)
}

/** name → title 映射 */
export function getModuleTitleMap(): Record<string, string> {
  return Object.fromEntries(moduleRegistry.map(m => [m.name, m.title]))
}

/** name → component 映射（供 ModulesRender 使用） */
export function getModuleComponentMap(): Record<string, Component> {
  return Object.fromEntries(moduleRegistry.map(m => [m.name, m.component]))
}

/** 按 name 查找页面 */
export function getPageByName(name: string): PageMeta | undefined {
  return pageRegistry.find(p => p.name === name)
}

/** 获取所有页面列表 */
export function getPages(): PageMeta[] {
  return [...pageRegistry]
}

// ========== 模块分类 ==========

/** 大模块（支持 single/grid 布局） */
export const LARGE_MODULES = [
  'energyPrices',
  'abnormalTransportation',
  'capacityPool',
  'urgentCustomer',
  'majorEvents',
  'cargoTrend',
  'signingInformation',
  'reorderProgress',
]

/** 小卡片模块（仅 scroll 页面内展示） */
export const SMALL_MODULES = [
  'cargoVolume',
  'onTime',
  'endToEnd',
  'energyPricesCard',
  'unitPrice',
  'dryPrice',
]

/** 特殊模块（页面容器/独占整页） */
export const SPECIAL_MODULES = [
  'cargoBanner',
  'mapPage',
]

/** 判断模块是否为大模块（支持 single/grid） */
export function isLargeModule(module: string): boolean {
  return LARGE_MODULES.includes(module)
}

/** 判断模块是否为小卡片 */
export function isSmallModule(module: string): boolean {
  return SMALL_MODULES.includes(module)
}

/** 获取指定页面内的所有模块名 */
export function getPageModuleNames(pageName: string): string[] {
  const page = getPageByName(pageName)
  if (!page) return []
  return page.components.map(c => c.name)
}

/** 获取指定页面内的所有模块元信息（含 title） */
export function getPageModuleMetaList(pageName: string): { name: string; title: string }[] {
  const names = getPageModuleNames(pageName)
  const titleMap = getModuleTitleMap()
  return names.map(name => ({ name, title: titleMap[name] || name }))
}

/** 查找模块所在页面（返回页面 name，找不到返回 null） */
export function findModulePage(module: string): string | null {
  for (const page of pageRegistry) {
    if (page.components.some(c => c.name === module)) {
      return page.name
    }
  }
  return null
}
