<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { queryOnTimeRateCard } from '../../../services/transportApi'
import { useDashboardDataStore } from '../../../stores/dashboardDataStore'

const { t } = useI18n()
const dataStore = useDashboardDataStore()

const title = computed(() => t('dashboard.endToEnd.title'))

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

    // console.log('[EndToEnd] request params:', { fromWarehouse, toProvince, toRdc, startDate, endDate })
    // console.log('[EndToEnd] API result:', result)

    if (result?.code === 200 && result.data) {
      dataStore.updateModuleData('endToEnd', result.data)
      // 端对端准时交付率使用 deliveryRate 字段
      const rate = result.data.deliveryRate
      if (rate !== null && rate !== undefined && rate !== '') {
        if (typeof rate === 'string' && rate.includes('%')) {
          const num = parseFloat(rate.replace('%', ''))
          if (!isNaN(num)) {
            rateValue.value = Math.round(num) + '%'
          } else {
            rateValue.value = '0%'
          }
        } else if (typeof rate === 'number') {
          rateValue.value = Math.round(rate) + '%'
        } else {
          rateValue.value = '0%'
        }
      } else {
        rateValue.value = '0%'
      }
    } else {
      rateValue.value = '0%'
    }
  } catch (error) {
    console.error(t('dashboard.endToEnd.messages.fetchDataFailed'), error)
    rateValue.value = '0%'
  } finally {
    loading.value = false
  }
}

watch(
  () => props,
  () => {
    fetchData()
  },
  { deep: true }
)

onMounted(() => {
  fetchData()
})
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
  overflow: hidden;
}

.static-card {
  width: 100%;
  height: 100%;
  background: url('/dashboard/images/cargo-bg.png') center/100% 100% no-repeat;
  box-shadow: 0 0 1.25rem rgba(74, 158, 255, 0.3);
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
  align-items: center;
  justify-content: center;
  gap: clamp(0.1rem, 0.3vw, 0.3rem);
  flex-wrap: nowrap;
}

.card-value {
  font-size: clamp(0.5rem, 1.4vw, 0.8rem);
  font-weight: bold;
  color: #ffffff;
  text-shadow: 0 0 0.4rem rgba(255, 255, 255, 0.3);
  line-height: 1;
  white-space: nowrap;
}

.card-value.green {
  color: #ffffff;
  text-shadow: 0 0 0.4rem rgba(255, 255, 255, 0.3);
}

/* 响应式媒体查询 */
@media (max-width: 900px) {
  .static-card {
    padding: clamp(0.375rem, 0.5vw, 1rem);
  }
}

@media (max-width: 768px) {
  .static-card {
    padding: clamp(0.25rem, 0.5vw, 0.75rem);
  }
}

@media (max-width: 600px) {
  .static-card {
    max-width: 100%;
    height: auto;
    flex: none;
    padding: clamp(0.25rem, 0.5vw, 0.5rem);
  }

  .card-content-carouselCard {
    padding-top: 0.5rem;
  }

  .card-title {
    font-size: clamp(0.4rem, 1.5vw, 0.7rem);
  }

  .card-main-content {
    gap: clamp(0.1rem, 0.2vw, 0.2rem);
  }

  .card-value {
    font-size: clamp(0.6rem, 3.5vw, 1rem);
  }
}

@media (max-width: 400px) {
  .static-card {
    .card-content-carouselCard {
      padding-top: 0.25rem;
    }

    .card-title {
      font-size: 0.4rem;
    }

    .card-main-content {
      gap: 0.05rem;
    }

    .card-value {
      font-size: 0.6rem;
    }
  }
}

@media (max-width: 300px) {
  .static-card {
    min-width: 3.75rem;

    .card-content-carouselCard {
      padding-top: 0.125rem;
    }

    .card-title {
      font-size: 0.35rem;
    }

    .card-main-content {
      gap: 0.03rem;
    }

    .card-value {
      font-size: 0.5rem;
    }
  }
}
</style>
