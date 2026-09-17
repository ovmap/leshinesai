<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import type { PageMeta } from './moduleRegistry'

const props = defineProps<{
  pages: PageMeta[]
  currentPage: string
}>()

const emit = defineEmits<{
  (e: 'page-change', pageName: string): void
}>()

const isExpanded = ref(false)

function handleMouseEnter() {
  isExpanded.value = true
}

function handleMouseLeave() {
  isExpanded.value = false
}

function handlePageClick(pageName: string) {
  if (pageName !== props.currentPage) {
    emit('page-change', pageName)
  }
}

function initAnchor() {
  // 页面切换模式下无需计算锚点，保留接口兼容
}

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

    <!-- 展开状态：页面导航列表 -->
    <template v-if="isExpanded">
      <div class="navi-list">
        <div
          class="navi-item"
          :class="{ active: page.name === currentPage }"
          @click="handlePageClick(page.name)"
          v-for="page in pages"
          :key="page.name"
          :title="page.title"
        >
          <div class="navi-icon">
            <i class="iconfont" :class="page.icon"></i>
          </div>
          <!-- 标签名（hover 时显示在左侧） -->
          <div class="navi-label">
            <span>{{ page.title }}</span>
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
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.75);
}

.navi-icon .iconfont {
  font-size: 18px;
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
