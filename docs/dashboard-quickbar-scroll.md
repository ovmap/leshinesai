# Dashboard QuickBar 滚动导航 + scroll 布局方案

## 一、目标

在看板中新增 **scroll 布局模式** + **QuickBar 右侧导航**，参考 `refer` 项目的实现：
- 所有模块垂直堆叠，每个模块独占一页（全屏高度），形成可滚动的长页面
- 右侧悬浮 QuickBar 导航栏，支持收起/展开、点击跳转、滚动高亮
- 新增两个页面：`货量趋势` 和 `签收信息` 各一个独立页面，通过 QuickBar 导航切换
- 统一模块注册表，集中管理模块元数据（name/title/icon/组件），替代现在分散在多处的硬编码

---

## 二、整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│  DashboardView.vue                                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  dashboard-header (标题 + 操作按钮)                          │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │                     │                          ┌──────────┐ │ │
│  │  dashboard-content  │                          │ QuickBar │ │ │
│  │                     │                          │          │ │ │
│  │  layout === 'scroll'时:                       │  ● 货量  │ │ │
│  │  ┌─────────────────┐                          │  ● 签收  │ │ │
│  │  │ .view-item      │ ← 模块1 (全屏高度)       │          │ │ │
│  │  │  ModulesRender  │                          │  ──────  │ │ │
│  │  ├─────────────────┤                          │  收起→   │ │ │
│  │  │ .view-item      │ ← 模块2 (全屏高度)       └──────────┘ │ │
│  │  │  ModulesRender  │                                       │ │
│  │  ├─────────────────┤                          (鼠标悬停展开) │ │
│  │  │ ...更多模块...   │                                       │ │
│  │  └─────────────────┘                                       │ │
│  │                                                             │ │
│  │  layout === 'grid'时: (现有行为不变)                         │ │
│  │  ┌──────────┬──────────┐                                   │ │
│  │  │ 模块1    │ 模块2    │                                   │ │
│  │  └──────────┴──────────┘                                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 三、模块注册表（统一配置）

### 3.1 新建 `src/components/dashboard/moduleRegistry.ts`

集中管理所有模块的元数据，替代现在分散在 `DashboardView.vue`、`ModulesRender.vue`、`dashboardCLI.ts` 中的硬编码。

```typescript
// src/components/dashboard/moduleRegistry.ts
import { defineAsyncComponent, type Component } from 'vue'

/**
 * 模块元数据接口
 * 参考 refer 项目的 pageModules 数据结构
 */
export interface ModuleMeta {
  name: string          // 模块标识符（唯一 key）
  title: string         // 中文标题
  icon: string          // 图标（SVG path 或 iconfont class）
  component: Component  // 异步组件
  defaultSpan?: number  // 默认网格跨度（1-24），scroll 模式下忽略
  order: number         // 排序序号（控制 QuickBar 和 scroll 顺序）
}

/**
 * 模块注册表 — 所有可用的看板模块
 * 
 * 新增模块只需在此添加一条记录即可，
 * 不再需要修改 DashboardView.vue / ModulesRender.vue / dashboardCLI.ts 多处
 */
export const moduleRegistry: ModuleMeta[] = [
  {
    name: 'cargoTrend',
    title: '货量趋势',
    icon: 'trend',        // 使用内置 SVG 图标 key
    component: defineAsyncComponent(() => import('./modules/CargoTrend.vue')),
    defaultSpan: 12,
    order: 1,
  },
  {
    name: 'signingInformation',
    title: '签收信息',
    icon: 'sign',         // 使用内置 SVG 图标 key
    component: defineAsyncComponent(() => import('./modules/SigningInformation.vue')),
    defaultSpan: 12,
    order: 2,
  },
]

/**
 * 按 order 排序后的模块列表（供各组件直接使用）
 */
export const sortedModules = () => [...moduleRegistry].sort((a, b) => a.order - b.order)

/**
 * 按 name 查找模块
 */
export function getModuleByName(name: string): ModuleMeta | undefined {
  return moduleRegistry.find(m => m.name === name)
}

/**
 * 获取所有模块 name 列表（按 order 排序）
 */
export function getModuleNames(): string[] {
  return sortedModules().map(m => m.name)
}

/**
 * name → title 映射
 */
export function getModuleTitleMap(): Record<string, string> {
  return Object.fromEntries(moduleRegistry.map(m => [m.name, m.title]))
}

/**
 * name → component 映射（供 ModulesRender 使用）
 */
export function getModuleComponentMap(): Record<string, Component> {
  return Object.fromEntries(moduleRegistry.map(m => [m.name, m.component]))
}
```

