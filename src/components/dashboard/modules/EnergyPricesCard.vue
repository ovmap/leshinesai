<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import 'swiper/css'
import 'swiper/css/pagination'
import { Pagination, Autoplay } from 'swiper/modules'
import { queryEnergyPrice } from '../../../services/transportApi'

interface EnergyPriceData {
  id: number
  title: string
  value: string
  unit: string
  yoy?: string
  mom?: string
  priceIsUp?: boolean
}

const energyPriceData = ref<EnergyPriceData[]>([
  {
    id: 1,
    title: '汽油',
    value: '--',
    unit: '元/吨',
    yoy: '--',
    mom: '--',
    priceIsUp: true,
  },
  {
    id: 2,
    title: '柴油',
    value: '--',
    unit: '元/吨',
    yoy: '--',
    mom: '--',
    priceIsUp: true,
  },
  {
    id: 3,
    title: '航空燃油',
    value: '--',
    unit: '元/吨',
    yoy: '--',
    mom: '--',
    priceIsUp: false,
  },
])

const fetchEnergyPrice = async () => {
  try {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const startDate = `${year}-01`
    const endDate = `${year}-${month}`

    const result = await queryEnergyPrice({ startDate, endDate, international: false })
    console.log('[EnergyPrices] API result:', result)
    if (result?.code === 200 && result.data) {
      const data = result.data
      energyPriceData.value = [
        {
          id: 1,
          title: '汽油',
          value: data.gasoline ?? '--',
          unit: '元/吨',
          priceIsUp: data.gasolinePriceIsUp ?? true,
        },
        {
          id: 2,
          title: '柴油',
          value: data.diesel ?? '--',
          unit: '元/吨',
          priceIsUp: data.dieselPriceIsUp ?? true,
        },
        {
          id: 3,
          title: '航空燃油',
          value: data.aircraftFuel ?? '--',
          unit: '元/吨',
          priceIsUp: data.aircraftFuelPriceIsUp ?? false,
        },
      ]
    }
  } catch (error) {
    console.error('获取能源价格数据失败:', error)
  }
}

let swiperInstance: any = null

const onSwiper = (swiper: any) => {
  swiperInstance = swiper
}

onMounted(() => {
  fetchEnergyPrice()
})

onUnmounted(() => {
  if (swiperInstance) {
    swiperInstance.destroy(true, true)
    swiperInstance = null
  }
})
</script>

<template>
  <div class="energy-price-container">
    <div class="energy-price-section">
      <div class="energy-price-cards-container">
        <div class="energy-price-card-wrapper">
          <div class="energy-price-card">
            <Swiper
              :slidesPerView="1"
              :loop="false"
              :pagination="{ el: '.swiper-pagination', clickable: true }"
              :autoplay="{ delay: 5000, disableOnInteraction: false }"
              :modules="[Pagination, Autoplay]"
              class="energy-swiper"
              @swiper="onSwiper"
            >
              <SwiperSlide v-for="item in energyPriceData" :key="item.id">
                <div class="card-content-carouselCard">
                  <div class="card-title">{{ item.title }}</div>
                  <div class="card-main-content">
                    <div class="card-value-unit">
                      <span class="card-value">{{ item.value }}</span>
                      <span class="card-unit">{{ item.unit }}</span>
                      <span
                        class="trend-arrow"
                        :class="item.priceIsUp ? 'trend-up' : 'trend-down'"
                      >
                        {{ item.priceIsUp ? '▲' : '▼' }}
                      </span>
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
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.energy-price-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.energy-price-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  width: 100%;
  height: 100%;
}

.energy-price-cards-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.energy-price-card-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  background: url('/dashboard/images/cargo-bg.png') center/100% 100% no-repeat;
  box-shadow: 0 0 1.25rem rgba(74, 158, 255, 0.3);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.energy-price-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: clamp(4px, 1vw, 8px) clamp(2px, 0.5vw, 4px);
  position: relative;
}

.energy-swiper {
  width: 100%;
  height: 100%;
}

.energy-swiper :deep(.swiper-slide) {
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
  height: 100%;
  gap: clamp(4px, 1vw, 8px);
}

.card-title {
  color: #a0c4ff;
  font-size: clamp(0.35rem, 0.7vw, 0.6rem);
  font-weight: 500;
  text-align: center;
  white-space: nowrap;
}

.card-main-content {
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-value-unit {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: clamp(2px, 0.5vw, 6px);
  flex-wrap: nowrap;
}

.card-value {
  color: #ffffff;
  font-size: clamp(0.6rem, 1.8vw, 1rem);
  font-weight: bold;
  text-shadow: 0 0 8px rgba(74, 158, 255, 0.6), 0 0 16px rgba(74, 158, 255, 0.3);
  white-space: nowrap;
}

.card-unit {
  color: rgba(255, 255, 255, 0.7);
  font-size: clamp(0.35rem, 0.8vw, 0.5rem);
  white-space: nowrap;
}

.trend-arrow {
  font-size: clamp(0.4rem, 1vw, 0.6rem);
  animation: pulse 2s ease-in-out infinite;
}

.trend-up {
  color: #ff4d4f;
}

.trend-down {
  color: #52c41a;
}

/* Swiper 分页器样式 */
.swiper-pagination {
  position: absolute;
  bottom: 4px !important;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  justify-content: center;
  gap: 6px;
}

.swiper-pagination :deep(.swiper-pagination-bullet) {
  width: 6px;
  height: 6px;
  background: rgba(160, 196, 255, 0.4);
  border-radius: 50%;
  opacity: 1;
  transition: all 0.3s ease;
}

.swiper-pagination :deep(.swiper-pagination-bullet-active) {
  background: #a0c4ff;
  transform: scale(1.3);
}

/* 响应式 */
@media (max-width: 900px) {
  .card-value {
    font-size: clamp(18px, 2.5vw, 30px);
  }
  .card-title {
    font-size: clamp(11px, 1.4vw, 14px);
  }
}

@media (max-width: 768px) {
  .energy-price-card {
    padding: clamp(6px, 1.5vw, 12px);
  }
  .card-value {
    font-size: clamp(16px, 2.2vw, 26px);
  }
  .corner-decor {
    width: 6px;
    height: 6px;
  }
}

@media (max-width: 600px) {
  .card-value {
    font-size: clamp(14px, 2vw, 22px);
  }
  .card-title {
    font-size: clamp(10px, 1.3vw, 13px);
  }
  .card-unit {
    font-size: clamp(9px, 1vw, 12px);
  }
  .trend-arrow {
    font-size: clamp(10px, 1.3vw, 14px);
  }
}

@media (max-width: 400px) {
  .card-value {
    font-size: clamp(12px, 1.8vw, 18px);
  }
  .card-title {
    font-size: 10px;
  }
  .corner-decor {
    width: 5px;
    height: 5px;
  }
}

@media (max-width: 300px) {
  .card-value {
    font-size: 11px;
  }
  .card-title {
    font-size: 9px;
  }
  .card-unit {
    font-size: 8px;
  }
  .trend-arrow {
    font-size: 9px;
  }
  .corner-decor {
    width: 4px;
    height: 4px;
  }
}
</style>
