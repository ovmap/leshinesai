<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { queryOnTimeRateCard } from '../../../services/transportApi'
import { useDashboardDataStore } from '../../../stores/dashboardDataStore'

const { t } = useI18n()
const dataStore = useDashboardDataStore()

const title = computed(() => t('dashboard.onTime.title'))
const props = defineProps<{
  fromWarehouse?: string[]
  toProvince?: string[]
  toRdc?: string[]
}>()

const rateValue = ref('0%')
const loading = ref(false)

const fetchData = async () => {
  try {
    loading.value = true
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const startDate = `${year}-${month}-01 00:00:00`
    const endDate = `${year}-${month}-${day} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

    const fromWarehouse = (props.fromWarehouse || []).map((w: any) => typeof w === 'string' ? w : w.name || w.code)
    const toProvince = (props.toProvince || []).map((w: any) => typeof w === 'string' ? w : w.name || w.code)
    const toRdc = (props.toRdc || []).map((w: any) => typeof w === 'string' ? w : w.name || w.code)

    const result = await queryOnTimeRateCard({
      fromWarehouse,
      toProvince,
      toRdc,
      startDate,
      endDate,
    })

    // console.log('[OnTime] request params:', { fromWarehouse, toProvince, toRdc, startDate, endDate })
    // console.log('[OnTime] API result:', result)

    if (result?.code === 200 && result.data) {
      dataStore.updateModuleData('onTime', result.data)
      // 提货及时率使用 pickupRate 字段
      const rate = result.data.pickupRate
      if (typeof rate === 'string' && rate.includes('%')) {
        const num = parseFloat(rate.replace('%', ''))
        rateValue.value = isNaN(num) ? '0%' : Math.round(num) + '%'
      } else if (typeof rate === 'number') {
        rateValue.value = Math.round(rate) + '%'
      } else {
        rateValue.value = '0%'
      }
    } else {
      rateValue.value = '0%'
    }
  } catch (error) {
    console.error(t('dashboard.onTime.messages.fetchError'), error)
    rateValue.value = '0%'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})

watch(
  () => props,
  () => {
    fetchData()
  },
  { deep: true }
)
</script>

<template>
  <div class="cargo-volume-container">
    <div class="static-card">
      <div class="card-content-carouselCard">
        <div class="card-title">{{ title }}</div>
        <div class="card-main-content">
          <div class="card-value-unit">
            <span class="card-value green">{{ loading ? '...' : rateValue }}</span>
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

.static-card {
  width: 100%;
  height: 100%;
  background: url('/dashboard/images/cargo-bg.png') center/100% 100% no-repeat;
  box-shadow: 0 0 1.25rem rgba(74, 158, 255, 0.3);
  border-radius: 0.5rem;
  padding: clamp(0.5rem, 2vw, 1.2rem) clamp(0.6rem, 2.5vw, 1.5rem);
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.card-content-carouselCard {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.card-title {
  color: #a0c4ff;
  font-size: clamp(0.35rem, 0.7vw, 0.6rem);
  margin-bottom: 0.4rem;
  font-weight: 400;
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
}

.card-value {
  font-size: clamp(0.5rem, 1.4vw, 0.8rem);
  font-weight: bold;
  color: #ffffff;
  text-shadow: 0 0 0.4rem rgba(255, 255, 255, 0.3);
}

.card-value.green {
  color: #ffffff;
}

.card-unit {
  font-size: clamp(0.35rem, 0.8vw, 0.5rem);
  color: #ffffff;
  font-weight: 500;
  margin-left: 0.1rem;
}

.card-unit.green {
  color: #ffffff;
}

/* 响应式适配 */
@media (max-width: 900px) {
  .static-card {
    padding: clamp(0.4rem, 1.8vw, 1rem) clamp(0.5rem, 2vw, 1.2rem);
  }
}

@media (max-width: 768px) {
  .static-card {
    padding: 0.4rem 0.5rem;
  }

  .card-title {
    font-size: clamp(0.55rem, 1.6vw, 0.9rem);
  }

  .card-value {
    font-size: clamp(1rem, 3vw, 1.6rem);
  }
}

@media (max-width: 600px) {
  .static-card {
    padding: 0.3rem 0.4rem;
  }

  .card-title {
    font-size: clamp(0.5rem, 1.5vw, 0.8rem);
  }

  .card-value {
    font-size: clamp(0.9rem, 2.8vw, 1.4rem);
  }

  .corner {
    width: 6px;
    height: 6px;
  }
}

@media (max-width: 400px) {
  .static-card {
    padding: 0.25rem 0.3rem;
  }

  .card-title {
    font-size: 0.5rem;
  }

  .card-value {
    font-size: clamp(0.8rem, 2.5vw, 1.2rem);
  }
}

@media (max-width: 300px) {
  .static-card {
    padding: 0.2rem;
  }

  .card-title {
    font-size: 0.45rem;
  }

  .card-value {
    font-size: 0.8rem;
  }

  .corner {
    width: 4px;
    height: 4px;
  }
}
</style>
