# 看板模块迁移手顺

本文档记录从 refer 项目迁移模块到 alice 看板的标准流程。

## 目录结构

```
refer/                              # 参考项目（源）
├── src/
│   ├── api/fullscreen.ts           # API 接口定义
│   ├── store/                      # Pinia stores
│   ├── locales/                    # 国际化文件
│   └── components/RenderComponent/chartRender/LS/
│       └── <moduleName>/index.vue  # 组件源码
└── public/static/                  # 静态资源

alice/                              # 当前项目（目标）
├── src/
│   ├── services/transportApi.ts    # API 接口（统一出口）
│   ├── stores/dashboardControlStore.ts  # 看板控制 store
│   └── components/dashboard/
│       ├── moduleRegistry.ts       # 模块注册表
│       ├── ModulesRender.vue       # 模块渲染器
│       └── modules/                # 迁移后的模块组件
│           └── <ModuleName>.vue
└── public/dashboard/               # 静态资源（统一存放）
    ├── images/
    ├── video/
    └── ...
```

---

## 迁移步骤

### Step 1: 研究 refer 组件

阅读 refer 中的源文件，记录以下信息：

| 项目 | 说明 | 示例 |
|------|------|------|
| API 接口 | 调用了哪些函数、请求方式、URL | `queryTotalVolume` GET `/kanban/v1/volume/queryTotalVolume` |
| 数据结构 | API 返回什么字段 | `{ totalVolume, yoy, mom }` |
| Store 依赖 | 用了哪些 store | `filterStore`, `selectOptionsStore` |
| 国际化 | 用了哪些 `$t()` key | `$t('ls.unitPrice.title')` → 替换为中文 |
| 模板结构 | Swiper / 表格 / 静态卡片 | 决定是否需要安装新依赖 |
| CSS 方案 | SCSS / CSS、响应式断点 | 统一改为纯 CSS scoped |
| 静态资源 | 引用了哪些图片/视频 | `/static/images/xxx.png` |

### Step 2: 添加 API 接口

在 `src/services/transportApi.ts` 中添加接口函数。

**注意选择正确的 axios 客户端：**

| 客户端 | baseURL | 用途 |
|--------|---------|------|
| `transportDashboardClient` | `transport-service-dashboard-tst` | 看板数据接口 `/kanban/v1/...` |
| `transportAiClient` | `transport-service-ai-tst` | 智能体接口 `/ai/v1/...` |

```typescript
// 示例
export async function queryTrunkLinePrice(data: object) {
  const response = await transportDashboardClient.post('/kanban/v1/price/queryTrunkLinePrice', data)
  return response.data
}
```

### Step 3: 创建适配组件

在 `src/components/dashboard/modules/` 下创建 `.vue` 文件。

**适配要点：**

1. **替换国际化**：`$t('ls.xxx.title')` → 直接写中文
2. **替换 API 导入**：`from '#/api/fullscreen'` → `from '../../../services/transportApi'`
3. **替换 Store 依赖**：
   - `filterStore.selectedWarehouse` → 改为 props 传入
   - `selectOptionsStore.xxx` → 改为组件内自行调用 API 获取
4. **替换 CSS**：SCSS → 纯 CSS scoped
5. **资源路径**：`/static/images/xxx.png` → `/dashboard/images/xxx.png`
6. **字体大小**：使用 `clamp()` 适配小格子，参考值：
   - 标题：`clamp(0.35rem, 0.7vw, 0.6rem)`
   - 数值：`clamp(0.6rem, 1.8vw, 1rem)`
   - 单位：`clamp(0.4rem, 1vw, 0.6rem)`

**组件模板（静态单值卡片）：**

```vue
<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { queryXxx } from '../../../services/transportApi'

const props = defineProps<{
  fromWarehouse?: string[]
  toProvince?: string[]
  toRdc?: string[]
}>()

const value = ref('0')
const loading = ref(false)

const fetchData = async () => { /* ... */ }

watch(() => props, () => fetchData(), { deep: true })
onMounted(() => fetchData())
</script>

<template>
  <div class="card-container">
    <div class="static-card">
      <div class="corner-decor top-left"></div>
      <div class="corner-decor top-right"></div>
      <div class="corner-decor bottom-left"></div>
      <div class="corner-decor bottom-right"></div>
      <div class="card-content">
        <div class="card-title">标题</div>
        <div class="card-main-content">
          <div class="card-value-unit">
            <span class="card-value">{{ loading ? '...' : value }}</span>
            <span class="card-unit">单位</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

**样式规范：**

样式以 refer 项目为准，保持一致。

**标题规范：**

refer 中标题分两种情况：

1. **小卡片模块**（4×3 格子，如累计货量、提货及时率等）：
   - 组件内部自带标题，颜色 `#a0c4ff`，无外层 header-bar
   - 使用 `card-title` 样式

