<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import { queryTrunkLinePrice } from '../../../services/transportApi'
import { useDashboardDataStore } from '../../../stores/dashboardDataStore'

const { t } = useI18n()
const dataStore = useDashboardDataStore()

const title = computed(() => t('dashboard.unitPrice.title'))
const unit = computed(() => t('dashboard.unitPrice.units.yuanPerKm'))
const value = ref('0')

const fetchData = async () => {
  try {
    const startDate = dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD') + ' 00:00:00'
    const endDate = dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD') + ' 23:59:59'
    const result = await queryTrunkLinePrice({ startDate, endDate })
    if (result?.code === 200 && result.data) {
      dataStore.updateModuleData('unitPrice', result.data)
      value.value = parseFloat(result.data.trunkLinePrice ?? '0').toFixed(2)
    }
  } catch (error) {
    console.error(t('dashboard.unitPrice.messages.fetchError'), error)
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="cargo-volume-container">
    <div class="static-card">
      <!-- 卡片内容 -->
      <div class="card-content-carouselCard">
        <div class="card-title">{{ title }}</div>
        <div class="card-main-content">
          <div class="card-value-unit">
            <span class="card-value green">{{ value }}</span>
            <span class="card-unit green">{{ unit }}</span>
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
  overflow: hidden;
}

.static-card {
  width: 100%;
  height: 100%;
  background: url('/dashboard/images/cargo-bg.png') center/100% 100% no-repeat;
  box-shadow: 0 0 1.25rem rgba(74, 158, 255, 0.3);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.card-content-carouselCard {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 3;
  width: 100%;
  height: 100%;
  padding: 16px;
}

.card-title {
  color: #a0c4ff;
  font-size: clamp(0.35rem, 0.7vw, 0.6rem);
  font-weight: 400;
  margin-bottom: 8px;
  text-align: center;
}

.card-main-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  align-items: center;
  justify-content: center;
}

.card-value-unit {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}

.card-value.green {
  color: #ffffff;
  font-weight: 700;
  font-size: clamp(0.5rem, 1.4vw, 0.8rem);
  text-shadow: 0 0 0.4rem rgba(255, 255, 255, 0.3);
  line-height: 1.2;
}

.card-unit.green {
  color: #ffffff;
  font-weight: 500;
  font-size: clamp(0.35rem, 0.8vw, 0.5rem);
  margin-left: 4px;
}

/* 响应式适配 */
@media (max-width: 900px) {
  .card-title {
    font-size: clamp(0.55rem, 1.6vw, 0.9rem);
  }

  .card-value.green {
    font-size: clamp(1.1rem, 3vw, 1.8rem);
  }

  .card-unit.green {
    font-size: clamp(0.45rem, 1.3vw, 0.75rem);
  }
}

@media (max-width: 768px) {
  .card-title {
    font-size: clamp(0.5rem, 1.5vw, 0.85rem);
    margin-bottom: 8px;
  }

  .card-value.green {
    font-size: clamp(1rem, 2.8vw, 1.6rem);
  }

  .card-unit.green {
    font-size: clamp(0.4rem, 1.2vw, 0.7rem);
  }

  .card-content-carouselCard {
    padding: 12px;
  }
}

@media (max-width: 600px) {
  .card-title {
    font-size: clamp(0.45rem, 1.4vw, 0.8rem);
    margin-bottom: 6px;
  }

  .card-value.green {
    font-size: clamp(0.9rem, 2.5vw, 1.4rem);
  }

  .card-unit.green {
    font-size: clamp(0.4rem, 1.1vw, 0.65rem);
  }

  .card-content-carouselCard {
    padding: 8px;
  }

  .corner-decor {
    width: 6px;
    height: 6px;
  }
}

@media (max-width: 400px) {
  .card-title {
    font-size: 0.45rem;
    margin-bottom: 4px;
  }

  .card-value.green {
    font-size: 0.9rem;
  }

  .card-unit.green {
    font-size: 0.4rem;
  }

  .card-content-carouselCard {
    padding: 4px;
  }

  .corner-decor {
    width: 5px;
    height: 5px;
  }
}

@media (max-width: 300px) {
  .card-title {
    font-size: 0.4rem;
    margin-bottom: 2px;
  }

  .card-value.green {
    font-size: 0.8rem;
  }

  .card-unit.green {
    font-size: 0.35rem;
  }

  .card-content-carouselCard {
    padding: 2px;
  }

  .corner-decor {
    width: 4px;
    height: 4px;
  }
}
</style>
