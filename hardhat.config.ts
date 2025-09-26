import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ignition-ethers";
import dotenv from "dotenv";
// import "hardhat-gas-reporter";
dotenv.config();

const alchemyEndpointKey = process.env.ALCHEMY_ENDPOINT_KEY || "";
const coinmarketcapAPIKey = process.env.COINMARKETCAP_API_KEY || "";
const etherscanAPIKey = process.env.ETHERSCAN_API_KEY || "";
const privateKey =
  process.env.PRODUCTION == "false"
    ? process.env.PRIVATE_KEY_2
    : process.env.PRIVATE_KEY;

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
      { version: "0.4.18", settings },
    ],
  },

  // defaultNetwork: "local",
  networks: {
    hardhat: {
      forking: {
        url: `https://base-mainnet.g.alchemy.com/v2/${alchemyEndpointKey}`,
      },
    },

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
      gas: 500000000,
      accounts: [privateKey],
    },

    bnbTestnet: {
      url: `https://bnb-testnet.g.alchemy.com/v2/${alchemyEndpointKey}`,
      accounts: [privateKey],
    },

    bnbMainnet: {
      url: `https://bnb-mainnet.g.alchemy.com/v2/${alchemyEndpointKey}`,
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
      baseSepolia: process.env.BASESCAN_API_KEY,
      base: process.env.BASESCAN_API_KEY,
      bnbTestnet: process.env.BSCSCAN_API_KEY,
      bnbMainnet: process.env.BSCSCAN_API_KEY,
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
      {
        network: "bnbTestnet",
        chainId: 97,
        urls: {
          apiURL: "https://api-testnet.bscscan.com/api",
          browserURL: "https://testnet.bscscan.com",
        },
      },
      {
        network: "bnbMainnet",
        chainId: 56,
        urls: {
          apiURL: "https://api.bscscan.com/api",
          browserURL: "https://bscscan.com",
        },
      },
    ],
  },
};
export default config;