2. **图表/大模块**（如能源价格趋势、运输异常等）：
   - refer 中由 `ModulesCard` 组件的 `header-bar` 渲染标题
   - 迁移后需在组件内部自行实现 header-bar：
   ```vue
   <div class="header-bar">
     <h2 class="header-title">模块标题</h2>
   </div>
   ```
   ```css
   .header-bar {
     width: 100%;
     height: 1.8rem;
     flex-shrink: 0;
     background: url('/dashboard/images/title-bg.png') center/100% 100% no-repeat;
     display: flex;
     align-items: center;
     justify-content: space-between;
     padding-left: 1rem;
     padding-right: 1rem;
     border-bottom: 1px solid rgba(74, 158, 255, 0.2);
   }
   .header-title {
     color: white;
     font-size: 0.875rem;
     font-weight: 600;
     margin: 0;
     text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
   }
   ```

### Step 4: 注册模块

在 `src/components/dashboard/moduleRegistry.ts` 中添加：

```typescript
{
  name: 'moduleName',           // 唯一标识（驼峰命名）
  title: '模块标题',             // 中文标题
  icon: 'iconKey',              // QuickBar 图标 key
  component: defineAsyncComponent(() => import('./modules/ModuleName.vue')),
  defaultSpan: 8,               // 非 scroll 模式下的网格跨度
  order: 5,                     // 排序（控制 QuickBar 和 scroll 顺序）
},
```

### Step 5: 配置页面网格位置

在 `pageRegistry` 中找到对应页面（或新建页面），在其 `components` 数组中添加位置配置：


**新建页面示例：**

如果模块需要独立页面，在 `pageRegistry` 中添加新页面：

```typescript
{
  name: 'newPageName',           // 页面唯一标识
  title: '页面标题',              // 中文标题
  icon: 'iconKey',                // QuickBar 图标 key（如 'map', 'delivery', 'alert'）
  gridConfig: { gridCols: 48, gridRows: 27, gridGap: 12 },
  components: [
    { name: 'moduleName', x: 1, y: 1, width: 48, height: 27, zoom: 1 },
  ]
}
```

**网格坐标系：**
- 总网格：48 列 × 27 行
- 坐标从 1 开始（不是 0）
- `x` = 列位置，`y` = 行位置
- 小卡片标准尺寸：`width: 4, height: 3`

**布局参考图：**

```
┌────┬────┬────┬────────────────────────┬────┬────┬────┐
│累计│提货│准时│                        │能源│干单│配单│
│货量│及时│交付│      运输智能体          │价格│价  │价  │
│4×3 │率  │率  │      24×18             │4×3 │4×3 │4×3 │
└────┴────┴────┴────────────────────────┴────┴────┴────┘
x:1  x:5  x:9  x:13                   x:37 x:41 x:45
```

### Step 6: 复制静态资源

将 refer 中用到的图片/视频复制到 alice：

```powershell
# 复制单个文件
copy "refer\public\static\images\xxx.png" "alice\public\dashboard\images\"

# 复制整个目录
xcopy /E /I /Y "refer\public\static\images\dark" "alice\public\dashboard\images\dark"
```

**资源统一放在 `public/dashboard/` 下：**
- 图片 → `public/dashboard/images/`
- 视频 → `public/dashboard/video/`
- 字体 → `public/dashboard/load/`
- 品牌图标 → `public/dashboard/lenovo/`

### Step 7: 验证

1. **检查编译**：查看 VS Code 诊断，确保无 TypeScript 错误
2. **检查资源**：确认图片/视频路径正确，能在页面上显示
3. **检查 API**：打开浏览器控制台，确认接口请求成功、数据正确解析
4. **检查布局**：确认模块在 scroll 布局中的位置和大小正确

