<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import type { ModuleMeta } from './moduleRegistry'

const props = defineProps<{
  modules: ModuleMeta[]
}>()

const activeIndex = ref(0)
const isExpanded = ref(false)
let isClickTo = false
let clearClickTimer: ReturnType<typeof setTimeout> | null = null

let scrollContainer: HTMLElement | null = null
let moduleTops: number[] = []
let moduleHeights: number[] = []

/**
 * 初始化锚点 — 计算每个模块的位置
 * 参考 refer 项目的 initAnchor()
 */
function initAnchor() {
  scrollContainer = document.querySelector('.scroll-container')
  if (!scrollContainer) return

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

  if (clearClickTimer) clearTimeout(clearClickTimer)
  clearClickTimer = setTimeout(() => {
    isClickTo = false
  }, 1500)
}

/**
 * 滚动监听 → 自动高亮当前模块
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

function handleMouseEnter() {
  isExpanded.value = true
}

function handleMouseLeave() {
  isExpanded.value = false
}

function handleResize() {
  setTimeout(() => {
    initAnchor()
  }, 100)
}

onMounted(() => {
  nextTick(() => {
    initAnchor()
  })

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
          <div class="navi-icon">
            <!-- 货量趋势 -->
            <svg v-if="mod.icon === 'trend'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3v18h18" />
              <path d="M7 16l4-8 4 4 4-8" />
            </svg>
            <!-- 签收信息 -->
            <svg v-else-if="mod.icon === 'sign'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="10" />
            </svg>
            <!-- 智能体异常预警 -->
            <svg v-else-if="mod.icon === 'alert'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <!-- 默认图标 -->
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
          </div>
          <!-- 标签名（hover 时显示在左侧） -->
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

.quickbar-box:not(.expanded) {
  background: transparent;
}

.quickbar-box.expanded {
  background: rgba(8, 31, 64, 0.85);
  border: 1px solid rgba(74, 158, 255, 0.35);
  box-shadow: 0 0 20px rgba(74, 158, 255, 0.15),
              inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
}

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

.navi-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

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

.navi-icon {
  width: 20px;
  height: 20px;
  color: rgba(255, 255, 255, 0.75);
}

.navi-item.active .navi-icon {
  color: #fff;
}

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
