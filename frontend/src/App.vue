<template>
  <div class="app-container">
    <!-- Navbar -->
    <nav class="navbar">
      <div class="navbar-content">
        <div class="logo">
          <span class="logo-icon">🔥</span>
          <span class="logo-text">SCR Conversion</span>
        </div>

        <div class="navbar-right">
          <!-- Network Indicator -->
          <div v-if="isConnected" class="network-badge">
            <span class="network-dot" :class="{ 'network-dot-correct': isCorrectChain }"></span>
            <span class="network-name">{{ chainName }}</span>
          </div>

          <!-- Connected State -->
          <div v-if="isConnected" class="connected-account">
            <button @click="showSwitchNetwork = !showSwitchNetwork" class="account-button">
              <span class="account-address">{{ shortAddress }}</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
            </button>

            <!-- Dropdown Menu -->
            <div v-if="showSwitchNetwork" class="account-dropdown">
              <button v-if="!isCorrectChain" @click="handleSwitchNetwork" class="dropdown-item">
                {{ switchNetworkLabel }}
              </button>
              <button @click="handleDisconnect" class="dropdown-item disconnect">
                ⚡ Disconnect
              </button>
            </div>
          </div>

          <!-- Not Connected State -->
          <button v-else @click="openWalletModal" class="connect-button">
            Connect Wallet
          </button>
        </div>
      </div>
    </nav>

    <!-- Hero Section -->
    <div class="hero-section">
      <div class="hero-content">
        <h1 class="hero-title">Convert SCR to USDT</h1>
        <p class="hero-subtitle">
          Exchange and burn your SCR tokens for USDT at a fixed rate on Polygon
        </p>
      </div>
    </div>

    <!-- Main Content -->
    <main class="main-content">
      <div class="container">
        <!-- Main Interface (only show when wallet is connected) -->
        <template v-if="isConnected">
          <div class="main-card-wrapper">
            <!-- Pool Info -->
            <PoolInfo />

            <!-- Main Card -->
            <div class="card card-primary">
              <BalanceDisplay />
              <div class="divider"></div>
              <BurnInterface @status-change="handleStatusChange" />
            </div>
          </div>
        </template>

        <!-- Not Connected State -->
        <div v-else class="not-connected-card">
          <div class="not-connected-content">
            <div class="not-connected-icon">👛</div>
            <h3 class="not-connected-title">Connect Your Wallet</h3>
            <p class="not-connected-text">
              Connect your wallet to start burning SCR tokens
            </p>
          </div>
        </div>
      </div>
    </main>

    <!-- Toast Notifications -->
    <ToastNotification
      :show="showToast"
      :type="toastType"
      :title="toastTitle"
      :message="toastMessage"
      :tx-hash="toastTxHash"
      :closeable="toastCloseable"
      @close="handleCloseToast"
    />

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-content">
        <p class="footer-text">
          © {{ new Date().getFullYear() }} Taoist Labs. All rights reserved.
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from 'vue'
// Lazy load heavy components - only load when wallet is connected
const PoolInfo = defineAsyncComponent(() => import('./components/PoolInfo.vue'))
const BalanceDisplay = defineAsyncComponent(() => import('./components/BalanceDisplay.vue'))
const BurnInterface = defineAsyncComponent(() => import('./components/BurnInterface.vue'))
const ToastNotification = defineAsyncComponent(() => import('./components/ToastNotification.vue'))
import { useWagmiWallet } from './composables/useWagmiWallet'
import { useBurn } from './composables/useBurn'

const {
  isConnected,
  address,
  chainName,
  isCorrectChain,
  switchToHardhatLocal,
  switchToPolygon,
  disconnect,
  openModal
} = useWagmiWallet()

const { txStatus, resetStatus } = useBurn()

// UI state
const showSwitchNetwork = ref(false)

// Check if we should show switch to hardhat or polygon
const targetNetwork = computed(() => {
  const currentChain = chainName.value
  if (currentChain === 'Polygon Mainnet') return 'hardhat'
  return 'polygon'
})

const switchNetworkLabel = computed(() => {
  return targetNetwork.value === 'polygon'
    ? '🔄 Switch to Polygon Mainnet'
    : '🔄 Switch to Hardhat Local'
})

// Computed
const shortAddress = computed(() => {
  if (!address.value) return ''
  return `${address.value.slice(0, 6)}...${address.value.slice(-4)}`
})

// Toast computed properties
const showToast = computed(() => {
  const shouldShow = txStatus.value.status !== 'idle'
  console.log('[App.vue] showToast:', shouldShow, 'txStatus:', txStatus.value)
  return shouldShow
})

const toastType = computed(() => {
  const status = txStatus.value.status
  if (status === 'approving' || status === 'burning') return 'loading'
  if (status === 'success') return 'success'
  if (status === 'error') return 'error'
  return 'info'
})

const toastTitle = computed(() => {
  const status = txStatus.value.status
  if (status === 'approving') return 'Approving SCR...'
  if (status === 'burning') return 'Burning SCR...'
  if (status === 'success') return 'Burn Successful!'
  if (status === 'error') return 'Transaction Failed'
  return ''
})