### 3.2 改造影响

| 原文件 | 原代码 | 改为 |
|--------|--------|------|
| `ModulesRender.vue` | `moduleComponents` 硬编码 | `getModuleComponentMap()` |
| `DashboardView.vue` | `moduleTitleMap` 硬编码 | `getModuleTitleMap()` |
| `dashboardCLI.ts` | `AVAILABLE_MODULES` / `MODULE_NAMES` 硬编码 | `getModuleNames()` / `getModuleTitleMap()` |

---

## 四、scroll 布局模式

### 4.1 dashboardControlStore 扩展

```typescript
// src/stores/dashboardControlStore.ts

// currentLayout 类型扩展
const currentLayout = ref<'single' | 'grid' | 'cards' | 'scroll'>('grid')

// setLayout 参数类型同步扩展
function setLayout(layout: 'single' | 'grid' | 'cards' | 'scroll') {
  currentLayout.value = layout
}
```

### 4.2 DashboardView.vue 改造

当 `layout === 'scroll'` 时，渲染结构变为垂直堆叠：

```html
<!-- dashboard-content 区域 -->
<div class="dashboard-content" ref="contentRef">
  
  <!-- ========== scroll 布局：垂直堆叠 ========== -->
  <div v-if="controlStore.currentLayout === 'scroll'" class="scroll-container" ref="scrollContainerRef">
    <div
      v-for="mod in scrollModules"
      :key="mod.name"
      class="view-item"
      :data-module="mod.name"
    >
      <ModulesRender
        :modules="[{ name: mod.name, span: 24, title: mod.title }]"
        :filters="controlStore.moduleFilters"
        layout="single"
        :key="refreshKey"
      />
    </div>
  </div>

  <!-- ========== 其他布局：现有逻辑 ========== -->
  <ModulesRender
    v-else
    :modules="displayModules"
    :filters="controlStore.moduleFilters"
    :layout="controlStore.currentLayout"
    :key="refreshKey"
  />
</div>

<!-- QuickBar（仅 scroll 布局时显示） -->
<QuickBar
  v-if="controlStore.currentLayout === 'scroll'"
  :modules="scrollModules"
  ref="quickBarRef"
/>
```

```typescript
// 计算 scroll 模式下的模块列表
const scrollModules = computed(() => {
  const active = controlStore.activeModules
  return sortedModules()
    .filter(m => active.includes(m.name))
    .sort((a, b) => a.order - b.order)
})
```

### 4.3 scroll 布局的 CSS

```css
/* scroll 模式：内容区可滚动 */
.dashboard-content {
  position: relative;
  z-index: 1;
  flex: 1;
  overflow: hidden;  /* 默认不可滚动（grid/single 模式） */
}

/* scroll 容器 */
.scroll-container {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  scroll-behavior: smooth;
}

/* 每个模块占满一屏 */
.scroll-container .view-item {
  width: 100%;
  min-height: calc(100vh - 60px);  /* 减去 header 高度 */
  padding: 16px;
  box-sizing: border-box;
}
```

---

## 五、QuickBar 组件

### 5.1 新建 `src/components/dashboard/QuickBar.vue`

参考 `refer/src/views/home/components/QuickBar/index.vue`，适配看板的深色科技风格。

