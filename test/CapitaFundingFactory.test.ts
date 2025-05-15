import { expect } from "chai";
import { ethers } from "hardhat";
import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { CapitaFundingFactory, CapitaPoints } from "../typechain-types";

describe("CapitaFundingFactory Contract", function () {
  // Fixture to deploy the Factory contract
  async function deployFactoryFixture() {
    const [owner, user1, user2, moderator, feeWallet, campaignOwner] =
      await ethers.getSigners();
    const stableCoinAddress = ethers.Wallet.createRandom().address; // Mock stablecoin
    const capitaTokenAddress = ethers.Wallet.createRandom().address; // Mock Capita token
    const priceFeedAddress = ethers.Wallet.createRandom().address; // Mock price feed address

    const Factory = await ethers.getContractFactory("CapitaFundingFactory");
    const factory = await Factory.deploy(
      stableCoinAddress,
      capitaTokenAddress,
      feeWallet.address,
      priceFeedAddress
    );
    await factory.waitForDeployment();

    // Mock v3 aggregator
    const MockV3Aggregator = await ethers.getContractFactory(
      "MockV3Aggregator"
    );
    const mockV3Aggregator = await MockV3Aggregator.deploy(10, 20000000000000);
    await mockV3Aggregator.waitForDeployment();

    // Deploy mock CapitaPoints contract (minimal implementation for testing)
    const CapitaPoints = await ethers.getContractFactory("CapitaPoints");

    const capitaPoints = await CapitaPoints.deploy(
      await factory.getAddress(),
      await mockV3Aggregator.getAddress()
    );
    await capitaPoints.waitForDeployment();

    return {
      factory,
      capitaPoints,
      owner,
      user1,
      user2,
      moderator,
      feeWallet,
      campaignOwner,
      stableCoinAddress,
      capitaTokenAddress,
    };
  }

  let factory: CapitaFundingFactory;
  let capitaPoints: CapitaPoints;
  let owner;
  let user1;
  let user2;
  let moderator;
  let feeWallet;
  let campaignOwner;
  let stableCoinAddress: string;
  let capitaTokenAddress: string;

  beforeEach(async function () {
    ({
      factory,
      capitaPoints,
      owner,
      user1,
      user2,
      moderator,
      feeWallet,
      campaignOwner,
      stableCoinAddress,
      capitaTokenAddress,
    } = await loadFixture(deployFactoryFixture));
  });

  describe("Deployment", function () {
    it("should deploy with correct initial state", async function () {
      expect(await factory.stableCoinAddress()).to.equal(stableCoinAddress);
      expect(await factory.capitaTokenAddress()).to.equal(capitaTokenAddress);
      expect(await factory.feeWalletAddress()).to.equal(feeWallet.address);
      expect(await factory.platformFee()).to.equal(5);
      expect(await factory.paused()).to.be.false;
      expect(await factory.getDeployedCampaigns()).to.be.an("array").that.is
        .empty;
      expect(await factory.moderators(owner.address)).to.be.true;
      expect(await factory.owner()).to.equal(owner.address);
    });
  });

  describe("addModerator", function () {
    it("should allow owner to add moderator", async function () {
      const tx = await factory.connect(owner).addModerator(moderator.address);
      expect(await factory.moderators(moderator.address)).to.be.true;
      await expect(tx)
        .to.emit(factory, "ModeratorAdded")
        .withArgs(moderator.address);
    });

    it("should revert if called by non-owner", async function () {
      await expect(
        factory.connect(user1).addModerator(moderator.address)
      ).to.be.revertedWithCustomError(factory, "Capita__NotOwner");
    });
  });

  describe("removeModerator", function () {
    it("should allow owner to remove moderator", async function () {
      await factory.connect(owner).addModerator(moderator.address);
      const tx = await factory
        .connect(owner)
        .removeModerator(moderator.address);
      expect(await factory.moderators(moderator.address)).to.be.false;
      await expect(tx)
        .to.emit(factory, "ModeratorRemoved")
        .withArgs(moderator.address);
    });

    it("should revert if called by non-owner", async function () {
      await expect(
        factory.connect(user1).removeModerator(moderator.address)
      ).to.be.revertedWithCustomError(factory, "Capita__NotOwner");
    });
  });

  describe("setCapitaPointsAddress", function () {
    it("should allow owner to set CapitaPoints address", async function () {
      const newCapitaPointsAddress = ethers.Wallet.createRandom().address;
      const tx = await factory
        .connect(owner)
        .setCapitaPointsAddress(newCapitaPointsAddress);
      expect(await factory.capitaPoints()).to.equal(newCapitaPointsAddress);
      await expect(tx)
        .to.emit(factory, "CapitaPointsAddressSet")
        .withArgs(newCapitaPointsAddress);
    });

    it("should revert if called by non-owner", async function () {
      await expect(
        factory
          .connect(user1)
          .setCapitaPointsAddress(ethers.Wallet.createRandom().address)
      ).to.be.revertedWithCustomError(factory, "Capita__NotOwner");
    });
  });

  describe("updatePaused", function () {
    it("should allow owner to pause/unpause contract", async function () {
      let tx = await factory.connect(owner).updatePaused(true);
      expect(await factory.paused()).to.be.true;
      await expect(tx).to.emit(factory, "CapitaFactoryPaused").withArgs(true);

      tx = await factory.connect(owner).updatePaused(false);
      expect(await factory.paused()).to.be.false;
      await expect(tx).to.emit(factory, "CapitaFactoryPaused").withArgs(false);
    });

    it("should revert if called by non-owner", async function () {
      await expect(
        factory.connect(user1).updatePaused(true)
      ).to.be.revertedWithCustomError(factory, "Capita__NotOwner");
    });
  });

  describe("createChainFundMe", function () {
    beforeEach(async function () {
      // Set CapitaPoints address for tests
      await factory
        .connect(owner)
        .setCapitaPointsAddress(await capitaPoints.getAddress());
      await factory.verifyCreator(user1.address, true);
    });

    it("should not allow unverified users create campaign with other tokens", async function () {
      const startTime = (await time.latest()) + 3600; // 1 hour from now
      const endTime = startTime + 86400; // 1 day duration
      const metadataUri = "ipfs://example";
      const otherTokens = [ethers.Wallet.createRandom().address];
      const tx = factory
        .connect(user2)
        .createChainFundMe(startTime, endTime, metadataUri, otherTokens);

      await expect(tx).to.be.revertedWithCustomError(
        factory,
        "CapitaFundingFactory__UnverifiedUser"
      );
    });

    it("should create a new ChainFundMe campaign", async function () {
      const startTime = (await time.latest()) + 3600; // 1 hour from now
      const endTime = startTime + 86400; // 1 day duration
      const metadataUri = "ipfs://example";
      const otherTokens = [];
      //await factory.connect(owner).setAcceptableToken(otherTokens[0]); // Allow token

      const tx = await factory
        .connect(user1)
        .createChainFundMe(startTime, endTime, metadataUri, otherTokens);
      const receipt = await tx.wait();
      const campaigns = await factory.getDeployedCampaigns();
      expect(campaigns).to.have.lengthOf(1);
      expect(campaigns[0]).to.be.properAddress;

      const userCampaigns = await factory.getUserCampaigns(user1.address);
      expect(userCampaigns).to.have.lengthOf(1);
      expect(userCampaigns[0]).to.equal(campaigns[0]);

      await expect(tx)
        .to.emit(factory, "ChainFundMeCreated")
        .withArgs(user1.address, campaigns[0]);

      // // Gas Efficiency Audit
      // const gasUsed = receipt!.gasUsed;
      // expect(gasUsed).to.be.lte(600000); // Adjust based on actual gas usage
      // Audit Note: Deployment of ChainFundMe is gas-intensive. Consider proxy patterns (e.g., ERC1167) for gas savings.
    });

    it("should revert if contract is paused", async function () {
      await factory.connect(owner).updatePaused(true);
      await expect(
        factory
          .connect(user1)
          .createChainFundMe(
            (await time.latest()) + 3600,
            (await time.latest()) + 90000,
            "ipfs://example",
            []
          )
      ).to.be.revertedWithCustomError(
        factory,
        "CapitaFundingFactory__ContractPaused"
      );
    });

    it("should revert if CapitaPoints address not set", async function () {
      // Deploy new factory without setting CapitaPoints
      const Factory = await ethers.getContractFactory("CapitaFundingFactory");
      const newFactory = await Factory.deploy(
        stableCoinAddress,
        capitaTokenAddress,
        feeWallet.address,
        ethers.Wallet.createRandom().address // price feed address
      );
      await newFactory.waitForDeployment();

      await expect(
        newFactory
          .connect(user1)
          .createChainFundMe(
            (await time.latest()) + 3600,
            (await time.latest()) + 90000,
            "ipfs://example",
            []
          )
      )
        .to.be.revertedWithCustomError(
          newFactory,
          "CapitaFundingFactory__InvalidAddress"
        )
        .withArgs(ethers.ZeroAddress);
    });

    it("should revert if more than 5 tokens provided", async function () {
      const startTime = (await time.latest()) + 3600;
      const endTime = startTime + 86400;
      const metadataUri = "ipfs://example";
      const otherTokens = Array(6).fill(ethers.Wallet.createRandom().address);
      await expect(
        factory
          .connect(user1)
          .createChainFundMe(startTime, endTime, metadataUri, otherTokens)
      ).to.be.revertedWithCustomError(
        factory,
        "CapitaFundingFactory__MaxOf5TokensExceeded"
      );
    });

    it("should revert if invalid dates provided", async function () {
      const currentTime = await time.latest();
      const metadataUri = "ipfs://example";

      // startTime >= endTime
      await expect(
        factory
          .connect(user1)
          .createChainFundMe(
            currentTime + 3600,
            currentTime + 3600,
            metadataUri,
            []
          )
      ).to.be.revertedWithCustomError(
        factory,
        "CapitaFundingFactory__InvalidDatesSet"
      );

      // startTime < block.timestamp
      await expect(
        factory
          .connect(user1)
          .createChainFundMe(
            currentTime - 3600,
            currentTime + 86400,
            metadataUri,
            []
          )
      ).to.be.revertedWithCustomError(
        factory,
        "CapitaFundingFactory__InvalidDatesSet"
      );
    });

    it("should revert if zero token address provided", async function () {
      const startTime = (await time.latest()) + 3600;
      const endTime = startTime + 86400;
      const metadataUri = "ipfs://example";
      await expect(
        factory
          .connect(user1)
          .createChainFundMe(startTime, endTime, metadataUri, [
            ethers.ZeroAddress,
          ])
      )
        .to.be.revertedWithCustomError(
          factory,
          "CapitaFundingFactory__InvalidAddress"
        )
        .withArgs(ethers.ZeroAddress);
    });

    it("should revert if invalid token address provided", async function () {
      const startTime = (await time.latest()) + 3600;
      const endTime = startTime + 86400;
      const metadataUri = "ipfs://example";
      const invalidToken = ethers.Wallet.createRandom().address;

      await expect(
        factory
          .connect(user1)
          .createChainFundMe(startTime, endTime, metadataUri, [invalidToken])
      )
        .to.be.revertedWithCustomError(
          factory,
          "CapitaFundingFactory__TokenNotAllowed"
        )
        .withArgs(invalidToken);
    });
  });

  describe("setAcceptableToken", function () {
    it("should allow owner to set acceptable token", async function () {
      const tokenAddress = ethers.Wallet.createRandom().address;
      const tx = await factory.connect(owner).setAcceptableToken(tokenAddress);
      expect(await factory.checkAcceptableTokenAddress(tokenAddress)).to.be
        .true;
      await expect(tx)
        .to.emit(factory, "AcceptableTokenSet")
        .withArgs(tokenAddress, true);
    });

    it("should revert if called by non-owner", async function () {
      await expect(
        factory
          .connect(user1)
          .setAcceptableToken(ethers.Wallet.createRandom().address)
      ).to.be.revertedWithCustomError(factory, "Capita__NotOwner");
    });
  });

  describe("removeTokenAddress", function () {
    it("should allow owner to remove acceptable token", async function () {
      const tokenAddress = ethers.Wallet.createRandom().address;
      await factory.connect(owner).setAcceptableToken(tokenAddress);
      const tx = await factory.connect(owner).removeTokenAddress(tokenAddress);
      expect(await factory.checkAcceptableTokenAddress(tokenAddress)).to.be
        .false;
      await expect(tx)
        .to.emit(factory, "AcceptableTokenSet")
        .withArgs(tokenAddress, false);
    });

    it("should revert if called by non-owner", async function () {
      await expect(
        factory
          .connect(user1)
          .removeTokenAddress(ethers.Wallet.createRandom().address)
      ).to.be.revertedWithCustomError(factory, "Capita__NotOwner");
    });
  });

  describe("updatePlatformFee", function () {
    it("should allow owner to update platform fee", async function () {
      const tx = await factory.connect(owner).updatePlatformFee(10);
      expect(await factory.platformFee()).to.equal(10);
      await expect(tx).to.emit(factory, "PlatformFeeUpdated").withArgs(10);
    });

    it("should revert if fee less than 1", async function () {
      await expect(
        factory.connect(owner).updatePlatformFee(0)
      ).to.be.revertedWithCustomError(
        factory,
        "CapitaFundingFactory__FeeCannotBeLessThan_1"
      );
    });

    it("should revert if fee greater than 20", async function () {
      await expect(
        factory.connect(owner).updatePlatformFee(21)
      ).to.be.revertedWithCustomError(
        factory,
        "CapitaFundingFactory__FeeCannotBeGreaterThan_20"
      );
    });

    it("should revert if called by non-owner", async function () {
      await expect(
        factory.connect(user1).updatePlatformFee(10)
      ).to.be.revertedWithCustomError(factory, "Capita__NotOwner");
    });
  });

  describe("updateFeeWalletAddress", function () {
    it("should allow owner to update fee wallet address if capitaPoints not set", async function () {
      const newFeeWallet = ethers.Wallet.createRandom().address;
      const tx = await factory
        .connect(owner)
        .updateFeeWalletAddress(newFeeWallet);
      expect(await factory.feeWalletAddress()).to.equal(newFeeWallet);
      await expect(tx)
        .to.emit(factory, "UpdatedFeeWalletAddress")
        .withArgs(newFeeWallet);
    });

    it("should revert if capitaPoints is set", async function () {
      await factory
        .connect(owner)
        .setCapitaPointsAddress(await capitaPoints.getAddress());
      await expect(
        factory
          .connect(owner)
          .updateFeeWalletAddress(ethers.Wallet.createRandom().address)
      ).to.be.revertedWithCustomError(
        factory,
        "CapitaFundingFactory__CapitaPointsAlreadySet"
      );
    });

    it("should revert if called by non-owner", async function () {
      await expect(
        factory
          .connect(user1)
          .updateFeeWalletAddress(ethers.Wallet.createRandom().address)
      ).to.be.revertedWithCustomError(factory, "Capita__NotOwner");
    });
  });

  describe("Security Checks", function () {
    it("should not allow unauthorized access to moderator functions", async function () {
      expect(await factory.moderators(user1.address)).to.be.false;
      await expect(
        factory
          .connect(user1)
          .chainFundMe_approveWithdraw(ethers.Wallet.createRandom().address)
      ).to.be.revertedWithCustomError(
        factory,
        "CapitaFundingFactory__NotModerator"
      );
    });
  });
});

// Improvement Suggestions:
// 3. Add maximum array length checks for batch operations (e.g., batchWithdrawApproval, batchApproveFunding).
// 4. Allow updating feeWalletAddress with admin approval even after capitaPoints is set.
// 5. Consider batch operations for setAcceptableToken to reduce gas for multiple tokens.

// Vulnerability Notes:
// - Ensure ChainFundMe validates factory address to prevent fake factories.
// - Validate _toAddress in withdraw functions to prevent zero address or malicious contracts.
// - CapitaPointsAlreadySet restriction in updateFeeWalletAddress may be too restrictive; consider a more flexible admin override.
