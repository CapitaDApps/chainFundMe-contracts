import fs from "fs";

export type Networks =
  | "base"
  | "sepolia"
  | "local"
  | "baseSepolia"
  | "bnb"
  | "bnbTestnet"
  | "optimism"
  | "optimismSepolia"
  | "lisk"
  | "liskSepolia"
  | "celo"
  | "celoAlfajores"

type NetworkType = {
  [key in Networks]: {
    priceFeedAddress?: string;
    usdc?: string;
    usdt?: string;
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

  bnb: {
    priceFeedAddress: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE",
    usdt: "0x55d398326f99059ff775485246999027b3197955",
  },

  bnbTestnet: {
    priceFeedAddress: "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526",
    usdc: "0x78867a66e085417e085d75ee0336fbf1d3e4e97c",
  },

  optimism: {
    priceFeedAddress: "0x0D276FC14719f9292D5C1eA2198673d1f4269246",
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  },

  optimismSepolia: {
    priceFeedAddress: "0x8907a105E562C9F3d7F2ed46539Ae36D87a15590",
    usdc: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
  },

  lisk: {
    priceFeedAddress: "0xac485391EB2d7D88253a7F1eF18C37f4242D1A24",
    usdt: "0x05D032ac25d322df992303dCa074EE7392C117b9",
  },

  liskSepolia: {
    priceFeedAddress: "0x8a21CF9Ba08Ae709D64Cb25AfAA951183EC9FF6D",
    usdt: "0x2728DD8B45B788e26d12B13Db5A244e5403e7eda",
  },

  celo: {
    priceFeedAddress: "0x0568fD19986748cEfF3301e55c0eb1E729E0Ab7e",
    usdc: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
  },

  celoAlfajores: {
    priceFeedAddress: "0x022F9dCC73C5Fb43F2b4eF2EF9ad3eDD1D853946",
    usdc: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B",
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
