import { expect } from "chai";
import { ethers } from "hardhat";
import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
  CapitaFundingFactory,
  CapitaPoints,
  ChainFundMe,
  IERC20,
} from "../typechain-types"; // Adjust based on your typechain output
import { parseEther, parseUnits } from "ethers";

describe("ChainFundMe via CapitaFundingFactory", function () {
  // Fixture to deploy Factory and create a ChainFundMe campaign
  async function deployCampaignFixture() {
    const [owner, user1, user2, moderator, feeWallet, campaignOwner, nonOwner] =
      await ethers.getSigners();

    // Deploy mock ERC20 tokens
    const Token = await ethers.getContractFactory("MockERC20"); // Mock ERC20 contract
    const stableCoin = await Token.deploy(
      "StableCoin",
      "STC",
      parseUnits("1000000", 6),
      6 // decimals
    );
    const capitaToken = await Token.deploy(
      "CapitaToken",
      "CPT",
      parseEther("1000000"),
      18 // decimals
    );
    const otherToken = await Token.deploy(
      "OtherToken",
      "OT",
      parseEther("1000000"),
      18 // decimals
    );
    await Promise.all([
      stableCoin.waitForDeployment(),
      capitaToken.waitForDeployment(),
      otherToken.waitForDeployment(),
    ]);

    // Mint tokens to users
    await Promise.all([
      stableCoin.mint(user1.address, parseUnits("100000", 6)),
      stableCoin.mint(user2.address, parseUnits("100000", 6)),
      capitaToken.mint(user1.address, parseEther("100000")),
      otherToken.mint(user1.address, parseEther("100000")),
    ]);

    // Mock v3 aggregator
    const MockV3Aggregator = await ethers.getContractFactory(
      "MockV3Aggregator"
    );
    const mockV3Aggregator = await MockV3Aggregator.deploy(8, 200000000000);
    await mockV3Aggregator.waitForDeployment();

    // Deploy Factory
    const Factory = await ethers.getContractFactory("CapitaFundingFactory");
    const factory = await Factory.deploy(
      stableCoin.target,
      capitaToken.target,
      feeWallet.address,
      mockV3Aggregator.target
    );
    await factory.waitForDeployment();

    // Deploy mock CapitaPoints contract (minimal implementation for testing)
    const CapitaPoints = await ethers.getContractFactory("CapitaPoints");

    const capitaPoints = await CapitaPoints.deploy(
      await factory.getAddress(),
      await mockV3Aggregator.getAddress()
    );
    await capitaPoints.waitForDeployment();

    // Set CapitaPoints and acceptable token
    await factory.connect(owner).setCapitaPointsAddress(capitaPoints.target);
    await factory.connect(owner).setAcceptableToken(otherToken.target);
    await factory.connect(owner).addModerator(moderator.address);

    // verify campaign owner
    await factory.verifyCreator(campaignOwner.address, true);

    // Create ChainFundMe campaign
    const startTime = (await time.latest()) + 3600; // 1 hour from now
    const endTime = startTime + 86400; // 1 day duration
    const metadataUri = "ipfs://example";
    const otherTokens = [otherToken.target];
    const tx = await factory
      .connect(campaignOwner)
      .createChainFundMe(startTime, endTime, metadataUri, otherTokens);
    await tx.wait();
    const campaignAddress = (await factory.getDeployedCampaigns())[0];

    const chainFundMe = await ethers.getContractAt(
      "ChainFundMe",
      campaignAddress
    );

    // Approve tokens for funding
    await Promise.all([
      stableCoin
        .connect(user1)
        .approve(chainFundMe.target, parseUnits("100000", 6)),
      stableCoin
        .connect(user2)
        .approve(chainFundMe.target, parseUnits("100000", 6)),
      capitaToken
        .connect(user1)
        .approve(chainFundMe.target, parseEther("100000")),
      otherToken
        .connect(user1)
        .approve(chainFundMe.target, parseEther("100000")),
    ]);

    return {
      factory,
      capitaPoints,
      chainFundMe,
      stableCoin,
      capitaToken,
      otherToken,
      owner,
      user1,
      user2,
      moderator,
      feeWallet,
      campaignOwner,
      nonOwner,
      startTime,
      endTime,
      metadataUri,
    };
  }

  let factory: CapitaFundingFactory;
  let capitaPoints: CapitaPoints;
  let chainFundMe: ChainFundMe;
  let stableCoin: IERC20;
  let capitaToken: IERC20;
  let otherToken: IERC20;
  let owner;
  let user1;
  let user2;
  let moderator;
  let feeWallet;
  let campaignOwner;
  let nonOwner;
  let startTime: number;
  let endTime: number;
  let metadataUri: string;

  beforeEach(async function () {
    ({
      factory,
      capitaPoints,
      chainFundMe,
      stableCoin,
      capitaToken,
      otherToken,
      owner,
      user1,
      user2,
      moderator,
      feeWallet,
      campaignOwner,
      nonOwner,
      startTime,
      endTime,
      metadataUri,
    } = await loadFixture(deployCampaignFixture));
  });

  describe("Initialization", function () {
    it("should initialize with correct parameters", async function () {
      expect(await chainFundMe.owner()).to.equal(campaignOwner.address);
      expect(await chainFundMe.startTime()).to.equal(startTime);
      expect(await chainFundMe.endTime()).to.equal(endTime);
      expect(await chainFundMe.campaignMetadataUri()).to.equal(metadataUri);
      expect(await chainFundMe.stableCoinAddress()).to.equal(stableCoin.target);
      expect(await chainFundMe.capitaTokenAddress()).to.equal(
        capitaToken.target
      );
      expect(await chainFundMe.otherAcceptableTokens(0)).to.equal(
        otherToken.target
      );
      expect(await chainFundMe.fundingFactoryAddress()).to.equal(
        factory.target
      );
      expect(await chainFundMe.isPaused()).to.be.false;
      expect(await chainFundMe.fundersCount()).to.equal(0);
      expect(await chainFundMe.isWithdrawApproved()).to.be.false;
      expect(await chainFundMe.withdrawalApprovalRevoked()).to.be.false;
      expect(await chainFundMe.fundingApproved()).to.be.false;
      expect(await chainFundMe.ended()).to.be.false;
    });
  });

  describe("deposit", function () {
    beforeEach(async function () {
      // Approve funding and advance time to start
      await factory
        .connect(moderator)
        .chainFundMe_approveFunding(chainFundMe.target);
    });

    it("should mint correct amount of points on approving created chainFundMe", async () => {
      const basePoints = await capitaPoints.BASE_POINTS();
      const pointsEarned = await capitaPoints.getSpenderPoints(
        campaignOwner.address
      );
      expect(pointsEarned).to.be.equal(basePoints);
    });

    it("should enforce funding limit for unverified creator", async () => {
      const startTime = (await time.latest()) + 3600; // 1 hour from now
      const endTime = startTime + 86400; // 1 day duration
      const newChainFundMeTx = await factory.connect(user2).createChainFundMe(
        startTime,
        endTime,
        "", // uri
        [] // other tokens
      );
      const receipt = await newChainFundMeTx.wait();
      await time.increaseTo(startTime);
      const newChainFundMeAddress = (receipt.logs[1] as { args: string[] })
        .args[1];

      await factory.chainFundMe_approveFunding(newChainFundMeAddress);
      await factory
        .connect(user1)
        .chainFundMe_fundChainFundMe(
          newChainFundMeAddress,
          ethers.ZeroAddress,
          ethers.parseEther("10"),
          { value: ethers.parseEther("10") }
        );
      const usdcAmount = ethers.parseUnits("35000", 6);
      await stableCoin
        .connect(user1)
        .approve(newChainFundMeAddress, usdcAmount);
      const usdcDeposit = factory
        .connect(user1)
        .chainFundMe_fundChainFundMe(
          newChainFundMeAddress,
          stableCoin.target,
          usdcAmount
        );

      const chainFundMe = await ethers.getContractAt(
        "ChainFundMe",
        newChainFundMeAddress
      );
      await expect(usdcDeposit).to.be.revertedWithCustomError(
        chainFundMe,
        "ChainFundMe__FundingLimitExceeded"
      );
    });

    it("should allow ETH deposit through factory", async function () {
      await time.increaseTo(startTime);
      const amount = parseEther("1");
      const platformFee = await factory.platformFee();
      const feeAmount = (amount * BigInt(platformFee)) / BigInt(100);
      const netAmount = amount - feeAmount;

      const tx = await factory
        .connect(user1)
        .chainFundMe_fundChainFundMe(
          chainFundMe.target,
          ethers.ZeroAddress,
          amount,
          {
            value: amount,
          }
        );

      expect(await chainFundMe.ethContribution(user1.address)).to.equal(amount);
      expect(await chainFundMe.fundersCount()).to.equal(1);
      const funder = await chainFundMe.allFunders(0);
      expect(funder.funderAddress).to.equal(user1.address);
      expect(funder.tokenAddress).to.equal(ethers.ZeroAddress);
      expect(funder.amount).to.equal(amount);

      await expect(tx)
        .to.emit(chainFundMe, "Deposited")
        .withArgs(user1.address, ethers.ZeroAddress, amount);
      await expect(tx).to.changeEtherBalances(
        [user1, chainFundMe, feeWallet],
        [-amount, netAmount, feeAmount]
      );

      expect(await capitaPoints.getSpenderPoints(user1.address)).to.be.gt(0);
    });

    it("should allow token deposit through factory", async function () {
      await time.increaseTo(startTime);
      const amount = parseUnits("100", 6);
      const platformFee = await factory.platformFee();
      const feeAmount = (amount * BigInt(platformFee)) / BigInt(100);
      const netAmount = amount - feeAmount;

      const tx = await factory
        .connect(user1)
        .chainFundMe_fundChainFundMe(
          chainFundMe.target,
          stableCoin.target,
          amount
        );

      expect(
        await chainFundMe.otherTokenContribution(
          user1.address,
          stableCoin.target
        )
      ).to.equal(amount);
      expect(await chainFundMe.fundersCount()).to.equal(1);
      const funder = await chainFundMe.allFunders(0);
      expect(funder.funderAddress).to.equal(user1.address);
      expect(funder.tokenAddress).to.equal(stableCoin.target);
      expect(funder.amount).to.equal(amount);

      await expect(tx)
        .to.emit(chainFundMe, "Deposited")
        .withArgs(user1.address, stableCoin.target, amount);
      expect(await stableCoin.balanceOf(chainFundMe.target)).to.equal(
        netAmount
      );
      expect(await stableCoin.balanceOf(feeWallet.address)).to.equal(feeAmount);

      expect(await capitaPoints.getSpenderPoints(user1.address)).to.be.gt(0);

      // Audit Note: Two token transfers (to contract, fee). Consider pull-over-push for fees to save gas.
    });

    it("should revert if paused", async function () {
      await time.increaseTo(startTime);
      await factory
        .connect(moderator)
        .chainFundMe_pauseChainFundMeContract(chainFundMe.target, true);
      await expect(
        factory
          .connect(user1)
          .chainFundMe_fundChainFundMe(
            chainFundMe.target,
            ethers.ZeroAddress,
            parseEther("1"),
            {
              value: parseEther("1"),
            }
          )
      ).to.be.revertedWithCustomError(
        chainFundMe,
        "ChainFundMe__FundingPaused"
      );
    });

    it("should revert if funding not approved", async function () {
      await time.increaseTo(startTime);
      await factory
        .connect(moderator)
        .chainFundMe_disapproveFunding(chainFundMe.target, true);
      await expect(
        factory
          .connect(user1)
          .chainFundMe_fundChainFundMe(
            chainFundMe.target,
            ethers.ZeroAddress,
            parseEther("1"),
            {
              value: parseEther("1"),
            }
          )
      ).to.be.revertedWithCustomError(
        chainFundMe,
        "ChainFundMe__FundingDisapproved"
      );
    });

    it("should revert if campaign not started", async function () {
      await expect(
        factory
          .connect(user1)
          .chainFundMe_fundChainFundMe(
            chainFundMe.target,
            ethers.ZeroAddress,
            parseEther("1"),
            {
              value: parseEther("1"),
            }
          )
      ).to.be.revertedWithCustomError(
        chainFundMe,
        "ChainFundMe__FundingPeriodNotStarted"
      );
    });

    it("should revert if campaign over", async function () {
      await time.increaseTo(endTime + 1);
      await expect(
        factory
          .connect(user1)
          .chainFundMe_fundChainFundMe(
            chainFundMe.target,
            ethers.ZeroAddress,
            parseEther("1"),
            {
              value: parseEther("1"),
            }
          )
      ).to.be.revertedWithCustomError(
        chainFundMe,
        "ChainFundMe__FundingPeriodOver"
      );
    });

    it("should revert if invalid token", async function () {
      await time.increaseTo(startTime);
      const invalidToken = ethers.Wallet.createRandom().address;
      await expect(
        factory
          .connect(user1)
          .chainFundMe_fundChainFundMe(
            chainFundMe.target,
            invalidToken,
            parseEther("100")
          )
      ).to.be.revertedWithCustomError(
        chainFundMe,
        "ChainFundMe__TokenNotAllowed"
      );
    });

    it("should revert if zero amount", async function () {
      await time.increaseTo(startTime);
      await expect(
        factory
          .connect(user1)
          .chainFundMe_fundChainFundMe(chainFundMe.target, stableCoin.target, 0)
      ).to.be.revertedWithCustomError(
        chainFundMe,
        "ChainFundMe__InvalidAmount"
      );
    });

    it("should revert if ETH amount mismatch", async function () {
      await time.increaseTo(startTime);
      await expect(
        factory
          .connect(user1)
          .chainFundMe_fundChainFundMe(
            chainFundMe.target,
            ethers.ZeroAddress,
            parseEther("1"),
            {
              value: parseEther("2"),
            }
          )
      ).to.be.revertedWithCustomError(
        chainFundMe,
        "ChainFundMe__ValueSentNotEqualAmount"
      );
    });
  });

  describe("approveWithdraw", function () {
    it("should allow factory to approve withdrawal", async function () {
      await time.increaseTo(endTime + 1);
      const tx = await factory
        .connect(moderator)
        .chainFundMe_approveWithdraw(chainFundMe.target);
      expect(await chainFundMe.isWithdrawApproved()).to.be.true;
      expect(await chainFundMe.ended()).to.be.true;
      await expect(tx).to.emit(chainFundMe, "WithdrawApproved");
    });

    it("should revert if already approved", async function () {
      await time.increaseTo(endTime + 1);
      await factory
        .connect(moderator)
        .chainFundMe_approveWithdraw(chainFundMe.target);
      await expect(
        factory
          .connect(moderator)
          .chainFundMe_approveWithdraw(chainFundMe.target)
      ).to.be.revertedWithCustomError(
        chainFundMe,
        "ChainFundMe__AlreadyApproved"
      );
    });

    it("should revert if called by non-factory", async function () {
      await time.increaseTo(endTime + 1);
      await expect(
        chainFundMe.connect(moderator).approveWithdraw()
      ).to.be.revertedWithCustomError(chainFundMe, "ChainFundMe__NotFactory");
    });

    it("should revert if campaign not ended", async function () {
      await time.increaseTo(startTime);
      await expect(
        factory
          .connect(moderator)
          .chainFundMe_approveWithdraw(chainFundMe.target)
      ).to.be.revertedWithCustomError(
        chainFundMe,
        "ChainFundMe__FundingStillActive"
      );
    });
  });

  describe("revokeApproval", function () {
    it("should allow factory to revoke approval", async function () {
      const tx = await factory
        .connect(owner)
        .chainFundMe_revokeApproval(chainFundMe.target, true);
      expect(await chainFundMe.withdrawalApprovalRevoked()).to.be.true;
      await expect(tx).to.emit(chainFundMe, "ApprovalRevoked").withArgs(true);
    });

    it("should revert if called by non-factory", async function () {
      await expect(
        chainFundMe.connect(owner).revokeApproval(true)
      ).to.be.revertedWithCustomError(chainFundMe, "ChainFundMe__NotFactory");
    });
  });

  describe("withdrawETH", function () {
    beforeEach(async function () {
      await factory
        .connect(moderator)
        .chainFundMe_approveFunding(chainFundMe.target);
      await time.increaseTo(startTime);
      await factory
        .connect(user1)
        .chainFundMe_fundChainFundMe(
          chainFundMe.target,
          ethers.ZeroAddress,
          parseEther("1"),
          {
            value: parseEther("1"),
          }
        );
      await time.increaseTo(endTime + 1);
      await factory
        .connect(moderator)
        .chainFundMe_approveWithdraw(chainFundMe.target);
    });

    it("should allow campaign owner to withdraw ETH", async function () {
      const platformFee = await factory.platformFee();
      const balance =
        parseEther("1") - (parseEther("1") * BigInt(platformFee)) / BigInt(100);
      const ownerBalanceBefore = await ethers.provider.getBalance(
        campaignOwner.address
      );

      const tx = await factory
        .connect(campaignOwner)
        .chainFundMe_withdrawETH(chainFundMe.target);
      await expect(tx)
        .to.emit(chainFundMe, "WithdrawnETH")
        .withArgs(campaignOwner.address, balance);
      await expect(tx).to.changeEtherBalances(
        [chainFundMe, campaignOwner],
        [-balance, balance]
      );

      const ownerBalanceAfter = await ethers.provider.getBalance(
        campaignOwner.address
      );
      expect(ownerBalanceAfter).to.be.gt(ownerBalanceBefore);

      // Audit Note: Single ETH transfer. Consider pull-over-push for large campaigns.
    });

    it("should revert if not approved", async function () {
      await factory
        .connect(owner)
        .chainFundMe_revokeApproval(chainFundMe.target, true);
      await expect(
        factory
          .connect(campaignOwner)
          .chainFundMe_withdrawETH(chainFundMe.target)
      ).to.be.revertedWithCustomError(chainFundMe, "ChainFundMe__NotApproved");
    });

    it("should revert if called by non-campaign owner", async function () {
      await expect(
        factory.connect(nonOwner).chainFundMe_withdrawETH(chainFundMe.target)
      ).to.be.revertedWithCustomError(factory, "Capita__NotOwner");
    });
  });

  describe("withdrawOtherTokens", function () {
    beforeEach(async function () {
      await factory
        .connect(moderator)
        .chainFundMe_approveFunding(chainFundMe.target);
      await time.increaseTo(startTime);
      await factory
        .connect(user1)
        .chainFundMe_fundChainFundMe(
          chainFundMe.target,
          stableCoin.target,
          parseUnits("100", 6)
        );
      await time.increaseTo(endTime + 1);
      await factory
        .connect(moderator)
        .chainFundMe_approveWithdraw(chainFundMe.target);
    });

    it("should allow campaign owner to withdraw tokens", async function () {
      const platformFee = await factory.platformFee();
      const balance =
        parseUnits("100", 6) -
        (parseUnits("100", 6) * BigInt(platformFee)) / BigInt(100);

      const tx = await factory
        .connect(campaignOwner)
        .chainFundMe_withdrawTokens(chainFundMe.target);
      await expect(tx)
        .to.emit(chainFundMe, "WithdrawnToken")
        .withArgs(campaignOwner.address, balance, stableCoin.target);
      expect(await stableCoin.balanceOf(chainFundMe.target)).to.equal(0);
      expect(await stableCoin.balanceOf(campaignOwner.address)).to.equal(
        balance
      );
      // Audit Note: Loops over otherAcceptableTokens. Consider mapping for O(1) access.
    });

    it("should emit FailedOtherTokensWithdrawal for failed transfers", async function () {
      // Deploy a failing token
      const FailingToken = await ethers.getContractFactory("MockFailingERC20");
      const failingToken = await FailingToken.deploy(
        "FailingToken",
        "FT",
        parseEther("1000")
      );
      await failingToken.waitForDeployment();
      await failingToken.mint(user1.address, parseEther("100"));

      // Update factory and campaign to accept failing token
      await factory.connect(owner).setAcceptableToken(failingToken.target);

      const new_startTime = (await time.latest()) + 3600; // 1 hour from now
      const new_endTime = new_startTime + 86400; // 1 day duration

      // deploy new campaign
      await factory
        .connect(campaignOwner)
        .createChainFundMe(new_startTime, new_endTime, metadataUri, [
          failingToken.target,
        ]);
      const newCampaignAddress = (await factory.getDeployedCampaigns())[1];
      const newChainFundMe = await ethers.getContractAt(
        "ChainFundMe",
        newCampaignAddress
      );

      // approve new campaign fundMe to spend failing tokens
      await failingToken
        .connect(user1)
        .approve(newChainFundMe.target, parseEther("100"));

      // approve funding
      await factory
        .connect(moderator)
        .chainFundMe_approveFunding(newChainFundMe.target);

      // fund
      await time.increaseTo(new_startTime);
      await factory
        .connect(user1)
        .chainFundMe_fundChainFundMe(
          newCampaignAddress,
          failingToken.target,
          parseEther("100")
        );

      // approve withdrawal
      await time.increaseTo(new_endTime + 1);
      await factory
        .connect(moderator)
        .chainFundMe_approveWithdraw(newChainFundMe.target);

      // withdraw funded tokens
      const tx = await factory
        .connect(campaignOwner)
        .chainFundMe_withdrawTokens(newChainFundMe.target);
      await expect(tx)
        .to.emit(newChainFundMe, "FailedOtherTokensWithdrawal")
        .withArgs([failingToken.target]);

      // Gas Efficiency Audit
      // Audit Note: Failed transfers increase gas due to event emission. Consider skipping failed tokens silently.
    });

    it("should revert if not approved", async function () {
      await factory
        .connect(owner)
        .chainFundMe_revokeApproval(chainFundMe.target, true);
      await expect(
        factory
          .connect(campaignOwner)
          .chainFundMe_withdrawTokens(chainFundMe.target)
      ).to.be.revertedWithCustomError(chainFundMe, "ChainFundMe__NotApproved");
    });

    it("should revert if called by non-campaign owner", async function () {
      await expect(
        factory.connect(nonOwner).chainFundMe_withdrawTokens(chainFundMe.target)
      ).to.be.revertedWithCustomError(factory, "Capita__NotOwner");
    });
  });

  describe("endCampaign", function () {
    it("should allow owner to end campaign", async function () {
      await time.increaseTo(startTime);
      const tx = await chainFundMe.connect(campaignOwner).endCampaign();
      expect(await chainFundMe.ended()).to.be.true;
      expect(await chainFundMe.endTime()).to.be.closeTo(
        await time.latest(),
        100
      );
    });

    it("should revert if campaign not started", async function () {
      await expect(
        chainFundMe.connect(campaignOwner).endCampaign()
      ).to.be.revertedWithCustomError(
        chainFundMe,
        "ChainFundMe__FundingPeriodNotStarted"
      );
    });

    it("should revert if called by non-owner", async function () {
      await time.increaseTo(startTime);
      await expect(
        chainFundMe.connect(nonOwner).endCampaign()
      ).to.be.revertedWithCustomError(chainFundMe, "ChainFundMe__NotOwner");
    });
  });

  describe("updateEndTime", function () {
    it("should allow owner to update end time", async function () {
      const newEndTime = endTime + 86400;
      await chainFundMe.connect(campaignOwner).updateEndTime(newEndTime);
      expect(await chainFundMe.endTime()).to.equal(newEndTime);
    });

    it("should revert if campaign is over", async function () {
      await time.increaseTo(endTime + 1);
      await expect(
        chainFundMe.connect(campaignOwner).updateEndTime(endTime + 86400)
      ).to.be.revertedWithCustomError(
        chainFundMe,
        "ChainFundMe__FundingPeriodOver"
      );
    });

    it("should revert if called by non-owner", async function () {
      await expect(
        chainFundMe.connect(nonOwner).updateEndTime(endTime + 86400)
      ).to.be.revertedWithCustomError(chainFundMe, "ChainFundMe__NotOwner");
    });
  });

  describe("updateStartTime", function () {
    it("should allow owner to update start time", async function () {
      const newStartTime = startTime + 3600;
      await chainFundMe.connect(campaignOwner).updateStartTime(newStartTime);
      expect(await chainFundMe.startTime()).to.equal(newStartTime);
    });

    it("should revert if campaign in progress", async function () {
      await time.increaseTo(startTime);
      await expect(
        chainFundMe.connect(campaignOwner).updateStartTime(startTime + 3600)
      ).to.be.revertedWithCustomError(
        chainFundMe,
        "ChainFundMe__FundingStillActive"
      );
    });

    it("should revert if called by non-owner", async function () {
      await expect(
        chainFundMe.connect(nonOwner).updateStartTime(startTime + 3600)
      ).to.be.revertedWithCustomError(chainFundMe, "ChainFundMe__NotOwner");
    });
  });

  describe("updatePause", function () {
    it("should allow factory to pause/unpause", async function () {
      let tx = await factory
        .connect(moderator)
        .chainFundMe_pauseChainFundMeContract(chainFundMe.target, true);
      expect(await chainFundMe.isPaused()).to.be.true;
      await expect(tx).to.emit(chainFundMe, "Paused").withArgs(true);

      tx = await factory
        .connect(moderator)
        .chainFundMe_pauseChainFundMeContract(chainFundMe.target, false);
      expect(await chainFundMe.isPaused()).to.be.false;
      await expect(tx).to.emit(chainFundMe, "Paused").withArgs(false);
    });

    it("should revert if called by non-factory", async function () {
      await expect(
        chainFundMe.connect(moderator).updatePause(true)
      ).to.be.revertedWithCustomError(chainFundMe, "ChainFundMe__NotFactory");
    });
  });

  describe("updateMetadataURI", function () {
    it("should allow owner to update metadata URI", async function () {
      const newUri = "ipfs://new-example";
      await chainFundMe.connect(campaignOwner).updateMetadataURI(newUri);
      expect(await chainFundMe.campaignMetadataUri()).to.equal(newUri);
    });

    it("should revert if campaign is over", async function () {
      await time.increaseTo(endTime + 1);
      await expect(
        chainFundMe
          .connect(campaignOwner)
          .updateMetadataURI("ipfs://new-example")
      ).to.be.revertedWithCustomError(
        chainFundMe,
        "ChainFundMe__FundingPeriodOver"
      );
    });

    it("should revert if called by non-owner", async function () {
      await expect(
        chainFundMe.connect(nonOwner).updateMetadataURI("ipfs://new-example")
      ).to.be.revertedWithCustomError(chainFundMe, "ChainFundMe__NotOwner");
    });
  });

  describe("updateFundingApproval", function () {
    it("should allow factory to update funding approval", async function () {
      let tx = await factory
        .connect(moderator)
        .chainFundMe_approveFunding(chainFundMe.target);
      expect(await chainFundMe.fundingApproved()).to.be.true;
      await expect(tx).to.emit(chainFundMe, "FundingApproved").withArgs(true);
    });

    it("should revert if called by non-factory", async function () {
      await expect(
        chainFundMe.connect(moderator).updateFundingApproval()
      ).to.be.revertedWithCustomError(chainFundMe, "ChainFundMe__NotFactory");
    });
  });

  describe("batchApproveFunding", function () {
    it("should allow factory to batch approve funding", async function () {
      // Create another campaign
      const tx = await factory
        .connect(campaignOwner)
        .createChainFundMe(startTime, endTime, metadataUri, []);
      const newCampaignAddress = (await factory.getDeployedCampaigns())[1];
      const newChainFundMe = await ethers.getContractAt(
        "ChainFundMe",
        newCampaignAddress
      );

      const txBatch = await factory
        .connect(moderator)
        .chainFundMe_batchApproveFunding([
          chainFundMe.target,
          newChainFundMe.target,
        ]);
      expect(await chainFundMe.fundingApproved()).to.be.true;
      expect(await newChainFundMe.fundingApproved()).to.be.true;
      await expect(txBatch)
        .to.emit(chainFundMe, "FundingApproved")
        .withArgs(true);
      await expect(txBatch)
        .to.emit(newChainFundMe, "FundingApproved")
        .withArgs(true);

      // Audit Note: Linear gas cost for array. Cap array length to prevent DoS.
    });
  });

  describe("updateDisapprovalApproval", function () {
    it("should allow factory to update funding disapproval", async function () {
      let tx = await factory
        .connect(moderator)
        .chainFundMe_disapproveFunding(chainFundMe.target, true);
      expect(await chainFundMe.fundingDisapproved()).to.be.true;
      await expect(tx)
        .to.emit(chainFundMe, "FundingDisapproved")
        .withArgs(true);

      tx = await factory
        .connect(moderator)
        .chainFundMe_disapproveFunding(chainFundMe.target, false);
      expect(await chainFundMe.fundingDisapproved()).to.be.false;
      await expect(tx)
        .to.emit(chainFundMe, "FundingDisapproved")
        .withArgs(false);
    });

    it("should revert if called by non-factory", async function () {
      await expect(
        chainFundMe.connect(moderator).updateFundingDisapproval(true)
      ).to.be.revertedWithCustomError(chainFundMe, "ChainFundMe__NotFactory");
    });
  });

  describe("batchDisapproveFunding", function () {
    it("should allow factory to batch disapprove funding", async function () {
      // Create another campaign
      const tx = await factory
        .connect(campaignOwner)
        .createChainFundMe(startTime, endTime, metadataUri, []);
      const newCampaignAddress = (await factory.getDeployedCampaigns())[1];
      const newChainFundMe = await ethers.getContractAt(
        "ChainFundMe",
        newCampaignAddress
      );

      const txBatch = await factory
        .connect(moderator)
        .chainFundMe_batchDisapproveFunding(
          [chainFundMe.target, newChainFundMe.target],
          true
        );
      expect(await chainFundMe.fundingDisapproved()).to.be.true;
      expect(await newChainFundMe.fundingDisapproved()).to.be.true;
      await expect(txBatch)
        .to.emit(chainFundMe, "FundingDisapproved")
        .withArgs(true);
      await expect(txBatch)
        .to.emit(newChainFundMe, "FundingDisapproved")
        .withArgs(true);

      // Audit Note: Linear gas cost for array. Cap array length to prevent DoS.
    });
  });

  describe("getFundersDetails", function () {
    it("should return all funders details", async function () {
      await factory
        .connect(moderator)
        .chainFundMe_approveFunding(chainFundMe.target);
      await time.increaseTo(startTime);
      await factory
        .connect(user1)
        .chainFundMe_fundChainFundMe(
          chainFundMe.target,
          stableCoin.target,
          parseUnits("100", 6)
        );
      await factory
        .connect(user2)
        .chainFundMe_fundChainFundMe(
          chainFundMe.target,
          ethers.ZeroAddress,
          parseEther("1"),
          {
            value: parseEther("1"),
          }
        );

      const funders = await chainFundMe.getFundersDetails();
      expect(funders.length).to.equal(2);
      expect(funders[0].funderAddress).to.equal(user1.address);
      expect(funders[0].tokenAddress).to.equal(stableCoin.target);
      expect(funders[0].amount).to.equal(parseUnits("100", 6));
      expect(funders[1].funderAddress).to.equal(user2.address);
      expect(funders[1].tokenAddress).to.equal(ethers.ZeroAddress);
      expect(funders[1].amount).to.equal(parseEther("1"));
    });
  });

  describe("Security Checks", function () {
    it("should ensure only factory can call sensitive functions", async function () {
      await time.increaseTo(endTime + 1);
      await expect(
        chainFundMe.connect(user1).updatePause(true)
      ).to.be.revertedWithCustomError(chainFundMe, "ChainFundMe__NotFactory");
      await expect(
        chainFundMe.connect(user1).approveWithdraw()
      ).to.be.revertedWithCustomError(chainFundMe, "ChainFundMe__NotFactory");
    });
  });
});
