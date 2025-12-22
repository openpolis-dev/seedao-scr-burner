import hre from "hardhat";
import { MetamaskConnector } from "@web3camp/hardhat-metamask-connector";

/**
 * Withdraw all USDT from the burner contract (Emergency)
 *
 * This script withdraws all USDT from the burner contract to the owner's address.
 * Use this in emergency situations to recover funds.
 *
 * Prerequisites:
 * - You must be the owner of the burner contract
 * - Set BURNER_CONTRACT environment variable
 *
 * Usage:
 * BURNER_CONTRACT=0x... npx hardhat run scripts/withdrawUSDT.ts --network polygon
 *
 * Example:
 * BURNER_CONTRACT=0xF5EC2f25Def2dDD30C9FE0f4cF485fe27C660336 \
 * npx hardhat run scripts/withdrawUSDT.ts --network polygon
 */
async function main() {
  const networkName = hre.network.name;
  const isLocalhost = networkName === "localhost" || networkName === "hardhat";
  const currencySymbol = isLocalhost ? "ETH" : "MATIC";

  console.log(`🚨 Withdrawing USDT from burner contract on ${networkName}...\n`);

  const connector = new MetamaskConnector();
  const owner = await connector.getSigner();

  // IMPORTANT: Must call getAddress() to trigger browser and establish MetaMask connection
  const ownerAddress = await owner.getAddress();
  console.log("📝 Withdrawing with account:", ownerAddress);
  console.log(`💰 Account balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(ownerAddress))} ${currencySymbol}\n`);

  // Get burner contract address - REQUIRED
  const burnerAddress = process.env.BURNER_CONTRACT;

  if (!burnerAddress) {
    console.error("❌ Error: BURNER_CONTRACT address not provided!\n");
    console.log("Usage:");
    console.log("  BURNER_CONTRACT=0x... npx hardhat run scripts/withdrawUSDT.ts --network", networkName);
    connector.close();
    process.exit(1);
  }

  console.log("📋 Configuration:");
  console.log("   Burner Contract:", burnerAddress);
  console.log("");

  // Get contract instance
  const burner = await hre.ethers.getContractAt("SCRBurnerUpgradeable", burnerAddress, owner);

  // Verify owner
  console.log("🔍 Verifying ownership...");
  const contractOwner = await burner.owner();
  console.log("   Contract owner:", contractOwner);
  console.log("   Your address:  ", ownerAddress);

  if (contractOwner.toLowerCase() !== ownerAddress.toLowerCase()) {
    console.error("\n❌ Error: You are not the owner of this contract!");
    console.log("   Only the owner can withdraw USDT.");
    connector.close();
    process.exit(1);
  }
  console.log("✅ Owner verification passed\n");

  // Get current USDT pool balance
  const poolBalance = await burner.getUSDTPoolBalance();
  console.log("💵 Current USDT pool balance:", hre.ethers.formatUnits(poolBalance, 6), "USDT");

  if (poolBalance === 0n) {
    console.log("\n⚠️  Pool is already empty. Nothing to withdraw.");
    connector.close();
    return;
  }

  // Get owner's current USDT balance
  const usdtAddress = await burner.usdtToken();
  const usdt = await hre.ethers.getContractAt("IERC20", usdtAddress, owner);
  const ownerBalanceBefore = await usdt.balanceOf(ownerAddress);
  console.log("💰 Your current USDT balance:", hre.ethers.formatUnits(ownerBalanceBefore, 6), "USDT\n");

  // Confirm withdrawal
  console.log("⚠️  WARNING: This will withdraw ALL USDT from the contract!");
  console.log("📤 About to withdraw:", hre.ethers.formatUnits(poolBalance, 6), "USDT");
  console.log("");

  // Withdraw all USDT
  console.log("🔄 Withdrawing all USDT...");
  try {
    const tx = await burner.withdrawUSDT();
    console.log("   Transaction hash:", tx.hash);
    console.log("   Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed!");
    console.log("   Block number:", receipt.blockNumber);
    console.log("   Gas used:", receipt.gasUsed.toString());
  } catch (error: any) {
    console.error("\n❌ Error withdrawing USDT:", error.message);
    if (error.data) {
      console.log("Error data:", error.data);
    }
    connector.close();
    process.exit(1);
  }

  // Verify withdrawal
  console.log("\n🔍 Verifying withdrawal...");
  const poolBalanceAfter = await burner.getUSDTPoolBalance();
  const ownerBalanceAfter = await usdt.balanceOf(ownerAddress);

  console.log("\n" + "=".repeat(60));
  console.log("✅ WITHDRAWAL SUCCESSFUL");
  console.log("=".repeat(60));
  console.log("Amount withdrawn:       ", hre.ethers.formatUnits(poolBalance, 6), "USDT");
  console.log("Pool balance (before):  ", hre.ethers.formatUnits(poolBalance, 6), "USDT");
  console.log("Pool balance (after):   ", hre.ethers.formatUnits(poolBalanceAfter, 6), "USDT");
  console.log("Your USDT (before):     ", hre.ethers.formatUnits(ownerBalanceBefore, 6), "USDT");
  console.log("Your USDT (after):      ", hre.ethers.formatUnits(ownerBalanceAfter, 6), "USDT");
  console.log("Received:               ", hre.ethers.formatUnits(ownerBalanceAfter - ownerBalanceBefore, 6), "USDT");
  console.log("=".repeat(60));

  if (poolBalanceAfter === 0n) {
    console.log("\n✅ Pool successfully drained!");
  } else {
    console.log("\n⚠️  Warning: Pool still has USDT remaining");
  }

  console.log("\n✨ Withdrawal complete!\n");

  // Close the MetaMask connector server
  connector.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
