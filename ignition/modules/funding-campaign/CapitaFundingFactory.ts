import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import { ethers, network } from "hardhat";

import { Networks, networks, getDeployedAddress } from "../../../lib/config";

export default buildModule("CapitaFundingFactory", (m) => {
  const net = network.name as Networks;
  const stableToken = networks[net].usdc;
  const priceFeedAddress = networks[net].priceFeedAddress;
  console.log({ net });

  const capitaTokenData = getDeployedAddress(net as Networks, "capita-token");

  if (!stableToken) {
    throw new Error("Stable token address not found");
  }

  const CapitaFundingFactory = m.contract("CapitaFundingFactory", [
    stableToken,
    capitaTokenData
      ? capitaTokenData["CapitaToken#CapitaToken"]
      : ethers.ZeroAddress,
    "0xcB5ECcdC62091DeA21E06cE41783ECd867DCEdbd",
    priceFeedAddress,
  ]);

  return { CapitaFundingFactory };
});
