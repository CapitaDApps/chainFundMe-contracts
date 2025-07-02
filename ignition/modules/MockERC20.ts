import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers, network } from "hardhat";
import { getDeployedAddress, Networks } from "../../lib/config";

export default buildModule("MockERC20", (m) => {
  const token = m.contract("MockERC20", [
    "MockERC20",
    "ME20",
    ethers.parseEther("10000000"),
    18,
  ]);

  return { token };
});
