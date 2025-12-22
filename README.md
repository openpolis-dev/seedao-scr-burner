# SCR Burner

Burn SCR and receive USDT.

## Current Polygon Deployment
SCR Token:             0xE4825A1a31a76f72befa47f7160B132AA03813E0
USDT Token:            0xc2132D05D31c914a87C6611C10748AEb04B58e8F
SCRBurner (Proxy):     0x30a903c7Dc9567a78ed7c8DF4eb2Eb93d910F841
Implementation:        0x3c12d7a931beF35a9080Fdf878550aA0ed79b07d

## Quick Start (Local Development)

```bash
# Install dependencies
npm install --legacy-peer-deps

# Compile contracts and export ABIs
npm run compile
npm run export-abis

# Terminal 1: Start local node
npm run node

# Terminal 2: Deploy test tokens and burner contract
npx hardhat run scripts/deployTestTokens.ts --network localhost
npx hardhat run scripts/1_deploySCRBurner.ts --network localhost

# Terminal 2: Send test assets to your wallet
npx hardhat run scripts/sendTestTokens.ts --network localhost

# Terminal 3: Start frontend
cd frontend && npm run dev
```

## Tech Stack

**Frontend:** Vue 3, TypeScript, Vite, Wagmi, Tailwind CSS
**Contracts:** Solidity 0.8.22, Hardhat, OpenZeppelin Upgradeable, TypeChain

## Contracts

**SCRBurnerUpgradeable** - Upgradeable contract (UUPS proxy) for burning SCR tokens
- Default rate: 1 SCR = 0.0034 USDT
- Owner can update rate, fund pool, set burn end time, pause/unpause, and upgrade implementation
- Proxy pattern allows contract upgrades without changing address

**TestSCR** - ERC20 (18 decimals) with burnable tokens for local testing
**TestUSDT** - ERC20 (6 decimals) for local testing

## Deployment Scripts

### Local Development
```bash
# 1. Deploy test tokens (TestSCR and TestUSDT)
npx hardhat run scripts/deployTestTokens.ts --network localhost

# 2. Copy the token addresses from the output, then deploy burner contract
SCR_TOKEN=0x... USDT_TOKEN=0x... \
npx hardhat run scripts/1_deploySCRBurner.ts --network localhost

# 3. Send test assets (ETH, SCR, USDT) to your wallet
npx hardhat run scripts/sendTestTokens.ts --network localhost

# 4. Set burn end time (optional)
PROXY_ADDRESS=0x... npx hardhat run scripts/3_setBurnEndTime.ts --network localhost

# 5. Set conversion rate (optional)
PROXY_ADDRESS=0x... RATE_NUMERATOR=34 \
npx hardhat run scripts/4_setConversionRate.ts --network localhost

# 6. Check contract state
PROXY_ADDRESS=0x... npx hardhat run scripts/5_checkState.ts --network localhost

# 7. Upgrade burner contract (optional)
PROXY_ADDRESS=0x... npx hardhat run scripts/6_upgrade.ts --network localhost
```

### Polygon Mainnet
```bash
# 1. Deploy upgradeable burner contract (SCR and USDT already exist on Polygon)
SCR_TOKEN=0xE4825A1a31a76f72befa47f7160B132AA03813E0 \
USDT_TOKEN=0xc2132D05D31c914a87C6611C10748AEb04B58e8F \
npx hardhat run scripts/1_deploySCRBurner.ts --network polygon

# 2. Grant BURNER_ROLE to the deployed contract (REQUIRED for production SCR token)
#    This must be run by the SCR token admin
SCR_TOKEN=0xE4825A1a31a76f72befa47f7160B132AA03813E0 \
PROXY_ADDRESS=0x... \
npx hardhat run scripts/2_grantBurnerRole.ts --network polygon

# 3. Fund the burner contract with USDT
USDT_TOKEN=0xc2132D05D31c914a87C6611C10748AEb04B58e8F \
PROXY_ADDRESS=0x... \
AMOUNT=1000 \
npx hardhat run scripts/fundUSDTPool.ts --network polygon

# 4. Set burn end time (optional - 0 means no end time)
PROXY_ADDRESS=0x... npx hardhat run scripts/3_setBurnEndTime.ts --network polygon

# 5. Set conversion rate (optional)
PROXY_ADDRESS=0x... RATE_NUMERATOR=34 \
npx hardhat run scripts/4_setConversionRate.ts --network polygon

# 6. Check contract state
PROXY_ADDRESS=0x... npx hardhat run scripts/5_checkState.ts --network polygon

# 7. Upgrade burner contract (when needed)
PROXY_ADDRESS=0x... npx hardhat run scripts/6_upgrade.ts --network polygon

# 8. Withdraw USDT from pool (emergency only)
PROXY_ADDRESS=0x... npx hardhat run scripts/withdrawUSDT.ts --network polygon
```

**Important Notes:**
- The production SCR token requires BURNER_ROLE for `burnFrom()` - this is granted in step 2
- Users must approve the burner contract before burning (handled automatically by the frontend)
- For localhost testing, TestSCR allows burning without BURNER_ROLE for convenience

## Key Commands

```bash
npm run node         # Start Hardhat network
npm run compile      # Compile contracts
npm run export-abis  # Export contract ABIs to frontend/src/abis/
npm test             # Run tests
npm run dev          # Start frontend (from frontend/)
npm run build        # Build frontend
```

**Important:** After modifying smart contracts, run both `npm run compile` and `npm run export-abis` to update the frontend ABIs.

## Configuration

Contract addresses are in `frontend/src/config.ts` (not environment variables).

Update after deployment:
```typescript
contracts: {
  scrToken: '0x...',    // SCR token address
  usdtToken: '0x...',   // USDT token address
  burner: '0x...',      // SCRBurner PROXY address (not implementation)
}
```

**Important:** Always use the **proxy address** for the burner contract, not the implementation address.

## Project Structure

```
├── contracts/              # Smart contracts
│   ├── SCRBurnerUpgradeable.sol  # Main burner contract (upgradeable)
│   ├── TestSCR.sol        # Test SCR token
│   └── TestUSDT.sol       # Test USDT token
├── scripts/               # Deployment & management scripts
│   ├── deployTestTokens.ts      # Deploy test tokens (local only)
│   ├── 1_deploySCRBurner.ts     # Deploy burner contract
│   ├── 2_grantBurnerRole.ts     # Grant BURNER_ROLE (mainnet)
│   ├── 3_setBurnEndTime.ts      # Set burn end time
│   ├── 4_setConversionRate.ts   # Set conversion rate
│   ├── 5_checkState.ts          # Check contract state
│   ├── 6_upgrade.ts             # Upgrade burner contract
│   ├── sendTestTokens.ts        # Send test assets (local only)
│   ├── fundUSDTPool.ts          # Fund USDT pool
│   ├── withdrawUSDT.ts          # Withdraw USDT (emergency)
│   └── exportABIs.ts            # Export ABIs to frontend
├── frontend/              # Vue 3 frontend
│   └── src/
│       ├── abis/          # Exported contract ABIs (committed to git)
│       ├── config.ts      # Contract addresses & network config
│       └── ...
```

## License

MIT

---

Built by [Taoist Labs](https://github.com/taoist-labs)
