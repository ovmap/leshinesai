# 看板全局筛选实现指南

## 概述

看板支持全局筛选功能，用户可以在 Header 区域选择始发仓、目的省、目的 RDC，所有模块会自动响应筛选条件并刷新数据。

## 架构设计

### 核心组件

```
GlobalFilterBar.vue          # 全局筛选 UI 组件（Header 左侧）
    ↓
globalFilterStore.ts         # 全局筛选状态管理（多选数组）
    ↓
dashboardControlStore.ts     # 看板控制状态（模块筛选条件）
    ↓
ModulesRender.vue            # 模块渲染器（传递 props）
    ↓
各模块组件                    # 接收 props 并响应筛选
```

### 数据流向

```
用户选择下拉框 → globalFilterStore 更新 selectedWarehouse/Province/Rdc
    ↓
用户点击"完成" → globalFilterStore.syncToControlStore()
    ↓
controlStore.applyFilters(undefined, filters)  # undefined 表示全局
    ↓
moduleFilters[每个活跃模块] 被更新
    ↓
ModulesRender 通过 v-bind="getModuleFilters(name)" 传给子组件
    ↓
子组件 props 变化 → watch(props) 触发 → 调 API 刷新数据
```

## 核心文件说明

### 1. globalFilterStore.ts

管理全局筛选状态（多选数组）：

```typescript
const selectedWarehouse = ref<string[]>([])   // 始发仓
const selectedProvince = ref<string[]>([])    // 目的省
const selectedRdc = ref<string[]>([])         // 目的 RDC

// 同步到 controlStore，触发所有模块刷新
function syncToControlStore() {
  const filters = getFilterParams()
  controlStore.applyFilters(undefined, filters)
}
```

### 2. dashboardControlStore.ts

管理各模块的筛选条件：

```typescript
// 全局筛选（module 为 undefined）
function applyFilters(module: string | undefined, filters: Record<string, any>) {
  if (module) {
    // 模块专属筛选
    moduleFilters.value[module] = { ...moduleFilters.value[module], ...filters }
  } else {
    // 全局筛选，应用到所有活跃模块
    activeModules.value.forEach(mod => {
      moduleFilters.value[mod] = { ...moduleFilters.value[mod], ...filters }
    })
  }
}
```

### 3. ModulesRender.vue

将筛选条件作为 props 传递给子模块：

```vue
<component
  :is="moduleComponents[mod.name]"
  v-bind="getModuleFilters(mod.name)"
/>
```

`getModuleFilters` 返回该模块的筛选对象：

```typescript
function getModuleFilters(moduleName: string): Record<string, any> {
  return props.filters?.[moduleName] || {}
}
```

## 模块接入全局筛选

### 步骤 1: 定义 props

```typescript
const props = defineProps<{
  fromWarehouse?: string[]   // 始发仓（数组，支持多选）
  toProvince?: string[]      // 目的省
  toRdc?: string[]           // 目的 RDC
  modeType?: string          // 配送模式（可选，单选）
}>()
```

### 步骤 2: 监听 props 变化

```typescript
// 用于跟踪全局筛选数组变化（多选检测）
const lastWarehouseStr = ref<string>('')
const lastProvinceStr = ref<string>('')
const lastRdcStr = ref<string>('')

watch(
  () => props,
  (newProps) => {
    let changed = false
    
    // 比较数组内容（多选时需要比较整个数组）
    const newWarehouseArr = newProps.fromWarehouse || []
    const newProvinceArr = newProps.toProvince || []
    const newRdcArr = newProps.toRdc || []
    
    // 将数组转为字符串比较
    const newWarehouseStr = newWarehouseArr.join(',')
    const newProvinceStr = newProvinceArr.join(',')
    const newRdcStr = newRdcArr.join(',')
    
    // 如果全局筛选数组变化了，标记 changed
    if (
      newWarehouseStr !== (lastWarehouseStr.value || '') ||
      newProvinceStr !== (lastProvinceStr.value || '') ||
      newRdcStr !== (lastRdcStr.value || '')
    ) {
      changed = true
      lastWarehouseStr.value = newWarehouseStr
      lastProvinceStr.value = newProvinceStr
      lastRdcStr.value = newRdcStr
    }
    
    if (changed) {
      // 刷新数据
      fetchData()
    }
  },
  { deep: true }
)
```

### 步骤 3: 在 API 调用中使用筛选条件

```typescript
const fetchData = async () => {
  const filterParams: Record<string, string[]> = {}
  
  // 使用 props 传入的筛选条件
  if (props.fromWarehouse && props.fromWarehouse.length > 0) {
    filterParams.fromWarehouse = props.fromWarehouse
  }
  if (props.toProvince && props.toProvince.length > 0) {
    filterParams.toProvince = props.toProvince
  }
  if (props.toRdc && props.toRdc.length > 0) {
    filterParams.toRdc = props.toRdc
  }
  
  const result = await queryYourApi(filterParams)
  // 处理结果...
}
```

### 步骤 4: 初始化时继承全局筛选（可选）

如果模块有弹窗或子筛选，初始化时继承全局筛选值：

```typescript
onMounted(async () => {
  // 继承全局筛选值
  if (props.fromWarehouse?.[0]) {
    modalSelectedWarehouse.value = props.fromWarehouse[0]
  }
  if (props.toProvince?.[0]) {
    modalSelectedProvince.value = props.toProvince[0]
  }
  if (props.toRdc?.[0]) {
    modalSelectedRdc.value = props.toRdc[0]
  }
  
  // 获取数据
  await fetchData()
})
```

