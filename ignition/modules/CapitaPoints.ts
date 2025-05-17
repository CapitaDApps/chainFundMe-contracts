import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { network } from "hardhat";
import { Networks, getDeployedAddress, networks } from "../../lib/config";

export default buildModule("CapitaPoints", (m) => {
  const net = network.name as Networks;
  const priceFeedAddress = networks[net].priceFeedAddress;

  const capitaFactoryData = getDeployedAddress(net, "capita-factory-mainnet");

  if (!capitaFactoryData) {
    throw new Error("CapitaFundingFactory not found");
  }

  const capitaPoints = m.contract("CapitaPoints", [
    capitaFactoryData["CapitaFundingFactory#CapitaFundingFactory"],
    priceFeedAddress,
  ]);
  return { capitaPoints };
});
