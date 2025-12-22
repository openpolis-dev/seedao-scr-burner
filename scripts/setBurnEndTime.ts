import hre from "hardhat";
import { MetamaskConnector } from "@web3camp/hardhat-metamask-connector";

async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;

  if (!proxyAddress) {
    throw new Error("PROXY_ADDRESS environment variable is required");
  }

  console.log("🔥 Setting Burn End Time");
  console.log("==========================");
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

  // Get current burn end time
  const currentEndTime = await burner.burnEndTime();
  console.log("Current Burn End Time:", currentEndTime.toString());
  if (currentEndTime > 0n) {
    const currentDate = new Date(Number(currentEndTime) * 1000);
    console.log("Current End Time (readable):", currentDate.toLocaleString());
  } else {
    console.log("Current End Time (readable): No end time set (burns enabled indefinitely)");
  }
  console.log("");

  // Set end time to 1 year later.
  const endTime = 1798070400; // Thu Dec 24 2026 08:00:00 GMT+0800 (China Standard Time)
  const endDate = new Date(endTime * 1000);

  console.log("Setting New Burn End Time:");
  console.log("  Timestamp:", endTime);
  console.log("  Date:", endDate.toLocaleString());
  console.log("");

  console.log("⏳ Sending transaction...");
  const tx = await burner.setBurnEndTime(endTime);
  console.log("Transaction sent:", tx.hash);
  console.log("");

  console.log("⏳ Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed!");
  console.log("Block:", receipt?.blockNumber);
  console.log("");

  // Verify the new end time
  const newEndTime = await burner.burnEndTime();
  console.log("Verified New End Time:", newEndTime.toString());
  console.log("Date:", new Date(Number(newEndTime) * 1000).toLocaleString());
  console.log("");

  console.log("✨ Burn end time set successfully!");
  console.log("");
  console.log("📝 Note: To remove the end time restriction, run this script with endTime = 0");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
