<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import { getModuleComponentMap, type GridConfig, type ComponentPosition } from './moduleRegistry'

// 从统一注册表获取组件映射
const moduleComponents = getModuleComponentMap()

export interface ModuleConfig {
  name: string
  span?: number  // 1-24 网格跨度，默认 12
  title?: string
  noBorder?: boolean  // 是否隐藏边框和标题
}

const props = defineProps<{
  modules?: ModuleConfig[]
  filters?: Record<string, Record<string, any>>
  layout?: 'single' | 'grid' | 'cards' | 'scroll'
  // 网格模式 props（参考 refer 的 ModulesRender）
  gridConfig?: GridConfig
  components?: ComponentPosition[]
}>()

// 获取模块专属的筛选条件
function getModuleFilters(moduleName: string): Record<string, any> {
  return props.filters?.[moduleName] || {}
}

// ============ 网格模式逻辑（参考 refer） ============

const containerRef = ref<HTMLElement | null>(null)
const gridWidth = ref(0)   // 每个格子的宽度 (px)
const gridHeight = ref(0)  // 每个格子的高度 (px)
let resizeObserver: ResizeObserver | null = null

/**
 * 计算格子尺寸 — 参考 refer 的 initSize()
 * scroll 模式下格子为正方形，容器高度动态计算
 */
function initSize() {
  if (!containerRef.value || !props.gridConfig) return

  const { gridCols, gridRows, gridGap } = props.gridConfig
  const width = containerRef.value.getBoundingClientRect().width

  if (width <= 0) return

  // 计算格子宽度
  const gw = (width - gridGap * (gridCols - 1)) / gridCols
  gridWidth.value = Math.floor(gw * 100) / 100  // paddingFixed

  // scroll 模式：格子为正方形
  gridHeight.value = gridWidth.value

  // 计算容器总高度
  const totalHeight = (gridHeight.value + gridGap) * gridRows
  containerRef.value.style.height = `${totalHeight}px`
}

/**
 * 网格坐标 → 像素定位 — 参考 refer 的 getGridStyle()
 */
function getGridStyle(item: ComponentPosition) {
  if (!props.gridConfig) return {}

  const { gridGap } = props.gridConfig
  const top = (gridHeight.value + gridGap) * (item.y - 1)
  const left = (gridWidth.value + gridGap) * (item.x - 1)
  const w = item.width * gridWidth.value + gridGap * (item.width - 1)
  const h = item.height * gridHeight.value + gridGap * (item.height - 1)

  return {
    position: 'absolute' as const,
    top: `${top}px`,
    left: `${left}px`,
    width: `${w}px`,
    height: `${h}px`,
  }
}

/** 获取组件的 zoom 值 */
function getComponentZoom(item: ComponentPosition): number {
  return item.zoom ?? 1
}

// 是否使用网格模式
const isGridMode = computed(() => !!props.gridConfig && !!props.components)

onMounted(() => {
  if (isGridMode.value) {
    nextTick(() => {
      initSize()
      // 监听容器尺寸变化
      if (containerRef.value) {
        resizeObserver = new ResizeObserver(() => {
          initSize()
        })
        resizeObserver.observe(containerRef.value)
      }
    })
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

// 监听 gridConfig 变化
watch(() => props.gridConfig, () => {
  if (isGridMode.value) {
    nextTick(() => initSize())
  }
}, { deep: true })
</script>

<template>
  <!-- 网格模式（参考 refer 的绝对定位布局） -->
  <div
    v-if="isGridMode"
    ref="containerRef"
    class="modules-render-grid"
  >
    <div
      v-for="item in components"
      :key="item.name"
      class="modules-component"
      :style="getGridStyle(item)"
    >
      <div class="component-content" :style="{ zoom: getComponentZoom(item) }">
        <component
          v-if="moduleComponents[item.name]"
          :is="moduleComponents[item.name]"
          v-bind="getModuleFilters(item.name)"
        />
        <div v-else class="unknown-module">
          未知模块: {{ item.name }}
        </div>
      </div>
    </div>
  </div>

  <!-- CSS Grid 模式（原有逻辑） -->
  <div v-else class="modules-render">
    <div class="modules-grid" :class="{ 'single-layout': layout === 'single' }">
      <div
        v-for="mod in (modules || [])"
        :key="mod.name"
        class="module-slot"
        :style="{ gridColumn: `span ${mod.span || 12}` }"
      >
        <div class="module-card" :class="{ 'no-border': mod.noBorder }">
          <!-- 四角装饰 -->
          <template v-if="!mod.noBorder">
            <div class="corner top-left"></div>
            <div class="corner top-right"></div>
            <div class="corner bottom-left"></div>
            <div class="corner bottom-right"></div>
          </template>

          <div class="module-header" v-if="mod.title && !mod.noBorder">
            <h3>{{ mod.title }}</h3>
          </div>
          <div class="module-body">
            <component
              v-if="moduleComponents[mod.name]"
              :is="moduleComponents[mod.name]"
              v-bind="getModuleFilters(mod.name)"
            />
            <div v-else class="unknown-module">
              未知模块: {{ mod.name }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ============ 网格模式样式 ============ */
.modules-render-grid {
  position: relative;
  width: 100%;
  /* 高度由 JS 动态计算 */
}

.modules-component {
  position: absolute;
  overflow: hidden;
}

.component-content {
  width: 100%;
  height: 100%;
}

/* ============ CSS Grid 模式样式 ============ */
.modules-render {
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 16px;
}

.modules-grid {
  display: grid;
  grid-template-columns: repeat(24, 1fr);
  gap: 16px;
  min-height: 100%;
}

.module-slot {
  min-width: 0;
}

.module-card {
  width: 100%;
  height: 100%;
  min-height: 280px;
  background: url('/dashboard/itemBg.png') center/cover no-repeat,
              linear-gradient(135deg, rgba(8, 31, 64, 0.9), rgba(15, 23, 42, 0.95));
  border: 1px solid rgba(74, 158, 255, 0.35);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  box-shadow: 0 0 16px rgba(74, 158, 255, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.module-card.no-border {
  background: transparent;
  border: none;
  box-shadow: none;
  min-height: 0;
}

/* 四角装饰 */
.corner {
  position: absolute;
  width: 12px;
  height: 12px;
  border-color: rgba(74, 158, 255, 0.7);
  border-style: solid;
  z-index: 2;
  pointer-events: none;
}
.corner.top-left { top: 6px; left: 6px; border-width: 2px 0 0 2px; }
.corner.top-right { top: 6px; right: 6px; border-width: 2px 2px 0 0; }
.corner.bottom-left { bottom: 6px; left: 6px; border-width: 0 0 2px 2px; }
.corner.bottom-right { bottom: 6px; right: 6px; border-width: 0 2px 2px 0; }

.module-header {
  padding: 12px 16px;
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.7) 100%);
  border-bottom: 1px solid rgba(74, 158, 255, 0.2);
  position: relative;
}

.module-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
  letter-spacing: 1px;
}

.module-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.unknown-module {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
}

/* 滚动条 */
.modules-render::-webkit-scrollbar { width: 6px; }
.modules-render::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); }
.modules-render::-webkit-scrollbar-thumb { background: rgba(74, 158, 255, 0.4); border-radius: 3px; }
</style>
