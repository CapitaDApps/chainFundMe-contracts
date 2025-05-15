import { ethers, network } from "hardhat";
import { getDeployedAddress, networks, Networks } from "../lib/config";
import { sleep } from "../lib/utils";

async function main() {
  const net = network.name as Networks;

  const USDCAddress = networks[net].usdc;
  const capitaFactory = getDeployedAddress(net, "capita-factory");

  const [owner] = await ethers.getSigners();

  if (!capitaFactory) {
    console.error("CapitaFundingFactory contract not found");
    return;
  }

  const CapitaFundingFactory = await ethers.getContractAt(
    "CapitaFundingFactory",
    capitaFactory["CapitaFundingFactory#CapitaFundingFactory"],
    owner
  );

  const chainFundMeAddresses =
    await CapitaFundingFactory.getDeployedCampaigns();
  const chainFundMeAddress =
    chainFundMeAddresses[chainFundMeAddresses.length - 1];

  if (!chainFundMeAddress) {
    console.error("ChainFundMe address not found");
    return;
  }

  const ChainFundMe = await ethers.getContractAt(
    "ChainFundMe",
    chainFundMeAddress
  );

  const approved = await ChainFundMe.fundingApproved();
  const limitsEnabled = await CapitaFundingFactory.limitsEnabled();
  console.log({ approved, limitsEnabled });

  const amount = ethers.parseEther("0.01");
  const usdcAmount = ethers.parseUnits("5", 6);
  // approve funding
  if (!approved && limitsEnabled) {
    console.log("Approving funding...");
    const tx = await CapitaFundingFactory.chainFundMe_approveFunding(
      chainFundMeAddress
    );
    await tx.wait();
    console.log("Funding approved");
    await sleep(5000); // wait for 5 seconds
  }

  // approve chainFundME to transfer usdc
  console.log(
    `Approving chainFundMe contract at -> ${chainFundMeAddress} to spend ${ethers.formatUnits(
      usdcAmount,
      6
    )} of USDC`
  );
  const USDC = await ethers.getContractAt("IERC20", USDCAddress, owner);

  await USDC.approve(chainFundMeAddress, usdcAmount);
  console.log(
    ethers.formatUnits(await USDC.balanceOf(owner.address), 6),
    owner.address
  );

  // fund the campaign
  console.log(`Funding ChainFundMe campaign at address ${chainFundMeAddress}`);
  await CapitaFundingFactory.chainFundMe_fundChainFundMe(
    chainFundMeAddress,
    USDCAddress,
    usdcAmount
  );

  console.log(
    `ChainFundMe campaign at address ${chainFundMeAddress} funded successfully with ${ethers.formatEther(
      amount
    )} ETH`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
