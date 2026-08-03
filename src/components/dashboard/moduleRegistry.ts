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
}

/**
 * 页面注册表 — 每个页面是一个独立的全屏视图
 * 参考 refer 项目的 Zone 概念，通过 QuickBar 切换页面
 */
export const pageRegistry: PageMeta[] = [
  {
    name: 'cargoBanner',
    title: '运输智能体',
    icon: 'alert',
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
    icon: 'map',
    gridConfig: { gridCols: 48, gridRows: 27, gridGap: 12 },
    components: [
      // 预留：后续在这里添加地图相关组件
      { name: 'mapPage', x: 1, y: 1, width: 48, height: 27, zoom: 1 },
    ]
  },
]

/**
 * 模块注册表 — 所有可用的看板组件
 */
export const moduleRegistry: ModuleMeta[] = [
  {
    name: 'cargoBanner',
    title: '运输智能体',
    icon: 'alert',
    component: defineAsyncComponent(() => import('./modules/CargoBanner.vue')),
    defaultSpan: 24,
    order: 0,
  },
  {
    name: 'mapPage',
    title: '地图',
    icon: 'map',
    component: defineAsyncComponent(() => import('./modules/cargoMap/MapPage.vue')),
    defaultSpan: 24,
    order: 15,
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
