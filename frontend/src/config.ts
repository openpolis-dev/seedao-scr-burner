/**
 * Frontend Configuration
 *
 * This file contains all configuration for the frontend app.
 * Update contract addresses after deployment.
 */

export const config = {
  // Contract Addresses (update after deployment)
  contracts: {
    scrToken: '0xEADbc3CA511e6bCbfd925015c7FE6cA5F78c8fce',  // Test SCR token on Polygon
    usdtToken: '0xC3B8cf5cCE37fCbD4bd037C69a3F3d49944Ad8C8', // Test USDT token on Polygon
    burner: '0xF5EC2f25Def2dDD30C9FE0f4cF485fe27C660336',    // SCRBurner (Proxy) on Polygon
  },

  // Supported Networks
  networks: {
    hardhatLocal: {
      id: 1337,
      name: 'Hardhat Local',
      rpcUrl: 'http://127.0.0.1:8545',
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18,
      },
    },
    polygon: {
      id: 137,
      name: 'Polygon Mainnet',
      rpcUrl: 'https://polygon-rpc.com',
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18,
      },
    },
  },

  // Token Decimals
  tokenDecimals: {
    scr: 18,
    usdt: 6,
  },

  // WalletConnect Project ID (optional)
  walletConnect: {
    projectId: 'da76ddd6c7d31632ed7fc9b88e28a410', // Add your WalletConnect project ID here if needed
  },

  // Default network
  defaultNetwork: 'polygon' as const,
} as const

export type Config = typeof config
