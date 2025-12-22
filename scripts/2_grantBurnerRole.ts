import hre from "hardhat";
import { MetamaskConnector } from "@web3camp/hardhat-metamask-connector";

/**
 * Script to grant BURNER_ROLE to SCRBurner contract on Polygon mainnet
 *
 * IMPORTANT: The production SCR token (0xE4825A1a31a76f72befa47f7160B132AA03813E0)
 * requires BURNER_ROLE for calling burnFrom(). The burner contract needs this role
 * to burn SCR tokens on behalf of users.
 *
 * This script must be run by an account that has DEFAULT_ADMIN_ROLE on the SCR token.
 *
 * Prerequisites:
 * 1. SCRBurner contract must be deployed
 * 2. Connect MetaMask with an account that has DEFAULT_ADMIN_ROLE on SCR token
 * 3. Set SCR_TOKEN and PROXY_ADDRESS environment variables
 *
 * Usage:
 * SCR_TOKEN=0x... PROXY_ADDRESS=0x... npx hardhat run scripts/2_grantBurnerRole.ts --network polygon
 *
 * For Polygon mainnet:
 * SCR_TOKEN=0xE4825A1a31a76f72befa47f7160B132AA03813E0 \
 * PROXY_ADDRESS=0x... \
 * npx hardhat run scripts/2_grantBurnerRole.ts --network polygon
 *
 * Note: For localhost testing, TestSCR allows burning without BURNER_ROLE for convenience.
 */
async function main() {
  console.log("🔐 Starting BURNER_ROLE grant process...\n");

  const connector = new MetamaskConnector();
  const admin = await connector.getSigner();
  const adminAddress = await admin.getAddress();
  console.log("📝 Admin account:", adminAddress);
  console.log("💰 Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(adminAddress)), "MATIC\n");

  // Addresses
  const SCR_TOKEN_ADDRESS = process.env.SCR_TOKEN || "";
  const PROXY_ADDRESS = process.env.PROXY_ADDRESS || "";

  if (!SCR_TOKEN_ADDRESS || !PROXY_ADDRESS) {
    console.error("❌ Error: Required addresses not set!\n");
    console.log("Usage:");
    console.log("SCR_TOKEN=0x... PROXY_ADDRESS=0x... npx hardhat run scripts/2_grantBurnerRole.ts --network polygon");
    console.log("\n💡 For Polygon mainnet:");
    console.log("   SCR Token: 0xE4825A1a31a76f72befa47f7160B132AA03813E0");
    connector.close();
    process.exit(1);
  }

  console.log("📋 Contract addresses:");
  console.log("   SCR Token:      ", SCR_TOKEN_ADDRESS);
  console.log("   Burner Contract:", PROXY_ADDRESS);

  // Get SCR token contract (using ISCRToken interface for role management)
  const scrToken = await hre.ethers.getContractAt("ISCRToken", SCR_TOKEN_ADDRESS, admin);

  // Calculate BURNER_ROLE
  const BURNER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("BURNER_ROLE"));
  console.log("\n📋 BURNER_ROLE hash:", BURNER_ROLE);

  // Check if admin has DEFAULT_ADMIN_ROLE
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const hasAdminRole = await scrToken.hasRole(DEFAULT_ADMIN_ROLE, adminAddress);

  if (!hasAdminRole) {
    console.error("\n❌ Error: Your account does not have DEFAULT_ADMIN_ROLE on the SCR token!");
    console.log("   Your address:", adminAddress);
    console.log("   SCR token:   ", SCR_TOKEN_ADDRESS);
    console.log("\n   Please use an account with admin privileges.");
    connector.close();
    process.exit(1);
  }

  console.log("✅ Admin check passed");

  // Check if burner already has the role
  const hasRole = await scrToken.hasRole(BURNER_ROLE, PROXY_ADDRESS);

  if (hasRole) {
    console.log("\n⚠️  Burner contract already has BURNER_ROLE!");
    console.log("   No action needed.");
    connector.close();
    return;
  }

  // Grant BURNER_ROLE
  console.log("\n🔄 Granting BURNER_ROLE to burner contract...");

  try {
    const tx = await scrToken.grantRole(BURNER_ROLE, PROXY_ADDRESS);
    console.log("   Transaction hash:", tx.hash);
    console.log("   Waiting for confirmation...");

  const receipt = await tx.wait();

  if (receipt && receipt.status === 1) {
    console.log("✅ Transaction confirmed!");
    console.log("   Block number:", receipt.blockNumber);
    console.log("   Gas used:", receipt.gasUsed.toString());

    // Verify the role was granted
    const verified = await scrToken.hasRole(BURNER_ROLE, PROXY_ADDRESS);

    if (verified) {
      console.log("\n" + "=".repeat(60));
      console.log("✅ SUCCESS: BURNER_ROLE granted successfully!");
      console.log("=".repeat(60));
      console.log("SCR Token:       ", SCR_TOKEN_ADDRESS);
      console.log("Burner Contract: ", PROXY_ADDRESS);
      console.log("Transaction:     ", tx.hash);
      console.log("=".repeat(60));
    } else {
      console.error("\n❌ Error: Role verification failed!");
    }
  } else {
    console.error("\n❌ Error: Transaction failed!");
    connector.close();
    process.exit(1);
  }
  } catch (error: any) {
    console.error("\n❌ Error granting role:", error.message);

    // Try to get more details
    if (error.data) {
      console.log("Error data:", error.data);
    }

    // Check if it's an access control issue
    console.log("\n🔍 Debugging information:");
    console.log("   Admin address:", adminAddress);
    console.log("   Has DEFAULT_ADMIN_ROLE?", await scrToken.hasRole(DEFAULT_ADMIN_ROLE, adminAddress));

    connector.close();
    process.exit(1);
  }

  console.log("\n✨ Process complete!\n");

  // Close the MetaMask connector server
  connector.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
