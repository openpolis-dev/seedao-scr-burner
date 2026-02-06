/**
 * Wagmi Configuration
 *
 * Configures wallet connection, chains, and Web3Modal for the app
 */

import { http, createConfig, createStorage } from '@wagmi/vue'
import { polygon } from '@wagmi/vue/chains'
import { injected, walletConnect } from '@wagmi/vue/connectors'
import { createWeb3Modal } from '@web3modal/wagmi'
import { config } from './config'
import { joyid } from './connectors/joyid'

// Define custom Hardhat Local chain
export const hardhatLocal = {
  id: config.networks.hardhatLocal.id,
  name: config.networks.hardhatLocal.name,
  network: 'hardhat',
  nativeCurrency: config.networks.hardhatLocal.nativeCurrency,
  rpcUrls: {
    default: {
      http: [config.networks.hardhatLocal.rpcUrl],
    },
    public: {
      http: [config.networks.hardhatLocal.rpcUrl],
    },
  },
  testnet: true,
} as const

// Get the default chain based on config
const defaultChain = config.defaultNetwork === 'polygon' ? polygon : hardhatLocal

// Create Wagmi config
const wagmiConfigRaw = createConfig({
  chains: [polygon, hardhatLocal],
  transports: {
    [polygon.id]: http(config.networks.polygon.rpcUrl),
    [hardhatLocal.id]: http(config.networks.hardhatLocal.rpcUrl),
  },
  connectors: [
    injected({ target: 'metaMask' }),
    // @ts-ignore - JoyID connector type compatibility
    joyid({
      name: 'JoyID',
      joyidAppURL: 'https://app.joy.id',
    }),
    ...(config.walletConnect.projectId
      ? [
          walletConnect({
            projectId: config.walletConnect.projectId,
            metadata: {
              name: 'SCR Conversion',
              description: 'Exchange and burn your SCR tokens for USDT at a fixed rate on Polygon',
              url: typeof window !== 'undefined' ? window.location.origin : 'https://claim.seedao.xyz',
              icons: [typeof window !== 'undefined' ? `${window.location.origin}/favicon.ico` : 'https://claim.seedao.xyz/favicon.ico'],
            },
            showQrModal: false,
          }),
        ]
      : []),
  ],
  storage: createStorage({
    storage: window.localStorage,
    key: 'scr-burner.wagmi',
  }),
  ssr: false,
})

export const wagmiConfig = wagmiConfigRaw
export { defaultChain }

// Create Web3Modal instance
let modalInstance: ReturnType<typeof createWeb3Modal> | null = null

export const getModal = () => {
  if (!config.walletConnect.projectId) {
    console.warn('WalletConnect Project ID not configured')
    return null
  }

  if (!modalInstance) {
    try {
      modalInstance = createWeb3Modal({
        // @ts-ignore - Wagmi connector types have minor version incompatibilities between packages
        wagmiConfig,
        projectId: config.walletConnect.projectId,
        enableAnalytics: false,
        themeMode: 'light',
        themeVariables: {
          '--w3m-accent': '#7c3aed',
          '--w3m-border-radius-master': '8px',
        },
        defaultChain: defaultChain,
        featuredWalletIds: [
          'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
          '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
        ],
      })
      console.log('Web3Modal initialized successfully')
    } catch (error) {
      console.error('Failed to initialize Web3Modal:', error)
      return null
    }
  }

  return modalInstance
}
