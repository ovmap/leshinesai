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
 * Scroll 布局配置
 */
export interface ScrollLayout {
  gridConfig: GridConfig           // 该模块的网格配置
  components: ComponentPosition[]  // 模块内的组件列表
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
  order: number         // 排序序号（控制 QuickBar 和 scroll 顺序）
  scrollLayout?: ScrollLayout  // scroll 模式下的网格布局配置
}

/**
 * 模块注册表 — 所有可用的看板模块
 *
 * 新增模块只需在此添加一条记录即可，
 * 不再需要修改 DashboardView.vue / ModulesRender.vue / dashboardCLI.ts 多处
 */
export const moduleRegistry: ModuleMeta[] = [
  {
    name: 'cargoBanner',
    title: '智能体异常预警',
    icon: 'alert',
    component: defineAsyncComponent(() => import('./modules/CargoBanner.vue')),
    defaultSpan: 24,
    order: 0,
    scrollLayout: {
      gridConfig: { gridCols: 48, gridRows: 27, gridGap: 12 },
      components: [
        { name: 'cargoBanner', x: 13, y: 1, width: 24, height: 18, zoom: 1 }
      ]
    }
  },
  {
    name: 'cargoTrend',
    title: '货量趋势',
    icon: 'trend',
    component: defineAsyncComponent(() => import('./modules/CargoTrend.vue')),
    defaultSpan: 12,
    order: 1,
  },
  {
    name: 'signingInformation',
    title: '签收信息',
    icon: 'sign',
    component: defineAsyncComponent(() => import('./modules/SigningInformation.vue')),
    defaultSpan: 12,
    order: 2,
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
