import { ethers, network } from "hardhat";
import { getDeployedAddress, Networks } from "../lib/config";

async function main() {
  const net = network.name as Networks;
  const capitaPointsData = getDeployedAddress(net, "capita-points-mainnet");
  const capitaFactoryData = getDeployedAddress(net, "capita-factory-mainnet");

  if (!capitaPointsData) {
    console.error("CapitaPoints not found");
    return;
  }
  const capitaPointsAddress = capitaPointsData["CapitaPoints#CapitaPoints"];

  const [owner] = await ethers.getSigners();

  if (!capitaFactoryData) {
    console.error("CapitaFundingFactory contract not found");
    return;
  }

  const CapitaFundingFactory = await ethers.getContractAt(
    "CapitaFundingFactory",
    capitaFactoryData["CapitaFundingFactory#CapitaFundingFactory"],
    owner
  );

  if (!capitaPointsAddress) {
    console.error("CapitaPoints address not found");
    return;
  }
  console.log(`Setting CapitaPoints address to ${capitaPointsAddress}`);

  // Set the CapitaPoints address in the CapitaFundingFactory contract
  await CapitaFundingFactory.setCapitaPointsAddress(capitaPointsAddress);
  console.log(`CapitaPoints address set to ${capitaPointsAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
