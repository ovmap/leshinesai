<script setup lang="ts">
import { defineAsyncComponent, type Component } from 'vue'

// 模块注册表 - 所有可用的看板模块
const moduleComponents: Record<string, Component> = {
  cargoTrend: defineAsyncComponent(() => import('./modules/CargoTrend.vue')),
  signingInformation: defineAsyncComponent(() => import('./modules/SigningInformation.vue')),
}

export interface ModuleConfig {
  name: string
  span?: number  // 1-24 网格跨度，默认 12
  title?: string
}

const props = defineProps<{
  modules: ModuleConfig[]
  filters?: Record<string, Record<string, any>>
  layout?: 'single' | 'grid' | 'cards'
}>()

// 获取模块专属的筛选条件
function getModuleFilters(moduleName: string): Record<string, any> {
  return props.filters?.[moduleName] || {}
}
</script>

<template>
  <div class="modules-render">
    <div class="modules-grid" :class="{ 'single-layout': layout === 'single' }">
      <div
        v-for="mod in modules"
        :key="mod.name"
        class="module-slot"
        :style="{ gridColumn: `span ${mod.span || 12}` }"
      >
        <div class="module-card">
          <!-- 四角装饰 -->
          <div class="corner top-left"></div>
          <div class="corner top-right"></div>
          <div class="corner bottom-left"></div>
          <div class="corner bottom-right"></div>

          <div class="module-header" v-if="mod.title">
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