## 注意事项

### 1. Props 类型

- `fromWarehouse`、`toProvince`、`toRdc` 都是 **数组类型**（`string[]`），支持多选
- 不要再用 `[props.fromWarehouse]` 包装，直接使用即可

### 2. 数组比较

- 多选时，数组引用会变化，需要比较数组内容
- 简单方式：`arr.join(',')` 转为字符串比较

### 3. 子筛选独立性

- 弹窗内的筛选（如 `modalSelectedWarehouse`）是独立的 ref
- 修改弹窗内筛选**不会反向同步**到全局筛选
- 每次打开弹窗时，从全局筛选继承初始值

### 4. Single 布局

- Single 布局下，右侧表格的筛选也会继承全局筛选值
- 用户修改后只影响本地状态，不影响全局

### 5. 智能体指令

如果模块需要支持智能体设置筛选，添加 action 处理：

```typescript
watch(
  () => controlStore.pendingActions,
  (actions) => {
    actions.forEach(action => {
      if (action.module !== 'yourModule') return
      switch (action.action) {
        case 'setFilters':
          // 处理筛选设置
          break
      }
      controlStore.consumeAction(action.id)
    })
  },
  { deep: true }
)
```

## 完整示例：SigningInformation.vue

```typescript
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { querySign } from '../../../services/transportApi'
import { useDashboardControlStore } from '../../../stores/dashboardControlStore'

const controlStore = useDashboardControlStore()

// 1. 定义 props
const props = defineProps<{
  fromWarehouse?: string[]
  toProvince?: string[]
  toRdc?: string[]
  modeType?: string
}>()

// 2. 跟踪全局筛选变化
const lastWarehouseStr = ref<string>('')
const lastProvinceStr = ref<string>('')
const lastRdcStr = ref<string>('')

// 3. 监听 props 变化
watch(
  () => props,
  (newProps) => {
    let changed = false
    
    const newWarehouseArr = newProps.fromWarehouse || []
    const newProvinceArr = newProps.toProvince || []
    const newRdcArr = newProps.toRdc || []
    
    const newWarehouseStr = newWarehouseArr.join(',')
    const newProvinceStr = newProvinceArr.join(',')
    const newRdcStr = newRdcArr.join(',')
    
    if (
      newWarehouseStr !== (lastWarehouseStr.value || '') ||
      newProvinceStr !== (lastProvinceStr.value || '') ||
      newRdcStr !== (lastRdcStr.value || '')
    ) {
      changed = true
      lastWarehouseStr.value = newWarehouseStr
      lastProvinceStr.value = newProvinceStr
      lastRdcStr.value = newRdcStr
    }
    
    if (changed) {
      fetchSigningData()
    }
  },
  { deep: true }
)

// 4. API 调用使用筛选条件
const fetchSigningData = async () => {
  const filterParams: Record<string, string[]> = {}
  
  if (props.fromWarehouse && props.fromWarehouse.length > 0) {
    filterParams.fromWarehouse = props.fromWarehouse
  }
  if (props.toProvince && props.toProvince.length > 0) {
    filterParams.toProvince = props.toProvince
  }
  if (props.toRdc && props.toRdc.length > 0) {
    filterParams.toRdc = props.toRdc
  }
  
  const result = await querySign(filterParams)
  // 处理结果...
}

// 5. 初始化
onMounted(async () => {
  await fetchSigningData()
})
</script>
```

## 调试技巧

### 1. 查看筛选是否传递到模块

在模块的 watch 中添加 log：

```typescript
watch(() => props, (newProps) => {
  console.log('[ModuleName] props changed:', newProps)
}, { deep: true })
```

### 2. 查看 controlStore 状态

在 DevTools Console 中：

```javascript
// 查看当前全局筛选
const store = window.__pinia?.stores?.dashboardControl
console.log(store.moduleFilters)
```

### 3. 手动触发筛选

```javascript
// 设置全局筛选
await window.ipcRenderer.invoke('dashboard:control', {
  command: 'filter',
  args: { filters: { fromWarehouse: ['武汉CDC'] } }
})
```

## 常见问题

### Q: 为什么选了筛选但模块没刷新？

A: 检查以下几点：
1. 模块是否定义了 `fromWarehouse`、`toProvince`、`toRdc` props
2. 是否 watch 了 props 变化
3. watch 中是否正确比较了数组内容（多选时）
4. API 调用时是否使用了 props 传入的筛选条件

### Q: 弹窗内的筛选和全局筛选不一致？

A: 这是设计如此。弹窗内的筛选是独立的，不会反向同步到全局。每次打开弹窗时，会从全局筛选继承初始值。

### Q: Single 布局下筛选不生效？

A: 检查 `onMounted` 中是否继承了全局筛选值：

```typescript
if (isSingleLayout.value) {
  modalSelectedWarehouse.value = props.fromWarehouse?.[0] || ''
  // ...
}
```

## 参考文档

- [dashboard-cli-debug.md](./dashboard-cli-debug.md) - CLI 调试指南
- [dashboard-data-flow.md](./dashboard-data-flow.md) - 数据流说明
- [dashboard-cli-design.md](./dashboard-cli-design.md) - CLI 设计文档