```vue
<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount, computed } from 'vue'
import type { ModuleMeta } from './moduleRegistry'

const props = defineProps<{
  modules: ModuleMeta[]
}>()

const activeIndex = ref(0)
const isExpanded = ref(false)
let isClickTo = false
let clearClickTimer: ReturnType<typeof setTimeout> | null = null

// 滚动容器引用（由父组件 DashboardView 传入或通过 DOM 查询获取）
let scrollContainer: HTMLElement | null = null
// 每个模块的顶部偏移量
let moduleTops: number[] = []
// 每个模块的高度
let moduleHeights: number[] = []
// header 高度
let headerHeight = 0

/**
 * 初始化锚点 — 计算每个模块的位置
 * 参考 refer 项目的 initAnchor()
 */
function initAnchor() {
  scrollContainer = document.querySelector('.scroll-container')
  if (!scrollContainer) return

  const headerEl = document.querySelector('.dashboard-header')
  headerHeight = headerEl?.clientHeight || 0

  const items = scrollContainer.querySelectorAll('.view-item')
  moduleTops = []
  moduleHeights = []

  let cumTop = 0
  items.forEach((item) => {
    moduleTops.push(cumTop)
    moduleHeights.push(item.clientHeight)
    cumTop += item.clientHeight
  })

  nextTick(() => {
    intoView(0)
  })
}

/**
 * 点击导航项 → 滚动到对应模块
 * 参考 refer 项目的 intoView()
 */
function intoView(index: number) {
  if (!scrollContainer) return

  isClickTo = true
  activeIndex.value = index

  const targetTop = moduleTops[index] || 0

  scrollContainer.scrollTo({
    top: targetTop,
    behavior: 'smooth',
  })

  // 1.5 秒后清除点击标记，避免滚动事件干扰
  if (clearClickTimer) clearTimeout(clearClickTimer)
  clearClickTimer = setTimeout(() => {
    isClickTo = false
  }, 1500)
}

/**
 * 滚动监听 → 自动高亮当前模块
 * 参考 refer 项目的 setActiveIndex()
 */
function setActiveIndex() {
  if (isClickTo || !scrollContainer) return

  const scrollTop = scrollContainer.scrollTop
  let i = 0

  for (let index = 0; index < moduleTops.length; index++) {
    const cur = moduleTops[index]
    const nex = moduleTops[index + 1]
    if (scrollTop >= cur && ((nex && scrollTop < nex) || !nex)) {
      i = index
      break
    }
  }

  activeIndex.value = i
}

/**
 * 鼠标悬停展开
 */
function handleMouseEnter() {
  isExpanded.value = true
}

function handleMouseLeave() {
  isExpanded.value = false
}

/**
 * 窗口 resize 时重新计算锚点
 */
function handleResize() {
  setTimeout(() => {
    initAnchor()
  }, 100)
}

onMounted(() => {
  // 延迟初始化，等待 DOM 渲染完成
  nextTick(() => {
    initAnchor()
  })

  // 监听滚动容器的滚动事件
  // 使用 setTimeout 确保 scroll-container 已渲染
  setTimeout(() => {
    const container = document.querySelector('.scroll-container')
    if (container) {
      container.addEventListener('scroll', setActiveIndex)
    }
  }, 0)

  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  const container = document.querySelector('.scroll-container')
  if (container) {
    container.removeEventListener('scroll', setActiveIndex)
  }
  window.removeEventListener('resize', handleResize)
  if (clearClickTimer) clearTimeout(clearClickTimer)
})

// 暴露 initAnchor 给父组件
defineExpose({ initAnchor })
</script>

<template>
  <div
    class="quickbar-box"
    :class="{ expanded: isExpanded }"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- 收起状态：向左箭头 -->
    <div v-if="!isExpanded" class="collapsed-arrow" @click.stop="isExpanded = true">
      <div class="arrow-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 19l-7-7 7-7" />
        </svg>
      </div>
    </div>

    <!-- 展开状态：导航列表 -->
    <template v-if="isExpanded">
      <div class="navi-list">
        <div
          class="navi-item"
          :class="{ active: index === activeIndex }"
          @click="intoView(index)"
          v-for="(mod, index) in modules"
          :key="mod.name"
          :title="mod.title"
        >
          <!-- 图标区域 — 使用内置 SVG 图标 -->
          <div class="navi-icon">
            <!-- 货量趋势图标 -->
            <svg v-if="mod.icon === 'trend'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3v18h18" />
              <path d="M7 16l4-8 4 4 4-8" />
            </svg>
            <!-- 签收信息图标 -->
            <svg v-else-if="mod.icon === 'sign'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="10" />
            </svg>
            <!-- 默认图标 -->
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
          </div>
          <!-- 模块名称（hover 时显示在左侧） -->
          <div class="navi-label">
            <span>{{ mod.title }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.quickbar-box {
  position: fixed;
  top: 45%;
  right: 12px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 48px;
  padding: 8px 0;
  border-radius: 12px;
  transform: translateY(-50%);
  user-select: none;
  transition: background-color 0.3s ease, box-shadow 0.3s ease;
}

/* 收起状态 */
.quickbar-box:not(.expanded) {
  background: transparent;
}

/* 展开状态 */
.quickbar-box.expanded {
  background: rgba(8, 31, 64, 0.85);
  border: 1px solid rgba(74, 158, 255, 0.35);
  box-shadow: 0 0 20px rgba(74, 158, 255, 0.15),
              inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
}

/* 收起时的箭头 */
.collapsed-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 48px;
  background: rgba(8, 31, 64, 0.8);
  border: 1px solid rgba(74, 158, 255, 0.5);
  border-radius: 16px 0 0 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.collapsed-arrow:hover {
  background: rgba(29, 58, 112, 0.9);
  border-color: rgba(74, 158, 255, 0.7);
  transform: translateX(-3px);
}

.arrow-icon {
  width: 16px;
  height: 16px;
  color: rgba(153, 166, 204, 0.8);
}

.collapsed-arrow:hover .arrow-icon {
  color: #fff;
}

/* 导航列表 */
.navi-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

/* 导航项 */
.navi-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.25s ease;
}

.navi-item:hover {
  background: rgba(59, 130, 246, 0.2);
}

.navi-item.active {
  background: rgba(43, 167, 255, 0.35);
  box-shadow: 0 0 8px rgba(43, 167, 255, 0.3);
}

/* 图标 */
.navi-icon {
  width: 20px;
  height: 20px;
  color: rgba(255, 255, 255, 0.75);
}

.navi-item.active .navi-icon {
  color: #fff;
}

/* 标签名（显示在左侧） */
.navi-label {
  position: absolute;
  top: 50%;
  right: 100%;
  display: none;
  padding: 4px 10px;
  margin-right: 8px;
  font-size: 12px;
  color: #e2e8f0;
  white-space: nowrap;
  background: rgba(8, 31, 64, 0.9);
  border: 1px solid rgba(74, 158, 255, 0.4);
  border-radius: 4px;
  transform: translateY(-50%);
  pointer-events: none;
  box-shadow: 0 0 8px rgba(74, 158, 255, 0.2);
}

.navi-item:hover .navi-label {
  display: block;
}
</style>
```

