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
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(74, 158, 255, 0.25);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.module-header {
  padding: 12px 16px;
  background: rgba(30, 41, 59, 0.8);
  border-bottom: 1px solid rgba(74, 158, 255, 0.15);
}

.module-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
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
