import { ethers, network } from "hardhat";
import { getDeployedAddress, Networks } from "../lib/config";

async function main() {
  const net = network.name as Networks;

  const capitaFactoryData = getDeployedAddress(
    net,
    "capita-factory-baseSepolia"
  );

  if (!capitaFactoryData) {
    console.error("CapitaFundingFactory contract not found");
    return;
  }

  const CapitaFundingFactory = await ethers.getContractAt(
    "CapitaFundingFactory",
    capitaFactoryData["CapitaFundingFactory#CapitaFundingFactory"]
  );

  const campaignAddress = "0x8889E3bF33C33BE7b8b8076337fC30D8614CAd2b";
  // Delete campaign
  await CapitaFundingFactory.deleteCampaignByAddress(campaignAddress);
  console.log(`Deleting campaign ${campaignAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
