import hre from "hardhat";
import { MetamaskConnector } from "@web3camp/hardhat-metamask-connector";

/**
 * Send test assets (ETH, SCR, USDT) to a wallet for testing
 *
 * ⚠️  This script is ONLY for localhost testing!
 *
 * This script sends test assets from the deployer to a recipient address.
 * Useful for funding test wallets with tokens for testing the burn feature.
 *
 * Prerequisites:
 * - Local Hardhat node running (npm run node)
 * - Test tokens must be deployed (run deployTestTokens.ts first)
 * - Connect MetaMask with the deployer account (the one that deployed test tokens)
 *
 * Usage:
 * RECIPIENT=0x... SCR_TOKEN=0x... USDT_TOKEN=0x... \
 * npx hardhat run scripts/sendTestTokens.ts --network localhost
 *
 * Or use your own address from MetaMask:
 * RECIPIENT=<your-address> SCR_TOKEN=0x... USDT_TOKEN=0x... \
 * npx hardhat run scripts/sendTestTokens.ts --network localhost
 */
async function main() {
  const networkName = hre.network.name;
  const isLocalhost = networkName === "localhost" || networkName === "hardhat";

  // Warning for production networks
  if (networkName === "polygon") {
    console.log("⚠️  WARNING: You are running on Polygon mainnet!");
    console.log("⚠️  This script sends test tokens for testing purposes.");
    console.log("\n💡 On Polygon mainnet, users typically acquire real SCR and USDT from exchanges.");
    console.log("💡 Press Ctrl+C to cancel or wait 5 seconds to continue...\n");
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Get addresses from environment - REQUIRED
  const recipientAddress = process.env.RECIPIENT;
  const scrAddress = process.env.SCR_TOKEN;
  const usdtAddress = process.env.USDT_TOKEN;

  if (!recipientAddress || !scrAddress || !usdtAddress) {
    console.error("❌ Error: Required addresses not provided!\n");
    console.log("Usage:");
    console.log("  RECIPIENT=0x... SCR_TOKEN=0x... USDT_TOKEN=0x... \\");
    console.log("  npx hardhat run scripts/sendTestTokens.ts --network localhost");
    console.log("\n💡 Get SCR_TOKEN and USDT_TOKEN from deployTestTokens.ts output");
    console.log("💡 Get RECIPIENT from your MetaMask wallet address");
    process.exit(1);
  }

  console.log("🎁 Sending test assets...\n");
  console.log("📋 Configuration:");
  console.log("   Recipient:", recipientAddress);
  console.log("   SCR Token:", scrAddress);
  console.log("   USDT Token:", usdtAddress);
  console.log("");

  const connector = new MetamaskConnector();
  const sender = await connector.getSigner();
  const senderAddress = await sender.getAddress();
  console.log("📝 Sending from:", senderAddress);

  // Send 100 ETH
  console.log("\n📤 Sending 100 ETH...");
  const ethAmount = hre.ethers.parseEther("100");
  const ethTx = await sender.sendTransaction({
    to: recipientAddress,
    value: ethAmount
  });
  await ethTx.wait();
  console.log("✅ 100 ETH sent!");

  // Get contract instances
  const scr = await hre.ethers.getContractAt("TestSCR", scrAddress, sender);
  const usdt = await hre.ethers.getContractAt("TestUSDT", usdtAddress, sender);

  // Send 10,000 SCR
  console.log("\n📤 Sending 10,000 SCR...");
  const scrAmount = hre.ethers.parseEther("10000");
  const scrTx = await scr.transfer(recipientAddress, scrAmount);
  await scrTx.wait();
  console.log("✅ 10,000 SCR sent!");

  // Send 500 USDT (so you can see balance increase after burning)
  console.log("\n📤 Sending 500 USDT...");
  const usdtAmount = hre.ethers.parseUnits("500", 6);
  const usdtTx = await usdt.transfer(recipientAddress, usdtAmount);
  await usdtTx.wait();
  console.log("✅ 500 USDT sent!");

  // Check all balances
  const ethBalance = await hre.ethers.provider.getBalance(recipientAddress);
  const scrBalance = await scr.balanceOf(recipientAddress);
  const usdtBalance = await usdt.balanceOf(recipientAddress);

  console.log("\n💰 Your balances:");
  console.log("  ETH:  ", hre.ethers.formatEther(ethBalance));
  console.log("  SCR:  ", hre.ethers.formatEther(scrBalance));
  console.log("  USDT: ", hre.ethers.formatUnits(usdtBalance, 6));

  console.log("\n✨ All done! You're ready to test the burn feature!");
  console.log("\n🔥 Try burning some SCR at http://localhost:3000");
  console.log("   Example: Burn 100 SCR → Receive 3 USDT");

  // Close the MetaMask connector server
  connector.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

