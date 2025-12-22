import hre from "hardhat";
import { MetamaskConnector } from "@web3camp/hardhat-metamask-connector";

/**
 * Deploy upgradeable SCRBurner contract
 *
 * This script deploys the SCRBurnerUpgradeable contract with UUPS proxy.
 * It requires existing SCR and USDT token addresses via environment variables.
 *
 * Usage:
 *
 * Localhost (test tokens):
 *   1. Deploy test tokens first:
 *      npx hardhat run scripts/deployTestTokens.ts --network localhost
 *   2. Deploy burner with test token addresses:
 *      SCR_TOKEN=0x... USDT_TOKEN=0x... npx hardhat run scripts/1_deploySCRBurner.ts --network localhost
 *
 * Polygon mainnet (existing tokens):
 *   SCR_TOKEN=0xE4825A1a31a76f72befa47f7160B132AA03813E0 \
 *   USDT_TOKEN=0xc2132D05D31c914a87C6611C10748AEb04B58e8F \
 *   npx hardhat run scripts/1_deploySCRBurner.ts --network polygon
 */
async function main() {
  const upgrades = (hre as any).upgrades;
  const connector = new MetamaskConnector();

  // Detect network
  const networkName = hre.network.name;
  const isLocalhost = networkName === "localhost" || networkName === "hardhat";

  console.log(`🚀 Deploying SCRBurnerUpgradeable to ${networkName}...\n`);

  // Get signer from MetaMask
  const deployer = await connector.getSigner();

  // IMPORTANT: Must call getAddress() to trigger browser and establish MetaMask connection
  const deployerAddress = await deployer.getAddress();
  console.log("📝 Deploying with account:", deployerAddress);
  console.log("💰 Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployerAddress)), isLocalhost ? "ETH" : "MATIC", "\n");

  // Get token addresses from environment - REQUIRED
  const scrAddress = process.env.SCR_TOKEN;
  const usdtAddress = process.env.USDT_TOKEN;

  if (!scrAddress || !usdtAddress) {
    console.error("❌ Error: Token addresses are required!\n");

    console.log("Usage:");
    console.log("  SCR_TOKEN=0x... USDT_TOKEN=0x... npx hardhat run scripts/1_deploySCRBurner.ts --network", networkName);

    if (isLocalhost) {
      console.log("\n📝 For localhost development:");
      console.log("  1. Deploy test tokens:");
      console.log("     npx hardhat run scripts/deployTestTokens.ts --network localhost");
      console.log("\n  2. Copy the addresses from the output");
      console.log("\n  3. Deploy burner with those addresses:");
      console.log("     SCR_TOKEN=0x... USDT_TOKEN=0x... npx hardhat run scripts/1_deploySCRBurner.ts --network localhost");
    } else if (networkName === "polygon") {
      console.log("\n🌐 For Polygon mainnet:");
      console.log("  SCR Token:  0xE4825A1a31a76f72befa47f7160B132AA03813E0");
      console.log("  USDT Token: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F");
      console.log("\n  Example:");
      console.log("  SCR_TOKEN=0xE4825A1a31a76f72befa47f7160B132AA03813E0 \\");
      console.log("  USDT_TOKEN=0xc2132D05D31c914a87C6611C10748AEb04B58e8F \\");
      console.log("  npx hardhat run scripts/1_deploySCRBurner.ts --network polygon");
    } else {
      console.log("\n💡 Tip: Make sure you're using the correct token addresses for", networkName);
    }

    process.exit(1);
  }

  console.log("📋 Using token addresses:");
  console.log("   SCR Token:  ", scrAddress);
  console.log("   USDT Token: ", usdtAddress);

  // Initial burn rate: 1 SCR = 0.0034 USDT (34/10000)
  const RATE_NUMERATOR = 34;
  const RATE_DENOMINATOR = 10000;

  console.log("\n📋 Burn rate configuration:");
  console.log("   1 SCR =", RATE_NUMERATOR, "/", RATE_DENOMINATOR, "USDT");
  console.log("   1 SCR =", (RATE_NUMERATOR / RATE_DENOMINATOR).toFixed(4), "USDT\n");

  // Deploy SCRBurnerUpgradeable with UUPS proxy
  console.log("📦 Deploying SCRBurnerUpgradeable (with UUPS proxy)...");
  const SCRBurnerFactory = await hre.ethers.getContractFactory("SCRBurnerUpgradeable", deployer);

  const burnerContract = await upgrades.deployProxy(
    SCRBurnerFactory,
    [
      scrAddress,        // _scrToken
      usdtAddress,       // _usdtToken
      RATE_NUMERATOR,    // _rateNumerator
      RATE_DENOMINATOR   // _rateDenominator
    ],
    {
      kind: 'uups',
      initializer: 'initialize'
    }
  );

  await burnerContract.waitForDeployment();
  const burnerAddress = await burnerContract.getAddress();

  // Get implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(burnerAddress);

  console.log("✅ SCRBurnerUpgradeable Proxy deployed to:", burnerAddress);
  console.log("✅ Implementation address:", implementationAddress);

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network:              ", networkName);
  console.log("SCR Token:            ", scrAddress);
  console.log("USDT Token:           ", usdtAddress);
  console.log("SCRBurner (Proxy):    ", burnerAddress);
  console.log("Implementation:       ", implementationAddress);
  console.log("=".repeat(60));

  console.log("\n📝 Update your frontend config with:");
  console.log("burner: '" + burnerAddress + "',");

  console.log("\n💡 The proxy address is what users interact with.");
  console.log("💡 Implementation can be upgraded without changing proxy address.");

  console.log("\n⚠️  IMPORTANT NEXT STEPS:");
  console.log("1. Fund the burner contract with USDT:");
  console.log("   - The contract needs USDT to exchange for burned SCR");
  console.log("   - Use: burnerContract.fundUSDTPool(amount)");
  console.log("\n2. Users must approve SCR tokens before burning:");
  console.log("   - Users call: scrToken.approve(burnerAddress, amount)");
  console.log("   - Then call: burnerContract.burnSCRForUSDT(amount)");

  console.log("\n✨ Deployment complete!\n");

  // Close the MetaMask connector server
  connector.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

