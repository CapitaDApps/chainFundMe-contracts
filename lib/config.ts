import fs from "fs";

export type Networks = "base" | "sepolia" | "local" | "baseSepolia";

type NetworkType = {
  [key in Networks]: {
    priceFeedAddress?: string;
    usdc?: string;
  };
};

export const networks: NetworkType = {
  base: {
    priceFeedAddress: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  baseSepolia: {
    priceFeedAddress: "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
  sepolia: {
    priceFeedAddress: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  },
  local: {
    priceFeedAddress: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
};

export function getDeployedAddress(network: Networks, deploymentId: string) {
  try {
    const data = fs.readFileSync(
      `ignition/deployments/${deploymentId}/deployed_addresses.json`
    );

    const content = JSON.parse(data.toString());
    return content;
  } catch (error) {
    return null;
  }
}
