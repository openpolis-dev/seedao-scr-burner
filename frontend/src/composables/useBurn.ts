import { ref } from 'vue'
import { parseUnits } from 'ethers'
import { useWagmiWallet } from './useWagmiWallet'
import { useContract } from './useContract'
import type { TransactionStatus, BurnResult } from '@/types/contracts'
import { config } from '../config'

// Shared state - singleton pattern
const txStatus = ref<TransactionStatus>({
  status: 'idle',
  message: '',
  txHash: undefined,
  error: undefined,
})

export function useBurn() {
  const { provider, address } = useWagmiWallet()
  const { getSCRContractWithSigner, getBurnerContractWithSigner, fetchBalances, fetchPoolInfo } = useContract()

  /**
   * Check if SCR allowance is sufficient
   */
  async function checkAllowance(amount: string): Promise<boolean> {
    if (!address.value || !provider.value) {
      throw new Error('Wallet not connected')
    }

    try {
      const scrContract = await getSCRContractWithSigner()
      if (!scrContract) throw new Error('Contract not available')

      const amountStr = String(amount)
      const amountBigInt = parseUnits(amountStr, config.tokenDecimals.scr)
      const allowance = await scrContract.allowance(
        address.value,
        config.contracts.burner
      )

      return BigInt(allowance) >= amountBigInt
    } catch (error) {
      console.error('Error checking allowance:', error)
      throw error
    }
  }

  /**
   * Approve SCR tokens for burning
   */
  async function approveSCR(amount: string): Promise<boolean> {
    if (!address.value || !provider.value) {
      throw new Error('Wallet not connected')
    }

    try {
      txStatus.value = {
        status: 'approving',
        message: 'Approving SCR tokens...',
      }

      const scrContract = await getSCRContractWithSigner()
      if (!scrContract) throw new Error('Contract not available')

      const amountStr = String(amount)
      const amountBigInt = parseUnits(amountStr, config.tokenDecimals.scr)
      const tx = await scrContract.approve(config.contracts.burner, amountBigInt)

      txStatus.value.message = 'Waiting for approval confirmation...'
      txStatus.value.txHash = tx.hash

      await tx.wait()

      console.log('[approveSCR] Approval confirmed')

      return true
    } catch (error: any) {
      console.error('Error approving SCR:', error)
      txStatus.value = {
        status: 'error',
        message: 'Approval failed',
        error: error.message || 'Unknown error',
      }
      throw error
    }
  }

  /**
   * Parse custom contract errors into user-friendly messages
   */
  function parseContractError(error: any): string {
    const errorData = error?.data?.toString() || error?.message || ''

    // Map custom errors to user-friendly messages
    const errorMap: Record<string, string> = {
      'AmountMustBeGreaterThanZero': 'Amount must be greater than zero',
      'USDTAmountTooSmall': 'SCR amount too small, resulting USDT would be zero',
      'InsufficientUSDTInPool': 'Insufficient USDT in pool. Please try a smaller amount or contact support.',
      'RateTooLow': 'Exchange rate is too low',
      'RateTooHigh': 'Exchange rate is too high',
      'InvalidAddress': 'Invalid token address',
      'DenominatorCannotBeZero': 'Invalid exchange rate configuration',
      'InsufficientBalance': 'Insufficient balance',
      'TransferFailed': 'Token transfer failed',
      'BurnEnded': 'The burn period has ended. Burning is no longer available.',
    }

    // Check if error contains any of our custom error names
    for (const [errorName, message] of Object.entries(errorMap)) {
      if (errorData.includes(errorName)) {
        return message
      }
    }

    // Check for common errors
    if (errorData.includes('insufficient funds') || errorData.includes('insufficient balance')) {
      return 'Insufficient balance for transaction'
    }
    if (errorData.includes('user rejected') || errorData.includes('User denied')) {
      return 'Transaction rejected by user'
    }
    if (errorData.includes('EnforcedPause')) {
      return 'Contract is currently paused. Burns are temporarily disabled.'
    }

    // Return original error message if no match
    return error?.reason || error?.message || 'Transaction failed'
  }

  /**
   * Burn SCR tokens
   */
  async function burnSCR(amount: string): Promise<BurnResult> {
    console.log('[burnSCR] Starting burn...', { amount, address: address.value })

    if (!address.value || !provider.value) {
      throw new Error('Wallet not connected')
    }

    try {
      // Check allowance first
      console.log('[burnSCR] Checking allowance...')
      const hasAllowance = await checkAllowance(amount)
      console.log('[burnSCR] Has allowance:', hasAllowance)

      if (!hasAllowance) {
        console.log('[burnSCR] Approving SCR...')
        await approveSCR(amount)
        console.log('[burnSCR] Approval complete')
      }

      // Now burn
      console.log('[burnSCR] Starting burn transaction...')
      txStatus.value = {
        status: 'burning',
        message: 'Burning SCR tokens...',
      }

      const burnerContract = await getBurnerContractWithSigner()
      if (!burnerContract) throw new Error('Burner contract not available')

      const amountStr = String(amount)
      const amountBigInt = parseUnits(amountStr, config.tokenDecimals.scr)

      console.log('[burnSCR] Calling burnSCRForUSDT with amount:', amountBigInt.toString())
      const tx = await burnerContract.burnSCRForUSDT(amountBigInt)

      console.log('[burnSCR] Transaction sent:', tx.hash)
      txStatus.value.message = 'Waiting for burn confirmation...'
      txStatus.value.txHash = tx.hash

      console.log('[burnSCR] Waiting for confirmation...')
      const receipt = await tx.wait()

      console.log('[burnSCR] Receipt:', receipt)

      if (receipt && receipt.status === 1) {
        console.log('[burnSCR] Burn successful!')
        txStatus.value = {
          status: 'success',
          message: 'Burn successful! USDT received.',
          txHash: tx.hash,
        }

        // Refresh balances and pool info
        await Promise.all([
          fetchBalances(),
          fetchPoolInfo()
        ])

        return {
          success: true,
          txHash: tx.hash,
        }
      } else {
        throw new Error('Transaction failed')
      }
    } catch (error: any) {
      console.error('[burnSCR] Error burning SCR:', error)
      console.error('[burnSCR] Error details:', {
        message: error.message,
        code: error.code,
        reason: error.reason,
        data: error.data,
      })

      const userFriendlyError = parseContractError(error)

      txStatus.value = {
        status: 'error',
        message: 'Burn failed',
        error: userFriendlyError,
      }

      return {
        success: false,
        error: userFriendlyError,
      }
    }
  }

  /**
   * Reset transaction status
   */
  function resetStatus(): void {
    txStatus.value = {
      status: 'idle',
      message: '',
      txHash: undefined,
      error: undefined,
    }
  }

  return {
    txStatus,
    checkAllowance,
    approveSCR,
    burnSCR,
    resetStatus,
  }
}
