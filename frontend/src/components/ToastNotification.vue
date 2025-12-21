<template>
  <Transition name="toast">
    <div v-if="show" class="toast-container" :class="`toast-${type}`">
      <div class="toast-content">
        <div class="toast-icon">
          <span v-if="type === 'success'">✅</span>
          <span v-else-if="type === 'error'">❌</span>
          <span v-else-if="type === 'loading'">
            <div class="spinner-small"></div>
          </span>
          <span v-else>ℹ️</span>
        </div>
        <div class="toast-body">
          <div class="toast-title">{{ title }}</div>
          <div v-if="message" class="toast-message">{{ message }}</div>
          <a
            v-if="txHash && type === 'success'"
            :href="getExplorerUrl(txHash)"
            target="_blank"
            rel="noopener noreferrer"
            class="toast-link"
          >
            View Transaction →
          </a>
        </div>
        <button v-if="closeable" @click="handleClose" class="toast-close">
          ✕
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { config } from '@/config'
import { useWagmiWallet } from '@/composables/useWagmiWallet'
import { watch } from 'vue'

interface Props {
  show: boolean
  type: 'success' | 'error' | 'loading' | 'info'
  title: string
  message?: string
  txHash?: string
  closeable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  closeable: true
})

const emit = defineEmits<{
  close: []
}>()

const { chainId } = useWagmiWallet()

// Debug logging
watch(() => props.show, (newVal) => {
  console.log('[ToastNotification] show changed:', newVal, 'props:', props)
}, { immediate: true })

function getExplorerUrl(txHash: string): string {
  const chain = chainId.value

  if (chain === config.networks.polygon.id) {
    return `https://polygonscan.com/tx/${txHash}`
  } else {
    // Local network - no explorer
    return '#'
  }
}

function handleClose() {
  emit('close')
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 5rem;
  right: 1.5rem;
  width: 400px;
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1);
  padding: 1.25rem;
  z-index: 1000;
  border: 2px solid;
}

.toast-success {
  border-color: #10b981;
  background: linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%);
}

.toast-error {
  border-color: #ef4444;
  background: linear-gradient(135deg, #ffffff 0%, #fef2f2 100%);
}

.toast-loading {
  border-color: #7c3aed;
  background: linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%);
}

.toast-info {
  border-color: #3b82f6;
  background: linear-gradient(135deg, #ffffff 0%, #eff6ff 100%);
}

.toast-content {
  display: flex;
  gap: 0.875rem;
  align-items: flex-start;
}

.toast-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.spinner-small {
  width: 24px;
  height: 24px;
  border: 3px solid #f3f4f6;
  border-top-color: #7c3aed;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.toast-body {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 0.25rem;
}

.toast-message {
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.4;
  margin-bottom: 0.5rem;
}

.toast-link {
  display: inline-block;
  font-size: 0.875rem;
  color: #7c3aed;
  font-weight: 500;
  text-decoration: none;
  transition: color 0.2s;
}

.toast-link:hover {
  color: #6d28d9;
  text-decoration: underline;
}

.toast-close {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 1.125rem;
  cursor: pointer;
  transition: color 0.2s;
  padding: 0;
  line-height: 1;
}

.toast-close:hover {
  color: #6b7280;
}

/* Transition */
.toast-enter-active {
  animation: toast-slide-in 0.3s ease-out;
}

.toast-leave-active {
  animation: toast-slide-out 0.3s ease-in;
}

@keyframes toast-slide-in {
  from {
    opacity: 0;
    transform: translateX(100%) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0) translateY(0);
  }
}

@keyframes toast-slide-out {
  from {
    opacity: 1;
    transform: translateX(0) translateY(0);
  }
  to {
    opacity: 0;
    transform: translateX(100%) translateY(-20px);
  }
}

/* Responsive */
@media (max-width: 640px) {
  .toast-container {
    top: 4rem;
    right: 1rem;
    left: 1rem;
    width: auto;
  }
}
</style>