### 5.2 与 refer 项目 QuickBar 的对比

| 特性 | refer 项目 | 我们的实现 |
|------|-----------|-----------|
| 定位方式 | `position: fixed; right: 1rem` | 相同 |
| 收起/展开 | 箭头 + mouseenter/leave | 相同 |
| 滚动定位 | `window.scrollTo` | `scrollContainer.scrollTo`（容器内滚动，非页面滚动） |
| 锚点计算 | `document.querySelectorAll('.view-item')` | 相同 |
| 滚动监听 | `document.addEventListener('scroll')` | `scrollContainer.addEventListener('scroll')` |
| 高亮逻辑 | `scrollTop >= cur && scrollTop < nex` | 相同 |
| 图标 | iconfont | 内置 SVG（不依赖 iconfont） |
| 编辑功能 | 编辑/重置/退出 | 暂不支持（后续可扩展） |
| 视觉风格 | 浅色主题 | 深色科技风（与看板统一） |

---

## 六、ModulesRender.vue 改造

### 6.1 使用模块注册表

```vue
<script setup lang="ts">
import { getModuleComponentMap } from './moduleRegistry'

const moduleComponents = getModuleComponentMap()

export interface ModuleConfig {
  name: string
  span?: number
  title?: string
}

const props = defineProps<{
  modules: ModuleConfig[]
  filters?: Record<string, Record<string, any>>
  layout?: 'single' | 'grid' | 'cards' | 'scroll'
}>()

function getModuleFilters(moduleName: string): Record<string, any> {
  return props.filters?.[moduleName] || {}
}
</script>
```

