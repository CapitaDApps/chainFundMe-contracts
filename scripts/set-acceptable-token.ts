import { ethers, network } from "hardhat";
import { getDeployedAddress, networks, Networks } from "../lib/config";

async function main() {
  const net = network.name as Networks;
  const capitaFactory = getDeployedAddress(net, "capita-factory-baseSepolia");

  const token = "0xc3184FC54B029cfDF86D1Cc393EF9626Cbe270E5";

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
