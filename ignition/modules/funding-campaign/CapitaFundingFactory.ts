import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import { ethers, network } from "hardhat";

import { Networks, networks, getDeployedAddress } from "../../../lib/config";

export default buildModule("CapitaFundingFactory", (m) => {
  const net = network.name as Networks;
  const stableToken = networks[net].usdc;

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
    "0x23e8f85cCE1332E3df6dCD27cd5BAF950c35e663",
  ]);

  return { CapitaFundingFactory };
});