### 6.2 模板不变

模板部分保持现有逻辑不变，`scroll` 模式下由 `DashboardView.vue` 直接控制渲染结构（每个模块单独调用一次 `ModulesRender`），`ModulesRender` 本身不需要感知 `scroll` 布局。

---

## 七、dashboardCLI.ts 改造

### 7.1 使用模块注册表

```typescript
import { getModuleNames, getModuleTitleMap } from '../components/dashboard/moduleRegistry'

// 动态获取，不再硬编码
const AVAILABLE_MODULES = getModuleNames()
const MODULE_NAMES = getModuleTitleMap()
```

### 7.2 validLayouts 扩展

```typescript
async function handleLayout(args?: Record<string, any>): Promise<string> {
  const layout = args?.layout || 'grid'
  const validLayouts = ['single', 'grid', 'cards', 'scroll']  // 新增 scroll

  if (!validLayouts.includes(layout)) {
    return `错误: 无效布局 "${layout}"。可选: ${validLayouts.join(', ')}`
  }
  // ...
}
```

---

## 八、functions.json 工具定义更新

```json
{
  "layout": {
    "type": "string",
    "enum": ["single", "grid", "cards", "scroll"],
    "description": "布局模式 (show/layout 命令)。scroll=垂直滚动+QuickBar导航, grid=网格并排, single=单模块全屏, cards=卡片流"
  }
}
```

---

## 九、完整文件改动清单

| 操作 | 文件路径 | 改动说明 |
|------|---------|---------|
| **新建** | `src/components/dashboard/moduleRegistry.ts` | 统一模块注册表 |
| **新建** | `src/components/dashboard/QuickBar.vue` | 右侧悬浮导航组件 |
| **修改** | `src/stores/dashboardControlStore.ts` | `currentLayout` 联合类型加 `'scroll'` |
| **修改** | `src/components/DashboardView.vue` | scroll 布局分支 + 集成 QuickBar |
| **修改** | `src/components/dashboard/ModulesRender.vue` | 改用 `moduleRegistry` 获取组件映射 |
| **修改** | `src/utils/dashboardCLI.ts` | 改用 `moduleRegistry`、`validLayouts` 加 `'scroll'` |
| **修改** | `resources/functions.json` | layout enum 加 `'scroll'` |

---

## 十、数据流与交互流程

### 10.1 用户通过 CLI 切换到 scroll 布局

```
用户: "用滚动模式看看板"
  ↓
AI → dashboard_command({ command: "layout", args: { layout: "scroll" } })
  ↓
dashboardCLI.ts → handleLayout({ layout: "scroll" })
  ↓ IPC: dashboard:control
DashboardView.vue → handleCommand({ command: "layout", args: { layout: "scroll" } })
  ↓
controlStore.setLayout('scroll')
  ↓
DashboardView 响应:
  ├─ 渲染 scroll-container + view-item 列表
  ├─ 渲染 QuickBar 组件
  └─ QuickBar.initAnchor() 计算锚点位置
```

### 10.2 用户点击 QuickBar 导航

```
用户点击 QuickBar 的 "签收信息"
  ↓
QuickBar.intoView(1)
  ↓
scrollContainer.scrollTo({ top: moduleTops[1], behavior: 'smooth' })
  ↓
activeIndex = 1（高亮 "签收信息" 导航项）
  ↓
1.5 秒后 isClickTo = false，恢复滚动监听
```

### 10.3 用户手动滚动

```
用户滚动 scroll-container
  ↓
scroll 事件触发 setActiveIndex()
  ↓
根据 scrollTop 计算当前所在模块索引
  ↓
activeIndex 更新 → QuickBar 高亮对应导航项
```

---

## 十一、scroll 模式下的布局细节

### 11.1 页面结构

