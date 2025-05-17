import { ethers, network } from "hardhat";
import { getDeployedAddress, Networks } from "../lib/config";

async function main() {
  const net = network.name as Networks;
  const capitaFactory = getDeployedAddress(net, "capita-factory-mainnet");

  const [owner] = await ethers.getSigners();

  if (!capitaFactory) throw new Error("No factory found");

  const CapitaFundingFactory = await ethers.getContractAt(
    "CapitaFundingFactory",
    capitaFactory["CapitaFundingFactory#CapitaFundingFactory"],
    owner
  );

  const chainFundMeAddresses =
    await CapitaFundingFactory.getDeployedCampaigns();
  const chainFundMeAddress =
    chainFundMeAddresses[chainFundMeAddresses.length - 2];

  if (!chainFundMeAddress) {
    console.error("ChainFundMe address not found");
    return;
  }

  const ChainFundMe = await ethers.getContractAt(
    "ChainFundMe",
    chainFundMeAddress
  );

  const funders = await ChainFundMe.getFundersDetails();
  console.log("Funders: ", funders);

  // points
  const capitaPoints = await ethers.getContractAt(
    "CapitaPoints",
    await CapitaFundingFactory.capitaPoints()
  );

  const pointsEarned = await capitaPoints.getSpenderPoints(
    funders[0].funderAddress
  );
  console.log("Points earned: ", ethers.formatEther(pointsEarned.toString()));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
