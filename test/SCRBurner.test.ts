import { expect } from "chai";
import hre from "hardhat";
import { TestSCR, TestUSDT, SCRBurnerUpgradeable } from "../src/types/contracts";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

const { ethers } = hre;

describe("SCRBurnerUpgradeable", function () {
  let scrToken: TestSCR;
  let usdtToken: TestUSDT;
  let burnerContract: SCRBurnerUpgradeable;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const INITIAL_RATE_NUMERATOR = 34n; // 0.0034 USDT per SCR
  const INITIAL_RATE_DENOMINATOR = 10000n;

  beforeEach(async function () {
    // Get signers
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy test tokens
    const TestSCRFactory = await ethers.getContractFactory("TestSCR");
    scrToken = await TestSCRFactory.deploy();
    await scrToken.waitForDeployment();

    const TestUSDTFactory = await ethers.getContractFactory("TestUSDT");
    usdtToken = await TestUSDTFactory.deploy();
    await usdtToken.waitForDeployment();

    // Deploy upgradeable burner contract with UUPS proxy
    const upgrades = (hre as any).upgrades;
    const SCRBurnerFactory = await ethers.getContractFactory("SCRBurnerUpgradeable");
    burnerContract = await upgrades.deployProxy(
      SCRBurnerFactory,
      [
        await scrToken.getAddress(),
        await usdtToken.getAddress(),
        INITIAL_RATE_NUMERATOR,
        INITIAL_RATE_DENOMINATOR
      ],
      {
        kind: 'uups',
        initializer: 'initialize'
      }
    ) as unknown as SCRBurnerUpgradeable;
    await burnerContract.waitForDeployment();

    // Fund burner contract with USDT
    const fundAmount = ethers.parseUnits("10000", 6); // 10,000 USDT
    await usdtToken.approve(await burnerContract.getAddress(), fundAmount);
    await burnerContract.fundUSDTPool(fundAmount);

    // Give users some SCR tokens
    const scrAmount = ethers.parseEther("1000"); // 1000 SCR
    await scrToken.transfer(user1.address, scrAmount);
    await scrToken.transfer(user2.address, scrAmount);
  });

  describe("Deployment", function () {
    it("Should set the correct token addresses", async function () {
      expect(await burnerContract.scrToken()).to.equal(await scrToken.getAddress());
      expect(await burnerContract.usdtToken()).to.equal(await usdtToken.getAddress());
    });

    it("Should set the correct initial rate", async function () {
      const [numerator, denominator] = await burnerContract.getCurrentRate();
      expect(numerator).to.equal(INITIAL_RATE_NUMERATOR);
      expect(denominator).to.equal(INITIAL_RATE_DENOMINATOR);
    });

    it("Should set the correct owner", async function () {
      expect(await burnerContract.owner()).to.equal(owner.address);
    });

    it("Should prevent re-initialization", async function () {
      await expect(
        burnerContract.initialize(
          await scrToken.getAddress(),
          await usdtToken.getAddress(),
          INITIAL_RATE_NUMERATOR,
          INITIAL_RATE_DENOMINATOR
        )
      ).to.be.revertedWithCustomError(burnerContract, "InvalidInitialization");
    });

    it("Should revert with InvalidAddress if SCR token is zero address", async function () {
      const SCRBurnerFactory = await ethers.getContractFactory("SCRBurnerUpgradeable");
      const upgrades = (hre as any).upgrades;

      await expect(
        upgrades.deployProxy(
          SCRBurnerFactory,
          [
            ethers.ZeroAddress,
            await usdtToken.getAddress(),
            INITIAL_RATE_NUMERATOR,
            INITIAL_RATE_DENOMINATOR
          ],
          {
            kind: 'uups',
            initializer: 'initialize'
          }
        )
      ).to.be.revertedWithCustomError(SCRBurnerFactory, "InvalidAddress");
    });

    it("Should revert with InvalidAddress if USDT token is zero address", async function () {
      const SCRBurnerFactory = await ethers.getContractFactory("SCRBurnerUpgradeable");
      const upgrades = (hre as any).upgrades;

      await expect(
        upgrades.deployProxy(
          SCRBurnerFactory,
          [
            await scrToken.getAddress(),
            ethers.ZeroAddress,
            INITIAL_RATE_NUMERATOR,
            INITIAL_RATE_DENOMINATOR
          ],
          {
            kind: 'uups',
            initializer: 'initialize'
          }
        )
      ).to.be.revertedWithCustomError(SCRBurnerFactory, "InvalidAddress");
    });

    it("Should revert with RateTooLow if rate numerator is too low", async function () {
      const SCRBurnerFactory = await ethers.getContractFactory("SCRBurnerUpgradeable");
      const upgrades = (hre as any).upgrades;

      await expect(
        upgrades.deployProxy(
          SCRBurnerFactory,
          [
            await scrToken.getAddress(),
            await usdtToken.getAddress(),
            0, // Below MIN_RATE_NUMERATOR
            INITIAL_RATE_DENOMINATOR
          ],
          {
            kind: 'uups',
            initializer: 'initialize'
          }
        )
      ).to.be.revertedWithCustomError(SCRBurnerFactory, "RateTooLow");
    });

    it("Should revert with RateTooHigh if rate numerator is too high", async function () {
      const SCRBurnerFactory = await ethers.getContractFactory("SCRBurnerUpgradeable");
      const upgrades = (hre as any).upgrades;

      await expect(
        upgrades.deployProxy(
          SCRBurnerFactory,
          [
            await scrToken.getAddress(),
            await usdtToken.getAddress(),
            10001, // Above MAX_RATE_NUMERATOR (10000)
            INITIAL_RATE_DENOMINATOR
          ],
          {
            kind: 'uups',
            initializer: 'initialize'
          }
        )
      ).to.be.revertedWithCustomError(SCRBurnerFactory, "RateTooHigh");
    });
  });

  describe("Burn SCR for USDT", function () {
    it("Should burn SCR and receive USDT correctly", async function () {
      const scrAmount = ethers.parseEther("100"); // 100 SCR
      const expectedUSDT = ethers.parseUnits("0.34", 6); // 0.34 USDT (100 * 0.0034)

      // Approve SCR
      await scrToken.connect(user1).approve(await burnerContract.getAddress(), scrAmount);

      // Check balances before
      const user1SCRBefore = await scrToken.balanceOf(user1.address);
      const user1USDTBefore = await usdtToken.balanceOf(user1.address);

      // Burn SCR
      const tx = await burnerContract.connect(user1).burnSCRForUSDT(scrAmount);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(burnerContract, "SCRBurned")
        .withArgs(user1.address, scrAmount, expectedUSDT, block!.timestamp);

      // Check balances after
      const user1SCRAfter = await scrToken.balanceOf(user1.address);
      const user1USDTAfter = await usdtToken.balanceOf(user1.address);

      expect(user1SCRAfter).to.equal(user1SCRBefore - scrAmount);
      expect(user1USDTAfter).to.equal(user1USDTBefore + expectedUSDT);
    });

    it("Should handle different SCR amounts correctly", async function () {
      const testCases = [
        { scr: "10", expectedUsdt: "0.034" },   // 10 * 0.0034 = 0.034
        { scr: "50", expectedUsdt: "0.17" },    // 50 * 0.0034 = 0.17
        { scr: "200", expectedUsdt: "0.68" }    // 200 * 0.0034 = 0.68
      ];

      for (const testCase of testCases) {
        const scrAmount = ethers.parseEther(testCase.scr);
        const expectedUSDT = ethers.parseUnits(testCase.expectedUsdt, 6);

        await scrToken.connect(user1).approve(await burnerContract.getAddress(), scrAmount);

        const user1USDTBefore = await usdtToken.balanceOf(user1.address);
        await burnerContract.connect(user1).burnSCRForUSDT(scrAmount);
        const user1USDTAfter = await usdtToken.balanceOf(user1.address);

        expect(user1USDTAfter - user1USDTBefore).to.equal(expectedUSDT);
      }
    });

    it("Should revert if amount is zero", async function () {
      await expect(
        burnerContract.connect(user1).burnSCRForUSDT(0)
      ).to.be.revertedWithCustomError(burnerContract, "AmountMustBeGreaterThanZero");
    });

    it("Should revert if user hasn't approved SCR", async function () {
      const scrAmount = ethers.parseEther("100");
      await expect(
        burnerContract.connect(user1).burnSCRForUSDT(scrAmount)
      ).to.be.reverted;
    });

    it("Should revert if pool has insufficient USDT", async function () {
      // Drain the pool
      await burnerContract.withdrawUSDT();

      const scrAmount = ethers.parseEther("100");
      await scrToken.connect(user1).approve(await burnerContract.getAddress(), scrAmount);

      await expect(
        burnerContract.connect(user1).burnSCRForUSDT(scrAmount)
      ).to.be.revertedWithCustomError(burnerContract, "InsufficientUSDTInPool");
    });
  });

  describe("Rate Management", function () {
    it("Should allow owner to update rate", async function () {
      const newNumerator = 50n; // 0.005 USDT per SCR
      const newDenominator = 10000n;

      await expect(burnerContract.setBurnRate(newNumerator, newDenominator))
        .to.emit(burnerContract, "BurnRateUpdated")
        .withArgs(INITIAL_RATE_NUMERATOR, INITIAL_RATE_DENOMINATOR, newNumerator, newDenominator);

      const [numerator, denominator] = await burnerContract.getCurrentRate();
      expect(numerator).to.equal(newNumerator);
      expect(denominator).to.equal(newDenominator);
    });

    it("Should apply new rate to subsequent burns", async function () {
      // Update rate to 500/10000 = 0.05
      await burnerContract.setBurnRate(500, 10000);

      const scrAmount = ethers.parseEther("100");
      const expectedUSDT = ethers.parseUnits("5", 6); // 100 * 0.05 = 5 USDT

      await scrToken.connect(user1).approve(await burnerContract.getAddress(), scrAmount);

      const user1USDTBefore = await usdtToken.balanceOf(user1.address);
      await burnerContract.connect(user1).burnSCRForUSDT(scrAmount);
      const user1USDTAfter = await usdtToken.balanceOf(user1.address);

      expect(user1USDTAfter - user1USDTBefore).to.equal(expectedUSDT);
    });

    it("Should revert if non-owner tries to update rate", async function () {
      await expect(
        burnerContract.connect(user1).setBurnRate(50, 10000)
      ).to.be.revertedWithCustomError(burnerContract, "OwnableUnauthorizedAccount");
    });

    it("Should revert if denominator is zero", async function () {
      await expect(
        burnerContract.setBurnRate(5, 0)
      ).to.be.revertedWithCustomError(burnerContract, "DenominatorCannotBeZero");
    });

    it("Should revert if rate numerator is too low", async function () {
      await expect(
        burnerContract.setBurnRate(0, 100)
      ).to.be.revertedWithCustomError(burnerContract, "RateTooLow");
    });

    it("Should revert if rate numerator is too high", async function () {
      await expect(
        burnerContract.setBurnRate(10001, 10000)
      ).to.be.revertedWithCustomError(burnerContract, "RateTooHigh");
    });

    it("Should revert if denominator does not match FIXED_RATE_DENOMINATOR", async function () {
      await expect(
        burnerContract.setBurnRate(50, 200) // Wrong denominator (should be 10000)
      ).to.be.revertedWithCustomError(burnerContract, "DenominatorCannotBeZero");
    });
  });

  describe("Pool Management", function () {
    it("Should allow owner to fund USDT pool", async function () {
      const fundAmount = ethers.parseUnits("1000", 6);
      await usdtToken.approve(await burnerContract.getAddress(), fundAmount);

      const poolBefore = await burnerContract.getUSDTPoolBalance();
      await expect(burnerContract.fundUSDTPool(fundAmount))
        .to.emit(burnerContract, "USDTPoolFunded")
        .withArgs(owner.address, fundAmount);

      const poolAfter = await burnerContract.getUSDTPoolBalance();
      expect(poolAfter - poolBefore).to.equal(fundAmount);
    });

    it("Should allow owner to withdraw all USDT", async function () {
      const poolBalance = await burnerContract.getUSDTPoolBalance();
      expect(poolBalance).to.be.gt(0); // Ensure there's USDT in the pool

      const ownerBalanceBefore = await usdtToken.balanceOf(owner.address);

      // Withdraw all USDT
      await expect(burnerContract.withdrawUSDT())
        .to.emit(burnerContract, "USDTWithdrawn")
        .withArgs(owner.address, poolBalance);

      const ownerBalanceAfter = await usdtToken.balanceOf(owner.address);
      const poolBalanceAfter = await burnerContract.getUSDTPoolBalance();

      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(poolBalance);
      expect(poolBalanceAfter).to.equal(0); // Pool should be empty
    });

    it("Should revert if non-owner tries to fund pool", async function () {
      const fundAmount = ethers.parseUnits("1000", 6);
      await usdtToken.connect(user1).approve(await burnerContract.getAddress(), fundAmount);

      await expect(
        burnerContract.connect(user1).fundUSDTPool(fundAmount)
      ).to.be.revertedWithCustomError(burnerContract, "OwnableUnauthorizedAccount");
    });

    it("Should revert if non-owner tries to withdraw", async function () {
      await expect(
        burnerContract.connect(user1).withdrawUSDT()
      ).to.be.revertedWithCustomError(burnerContract, "OwnableUnauthorizedAccount");
    });
  });

  describe("Pause/Unpause", function () {
    it("Should allow owner to pause", async function () {
      await burnerContract.pause();
      expect(await burnerContract.paused()).to.be.true;
    });

    it("Should allow owner to unpause", async function () {
      await burnerContract.pause();
      await burnerContract.unpause();
      expect(await burnerContract.paused()).to.be.false;
    });

    it("Should prevent burning when paused", async function () {
      await burnerContract.pause();

      const scrAmount = ethers.parseEther("100");
      await scrToken.connect(user1).approve(await burnerContract.getAddress(), scrAmount);

      await expect(
        burnerContract.connect(user1).burnSCRForUSDT(scrAmount)
      ).to.be.revertedWithCustomError(burnerContract, "EnforcedPause");
    });

    it("Should revert if non-owner tries to pause", async function () {
      await expect(
        burnerContract.connect(user1).pause()
      ).to.be.revertedWithCustomError(burnerContract, "OwnableUnauthorizedAccount");
    });
  });

  describe("Burn End Time", function () {
    it("Should allow burning when no end time is set", async function () {
      const scrAmount = ethers.parseEther("100");
      await scrToken.connect(user1).approve(await burnerContract.getAddress(), scrAmount);

      // burnEndTime should be 0 (no end time)
      expect(await burnerContract.burnEndTime()).to.equal(0);

      // Should burn successfully
      await expect(burnerContract.connect(user1).burnSCRForUSDT(scrAmount))
        .to.emit(burnerContract, "SCRBurned");
    });

    it("Should allow owner to set burn end time", async function () {
      const futureTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now

      await expect(burnerContract.setBurnEndTime(futureTime))
        .to.emit(burnerContract, "BurnEndTimeUpdated")
        .withArgs(0, futureTime);

      expect(await burnerContract.burnEndTime()).to.equal(futureTime);
    });

    it("Should allow burning before end time", async function () {
      const futureTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
      await burnerContract.setBurnEndTime(futureTime);

      const scrAmount = ethers.parseEther("100");
      await scrToken.connect(user1).approve(await burnerContract.getAddress(), scrAmount);

      await expect(burnerContract.connect(user1).burnSCRForUSDT(scrAmount))
        .to.emit(burnerContract, "SCRBurned");
    });

    it("Should prevent burning after end time", async function () {
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      await burnerContract.setBurnEndTime(pastTime);

      const scrAmount = ethers.parseEther("100");
      await scrToken.connect(user1).approve(await burnerContract.getAddress(), scrAmount);

      await expect(
        burnerContract.connect(user1).burnSCRForUSDT(scrAmount)
      ).to.be.revertedWithCustomError(burnerContract, "BurnEnded");
    });

    it("Should allow removing end time by setting to 0", async function () {
      const futureTime = Math.floor(Date.now() / 1000) + 86400;
      await burnerContract.setBurnEndTime(futureTime);

      // Remove end time
      await expect(burnerContract.setBurnEndTime(0))
        .to.emit(burnerContract, "BurnEndTimeUpdated")
        .withArgs(futureTime, 0);

      expect(await burnerContract.burnEndTime()).to.equal(0);
    });

    it("Should revert if non-owner tries to set end time", async function () {
      const futureTime = Math.floor(Date.now() / 1000) + 86400;

      await expect(
        burnerContract.connect(user1).setBurnEndTime(futureTime)
      ).to.be.revertedWithCustomError(burnerContract, "OwnableUnauthorizedAccount");
    });
  });

  describe("View Functions", function () {
    it("Should correctly calculate USDT amount", async function () {
      const scrAmount = ethers.parseEther("100");
      const expectedUSDT = ethers.parseUnits("0.34", 6); // 100 * 0.0034

      const calculatedUSDT = await burnerContract.calculateUSDTAmount(scrAmount);
      expect(calculatedUSDT).to.equal(expectedUSDT);
    });

    it("Should return correct pool balance", async function () {
      const poolBalance = await burnerContract.getUSDTPoolBalance();
      const actualBalance = await usdtToken.balanceOf(await burnerContract.getAddress());
      expect(poolBalance).to.equal(actualBalance);
    });

    it("Should return correct SCR balance", async function () {
      const scrBalance = await burnerContract.getSCRBalance();
      expect(scrBalance).to.equal(0); // Should always be 0 since tokens are burned

      // Even after burning, SCR balance should remain 0
      const scrAmount = ethers.parseEther("100");
      await scrToken.connect(user1).approve(await burnerContract.getAddress(), scrAmount);
      await burnerContract.connect(user1).burnSCRForUSDT(scrAmount);

      const scrBalanceAfter = await burnerContract.getSCRBalance();
      expect(scrBalanceAfter).to.equal(0); // Still 0, tokens were burned not transferred
    });
  });
});