```
┌──────────────────────────────────────────────────────────────┐
│  Header (60px)                                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  view-item: 货量趋势                                  │    │
│  │  ┌────────────────────────────────────────────────┐  │    │
│  │  │  module-card (span=24, 占满宽度)                │  │    │
│  │  │  ┌──────────────────────────────────────────┐  │  │    │
│  │  │  │  CargoTrend.vue                          │  │  │    │
│  │  │  └──────────────────────────────────────────┘  │  │    │
│  │  └────────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  view-item: 签收信息                                  │    │
│  │  ┌────────────────────────────────────────────────┐  │    │
│  │  │  module-card (span=24, 占满宽度)                │  │    │
│  │  │  ┌──────────────────────────────────────────┐  │  │    │
│  │  │  │  SigningInformation.vue                  │  │  │    │
│  │  │  └──────────────────────────────────────────┘  │  │    │
│  │  └────────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│                                              ┌──────────┐   │
│                                              │ QuickBar │   │
│                                              │  ● 货量  │   │
│                                              │  ○ 签收  │   │
│                                              │  ──────  │   │
│                                              │  ←       │   │
│                                              └──────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 11.2 每个 view-item 的高度策略

- **默认**: `min-height: calc(100vh - header高度)`，确保每个模块至少占满一屏
- 如果模块内容超过一屏（如长表格），view-item 会自动撑高，模块自然滚动
- QuickBar 的锚点计算基于实际 `clientHeight`，不受固定高度限制

### 11.3 scroll 模式与 grid/single 模式的关系

- `scroll` 模式下，DashboardView 内部为每个模块单独调用一次 `ModulesRender`（layout='single'），不需要修改 ModulesRender 的渲染逻辑
- 用户可以随时通过 CLI 切回 `grid` 或 `single` 模式
- QuickBar 仅在 `scroll` 模式下显示

---

## 十二、新增模块的流程（改造前 vs 改造后）

### 改造前（需改 4 处）

1. `ModulesRender.vue` → `moduleComponents` 添加异步组件
2. `DashboardView.vue` → `moduleTitleMap` 添加中文标题
3. `dashboardCLI.ts` → `AVAILABLE_MODULES` + `MODULE_NAMES` 添加
4. `dashboardControlStore.ts` → 如需默认显示，修改 `activeModules`

### 改造后（只需改 1 处）

在 `moduleRegistry.ts` 中添加一条记录：

```typescript
{
  name: 'newModule',
  title: '新模块',
  icon: 'default',
  component: defineAsyncComponent(() => import('./modules/NewModule.vue')),
  defaultSpan: 12,
  order: 3,
}
```

QuickBar 导航、CLI 命令、模块列表等全部自动从注册表读取，无需其他改动。

---

## 十三、后续可扩展的功能

参考 refer 项目的完整能力，以下功能可在后续迭代中逐步加入：

| 功能 | 说明 | 参考来源 |
|------|------|---------|
| 模块编辑模式 | QuickBar 中增加"编辑"按钮，进入编辑态后可调整模块内组件布局 | refer QuickBar `editModule` |
| 模块重置 | 编辑后支持重置回默认配置 | refer QuickBar `resetModule` |
| 模块排序 | 通过拖拽 QuickBar 导航项调整模块顺序 | refer configs/modules `onDragEnd` |
| 模块增删 | 通过管理界面动态添加/删除模块 | refer configs/modules `handleAdd/handleDelete` |
| 持久化配置 | 将模块配置持久化到 localStorage 或后端 | refer API `zoneConfig` |
| 布局切换动画 | grid ↔ scroll 切换时的过渡动画 | — |

---

## 十四、实施步骤

### Step 1: 模块注册表
- 新建 `moduleRegistry.ts`
- 改造 `ModulesRender.vue`、`DashboardView.vue`、`dashboardCLI.ts` 改用注册表

### Step 2: scroll 布局
- `dashboardControlStore.ts` 扩展 layout 类型
- `DashboardView.vue` 新增 scroll 布局分支
- `dashboardCLI.ts` + `functions.json` 支持 `scroll`

### Step 3: QuickBar 组件
- 新建 `QuickBar.vue`
- 集成到 `DashboardView.vue`（仅 scroll 模式显示）
- 实现 `initAnchor` / `intoView` / `setActiveIndex` 核心逻辑

### Step 4: 联调与测试
- scroll 模式下 QuickBar 导航跳转正确性
- 滚动时自动高亮正确性
- 窗口 resize 后锚点重新计算
- CLI 切换布局的完整链路
- grid/single/cards 模式不受影响
