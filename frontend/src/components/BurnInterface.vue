<template>
  <div class="burn-interface">
    <h3 class="burn-title">Convert SCR to USDT</h3>

    <!-- Rate Display -->
    <div v-if="burnRate.displayRate !== '0'" class="rate-display">
      <span class="rate-label">Current Rate:</span>
      <span class="rate-value">1 SCR = {{ burnRate.displayRate }} USDT</span>
    </div>

    <!-- Input Section -->
    <div class="input-section">
      <label class="input-label">SCR Amount</label>
      <div class="input-wrapper">
        <input
          v-model="scrAmount"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          class="amount-input"
          :disabled="!isConnected || isTransacting"
        />
        <button
          @click="setMaxAmount"
          :disabled="!isConnected || isTransacting || balances.scr === 0n"
          class="max-btn"
          type="button"
        >
          MAX
        </button>
        <span class="input-token">SCR</span>
      </div>
      <p v-if="scrAmount" class="calculated-amount">
        You will receive: <strong>{{ calculatedUSDT }}</strong> USDT
      </p>
    </div>

    <!-- Burn Button -->
    <button
      @click="handleBurn"
      :disabled="!canBurn"
      class="burn-btn"
    >
      {{ buttonText }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { parseUnits } from 'ethers'
import { useWagmiWallet } from '@/composables/useWagmiWallet'
import { useContract } from '@/composables/useContract'
import { useBurn } from '@/composables/useBurn'
import { config } from '@/config'

const emit = defineEmits<{
  statusChange: []
}>()

const { isConnected, address, provider } = useWagmiWallet()
const {
  balances,
  burnRate,
  hasBurnEnded,
  fetchBurnRate,
  calculateUSDTAmount,
} = useContract()

const { burnSCR, txStatus } = useBurn()

const scrAmount = ref('')

const calculatedUSDT = computed(() => {
  if (!scrAmount.value || burnRate.value.numerator === 0n) return '0'
  const result = calculateUSDTAmount(scrAmount.value)
  console.log('[BurnInterface] Calculated USDT:', { scrAmount: scrAmount.value, result, burnRate: burnRate.value })
  return result
})

const validationError = computed(() => {
  if (!isConnected.value) return 'Please connect your wallet'
  if (hasBurnEnded.value) return 'Burn period has ended'
  if (!scrAmount.value || parseFloat(scrAmount.value) <= 0) return null

  try {
    // Use bigint comparison to avoid floating point precision issues
    const amountStr = String(scrAmount.value)
    const amountBigInt = parseUnits(amountStr, config.tokenDecimals.scr)

    if (amountBigInt > balances.value.scr) {
      return 'Insufficient SCR balance'
    }
  } catch (error) {
    // If parsing fails, it's an invalid input
    return 'Invalid amount'
  }

  return null
})

const isTransacting = computed(() => {
  return txStatus.value.status === 'approving' || txStatus.value.status === 'burning'
})

const canBurn = computed(() => {
  return (
    isConnected.value &&
    scrAmount.value &&
    parseFloat(scrAmount.value) > 0 &&
    !validationError.value &&
    !isTransacting.value
  )
})

const buttonText = computed(() => {
  if (!isConnected.value) return 'Connect Wallet'
  if (isTransacting.value) {
    return txStatus.value.status === 'approving' ? 'Approving...' : 'Burning...'
  }
  if (validationError.value) return validationError.value
  return 'Burn SCR'
})

function setMaxAmount() {
  if (balances.value.scr === 0n) return

  // Convert the balance from wei to ether (18 decimals)
  const maxAmount = Number(balances.value.scr) / 1e18
  scrAmount.value = maxAmount.toString()
}

async function handleBurn() {
  if (!canBurn.value) return

  try {
    await burnSCR(scrAmount.value)
    scrAmount.value = '' // Clear input on success
    emit('statusChange')
  } catch (error) {
    console.error('Burn failed:', error)
    emit('statusChange')
  }
}

// Fetch burn rate when provider is ready
watch([address, provider], ([newAddress, newProvider]) => {
  console.log('[BurnInterface] Watch triggered:', { address: newAddress, hasProvider: !!newProvider })
  if (newAddress && newProvider) {
    console.log('[BurnInterface] Fetching burn rate...')
    fetchBurnRate()
  }
}, { immediate: true })

onMounted(() => {
  console.log('[BurnInterface] Mounted:', {
    isConnected: isConnected.value,
    address: address.value,
    hasProvider: !!provider.value
  })
  if (isConnected.value && address.value && provider.value) {
    fetchBurnRate()
  }
})
</script>

<style scoped>
.burn-interface {
  background: white;
  border-radius: 0.75rem;
  padding: 1rem;
  border: 1px solid #e5e7eb;
}

.burn-title {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 0.75rem;
}

.rate-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.625rem;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
}

.rate-label {
  font-size: 0.8125rem;
  color: #0369a1;
  font-weight: 500;
}

.rate-value {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #0c4a6e;
}

.input-section {
  margin-bottom: 1rem;
}

.input-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.25rem;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.amount-input {
  width: 100%;
  padding: 0.625rem 6.5rem 0.625rem 0.875rem;
  font-size: 1rem;
  font-weight: 600;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  outline: none;
  transition: border-color 0.2s;
}

.amount-input:focus {
  border-color: #7c3aed;
}

.amount-input:disabled {
  background: #f9fafb;
  cursor: not-allowed;
}

.max-btn {
  position: absolute;
  right: 4rem;
  padding: 0.375rem 0.75rem;
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 0.025em;
}

.max-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
}

.max-btn:active:not(:disabled) {
  transform: translateY(0);
}

.max-btn:disabled {
  background: #e5e7eb;
  color: #9ca3af;
  cursor: not-allowed;
}

.input-token {
  position: absolute;
  right: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
}

.calculated-amount {
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: #6b7280;
  text-align: right;
}

.calculated-amount strong {
  color: #059669;
  font-size: 0.9375rem;
}

.burn-btn {
  width: 100%;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  color: white;
  font-size: 0.9375rem;
  font-weight: 600;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.burn-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
}

.burn-btn:disabled {
  background: #e5e7eb;
  color: #9ca3af;
  cursor: not-allowed;
  transform: none;
}

.validation-error {
  margin-top: 0.75rem;
  font-size: 0.875rem;
  color: #dc2626;
  text-align: center;
}
</style>
