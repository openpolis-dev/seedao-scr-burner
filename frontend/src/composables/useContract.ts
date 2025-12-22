import { ref, computed } from 'vue'
import { formatUnits, parseUnits } from 'ethers'
import type { Contract } from 'ethers'
import { useWagmiWallet } from './useWagmiWallet'
import { getSCRContract, getUSDTContract, getBurnerContract } from '@/utils/contracts'
import type { TokenBalance, BurnRate } from '@/types/contracts'
import { config } from '../config'

// Shared state outside the composable (singleton pattern)
const balances = ref<TokenBalance>({
  scr: 0n,
  usdt: 0n,
})

const burnRate = ref<BurnRate>({
  numerator: 0n,
  denominator: 0n,
  displayRate: '0',
})

const usdtPoolBalance = ref<bigint>(0n)
const burnEndTime = ref<bigint>(0n)

const isLoading = ref(false)

export function useContract() {
  const { provider, address } = useWagmiWallet()

  /**
   * Get SCR contract with signer
   */
  async function getSCRContractWithSigner(): Promise<Contract | null> {
    if (!provider.value) return null
    const signer = await provider.value.getSigner()
    return getSCRContract(signer)
  }

  /**
   * Get USDT contract with signer
   */
  async function getUSDTContractWithSigner(): Promise<Contract | null> {
    if (!provider.value) return null
    const signer = await provider.value.getSigner()
    return getUSDTContract(signer)
  }

  /**
   * Get Burner contract with signer
   */
  async function getBurnerContractWithSigner(): Promise<Contract | null> {
    if (!provider.value) return null
    const signer = await provider.value.getSigner()
    return getBurnerContract(signer)
  }

  /**
   * Fetch user balances
   */
  async function fetchBalances(): Promise<void> {
    console.log('[fetchBalances] Starting...', {
      address: address.value,
      hasProvider: !!provider.value,
    })

    if (!address.value || !provider.value) {
      console.log('[fetchBalances] Missing address or provider, resetting balances')
      balances.value = { scr: 0n, usdt: 0n }
      return
    }

    try {
      isLoading.value = true
      console.log('[fetchBalances] Fetching balances for', address.value)

      // For read-only operations, use provider directly (no signer needed)
      const scrContract = getSCRContract(provider.value)
      const usdtContract = getUSDTContract(provider.value)

      console.log('[fetchBalances] Contracts created, calling balanceOf...')

      const [scrBalance, usdtBalance] = await Promise.all([
        scrContract.balanceOf(address.value),
        usdtContract.balanceOf(address.value),
      ])

      console.log('[fetchBalances] Balances fetched:', {
        scr: scrBalance.toString(),
        usdt: usdtBalance.toString(),
      })

      balances.value = {
        scr: scrBalance as bigint,
        usdt: usdtBalance as bigint,
      }
    } catch (error) {
      console.error('[fetchBalances] Error fetching balances:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch current burn rate
   */
  async function fetchBurnRate(): Promise<void> {
    console.log('[fetchBurnRate] Starting...', {
      hasProvider: !!provider.value,
    })

    if (!provider.value) {
      console.log('[fetchBurnRate] No provider, returning early')
      return
    }

    try {
      isLoading.value = true
      console.log('[fetchBurnRate] Fetching burn rate from contract...')

      // For read-only operations, use provider directly (no signer needed)
      const burnerContract = getBurnerContract(provider.value)
      const [numerator, denominator] = await burnerContract.getCurrentRate()

      console.log('[fetchBurnRate] Raw rate from contract:', {
        numerator: numerator.toString(),
        denominator: denominator.toString(),
      })

      const rate = Number(numerator) / Number(denominator)
      const displayRate = rate.toFixed(4)

      console.log('[fetchBurnRate] Calculated rate:', { rate, displayRate })

      burnRate.value = {
        numerator: numerator as bigint,
        denominator: denominator as bigint,
        displayRate,
      }

      console.log('[fetchBurnRate] Burn rate updated:', burnRate.value)
    } catch (error) {
      console.error('[fetchBurnRate] Error fetching burn rate:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch pool info (USDT balance and burn end time)
   */
  async function fetchPoolInfo(): Promise<void> {
    console.log('[fetchPoolInfo] Starting...', {
      hasProvider: !!provider.value,
    })

    if (!provider.value) {
      console.log('[fetchPoolInfo] No provider, returning early')
      return
    }

    try {
      isLoading.value = true
      console.log('[fetchPoolInfo] Fetching pool info from contract...')

      const burnerContract = getBurnerContract(provider.value)
      const [poolBalance, endTime] = await Promise.all([
        burnerContract.getUSDTPoolBalance(),
        burnerContract.burnEndTime(),
      ])

      console.log('[fetchPoolInfo] Pool info fetched:', {
        poolBalance: poolBalance.toString(),
        endTime: endTime.toString(),
      })

      usdtPoolBalance.value = poolBalance as bigint
      burnEndTime.value = endTime as bigint

      console.log('[fetchPoolInfo] Pool info updated')
    } catch (error) {
      console.error('[fetchPoolInfo] Error fetching pool info:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Calculate USDT amount for given SCR amount
   */
  function calculateUSDTAmount(scrAmount: string): string {
    if (!scrAmount || !burnRate.value.numerator || !burnRate.value.denominator) {
      return '0'
    }

    try {
      // Ensure scrAmount is a string
      const amountStr = String(scrAmount)
      const scrBigInt = parseUnits(amountStr, config.tokenDecimals.scr)
      const usdtBigInt =
        (scrBigInt * burnRate.value.numerator) / burnRate.value.denominator

      // Adjust for decimal difference (SCR: 18, USDT: 6)
      const adjustedUSDT = usdtBigInt / BigInt(10 ** (config.tokenDecimals.scr - config.tokenDecimals.usdt))

      return formatUnits(adjustedUSDT, config.tokenDecimals.usdt)
    } catch (error) {
      console.error('Error calculating USDT amount:', error)
      return '0'
    }
  }

  /**
   * Formatted balances for display
   */
  const formattedBalances = computed(() => ({
    scr: formatUnits(balances.value.scr, config.tokenDecimals.scr),
    usdt: formatUnits(balances.value.usdt, config.tokenDecimals.usdt),
  }))

  /**
   * Formatted pool balance
   */
  const formattedPoolBalance = computed(() =>
    formatUnits(usdtPoolBalance.value, config.tokenDecimals.usdt)
  )

  /**
   * Check if burn has ended
   */
  const hasBurnEnded = computed(() => {
    if (burnEndTime.value === 0n) return false
    const now = Math.floor(Date.now() / 1000)
    return BigInt(now) >= burnEndTime.value
  })

  /**
   * Get time remaining until burn ends
   */
  const timeRemaining = computed(() => {
    if (burnEndTime.value === 0n) return null
    const now = Math.floor(Date.now() / 1000)
    const remaining = Number(burnEndTime.value) - now
    if (remaining <= 0) return null

    const days = Math.floor(remaining / 86400)
    const hours = Math.floor((remaining % 86400) / 3600)
    const minutes = Math.floor((remaining % 3600) / 60)
    const seconds = remaining % 60

    return { days, hours, minutes, seconds, total: remaining }
  })

  return {
    // State
    balances,
    formattedBalances,
    burnRate,
    usdtPoolBalance,
    formattedPoolBalance,
    burnEndTime,
    hasBurnEnded,
    timeRemaining,
    isLoading,

    // Contract getters
    getSCRContractWithSigner,
    getUSDTContractWithSigner,
    getBurnerContractWithSigner,

    // Methods
    fetchBalances,
    fetchBurnRate,
    fetchPoolInfo,
    calculateUSDTAmount,
  }
}