---

## 常见问题

### Q: API 返回 `code: 500, msg: "JSON参数格式化异常"`
**A**: 检查参数类型。`fromWarehouse` 等字段应该是 `string[]`（字符串数组），不是 `object[]`（对象数组）。如果 API 返回的是 `{code, name}` 对象，需要提取 `name` 字段。

### Q: 字体超出卡片边界
**A**: 使用更小的 `clamp()` 值。小卡片（4×3 格子）推荐：
- 标题最大 0.6rem
- 数值最大 1rem
- 单位最大 0.6rem

### Q: Swiper 轮播不工作
**A**: 确保从 `swiper/vue` 导入（不是 `swiper`）：
```typescript
import { Swiper, SwiperSlide } from 'swiper/vue'
import 'swiper/css'
import 'swiper/css/pagination'
import { Pagination, Autoplay } from 'swiper/modules'
```

### Q: 模块不显示
**A**: 检查以下几点：
1. `moduleRegistry.ts` 中是否注册了该模块
2. `scrollLayout.components` 中是否配置了位置
3. 组件文件路径是否正确
4. 浏览器控制台是否有报错

### Q: v-if/else 分支 key 重复警告
**A**: 在 DashboardView.vue 中，v-if/else 分支需要使用不同的 key：
```vue
<ModulesRender v-if="..." :key="`${refreshKey}-grid`" />
<ModulesRender v-else :key="`${refreshKey}-default`" />
```

---

## 已迁移模块清单

| 模块 | 组件文件 | 类型 | API |
|------|----------|------|-----|
| 运输智能体 | CargoBanner.vue | 复杂卡片（视频+数据卡片+弹窗） | 多个 AI 接口 |
| 累计货量 | CargoVolume.vue | Swiper 轮播（日/月/年） | queryTotalVolume |
| 提货及时率 | OnTime.vue | 静态单值卡片 | queryOnTimeRateCard |
| 准时交付率 | EndToEnd.vue | 静态单值卡片 | queryOnTimeRateCard |
| 能源价格 | EnergyPricesCard.vue | Swiper 轮播（汽/柴/航空燃油） | queryEnergyPrice |
| 能源价格趋势 | EnergyPrices.vue | ECharts 折线/柱状图（国内/国际） | queryEnergyPrice |
| 运输异常 | AbnormalTransportation.vue | ECharts 矩形树图+详情弹窗 | statNotSignOrder, statNotSignOrderByPage |
| 运力池 | CapacityPool.vue | 自动滚动表格+详情弹窗 | queryPowerPool, queryPowerPoolItemByPage |
| 加急&重点客户风险 | UrgentCustomer.vue | 自动滚动表格+详情弹窗 | queryUrgentOrdersByPage, queryUrgentOrdersItemByPage |
| 重大活动&极端天气影响 | MajorEvents.vue | 自动滚动表格+详情弹窗 | queryTrafficInfo, queryAffectOrderItemByPage |
| 干单价 | UnitPrice.vue | 静态单值卡片 | queryTrunkLinePrice |
| 配单价 | DryPrice.vue | 静态单值卡片 | queryDeliveryPrice |
| 提货及时率(表格) | PickupRate.vue | 表格组件（暂未展示） | queryPickupRate |
| 货量趋势 | CargoTrend.vue | 图表 | queryVolume |
| 签收信息 | SigningInformation.vue | 表格+图表 | querySign |
| 返单进展 | ReorderProgress.vue | 双层环形图+导出进度 | queryTransConfirmStat, exportTransNotConfirm |
| 仓储物流准时交付率 | WarehousingLogistics.vue | 多层级表格+筛选 | queryOnTimeDeliveryRate, exportOnTimeDeliveryRate |
| 准时交付率-时间维度 | TimeDimension.vue | 动态时间维度表格+筛选 | queryOnTimeRateTime, exportOnTimeRateTime |
| 准时交付率-客户 | LenovoCustomer.vue | 原因分析表格+筛选 | queryEndToEndDeliveryRateReason, queryProductGroupList, queryBtcpIndicateList |
| 端到端准时交付率-非联想客户 | NonLenovoCustomer.vue | 多层级表格+筛选+导出 | queryEndToEndDeliveryRateCust, exportEndToEndDeliveryRateCust |
| PFP KPI-仓库 | TobWarehousingCard.vue | 多层级表格+筛选+双导出 | queryToBKpiSummary, exportToBLogisticKpiScoreSummary, exportToBLogisticKpiScoreDetail |
| PFP KPI-仓库排名 | TobWarehousingRank.vue | 动态月份列表格+详情弹窗+双导出 | queryToBKpiRank, queryToBKpiRankDetail, queryToBLogisticPunishInfo, exportToBLogisticKpiRank, exportToBLogisticKpiRankScoreDetail, exportToBLogisticKpiRankPunishDetail |
| PFP KPI-运输 | TransportationLogisticsScores.vue | 多层级表格+筛选+运输方式+双导出 | queryTransKpiSummary, queryTransTypeList, exportTransLogisticKpiScoreSummary, exportTransLogisticKpiScoreDetail |
| PFP KPI-运输排名 | TransportationLogisticsRank.vue | 动态月份列表格+详情弹窗+双导出 | queryTransKpiRank, queryTransKpiRankDetail, queryTransLogisticPunishInfo, exportTransLogisticKpiRank, exportTransLogisticKpiRankScoreDetail, exportTransLogisticKpiRankPunishDetail |
| PFP KPI-城配 | CityLogisticsScores.vue | 多层级表格+筛选+双导出 | queryDeliveryKpiSummary, exportDeliveryLogisticKpiScoreSummary, exportDeliveryLogisticKpiScoreDetail |
| PFP KPI-城配排名 | CityLogisticsRank.vue | 动态月份列表格+详情弹窗+双导出 | queryDeliveryKpiRank, queryDeliveryKpiRankDetail, queryDeliveryLogisticPunishInfo, exportDeliveryLogisticKpiRank, exportDeliveryLogisticKpiRankScoreDetail, exportDeliveryLogisticKpiRankPunishDetail |
| TCL华星物流商KPI评分 | TclWarehousingScores.vue | 多层级表格+筛选+双导出 | queryHuaxingKpiSummary, exportHuaxingLogisticKpiScoreSummary, exportHuaxingLogisticKpiScoreDetail |
| 运输仓储多业务KPI评分 | TransStorageKpiScore.vue | 表格+筛选+导出 | queryTransStorageKpiScore, exportTransStorageKpiScore, queryAssessmentUnit |

