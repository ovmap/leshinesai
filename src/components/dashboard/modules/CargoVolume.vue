<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Swiper, SwiperSlide } from 'swiper/vue'
import 'swiper/css'
import 'swiper/css/pagination'
import { Pagination, Autoplay } from 'swiper/modules'
import { queryTotalVolume } from '../../../services/transportApi'
import { useDashboardDataStore } from '../../../stores/dashboardDataStore'

const { t } = useI18n()

interface CarouselData {
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
  fromWarehouse?: string[]
  toProvince?: string[]
  toRdc?: string[]
}>()

const dataStore = useDashboardDataStore()

const carouselData = computed(() => [
  { title: t('dashboard.cargoVolume.titles.dailyVolume'), value: '0', unit: 'm³', yoy: '0%', mom: '0%', currentDate: '', yoyDate: '', momDate: '' },
  { title: t('dashboard.cargoVolume.titles.monthlyVolume'), value: '0', unit: 'm³', yoy: '0%', mom: '0%', currentDate: '', yoyDate: '', momDate: '' },
  { title: t('dashboard.cargoVolume.titles.yearlyVolume'), value: '0', unit: 'm³', yoy: '0%', mom: '0%', currentDate: '', yoyDate: '', momDate: '' },
])

const formatNumber = (num: number): string => {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'b'
  } else if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'm'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k'
  }
  return num.toString()
}

const fetchData = async () => {
  try {
    const wh = props.fromWarehouse?.[0] || ''
    const province = props.toProvince || []
    const rdc = props.toRdc || []

    const [dayData, monthData, yearData] = await Promise.all([
      queryTotalVolume('1', wh, province, rdc),
      queryTotalVolume('2', wh, province, rdc),
      queryTotalVolume('3', wh, province, rdc),
    ])

    const updateCard = (index: number, data: any) => {
      if (data?.data) {
        const d = data.data
        const raw = parseFloat(d.totalVolume || '0')
        carouselData.value[index].value = formatNumber(Math.round(raw))
        carouselData.value[index].unit = d.unit || 'm³'
        carouselData.value[index].yoy = d.yoy || '0%'
        carouselData.value[index].mom = d.mom || '0%'
        carouselData.value[index].currentDate = d.currentDate || ''
        carouselData.value[index].yoyDate = d.yoyDate || ''
        carouselData.value[index].momDate = d.momDate || ''
      }
    }

    updateCard(0, dayData)
    updateCard(1, monthData)
    updateCard(2, yearData)

    // 同步数据到 dataStore
    dataStore.updateModuleData('cargoVolume', {
      day: dayData?.data || null,
      month: monthData?.data || null,
      year: yearData?.data || null,
    })
  } catch (error) {
    console.error(t('dashboard.cargoVolume.messages.fetchError'), error)
  }
}

const getTrendArrow = (val: string): { arrow: string; color: string } => {
  if (val.startsWith('+') || val.startsWith('↑')) {
    return { arrow: '↑', color: '#10b981' }
  }
  if (val.startsWith('-') || val.startsWith('↓')) {
    return { arrow: '↓', color: '#ef4444' }
  }
  return { arrow: '', color: '#94a3b8' }
}

const buildTooltipHtml = (item: CarouselData): string => {
  const lines: string[] = []
  if (item.currentDate && item.yoyDate) {
    const yoyTrend = getTrendArrow(item.yoy)
    lines.push(`${item.currentDate} ${t('dashboard.cargoVolume.tooltip.vs')} ${item.yoyDate} ${t('dashboard.cargoVolume.tooltip.yoy')}: ${yoyTrend.arrow} ${item.yoy}`)
  }
  if (item.currentDate && item.momDate) {
    const momTrend = getTrendArrow(item.mom)
    lines.push(`${item.currentDate} ${t('dashboard.cargoVolume.tooltip.vs')} ${item.momDate} ${t('dashboard.cargoVolume.tooltip.mom')}: ${momTrend.arrow} ${item.mom}`)
  }
  return lines.join('\n') || t('common.messages.noData')
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="cargo-volume-container">
    <div class="carousel-section">
      <div class="carousel-cards-container">
        <div class="carousel-card-wrapper">
          <div class="carousel-card">
            <Swiper
              :slides-per-view="1"
              :loop="false"
              :pagination="{ clickable: true, el: '.swiper-pagination' }"
              :autoplay="{ delay: 4000, disableOnInteraction: false }"
              :modules="[Pagination, Autoplay]"
            >
              <SwiperSlide v-for="(item, index) in carouselData" :key="index">
                <div class="card-content-carouselCard">
                  <div class="card-title">{{ item.title }}</div>
                  <div class="card-main-content">
                    <div class="card-value-unit">
                      <a-tooltip :title="buildTooltipHtml(item)" placement="bottom" color="#1e293b">
                        <span class="card-value">{{ item.value }}</span>
                      </a-tooltip>
                      <span class="card-unit">{{ item.unit }}</span>
                    </div>
                  </div>
                </div>
              </SwiperSlide>
            </Swiper>
            <div class="swiper-pagination"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cargo-volume-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.carousel-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.carousel-cards-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.carousel-card-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  background-image: url('/dashboard/images/cargo-bg.png');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  border-radius: 0.5rem;
  box-shadow: 0 0 1.25rem rgba(74, 158, 255, 0.3);
  overflow: hidden;
}

