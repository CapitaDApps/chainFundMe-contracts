import { ethers, network } from "hardhat";
import { getDeployedAddress, networks, Networks } from "../lib/config";

async function main() {
  const net = network.name as Networks;
  const capitaFactory = getDeployedAddress(net, "capita-factory");
  const usdc = networks[net].usdc;

  const CapitaFundingFactory = await ethers.getContractAt(
    "CapitaFundingFactory",
    capitaFactory["CapitaFundingFactory#CapitaFundingFactory"]
  );
  if (!CapitaFundingFactory) {
    console.error("CapitaFundingFactory contract not found");
    return;
  }

  await CapitaFundingFactory.setAcceptableToken(usdc);
  console.log(
    `Acceptable token set to ${usdc} in CapitaFundingFactory contract`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
