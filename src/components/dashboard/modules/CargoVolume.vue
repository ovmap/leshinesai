<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { queryTotalVolume } from '../../../services/transportApi'

interface CarouselData {
  id: number
  title: string
  value: string
  unit: string
  yoy: string
  mom: string
  currentDate: string
  yoyDate: string
  momDate: string
}

const props = defineProps<{
  fromWarehouse?: string
  toProvince?: string[]
  toRdc?: string[]
}>()

const carouselData = ref<CarouselData[]>([
  { id: 1, title: '年累计货量', value: '0', unit: '', yoy: '0%', mom: '0%', currentDate: '', yoyDate: '', momDate: '' },
  { id: 2, title: '月累计货量', value: '0', unit: '', yoy: '0%', mom: '0%', currentDate: '', yoyDate: '', momDate: '' },
  { id: 3, title: '日货量', value: '0', unit: '', yoy: '0%', mom: '0%', currentDate: '', yoyDate: '', momDate: '' },
])

const currentIndex = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const fetchData = async () => {
  try {
    const wh = props.fromWarehouse || ''
    const province = props.toProvince || []
    const rdc = props.toRdc || []

    const [yearData, monthData, dayData] = await Promise.all([
      queryTotalVolume('3', wh, province, rdc),
      queryTotalVolume('2', wh, province, rdc),
      queryTotalVolume('1', wh, province, rdc),
    ])

    const updateCard = (index: number, data: any) => {
      if (data?.data) {
        const d = data.data
        const valid = d.totalVolume !== null && d.totalVolume !== undefined
        carouselData.value[index].value = valid ? Math.floor(parseFloat(d.totalVolume) || 0).toString() : '0'
        carouselData.value[index].yoy = d.yoy || '0%'
        carouselData.value[index].mom = d.mom || '0%'
        carouselData.value[index].currentDate = d.currentDate || ''
        carouselData.value[index].yoyDate = d.yoyDate || ''
        carouselData.value[index].momDate = d.momDate || ''
      }
    }

    updateCard(0, yearData)
    updateCard(1, monthData)
    updateCard(2, dayData)
  } catch (error) {
    console.error('获取货量数据失败:', error)
  }
}

const formatTooltip = (item: CarouselData) => {
  const lines: string[] = []
  if (item.currentDate && item.yoyDate) {
    lines.push(`${item.currentDate} 对比 ${item.yoyDate} 同比: ${item.yoy}`)
  }
  if (item.currentDate && item.momDate) {
    lines.push(`${item.currentDate} 对比 ${item.momDate} 环比: ${item.mom}`)
  }
  return lines.join('\n') || '暂无详细数据'
}

const getTrendColor = (val: string) => {
  if (val.startsWith('+') || val.startsWith('↑')) return '#10b981'
  if (val.startsWith('-') || val.startsWith('↓')) return '#ef4444'
  return '#94a3b8'
}

const next = () => {
  currentIndex.value = (currentIndex.value + 1) % carouselData.value.length
}

const prev = () => {
  currentIndex.value = (currentIndex.value - 1 + carouselData.value.length) % carouselData.value.length
}

const startAutoPlay = () => {
  stopAutoPlay()
  timer = setInterval(next, 4000)
}

const stopAutoPlay = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

onMounted(() => {
  fetchData()
  startAutoPlay()
})

onUnmounted(() => {
  stopAutoPlay()
})
</script>

<template>
  <div class="cargo-volume" @mouseenter="stopAutoPlay" @mouseleave="startAutoPlay">
    <div class="carousel-card">
      <!-- 四角装饰 -->
      <div class="corner top-left"></div>
      <div class="corner top-right"></div>
      <div class="corner bottom-left"></div>
      <div class="corner bottom-right"></div>

      <!-- 轮播内容 -->
      <transition name="fade" mode="out-in">
        <div class="slide" :key="currentIndex">
          <div class="card-title">{{ carouselData[currentIndex].title }}</div>
          <a-tooltip :title="formatTooltip(carouselData[currentIndex])" placement="bottom" color="#1e293b">
            <div class="card-value">{{ carouselData[currentIndex].value }}</div>
          </a-tooltip>
          <div class="card-trends">
            <span class="trend-item" v-if="carouselData[currentIndex].yoy">
              同比 <span :style="{ color: getTrendColor(carouselData[currentIndex].yoy) }">{{ carouselData[currentIndex].yoy }}</span>
            </span>
            <span class="trend-item" v-if="carouselData[currentIndex].mom">
              环比 <span :style="{ color: getTrendColor(carouselData[currentIndex].mom) }">{{ carouselData[currentIndex].mom }}</span>
            </span>
          </div>
        </div>
      </transition>

      <!-- 导航 -->
      <div class="nav-arrows">
        <button class="nav-btn" @click="prev">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"></polyline>
          </svg>
        </button>
        <button class="nav-btn" @click="next">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,6 15,12 9,18"></polyline>
          </svg>
        </button>
      </div>

      <!-- 指示器 -->
      <div class="indicators">
        <span
          v-for="(_, idx) in carouselData"
          :key="idx"
          class="dot"
          :class="{ active: idx === currentIndex }"
          @click="currentIndex = idx"
        ></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cargo-volume {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.carousel-card {
  width: 100%;
  height: 100%;
  min-height: 180px;
  background: linear-gradient(135deg, rgba(8, 31, 64, 0.9), rgba(15, 23, 42, 0.95));
  border: 1px solid rgba(74, 158, 255, 0.4);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: 0 0 20px rgba(74, 158, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* 四角装饰 */
.corner {
  position: absolute;
  width: 12px;
  height: 12px;
  border-color: rgba(74, 158, 255, 0.6);
  border-style: solid;
}
.corner.top-left { top: 8px; left: 8px; border-width: 2px 0 0 2px; }
.corner.top-right { top: 8px; right: 8px; border-width: 2px 2px 0 0; }
.corner.bottom-left { bottom: 8px; left: 8px; border-width: 0 0 2px 2px; }
.corner.bottom-right { bottom: 8px; right: 8px; border-width: 0 2px 2px 0; }

.slide {
  text-align: center;
  width: 100%;
}

.card-title {
  font-size: 14px;
  color: #a0c4ff;
  margin-bottom: 12px;
  font-weight: 400;
}

.card-value {
  font-size: 42px;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 0 12px rgba(255, 255, 255, 0.3);
  line-height: 1.2;
  cursor: pointer;
  margin-bottom: 12px;
}

.card-trends {
  display: flex;
  gap: 24px;
  justify-content: center;
  font-size: 13px;
  color: #94a3b8;
}

.trend-item span {
  font-weight: 600;
}

/* 导航箭头 */
.nav-arrows {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  transform: translateY(-50%);
  display: flex;
  justify-content: space-between;
  padding: 0 4px;
  pointer-events: none;
}

.nav-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid rgba(74, 158, 255, 0.3);
  background: rgba(8, 31, 64, 0.8);
  color: #a0c4ff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: all;
  transition: all 0.2s;
}

.nav-btn:hover {
  background: rgba(74, 158, 255, 0.2);
  border-color: rgba(74, 158, 255, 0.6);
}

/* 指示器 */
.indicators {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  transition: all 0.3s;
}

.dot.active {
  background: #ffffff;
  transform: scale(1.3);
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
