import { ethers, network } from "hardhat";
import { getDeployedAddress, Networks } from "../lib/config";

async function main() {
  const net = network.name as Networks;
  const capitaFactory = getDeployedAddress(net, "capita-factory");

  const [owner] = await ethers.getSigners();

  const CapitaFundingFactory = await ethers.getContractAt(
    "CapitaFundingFactory",
    capitaFactory["CapitaFundingFactory#CapitaFundingFactory"],
    owner
  );

  if (!CapitaFundingFactory) {
    console.error("CapitaFundingFactory contract not found");
    return;
  }

  const startTime = Math.floor(Date.now() / 1000 + 30);
  const endTime = startTime + 60 * 60 * 24 * 30;

  console.log(
    `Creating ChainFundMe campaign with start time ${startTime} and end time ${endTime}`
  );

  await CapitaFundingFactory.createChainFundMe(
    startTime,
    endTime,
    "bafkreigta7p3yeoj73xexx2btgzfjki4wwritbxn575m46wmbml3xxrt7q",
    []
  );

  console.log(
    `ChainFundMe campaign created with start time ${startTime} and end time ${endTime}`
  );
}
main().catch((error) => {
  console.log(error);
  process.exitCode = 1;
});
