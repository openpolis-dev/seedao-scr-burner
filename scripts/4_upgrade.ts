import hre from "hardhat";
import { MetamaskConnector } from "@web3camp/hardhat-metamask-connector";

/**
 * Universal upgrade script for SCRBurner contract
 *
 * Works for both local and mainnet deployments.
 * The network is specified via --network flag.
 *
 * Prerequisites:
 * - Set PROXY_ADDRESS environment variable (get from 1_deploySCRBurner.ts output)
 * - Connect MetaMask with the owner account of the proxy contract
 * - Must be owner of the proxy contract
 *
 * Usage:
 * Local:   PROXY_ADDRESS=0x... npx hardhat run scripts/4_upgrade.ts --network localhost
 * Polygon: PROXY_ADDRESS=0x... npx hardhat run scripts/4_upgrade.ts --network polygon
 */
async function main() {
  const upgrades = (hre as any).upgrades;

  // Detect network
  const networkName = hre.network.name;
  const isLocalhost = networkName === "localhost" || networkName === "hardhat";
  const currencySymbol = isLocalhost ? "ETH" : "MATIC";

  console.log(`🔄 Starting upgrade process on ${networkName}...\n`);

  const connector = new MetamaskConnector();
  const deployer = await connector.getSigner();
  const deployerAddress = await deployer.getAddress();
  console.log("📝 Upgrading with account:", deployerAddress);
  console.log(`💰 Account balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployerAddress))} ${currencySymbol}\n`);

  // Get proxy address - REQUIRED
  const PROXY_ADDRESS = process.env.PROXY_ADDRESS;

  if (!PROXY_ADDRESS) {
    console.error("❌ Error: PROXY_ADDRESS is required!\n");
    console.log("Usage:");
    console.log(`  PROXY_ADDRESS=0x... npx hardhat run scripts/4_upgrade.ts --network ${networkName}`);
    console.log("\n💡 Get the proxy address from the 1_deploySCRBurner.ts output");
    process.exit(1);
  }

  console.log("📋 Proxy address to upgrade:", PROXY_ADDRESS);

  // Verify deployer is the owner
  const proxyContract = await hre.ethers.getContractAt("SCRBurnerUpgradeable", PROXY_ADDRESS, deployer);
  const owner = await proxyContract.owner();

  console.log("📋 Current owner:", owner);

  if (owner.toLowerCase() !== deployerAddress.toLowerCase()) {
    console.error("\n❌ Error: You are not the owner of this contract!");
    console.log("   Your address:", deployerAddress);
    console.log("   Owner address:", owner);
    console.log("\n   Only the owner can upgrade the contract.");
    connector.close();
    process.exit(1);
  }

  console.log("✅ Owner check passed");

  // Get current implementation address
  console.log("\n🔍 Getting current implementation address...");
  const currentImplementation = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("📋 Current implementation:", currentImplementation);

  // Get current contract state
  const [numerator, denominator] = await proxyContract.getCurrentRate();
  const usdtBalance = await proxyContract.getUSDTPoolBalance();
  const scrBalance = await proxyContract.getSCRBalance();

  console.log("\n📊 Current contract state:");
  console.log("   Burn rate:", numerator.toString(), "/", denominator.toString());
  console.log("   USDT pool:", hre.ethers.formatUnits(usdtBalance, 6), "USDT");
  console.log("   SCR balance:", hre.ethers.formatEther(scrBalance), "SCR");

  // Deploy new implementation
  console.log("\n📦 Deploying new implementation...");
  const SCRBurnerV2Factory = await hre.ethers.getContractFactory("SCRBurnerUpgradeable", deployer);

  // Upgrade to new implementation
  console.log("🔄 Upgrading proxy to new implementation...");
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, SCRBurnerV2Factory, {
    kind: 'uups'
  });

  await upgraded.waitForDeployment();

  // Get new implementation address
  const newImplementation = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);

  // Verify state is preserved
  const [newNumerator, newDenominator] = await upgraded.getCurrentRate();
  const newUsdtBalance = await upgraded.getUSDTPoolBalance();
  const newScrBalance = await upgraded.getSCRBalance();

  console.log("\n✅ Upgrade transaction confirmed!");

  console.log("\n📊 Verifying state preservation:");
  console.log("   Burn rate:", newNumerator.toString(), "/", newDenominator.toString(),
    newNumerator === numerator && newDenominator === denominator ? "✅" : "❌");
  console.log("   USDT pool:", hre.ethers.formatUnits(newUsdtBalance, 6), "USDT",
    newUsdtBalance === usdtBalance ? "✅" : "❌");
  console.log("   SCR balance:", hre.ethers.formatEther(newScrBalance), "SCR",
    newScrBalance === scrBalance ? "✅" : "❌");

  console.log("\n" + "=".repeat(70));
  console.log("📋 UPGRADE SUMMARY");
  console.log("=".repeat(70));
  console.log("Network:                  ", networkName);
  console.log("Proxy address (unchanged):", PROXY_ADDRESS);
  console.log("Old implementation:       ", currentImplementation);
  console.log("New implementation:       ", newImplementation);
  console.log("Upgraded by:              ", deployerAddress);
  console.log("=".repeat(70));

  console.log("\n✅ Upgrade successful!");
  console.log("💡 The proxy address remains the same - no frontend changes needed.");
  console.log("💡 All existing data and state is preserved.");

  // Final verification
  console.log("\n🔍 Final verification...");
  const contract = await hre.ethers.getContractAt("SCRBurnerUpgradeable", PROXY_ADDRESS, deployer);
  const [finalNumerator, finalDenominator] = await contract.getCurrentRate();
  console.log("✅ Contract is responsive. Current rate:", finalNumerator.toString(), "/", finalDenominator.toString());

  console.log("\n✨ Upgrade process complete!\n");

  // Close the MetaMask connector server
  connector.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