.carousel-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  position: relative;
}

.carousel-card :deep(.swiper) {
  width: 100%;
  height: 100%;
}

.carousel-card :deep(.swiper-slide) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-content-carouselCard {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.card-title {
  color: #a0c4ff;
  font-size: clamp(0.35rem, 0.7vw, 0.6rem);
  margin-bottom: 0.4rem;
  font-weight: 400;
}

.card-main-content {
  display: flex;
  align-items: baseline;
  justify-content: center;
}

.card-value-unit {
  display: flex;
  align-items: baseline;
  gap: 0.2rem;
}

.card-value {
  color: #ffffff;
  font-weight: 700;
  font-size: clamp(0.5rem, 1.4vw, 0.8rem);
  text-shadow: 0 0 0.4rem rgba(255, 255, 255, 0.3);
  cursor: pointer;
  line-height: 1.2;
}

.card-unit {
  color: rgba(255, 255, 255, 0.7);
  font-size: clamp(0.35rem, 0.8vw, 0.5rem);
  font-weight: 400;
}

/* Swiper 分页圆点 */
.swiper-pagination {
  position: absolute;
  bottom: 0.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  gap: 0.375rem;
  justify-content: center;
}

.swiper-pagination :deep(.swiper-pagination-bullet) {
  width: 6px;
  height: 6px;
  background: rgba(255, 255, 255, 0.4);
  opacity: 1;
  border-radius: 50%;
  transition: all 0.3s;
}

.swiper-pagination :deep(.swiper-pagination-bullet-active) {
  background: #ffffff;
  transform: scale(1.3);
}

/* 响应式断点 */
@media (max-width: 900px) {
  .card-value {
    font-size: clamp(1.25rem, 2.5vw, 2rem);
  }

  .card-title {
    font-size: clamp(0.7rem, 1.1vw, 0.875rem);
  }

  .carousel-card-wrapper {
    border-radius: 0.375rem;
  }
}

@media (max-width: 768px) {
  .card-value {
    font-size: clamp(1.125rem, 2.2vw, 1.75rem);
  }

  .carousel-card {
    padding: 0.75rem;
  }

  .corner-decor {
    width: 6px;
    height: 6px;
  }
}

@media (max-width: 600px) {
  .card-value {
    font-size: clamp(1rem, 2vw, 1.5rem);
  }

  .card-title {
    font-size: 0.7rem;
    margin-bottom: 0.25rem;
  }

  .carousel-card {
    padding: 0.5rem;
  }

  .swiper-pagination {
    bottom: 0.25rem;
  }
}

@media (max-width: 400px) {
  .card-value {
    font-size: clamp(0.875rem, 1.8vw, 1.25rem);
  }

  .card-unit {
    font-size: 0.625rem;
  }

  .corner-decor {
    width: 5px;
    height: 5px;
    border-width: 1.5px;
  }

  .corner-decor.top-left { top: 4px; left: 4px; }
  .corner-decor.top-right { top: 4px; right: 4px; }
  .corner-decor.bottom-left { bottom: 4px; left: 4px; }
  .corner-decor.bottom-right { bottom: 4px; right: 4px; }
}

@media (max-width: 300px) {
  .card-value {
    font-size: 0.75rem;
  }

  .card-title {
    font-size: 0.6rem;
  }

  .card-unit {
    font-size: 0.5rem;
  }

  .carousel-card {
    padding: 0.25rem;
  }

  .corner-decor {
    width: 4px;
    height: 4px;
    border-width: 1px;
  }
}
</style>
