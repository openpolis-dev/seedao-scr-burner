import hre from "hardhat";
import { MetamaskConnector } from "@web3camp/hardhat-metamask-connector";

/**
 * Fund the SCRBurner contract with USDT
 *
 * This script allows the owner to deposit USDT into the burner contract's pool.
 * Users will receive USDT from this pool when they burn SCR tokens.
 *
 * Prerequisites:
 * - You must be the owner of the burner contract
 * - You must have USDT tokens in your wallet
 * - Set required environment variables
 *
 * Usage:
 * USDT_TOKEN=0x... PROXY_ADDRESS=0x... AMOUNT=1000 npx hardhat run scripts/fundUSDTPool.ts --network polygon
 *
 * Example:
 * USDT_TOKEN=0xC3B8cf5cCE37fCbD4bd037C69a3F3d49944Ad8C8 \
 * PROXY_ADDRESS=0xF5EC2f25Def2dDD30C9FE0f4cF485fe27C660336 \
 * AMOUNT=1000 \
 * npx hardhat run scripts/fundUSDTPool.ts --network polygon
 */
async function main() {
  const networkName = hre.network.name;
  const isLocalhost = networkName === "localhost" || networkName === "hardhat";
  const currencySymbol = isLocalhost ? "ETH" : "MATIC";

  console.log(`💰 Funding USDT pool on ${networkName}...\n`);

  const connector = new MetamaskConnector();
  const owner = await connector.getSigner();

  // IMPORTANT: Must call getAddress() to trigger browser and establish MetaMask connection
  const ownerAddress = await owner.getAddress();
  console.log("📝 Funding with account:", ownerAddress);
  console.log(`💰 Account balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(ownerAddress))} ${currencySymbol}\n`);

  // Get addresses from environment - REQUIRED
  const usdtAddress = process.env.USDT_TOKEN;
  const proxyAddress = process.env.PROXY_ADDRESS;
  const amountStr = process.env.AMOUNT;

  if (!usdtAddress || !proxyAddress || !amountStr) {
    console.error("❌ Error: Required parameters not provided!\n");
    console.log("Usage:");
    console.log("  USDT_TOKEN=0x... PROXY_ADDRESS=0x... AMOUNT=1000 \\");
    console.log("  npx hardhat run scripts/fundUSDTPool.ts --network", networkName);
    console.log("\n💡 AMOUNT is in USDT (e.g., 1000 means 1000 USDT)");
    connector.close();
    process.exit(1);
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    console.error("❌ Error: AMOUNT must be a positive number!");
    connector.close();
    process.exit(1);
  }

  console.log("📋 Configuration:");
  console.log("   USDT Token:      ", usdtAddress);
  console.log("   Burner Contract: ", proxyAddress);
  console.log("   Amount:          ", amount, "USDT");
  console.log("");

  // Get contract instances
  const usdt = await hre.ethers.getContractAt("IERC20", usdtAddress, owner);
  const burner = await hre.ethers.getContractAt("SCRBurnerUpgradeable", proxyAddress, owner);

  // Verify owner
  const contractOwner = await burner.owner();
  if (contractOwner.toLowerCase() !== ownerAddress.toLowerCase()) {
    console.error("❌ Error: You are not the owner of the burner contract!");
    console.log("   Your address:     ", ownerAddress);
    console.log("   Contract owner:   ", contractOwner);
    connector.close();
    process.exit(1);
  }
  console.log("✅ Owner verification passed\n");

  // Check USDT balance
  const usdtBalance = await usdt.balanceOf(ownerAddress);
  const usdtAmount = hre.ethers.parseUnits(amount.toString(), 6); // USDT has 6 decimals

  console.log("💵 Your USDT balance:", hre.ethers.formatUnits(usdtBalance, 6), "USDT");

  if (usdtBalance < usdtAmount) {
    console.error("❌ Error: Insufficient USDT balance!");
    console.log("   Required:", hre.ethers.formatUnits(usdtAmount, 6), "USDT");
    console.log("   Available:", hre.ethers.formatUnits(usdtBalance, 6), "USDT");
    connector.close();
    process.exit(1);
  }

  // Check current pool balance
  const currentPoolBalance = await burner.getUSDTPoolBalance();
  console.log("💰 Current pool balance:", hre.ethers.formatUnits(currentPoolBalance, 6), "USDT\n");

  // Step 1: Approve burner contract to spend USDT
  console.log("📝 Step 1/2: Approving burner contract to spend USDT...");
  const approveTx = await usdt.approve(proxyAddress, usdtAmount);
  console.log("   Transaction hash:", approveTx.hash);
  console.log("   Waiting for confirmation...");
  await approveTx.wait();
  console.log("✅ Approval confirmed\n");

  // Step 2: Fund the pool
  console.log("📝 Step 2/2: Funding USDT pool...");
  const fundTx = await burner.fundUSDTPool(usdtAmount);
  console.log("   Transaction hash:", fundTx.hash);
  console.log("   Waiting for confirmation...");
  const receipt = await fundTx.wait();
  console.log("✅ Funding confirmed\n");

  // Verify new pool balance
  const newPoolBalance = await burner.getUSDTPoolBalance();
  const yourNewBalance = await usdt.balanceOf(ownerAddress);

  console.log("=".repeat(60));
  console.log("✅ SUCCESSFULLY FUNDED USDT POOL");
  console.log("=".repeat(60));
  console.log("Amount deposited:     ", hre.ethers.formatUnits(usdtAmount, 6), "USDT");
  console.log("Old pool balance:     ", hre.ethers.formatUnits(currentPoolBalance, 6), "USDT");
  console.log("New pool balance:     ", hre.ethers.formatUnits(newPoolBalance, 6), "USDT");
  console.log("Your new USDT balance:", hre.ethers.formatUnits(yourNewBalance, 6), "USDT");
  console.log("=".repeat(60));

  // Calculate how much SCR can be burned with this pool
  const [numerator, denominator] = await burner.getCurrentRate();
  const rate = Number(numerator) / Number(denominator);
  const maxSCRBurnable = Number(hre.ethers.formatUnits(newPoolBalance, 6)) / rate;

  console.log("\n💡 Pool statistics:");
  console.log("   Exchange rate: 1 SCR = " + rate.toFixed(4) + " USDT");
  console.log("   Max SCR burnable: ~" + maxSCRBurnable.toFixed(2) + " SCR");

  console.log("\n✨ USDT pool funded successfully!\n");

  // Close the MetaMask connector server
  connector.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