---

## 迁移记录

### 2026-09-17 迁移 cityLogisticsRank 模块

**源文件**: `refer/src/components/RenderComponent/chartRender/LS/cityLogisticsRank/index.vue`

**目标文件**: `src/components/dashboard/modules/CityLogisticsRank.vue`

**页面位置**: `pfpKpiCityDelivery` (PFP KPI-城配) 页面，位置 x=1, y=14, 尺寸 48x14

**迁移内容**:
1. **API 接口** (transportApi.ts):
   - `queryDeliveryKpiRank` - 查询城配物流商 KPI 排名数据
   - `queryDeliveryKpiRankDetail` - 查询城配物流商 KPI 排名得分详情
   - `queryDeliveryLogisticPunishInfo` - 查询城配物流商奖惩信息
   - `exportDeliveryLogisticKpiRank` - 导出城配物流商 KPI 排名数据
   - `exportDeliveryLogisticKpiRankScoreDetail` - 导出城配物流商 KPI 排名得分详情
   - `exportDeliveryLogisticKpiRankPunishDetail` - 导出城配物流商 KPI 排名奖惩详情

2. **组件功能**:
   - 月份范围选择器（默认最近3个月，不包括本月）
   - 物流商多选下拉框（支持搜索）
   - CDC仓库多选下拉框（支持搜索）
   - 查看详情按钮（打开弹窗）
   - 导出按钮（主页面导出排名数据）
   - 表格支持横向滚动，自适应高度

3. **主表格列**:
   - 基础列：物流商、仓库
   - 动态月份列（第一组）：每个月份的排名、总成绩
   - 动态月份列（第二组）：每个月份的是否进行奖励、红线/重大/严重问题
   - 月份从新到旧排序

4. **详情弹窗**:
   - 双标签页：得分详情、奖惩详情
   - 弹窗内独立筛选条件（月份范围、物流商、CDC仓库）
   - 重置、查询、导出按钮
   - 表格支持横向滚动