const toastMessage = computed(() => {
  return txStatus.value.message || txStatus.value.error || ''
})

const toastTxHash = computed(() => txStatus.value.txHash)

const toastCloseable = computed(() => {
  const status = txStatus.value.status
  return status === 'success' || status === 'error'
})

// Methods
function openWalletModal() {
  openModal()
}

async function handleSwitchNetwork() {
  try {
    if (targetNetwork.value === 'polygon') {
      await switchToPolygon()
    } else {
      await switchToHardhatLocal()
    }
    showSwitchNetwork.value = false
  } catch (error) {
    console.error('Failed to switch network:', error)
  }
}

function handleDisconnect() {
  disconnect()
  showSwitchNetwork.value = false
}

function handleStatusChange() {
  // Status changes are handled by the composable
}

function handleCloseToast() {
  resetStatus()
}

// Wagmi handles auto-reconnection automatically, no manual action needed
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
}

/* Navbar */
.navbar {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.navbar-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  font-size: 1.25rem;
  color: #1f2937;
  cursor: pointer;
}

.logo-icon {
  font-size: 1.5rem;
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* Network Badge */
.network-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #f3f4f6;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.network-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f59e0b;
}

.network-dot-correct {
  background: #10b981;
}

.network-name {
  color: #6b7280;
}

/* Connected Account */
.connected-account {
  position: relative;
}

.account-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-radius: 0.75rem;
  font-weight: 600;
  color: #111827;
  cursor: pointer;
  transition: all 0.2s;
}

.account-button:hover {
  background: #f3f4f6;
  border-color: #7c3aed;
}

.account-address {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: 0.875rem;
}

/* Account Dropdown */
.account-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  left: 0;
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  border: 1px solid #e5e7eb;
  overflow: hidden;
  z-index: 10;
}

.dropdown-item {
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  background: white;
  text-align: left;
  cursor: pointer;
  font-weight: 500;
  color: #374151;
  transition: background 0.2s;
  border-bottom: 1px solid #f3f4f6;
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover {
  background: #f9fafb;
}

.dropdown-item.disconnect {
  color: #dc2626;
}

.dropdown-item.disconnect:hover {
  background: #fee2e2;
}

/* Connect Button */
.connect-button {
  padding: 0.625rem 1.5rem;
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  border: none;
  border-radius: 0.75rem;
  color: white;
  font-weight: 600;
  font-size: 0.9375rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
}

.connect-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
}

/* Hero Section */
.hero-section {
  padding: 2rem 2rem 1.5rem;
  text-align: center;
}

.hero-content {
  max-width: 800px;
  margin: 0 auto;
}

.hero-title {
  font-size: 2.5rem;
  font-weight: 800;
  color: white;
  margin-bottom: 0.5rem;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.hero-subtitle {
  font-size: 1.125rem;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 400;
}

/* Main Content */
.main-content {
  flex: 1;
  padding: 1.5rem 2rem;
}

.container {
  max-width: 800px;
  margin: 0 auto;
}

.main-card-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Cards */
.card {
  background: white;
  border-radius: 1.5rem;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), 0 10px 20px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.card-primary {
  background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
}

.card-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1.5rem;
}

/* Divider */
.divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, #e5e7eb, transparent);
  margin: 1.5rem 0;
}

/* Not Connected State */
.not-connected-card {
  background: white;
  border-radius: 1.5rem;
  padding: 3rem 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), 0 10px 20px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.not-connected-content {
  max-width: 400px;
  margin: 0 auto;
}

.not-connected-icon {
  font-size: 3.5rem;
  margin-bottom: 1rem;
}

.not-connected-title {
  font-size: 1.375rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.not-connected-text {
  color: #6b7280;
  font-size: 1rem;
}

/* Footer */
.footer {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1.5rem 2rem;
  margin-top: 2rem;
}

.footer-content {
  max-width: 1400px;
  margin: 0 auto;
  text-align: center;
}

.footer-text {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.875rem;
}

/* Responsive */
@media (max-width: 768px) {
  .navbar-content {
    padding: 1rem;
  }

  .logo {
    font-size: 1rem;
  }

  .logo-icon {
    font-size: 1.25rem;
  }

  .network-badge {
    font-size: 0.75rem;
    padding: 0.375rem 0.5rem;
  }

  .account-button {
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
  }

  .connect-button {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  }

  .hero-title {
    font-size: 1.75rem;
  }

  .hero-subtitle {
    font-size: 0.9375rem;
  }

  .hero-section {
    padding: 1.5rem 1rem 1rem;
  }

  .main-content {
    padding: 1rem;
  }

  .card {
    padding: 1.25rem;
  }

  .divider {
    margin: 1.25rem 0;
  }

  .not-connected-card {
    padding: 2rem 1.5rem;
  }

  .footer {
    padding: 1.25rem 1rem;
    margin-top: 1.5rem;
  }
}
</style>
