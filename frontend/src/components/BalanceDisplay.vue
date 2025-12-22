<template>
  <div class="balance-display">
    <h3 class="balance-title">Your Balances</h3>
    <div class="balances">
      <div class="balance-item">
        <span class="token-name">SCR</span>
        <span class="token-amount">{{ formattedBalances.scr }}</span>
      </div>
      <div class="balance-item">
        <span class="token-name">USDT</span>
        <span class="token-amount">{{ formattedBalances.usdt }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useWagmiWallet } from '@/composables/useWagmiWallet'
import { useContract } from '@/composables/useContract'

const { isConnected, address, provider } = useWagmiWallet()
const { formattedBalances, fetchBalances } = useContract()

// Fetch balances when wallet client is ready
// We need to watch both address and provider because walletClient loads after isConnected
watch([address, provider], ([newAddress, newProvider]) => {
  console.log('[BalanceDisplay] Watch triggered:', { address: newAddress, hasProvider: !!newProvider })
  if (newAddress && newProvider) {
    console.log('[BalanceDisplay] Fetching balances...')
    fetchBalances()
  }
}, { immediate: true })

onMounted(() => {
  console.log('[BalanceDisplay] Mounted:', {
    isConnected: isConnected.value,
    address: address.value,
    hasProvider: !!provider.value
  })
  if (isConnected.value && address.value && provider.value) {
    fetchBalances()
  }
})
</script>

<style scoped>
.balance-display {
  background: white;
  border-radius: 0.75rem;
  padding: 0.75rem 0.875rem;
  border: 1px solid #e5e7eb;
}

.balance-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.balances {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.balance-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  background: #f9fafb;
  border-radius: 0.5rem;
}

.token-name {
  font-weight: 600;
  font-size: 0.75rem;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.token-amount {
  font-family: monospace;
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
}

@media (max-width: 480px) {
  .balances {
    grid-template-columns: 1fr;
  }
}
</style>
