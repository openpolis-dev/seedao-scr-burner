<template>
  <div class="pool-info">
    <!-- USDT Pool Balance -->
    <div class="info-card pool-balance-card">
      <div class="card-icon">💰</div>
      <div class="card-content">
        <div class="card-label">USDT Pool Balance</div>
        <div class="card-value">{{ formattedPoolBalance }} USDT</div>
      </div>
    </div>

    <!-- Burn End Time -->
    <div v-if="burnEndTime !== 0n" class="info-card countdown-card" :class="{ 'ended': hasBurnEnded }">
      <div class="card-icon">{{ hasBurnEnded ? '🔒' : '⏰' }}</div>
      <div class="card-content">
        <div class="card-label">
          {{ hasBurnEnded ? 'Conversion Period Ended' : 'Conversion Ends In' }}
        </div>
        <div v-if="hasBurnEnded" class="card-value ended-text">
          Burning is no longer available
        </div>
        <div v-else-if="timeRemaining" class="countdown">
          <div class="time-unit">
            <span class="time-value">{{ timeRemaining.days }}</span>
            <span class="time-label">Days</span>
          </div>
          <span class="time-separator">:</span>
          <div class="time-unit">
            <span class="time-value">{{ pad(timeRemaining.hours) }}</span>
            <span class="time-label">Hours</span>
          </div>
          <span class="time-separator">:</span>
          <div class="time-unit">
            <span class="time-value">{{ pad(timeRemaining.minutes) }}</span>
            <span class="time-label">Mins</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useContract } from '@/composables/useContract'
import { useWagmiWallet } from '@/composables/useWagmiWallet'

const {
  formattedPoolBalance,
  burnEndTime,
  hasBurnEnded,
  timeRemaining,
  fetchPoolInfo
} = useContract()

const { provider, address } = useWagmiWallet()

// Ref to track seconds for countdown update
const currentTime = ref(Math.floor(Date.now() / 1000))
let intervalId: number | null = null

// Pad numbers with leading zero
function pad(num: number): string {
  return num.toString().padStart(2, '0')
}

// Update current time every second for countdown
function startCountdown() {
  if (intervalId === null) {
    intervalId = window.setInterval(() => {
      currentTime.value = Math.floor(Date.now() / 1000)
    }, 1000)
  }
}

// Watch for provider and address to become available
watch([address, provider], ([newAddress, newProvider]) => {
  console.log('[PoolInfo] Watch triggered:', { address: newAddress, hasProvider: !!newProvider })
  if (newAddress && newProvider) {
    console.log('[PoolInfo] Fetching pool info...')
    fetchPoolInfo()
    startCountdown()
  }
}, { immediate: true })

onMounted(() => {
  console.log('[PoolInfo] Mounted:', {
    hasProvider: !!provider.value,
    address: address.value
  })
  if (provider.value && address.value) {
    fetchPoolInfo()
    startCountdown()
  }
})

onUnmounted(() => {
  if (intervalId !== null) {
    clearInterval(intervalId)
  }
})
</script>

<style scoped>
.pool-info {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0;
}

.info-card {
  flex: 1;
  background: white;
  border-radius: 0.75rem;
  padding: 1rem;
  border: 2px solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  transition: all 0.2s;
}

.pool-balance-card {
  border-color: #10b981;
  background: linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%);
}

.countdown-card {
  border-color: #7c3aed;
  background: linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%);
}

.countdown-card.ended {
  border-color: #ef4444;
  background: linear-gradient(135deg, #ffffff 0%, #fef2f2 100%);
}

.card-icon {
  font-size: 1.75rem;
  flex-shrink: 0;
}

.card-content {
  flex: 1;
  min-width: 0;
}

.card-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.card-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
}

.ended-text {
  color: #dc2626;
  font-size: 1rem;
}

.countdown {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.time-unit {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 2.75rem;
}

.time-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #7c3aed;
  line-height: 1;
}

.time-label {
  font-size: 0.6875rem;
  color: #6b7280;
  margin-top: 0.125rem;
}

.time-separator {
  font-size: 1.25rem;
  font-weight: 700;
  color: #9ca3af;
  line-height: 1;
  margin: 0 -0.125rem;
}

/* Responsive */
@media (max-width: 768px) {
  .pool-info {
    flex-direction: column;
  }

  .countdown {
    gap: 0.375rem;
  }

  .time-unit {
    min-width: 2.5rem;
  }

  .time-value {
    font-size: 1.25rem;
  }

  .time-label {
    font-size: 0.625rem;
  }

  .time-separator {
    font-size: 1.25rem;
  }
}
</style>
