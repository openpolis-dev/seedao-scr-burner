import hre from "hardhat";
import { MetamaskConnector } from "@web3camp/hardhat-metamask-connector";

/**
 * Deploy test tokens (TestSCR and TestUSDT) for local development
 *
 * ⚠️  This script is ONLY for localhost testing!
 * ⚠️  Do NOT run this on Polygon mainnet - use existing tokens instead.
 *
 * This script deploys test versions of SCR and USDT tokens for local testing.
 * On Polygon mainnet, SCR and USDT are already deployed:
 *   - SCR:  0xE4825A1a31a76f72befa47f7160B132AA03813E0
 *   - USDT: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F
 *
 * Prerequisites:
 * - Start local Hardhat node: npm run node (in another terminal)
 * - Connect MetaMask to localhost network (http://127.0.0.1:8545, Chain ID: 31337)
 *
 * Usage:
 * npx hardhat run scripts/deployTestTokens.ts --network localhost
 *
 * The script will output the deployed addresses. Use these addresses
 * as CLI arguments when deploying the SCRBurner contract.
 */
async function main() {
  const networkName = hre.network.name;
  const isLocalhost = networkName === "localhost" || networkName === "hardhat";

  console.log(`🚀 Deploying test tokens to ${networkName}...\n`);

  // Warning for production networks
  if (networkName === "polygon") {
    console.log("⚠️  WARNING: You are deploying to Polygon mainnet!");
    console.log("⚠️  Production SCR and USDT already exist:");
    console.log("   SCR Token:  0xE4825A1a31a76f72befa47f7160B132AA03813E0");
    console.log("   USDT Token: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F");
    console.log("\n💡 This script deploys TEST tokens for testing purposes.");
    console.log("💡 Press Ctrl+C to cancel or wait 5 seconds to continue...\n");
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Get signer from MetaMask
  const connector = new MetamaskConnector();
  const deployer = await connector.getSigner();

  // IMPORTANT: Must call getAddress() to trigger browser and establish MetaMask connection
  const deployerAddress = await deployer.getAddress();
  const currencySymbol = isLocalhost ? "ETH" : "MATIC";

  console.log("📝 Deploying with account:", deployerAddress);
  console.log("💰 Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployerAddress)), currencySymbol, "\n");

  // Deploy TestSCR
  console.log("📦 Deploying TestSCR...");
  const TestSCRFactory = await hre.ethers.getContractFactory("TestSCR");
  const scrToken = await TestSCRFactory.connect(deployer).deploy();
  await scrToken.waitForDeployment();
  const scrAddress = await scrToken.getAddress();
  console.log("✅ TestSCR deployed to:", scrAddress);

  // Deploy TestUSDT
  console.log("\n📦 Deploying TestUSDT...");
  const TestUSDTFactory = await hre.ethers.getContractFactory("TestUSDT");
  const usdtToken = await TestUSDTFactory.connect(deployer).deploy();
  await usdtToken.waitForDeployment();
  const usdtAddress = await usdtToken.getAddress();
  console.log("✅ TestUSDT deployed to:", usdtAddress);

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📋 TEST TOKENS DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("TestSCR:      ", scrAddress);
  console.log("TestUSDT:     ", usdtAddress);
  console.log("=".repeat(60));

  console.log("\n📝 Next steps:");
  console.log("1. Copy the addresses above");

  console.log("\n2. Deploy SCRBurner contract:");
  console.log(`   SCR_TOKEN=${scrAddress} \\`);
  console.log(`   USDT_TOKEN=${usdtAddress} \\`);
  console.log("   npx hardhat run scripts/1_deploySCRBurner.ts --network localhost");

  console.log("\n3. Send test assets to your wallet (replace <YOUR_ADDRESS>):");
  console.log(`   RECIPIENT=<YOUR_ADDRESS> \\`);
  console.log(`   SCR_TOKEN=${scrAddress} \\`);
  console.log(`   USDT_TOKEN=${usdtAddress} \\`);
  console.log("   npx hardhat run scripts/sendTestTokens.ts --network localhost");

  console.log("\n4. Fund the burner contract with USDT (use fundUSDTPool)");
  console.log("\n5. Start the frontend and test burning!");

  console.log("\n✨ Test tokens deployed!\n");

  // Close the MetaMask connector server
  connector.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
