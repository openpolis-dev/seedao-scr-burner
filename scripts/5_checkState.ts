import hre from "hardhat";
import { MetamaskConnector } from "@web3camp/hardhat-metamask-connector";

/**
 * Check SCRBurner contract state
 *
 * This script reads and displays all the stored state of the SCRBurner contract.
 * Use this to verify state before and after upgrades.
 *
 * Usage:
 * Local:   PROXY_ADDRESS=0x... npx hardhat run scripts/5_checkState.ts --network localhost
 * Polygon: PROXY_ADDRESS=0x... npx hardhat run scripts/5_checkState.ts --network polygon
 */

async function main() {
  const networkName = hre.network.name;
  const isLocalhost = networkName === "localhost" || networkName === "hardhat";
  const currencySymbol = isLocalhost ? "ETH" : "MATIC";

  console.log(`🔍 Checking SCRBurner state on ${networkName}...\n`);

  const connector = new MetamaskConnector();
  const signer = await connector.getSigner();
  const signerAddress = await signer.getAddress();
  console.log("📝 Using account:", signerAddress);
  console.log(`💰 Account balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(signerAddress))} ${currencySymbol}\n`);

  // Get proxy address - REQUIRED
  const PROXY_ADDRESS = process.env.PROXY_ADDRESS;

  if (!PROXY_ADDRESS) {
    console.error("❌ Error: PROXY_ADDRESS is required!\n");
    console.log("Usage:");
    console.log(`  PROXY_ADDRESS=0x... npx hardhat run scripts/5_checkState.ts --network ${networkName}`);
    console.log("\n💡 Get the proxy address from the 1_deploySCRBurner.ts output");
    process.exit(1);
  }

  console.log("📋 Proxy address:", PROXY_ADDRESS);
  console.log("");

  // Get the contract
  const burnerContract = await hre.ethers.getContractAt("SCRBurnerUpgradeable", PROXY_ADDRESS, signer);

  // Read all state variables
  console.log("=" .repeat(70));
  console.log("📊 CONTRACT STATE");
  console.log("=".repeat(70));

  try {
    // 1. Token addresses
    const scrTokenAddress = await burnerContract.scrToken();
    const usdtTokenAddress = await burnerContract.usdtToken();
    console.log("\n🪙 Token Addresses:");
    console.log("   SCR Token:  ", scrTokenAddress);
    console.log("   USDT Token: ", usdtTokenAddress);

    // 2. Burn rate
    const [numerator, denominator] = await burnerContract.getCurrentRate();
    const rateDecimal = Number(numerator) / Number(denominator);
    console.log("\n💱 Burn Rate:");
    console.log("   Numerator:   ", numerator.toString());
    console.log("   Denominator: ", denominator.toString());
    console.log("   Rate:         1 SCR = " + rateDecimal.toFixed(4) + " USDT");

    // 3. Pool balances
    const usdtPoolBalance = await burnerContract.getUSDTPoolBalance();
    const scrBalance = await burnerContract.getSCRBalance();
    console.log("\n💰 Token Balances:");
    console.log("   USDT Pool:  ", hre.ethers.formatUnits(usdtPoolBalance, 6), "USDT");
    console.log("   SCR Balance:", hre.ethers.formatEther(scrBalance), "SCR");

    // 4. Owner
    const owner = await burnerContract.owner();
    console.log("\n👤 Contract Owner:");
    console.log("   Owner:      ", owner);
    console.log("   Is you?     ", owner.toLowerCase() === signerAddress.toLowerCase() ? "✅ Yes" : "❌ No");

    // 5. Paused state
    const isPaused = await burnerContract.paused();
    console.log("\n⏸️  Pause State:");
    console.log("   Paused?     ", isPaused ? "⚠️  Yes (contract is paused)" : "✅ No (contract is active)");

    // 6. Burn end time
    const burnEndTime = await burnerContract.burnEndTime();
    console.log("\n⏰ Burn End Time:");
    if (burnEndTime === 0n) {
      console.log("   End Time:   ", "Not set (burns enabled indefinitely)");
    } else {
      const endDate = new Date(Number(burnEndTime) * 1000);
      const now = Math.floor(Date.now() / 1000);
      const hasEnded = BigInt(now) >= burnEndTime;
      console.log("   End Time:   ", endDate.toLocaleString());
      console.log("   Timestamp:  ", burnEndTime.toString());
      console.log("   Status:     ", hasEnded ? "⚠️  Ended (burns disabled)" : "✅ Active");
      if (!hasEnded) {
        const remaining = Number(burnEndTime) - now;
        const days = Math.floor(remaining / 86400);
        const hours = Math.floor((remaining % 86400) / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        console.log("   Remaining:  ", `${days} days, ${hours} hours, ${minutes} minutes`);
      }
    }

    // 7. Get implementation address (via upgrades plugin)
    console.log("\n🔧 Upgrade Info:");
    const upgrades = (hre as any).upgrades;
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
    console.log("   Implementation:", implementationAddress);

    console.log("\n" + "=".repeat(70));

    // Calculate example burn amount
    console.log("\n💡 Example Burn Transaction:");
    const exampleSCR = hre.ethers.parseEther("100"); // 100 SCR
    const exampleUSDT = await burnerContract.calculateUSDTAmount(exampleSCR);
    console.log("   Burn 100 SCR → Receive", hre.ethers.formatUnits(exampleUSDT, 6), "USDT");

    // Check if pool has enough USDT
    if (usdtPoolBalance < exampleUSDT) {
      console.log("   ⚠️  Warning: USDT pool has insufficient balance for this burn!");
    } else {
      console.log("   ✅ Pool has sufficient USDT for this burn");
    }

    console.log("\n✨ State check complete!\n");

  } catch (error: any) {
    console.error("\n❌ Error reading contract state:", error.message);
    connector.close();
    process.exit(1);
  }

  // Close the MetaMask connector server
  connector.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