5. **得分详情表格列** (score tab):
   - 基础列：年月、物流商、仓库、总成绩
   - KPI得分列（11个）：
     - SEC入库周期达标率(满分:15)
     - 发货及时率(满分:5)
     - 库存准确率(满分:5)
     - 准时交货率(满分:30)
     - 货损率(满分:5)
     - 异常解决及时率(满分:5)
     - TMS&SEC APP签收率(满分:5)
     - TMS信息签收及时性(满分:10)
     - 返单及时率得分(满分:10)
     - 运作准确率得分(满分:5)
     - 客户满意度得分(满分:5)
   - 汇总列：得分汇总、红线问题、重大问题、严重问题、一般问题、问题描述、加分/扣分合计

6. **奖惩详情表格列** (reward tab):
   - 基础列：年月、物流商、仓库
   - 问题相关：红线问题(元)、重大问题(元)、严重问题(元)、一般问题(元)
   - 违约相关：违约处理(元)、总罚款金额(元)、标准违约金(元)、违约系数
   - 奖励相关：奖励金额(元)、备注原因、总成绩、月均发货体积(单位:m³)、考核结果是否奖励

7. **KPI 类型映射** (bizType='3'):
   - kpiType 12: SEC入库周期达标率
   - kpiType 1: 发货及时率
   - kpiType 4: 库存准确率
   - kpiType 13: 准时交货率
   - kpiType 14: 货损率
   - kpiType 15: 异常解决及时率
   - kpiType 16: TMS&SEC APP签收率
   - kpiType 17: TMS信息签收及时性
   - kpiType 11: 返单及时率
   - kpiType 5: 运作准确率
   - kpiType 18: 客户满意度

8. **适配要点**:
   - 替换国际化：`$t('ls.dateRange.separator')` → '至'
   - 替换 API 导入路径
   - 使用 selectOptionsStore 的 `getLogisticsByBizType('3')` 和 `getWarehouseByBizType('3')`
   - SCSS → 纯 CSS scoped
   - 弹窗使用 Teleport 组件渲染到 body
   - 并发请求控制：使用 detailFetchRequestId 防止乱序覆盖

---

### 2026-09-17 迁移 transportationLogisticsScores 模块

**源文件**: `refer/src/components/RenderComponent/chartRender/LS/transportationLogisticsScores/index.vue`

**目标文件**: `src/components/dashboard/modules/TransportationLogisticsScores.vue`

**页面位置**: `pfpKpiTransport` (PFP KPI-运输) 页面，位置 x=1, y=1, 尺寸 48x13

**迁移内容**:
1. **API 接口** (transportApi.ts):
   - `queryTransKpiSummary` - 查询运输物流商 KPI 评分数据
   - `queryTransTypeList` - 查询运输方式列表
   - `exportTransLogisticKpiScoreSummary` - 导出 KPI 评分汇总
   - `exportTransLogisticKpiScoreDetail` - 导出 KPI 评分明细

2. **组件功能**:
   - 月份范围选择器
   - 物流商多选下拉框（支持搜索）
   - CDC仓库多选下拉框（支持搜索）
   - 运输方式多选下拉框（支持搜索）
   - 显示详情开关（切换简略/详细表格视图）
   - 导出汇总/导出明细按钮
   - 表格支持横向滚动，自适应高度

3. **表格列**:
   - 基础列：年月、运输方式、物流商、CDC仓库
   - 详情模式额外列：得分合计 + 7个KPI指标的详细数据（分子/分母/比率/得分）
   - 简略模式列：7个KPI指标比率（带趋势箭头和颜色标识）

4. **KPI 指标** (bizType='2'):
   - 干线准时交货率 (kpiType: 6)
   - 提货及时率 (kpiType: 7)
   - 干线破损率 (kpiType: 8)
   - 7天异常订单处理及时率 (kpiType: 9)
   - 信息反馈及时率 (kpiType: 10)
   - 返单及时率 (kpiType: 11)
   - 运作准确率 (kpiType: 5)

5. **适配要点**:
   - 替换国际化：`$t('ls.dateRange.separator')` → '至'
   - 替换 API 导入路径
   - 使用 selectOptionsStore 的 `getLogisticsByBizType('2')` 和 `getWarehouseByBizType('2')`
   - SCSS → 纯 CSS scoped
   - 添加 header-bar 组件内标题

