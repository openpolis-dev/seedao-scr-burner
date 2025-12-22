import hre from "hardhat";
import { MetamaskConnector } from "@web3camp/hardhat-metamask-connector";

/**
 * Set the conversion rate for SCR to USDT
 *
 * The conversion rate is expressed as numerator/denominator.
 * The denominator is fixed at 10000 for finer granularity.
 * The numerator must be between 1 and 10000 (0.0001 to 1.0 USDT per SCR).
 *
 * Prerequisites:
 * - You must be the owner of the burner contract
 * - Set PROXY_ADDRESS environment variable
 * - Set RATE_NUMERATOR environment variable (1-10000)
 *
 * Usage:
 * PROXY_ADDRESS=0x... RATE_NUMERATOR=34 npx hardhat run scripts/setConversionRate.ts --network polygon
 *
 * Examples:
 * - RATE_NUMERATOR=34   -> 0.0034 USDT per SCR (34/10000)
 * - RATE_NUMERATOR=50   -> 0.0050 USDT per SCR (50/10000)
 * - RATE_NUMERATOR=100  -> 0.0100 USDT per SCR (100/10000)
 * - RATE_NUMERATOR=500  -> 0.0500 USDT per SCR (500/10000)
 * - RATE_NUMERATOR=1000 -> 0.1000 USDT per SCR (1000/10000)
 * - RATE_NUMERATOR=5000 -> 0.5000 USDT per SCR (5000/10000)
 */

async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  const rateNumeratorStr = process.env.RATE_NUMERATOR;

  if (!proxyAddress) {
    throw new Error("PROXY_ADDRESS environment variable is required");
  }

  if (!rateNumeratorStr) {
    throw new Error("RATE_NUMERATOR environment variable is required");
  }

  const rateNumerator = parseInt(rateNumeratorStr, 10);
  const rateDenominator = 10000; // Fixed at 10000

  if (isNaN(rateNumerator)) {
    throw new Error("RATE_NUMERATOR must be a valid number");
  }

  if (rateNumerator < 1 || rateNumerator > 10000) {
    throw new Error("RATE_NUMERATOR must be between 1 and 10000 (0.0001 to 1.0 USDT per SCR)");
  }

  console.log("🔄 Setting Conversion Rate");
  console.log("===========================");
  console.log("Network:", hre.network.name);
  console.log("Proxy Address:", proxyAddress);
  console.log("");

  // Connect with Metamask
  const connector = new MetamaskConnector();
  const signer = await connector.getSigner();
  const owner = await signer.getAddress();

  console.log("Owner Address:", owner);
  console.log("");

  // Get contract instance
  const Burner = await hre.ethers.getContractFactory("SCRBurnerUpgradeable");
  const burner = Burner.attach(proxyAddress).connect(signer);

  // Verify ownership
  const contractOwner = await burner.owner();
  if (contractOwner.toLowerCase() !== owner.toLowerCase()) {
    throw new Error(`Not the owner. Contract owner: ${contractOwner}, Your address: ${owner}`);
  }

  // Get current rate
  const [currentNumerator, currentDenominator] = await burner.getCurrentRate();
  const currentRate = Number(currentNumerator) / Number(currentDenominator);
  console.log("Current Conversion Rate:");
  console.log("  Numerator:", currentNumerator.toString());
  console.log("  Denominator:", currentDenominator.toString());
  console.log("  Rate:", currentRate.toFixed(4), "USDT per SCR");
  console.log("");

  // Calculate new rate
  const newRate = rateNumerator / rateDenominator;
  console.log("New Conversion Rate:");
  console.log("  Numerator:", rateNumerator);
  console.log("  Denominator:", rateDenominator);
  console.log("  Rate:", newRate.toFixed(4), "USDT per SCR");
  console.log("");

  // Calculate percentage change
  const percentageChange = ((newRate - currentRate) / currentRate * 100).toFixed(2);
  if (newRate > currentRate) {
    console.log("📈 Rate increase:", `+${percentageChange}%`);
  } else if (newRate < currentRate) {
    console.log("📉 Rate decrease:", `${percentageChange}%`);
  } else {
    console.log("⚠️  No change in rate");
  }
  console.log("");

  console.log("⏳ Sending transaction...");
  const tx = await burner.setBurnRate(rateNumerator, rateDenominator);
  console.log("Transaction sent:", tx.hash);
  console.log("");

  console.log("⏳ Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed!");
  console.log("Block:", receipt?.blockNumber);
  console.log("");

  // Verify the new rate
  const [newNumerator, newDenominator] = await burner.getCurrentRate();
  const verifiedRate = Number(newNumerator) / Number(newDenominator);
  console.log("Verified New Rate:");
  console.log("  Numerator:", newNumerator.toString());
  console.log("  Denominator:", newDenominator.toString());
  console.log("  Rate:", verifiedRate.toFixed(4), "USDT per SCR");
  console.log("");

  console.log("✨ Conversion rate updated successfully!");
  console.log("");
  console.log("📝 Examples for different rates:");
  console.log("  RATE_NUMERATOR=34   -> 0.0034 USDT per SCR");
  console.log("  RATE_NUMERATOR=50   -> 0.0050 USDT per SCR");
  console.log("  RATE_NUMERATOR=100  -> 0.0100 USDT per SCR");
  console.log("  RATE_NUMERATOR=500  -> 0.0500 USDT per SCR");
  console.log("  RATE_NUMERATOR=1000 -> 0.1000 USDT per SCR");
  console.log("  RATE_NUMERATOR=5000 -> 0.5000 USDT per SCR");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
