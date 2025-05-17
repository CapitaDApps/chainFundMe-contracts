import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ignition-ethers";
import dotenv from "dotenv";
// import "hardhat-gas-reporter";
dotenv.config();

const alchemyEndpointKey = process.env.ALCHEMY_ENDPOINT_KEY || "";
const coinmarketcapAPIKey = process.env.COINMARKETCAP_API_KEY || "";
const etherscanAPIKey = process.env.ETHERSCAN_API_KEY || "";
const privateKey = process.env.PRIVATE_KEY || "";

const settings = {
  optimizer: {
    enabled: true,
    runs: 200,
  },
};
const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.5.16",
        settings,
      },
      { version: "0.6.6", settings },
      { version: "0.8.0", settings },
      { version: "0.8.20", settings },
    ],
  },

  // defaultNetwork: "local",
  networks: {
    // hardhat: {
    //   forking: {
    //     url: `https://base-mainnet.g.alchemy.com/v2/${alchemyEndpointKey}`,
    //   },
    // },

    base: {
      url: `https://base-mainnet.g.alchemy.com/v2/${alchemyEndpointKey}`,
      accounts: [privateKey],
    },

    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${alchemyEndpointKey}`,
      accounts: [privateKey],
      gas: 4000000,
    },

    baseSepolia: {
      url: `https://base-sepolia.g.alchemy.com/v2/${alchemyEndpointKey}`,
      gas: 5000000,
      accounts: [privateKey],
    },

    local: {
      url: "http://127.0.0.1:8545",
    },
  },

  gasReporter: {
    enabled: false,
    currency: "USD",
    L2: "base",
    coinmarketcap: coinmarketcapAPIKey,
    L1Etherscan: etherscanAPIKey,
  },

  etherscan: {
    apiKey: {
      sepolia: etherscanAPIKey,
      baseSepolia: process.env.BASE_SEPOLIA_KEY,
      base: process.env.BASE_SEPOLIA_KEY,
    },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
    ],
  },
};
export default config;
