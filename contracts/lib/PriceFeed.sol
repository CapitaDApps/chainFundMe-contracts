// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "hardhat/console.sol";

library PriceFeed {
    error Stale_Price();
    error Invalid_Price();

    function ethToUsd(
        uint256 ethAmount,
        AggregatorV3Interface dataFeed
    ) internal view returns (uint256) {
        uint256 ethPriceInUsd = getChainlinkDataFeedLatestAnswer(dataFeed);
        uint256 ethAmountInUsd = ((ethPriceInUsd) * ethAmount) / 10 ** 18;

        return ethAmountInUsd;
    }

    function usdToEth(
        uint256 usdAmount,
        AggregatorV3Interface dataFeed
    ) internal view returns (uint256) {
        uint256 ethPriceInUsd = getChainlinkDataFeedLatestAnswer(dataFeed);

        uint256 usdAmountInEth = (usdAmount / (ethPriceInUsd)) * 10 ** 18;

        return usdAmountInEth;
    }

    /**
     * Returns the latest answer.
     */
    function getChainlinkDataFeedLatestAnswer(
        AggregatorV3Interface dataFeed
    ) internal view returns (uint256) {
        // prettier-ignore
        (
            /* uint80 roundID */,
            int answer,
            /*uint startedAt*/,
            uint timeStamp,
            /*uint80 answeredInRound*/
        ) = dataFeed.latestRoundData();

        if (timeStamp < (block.timestamp - 2 hours)) revert Stale_Price();
        if (answer <= 0) revert Invalid_Price();
        return (uint256(answer) * 10 ** 10);
    }
}