---

### 2026-09-17 迁移 tclWarehousingScores 模块

**源文件**: `refer/src/components/RenderComponent/chartRender/LS/TclWarehousingSocres/index.vue`

**目标文件**: `src/components/dashboard/modules/TclWarehousingScores.vue`

**页面位置**: `pfpKpiCustomer` (PFP KPI-客户) 页面，位置 x=1, y=1, 尺寸 48x13

**迁移内容**:
1. **API 接口** (transportApi.ts):
   - `queryHuaxingKpiSummary` - 查询TCL华星物流商 KPI 评分汇总数据
   - `exportHuaxingLogisticKpiScoreSummary` - 导出TCL华星物流商 KPI 评分汇总
   - `exportHuaxingLogisticKpiScoreDetail` - 导出TCL华星物流商 KPI 评分明细

2. **组件功能**:
   - 月份范围选择器
   - 物流商多选下拉框（支持搜索）
   - 发货平台多选下拉框（支持搜索）
   - 显示详情开关（切换简略/详细表格视图）
   - 导出汇总/导出明细按钮
   - 表格支持横向滚动，自适应高度

3. **表格列**:
   - 基础列：年月、物流商、运输方式、发货平台
   - 详情模式额外列：总成绩 + 3个KPI指标的详细数据（达标数量/总数量/达标率/得分）
     - 提货及时率 (kpiType: 34)
     - 送货及时率 (kpiType: 35)
     - 返单及时率 (kpiType: 36)
   - 简略模式列：3个KPI指标比率（带趋势箭头和颜色标识）
   - 详情模式额外列：得分汇总、扣分项（质量/服务/安全/其他扣分项/扣分说明）、加分项（其他加分项/加分说明）

4. **适配要点**:
   - 替换国际化：`$t('ls.dateRange.separator')` → '至'
   - 替换 API 导入路径
   - 使用 selectOptionsStore 的 `getLogisticsByBizType('7')` 和 `getWarehouseByBizType('7')`
   - SCSS → 纯 CSS scoped
   - 添加 header-bar 组件内标题

---

### 2026-09-17 迁移 transStorageKpiScore 模块

**源文件**: `refer/src/components/RenderComponent/chartRender/LS/transStorageKpiScore/index.vue`

**目标文件**: `src/components/dashboard/modules/TransStorageKpiScore.vue`

**页面位置**: `pfpKpiCustomer` (PFP KPI-客户) 页面，位置 x=1, y=14, 尺寸 48x14

**迁移内容**:
1. **API 接口** (transportApi.ts):
   - `queryTransStorageKpiScore` - 查询运输仓储多业务 KPI 评分数据
   - `exportTransStorageKpiScore` - 导出运输仓储多业务 KPI 评分数据
   - `queryAssessmentUnit` - 查询考核单元下拉选项（bizType=9）

2. **组件功能**:
   - 月份选择器（默认前2个月的首月）
   - 业务分类多选下拉框（支持搜索，硬编码选项：仓储/运输）
   - 考核单元多选下拉框（支持搜索，从API获取选项）
   - 导出按钮
   - 表格支持横向滚动，自适应高度

3. **表格列**:
   - 年月（格式化显示：YYYY年M月）
   - 业务分类
   - 考核单元
   - 物流商
   - 考核项目
   - 权重
   - 项目得分
   - 最终得分

4. **适配要点**:
   - 替换 API 导入路径
   - 考核单元下拉从API获取（queryAssessmentUnit，bizType=9）
   - 业务分类下拉硬编码（仓储/运输）
   - SCSS → 纯 CSS scoped
   - 添加 header-bar 组件内标题

---

## 待迁移模块参考

refer 中还有以下模块可以迁移：

| 模块 | refer 路径 | 说明 |
|------|-----------|------|
| 货量趋势图 | LS/cargoVolumeTrend | 折线图 |
| 签收地图 | LS/map | 地图+在途车辆 |
| 物流商 KPI | LS/logisticKpi | 评分表格 |
| UD reorder | LS/UDreorderProgress | 进度表格 |
| 非联想客户 | LS/nonLenovoCustomer | 表格 |
