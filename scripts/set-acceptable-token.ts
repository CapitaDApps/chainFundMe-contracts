import { ethers, network } from "hardhat";
import { getDeployedAddress, networks, Networks } from "../lib/config";

async function main() {
  const net = network.name as Networks;
  const capitaFactory = getDeployedAddress(net, "capita-factory-mainnet-4");

  const token = "0x46C85152bFe9f96829aA94755D9f915F9B10EF5F";

  if (!capitaFactory) {
    console.error("CapitaFundingFactory contract not found");
    return;
  }
  const factoryAddress =
    capitaFactory["CapitaFundingFactory#CapitaFundingFactory"];

  const CapitaFundingFactory = await ethers.getContractAt(
    "CapitaFundingFactory",
    factoryAddress
  );

  await CapitaFundingFactory.setAcceptableToken(token);
  console.log(
    `Acceptable token set to ${token} in CapitaFundingFactory contract ${factoryAddress}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
