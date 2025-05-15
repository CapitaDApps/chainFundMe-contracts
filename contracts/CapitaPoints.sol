// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {PriceFeed} from "./lib/PriceFeed.sol";
import {AccessControl} from "./AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CapitaPoints is AccessControl, ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error CapitaPoints__NotFactory();
    error CapitaPoints__NotOwner();
    error CapitaPoints__InsufficientETHForTier();
    error CapitaPoints__MultiplierTierAlreadyOwned();
    error CapitaPoints__InvalidAddress();
    error CapitaPoints__Paused();

    /*//////////////////////////////////////////////////////////////
                                LIBRARY
    //////////////////////////////////////////////////////////////*/

    using PriceFeed for uint256;

    /*//////////////////////////////////////////////////////////////
                           ENUMS AND STRUCTS
    //////////////////////////////////////////////////////////////*/

    enum MultiplierTier {
        BASE,
        BRONZE,
        SILVER,
        GOLD,
        PLATINUM,
        DIAMOND
    }

    struct MultiplierInfo {
        uint256 multiplierPrice; // Price in USD (wei)
        uint32 multiplier; // Multiplier value
    }

    struct SpenderStatus {
        MultiplierTier multiplierTier;
        uint32 multiplier;
    }

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    uint256 private constant BASE_TIER_PRICE = 0;
    uint32 private constant BASE_TIER_MULTIPLIER = 1;

    uint256 private constant BRONZE_TIER_PRICE = 10 ether; // 10USD in wei
    uint32 private constant BRONZE_TIER_MULTIPLIER = 5;

    uint256 private constant SILVER_TIER_PRICE = 30 ether;
    uint32 private constant SILVER_TIER_MULTIPLIER = 10;

    uint256 private constant GOLD_TIER_PRICE = 50 ether;
    uint32 private constant GOLD_TIER_MULTIPLIER = 15;

    uint256 private constant PLATINUM_TIER_PRICE = 70 ether;
    uint32 private constant PLATINUM_TIER_MULTIPLIER = 20;

    uint256 private constant DIAMOND_TIER_PRICE = 90 ether;
    uint32 private constant DIAMOND_TIER_MULTIPLIER = 25;

    uint256 public constant BASE_POINTS = 100 ether; // 10 points in wei

    AggregatorV3Interface public immutable priceFeedAddress;

    address public fundingFactoryAddress;

    bool public paused;

    mapping(address => uint256) public spenderToPointsEarned;
    mapping(address => SpenderStatus) public spenderStatus;
    mapping(MultiplierTier => MultiplierInfo) private multiplierTierInfo;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event PurchaseMultiplier(
        address indexed spender,
        MultiplierTier indexed multiplierTier,
        uint256 pricePaid,
        uint256 multiplier
    );

    event PointsMinted(address indexed spender, uint256 amountEarned);
    event MultiplierPriceUpdated(MultiplierTier indexed tier, uint256 newPrice);
    event MultiplierUpdated(MultiplierTier indexed tier, uint256 multiplier);
    event MultiplierInfoUpdated(
        MultiplierTier indexed tier,
        uint256 multiplier,
        uint256 newPrice
    );

    event NewFundingFactoryAddress(address indexed newFundingFactoryAddress);
    event Paused(bool isPaused);

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyFactory() {
        if (msg.sender != fundingFactoryAddress && msg.sender != address(this))
            revert CapitaPoints__NotFactory();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert CapitaPoints__Paused();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                               FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    constructor(
        address _fundingFactoryAddress,
        address _priceFeedAddress
    ) AccessControl(msg.sender) {
        if (
            _priceFeedAddress == address(0) ||
            _fundingFactoryAddress == address(0)
        ) revert CapitaPoints__InvalidAddress();
        priceFeedAddress = AggregatorV3Interface(_priceFeedAddress);
        fundingFactoryAddress = _fundingFactoryAddress;

        // Initialize multiplier tiers with prices and values
        updateMultiplierTierInfo(
            MultiplierTier.BASE,
            BASE_TIER_PRICE,
            BASE_TIER_MULTIPLIER
        );
        updateMultiplierTierInfo(
            MultiplierTier.BRONZE,
            BRONZE_TIER_PRICE,
            BRONZE_TIER_MULTIPLIER
        );
        updateMultiplierTierInfo(
            MultiplierTier.SILVER,
            SILVER_TIER_PRICE,
            SILVER_TIER_MULTIPLIER
        );
        updateMultiplierTierInfo(
            MultiplierTier.GOLD,
            GOLD_TIER_PRICE,
            GOLD_TIER_MULTIPLIER
        );
        updateMultiplierTierInfo(
            MultiplierTier.PLATINUM,
            PLATINUM_TIER_PRICE,
            PLATINUM_TIER_MULTIPLIER
        );
        updateMultiplierTierInfo(
            MultiplierTier.DIAMOND,
            DIAMOND_TIER_PRICE,
            DIAMOND_TIER_MULTIPLIER
        );
    }

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function purchaseMultiplier(
        MultiplierTier _multiplierTier
    ) external payable whenNotPaused nonReentrant {
        address sender = msg.sender;
        MultiplierInfo memory selectedMultiplier = multiplierTierInfo[
            _multiplierTier
        ];

        SpenderStatus memory spender = spenderStatus[sender];

        // Ensure spender does not already own this multiplier
        if (_multiplierTier == spender.multiplierTier) {
            revert CapitaPoints__MultiplierTierAlreadyOwned();
        }

        // Convert ETH to USD and check if enough was sent
        uint256 amount = msg.value;
        uint256 amountToUsd = amount.ethToUsd(priceFeedAddress);
        uint256 priceInUsd = selectedMultiplier.multiplierPrice;

        if (amountToUsd < priceInUsd) {
            revert CapitaPoints__InsufficientETHForTier();
        }

        uint256 priceInEth = priceInUsd.usdToEth(priceFeedAddress);
        if (amount > priceInEth) {
            (bool success, ) = payable(sender).call{value: amount - priceInEth}(
                ""
            );
        }

        // Update spender's multiplier
        spenderStatus[sender] = SpenderStatus({
            multiplierTier: _multiplierTier,
            multiplier: selectedMultiplier.multiplier
        });

        // mint required amount of tokens for tier
        mintPointsETH(sender, amount);

        emit PurchaseMultiplier(
            sender,
            _multiplierTier,
            amountToUsd,
            selectedMultiplier.multiplier
        );
    }

    function updateMultiplierPrice(
        MultiplierTier _multiplierTier,
        uint256 _priceInUSD
    ) external onlyOwner {
        multiplierTierInfo[_multiplierTier].multiplierPrice = _priceInUSD;
        emit MultiplierPriceUpdated(_multiplierTier, _priceInUSD);
    }

    function updateMultiplier(
        MultiplierTier _multiplierTier,
        uint32 _multiplier
    ) external onlyOwner {
        multiplierTierInfo[_multiplierTier].multiplier = _multiplier;
        emit MultiplierUpdated(_multiplierTier, _multiplier);
    }

    function updateFundingFactoryAddress(
        address _newFactoryAddress
    ) external onlyOwner {
        fundingFactoryAddress = _newFactoryAddress;
        emit NewFundingFactoryAddress(_newFactoryAddress);
    }

    function pause(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    function mintPoints(
        address _spender,
        uint256 amount
    ) external whenNotPaused onlyFactory {
        uint256 multiplier = getSpenderMultiplier(_spender);
        spenderToPointsEarned[_spender] += amount * multiplier;
        emit PointsMinted(_spender, amount);
    }

    /*//////////////////////////////////////////////////////////////
                            PUBLIC FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function mintPointsETH(
        address _spender,
        uint256 amountSpent
    ) public whenNotPaused onlyFactory {
        uint256 amountSpendInUsd = amountSpent.ethToUsd(priceFeedAddress);
        uint256 pointsReceived = calAmountPoints(amountSpendInUsd);
        uint256 multiplier = getSpenderMultiplier(_spender);
        spenderToPointsEarned[_spender] += pointsReceived * multiplier;

        emit PointsMinted(_spender, pointsReceived);
    }

    function mintPointsUSD(
        address _spender,
        uint256 amountSpent
    ) external whenNotPaused onlyFactory {
        uint256 pointsReceived = calAmountPoints(amountSpent);
        uint256 multiplier = getSpenderMultiplier(_spender);
        spenderToPointsEarned[_spender] += pointsReceived * multiplier;

        emit PointsMinted(_spender, pointsReceived);
    }

    function updateMultiplierTierInfo(
        MultiplierTier _multiplierTier,
        uint256 _priceInUSD,
        uint32 _multiplier
    ) public onlyOwner {
        multiplierTierInfo[_multiplierTier] = MultiplierInfo({
            multiplier: _multiplier,
            multiplierPrice: _priceInUSD
        });

        emit MultiplierInfoUpdated(_multiplierTier, _multiplier, _priceInUSD);
    }

    function calAmountPoints(
        uint256 _amountSpentInUSD
    ) public pure returns (uint256) {
        return (_amountSpentInUSD * BASE_POINTS) / 1e18;
    }

    /*//////////////////////////////////////////////////////////////
                            GETTER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getMultiplierInfo(
        MultiplierTier _tier
    ) external view returns (MultiplierInfo memory) {
        return multiplierTierInfo[_tier];
    }

    function getMultiplierTierPrice(
        MultiplierTier _tier
    ) external view returns (uint256) {
        return multiplierTierInfo[_tier].multiplierPrice;
    }

    function getMultiplierTierMultiplier(
        MultiplierTier _tier
    ) external view returns (uint32) {
        return multiplierTierInfo[_tier].multiplier;
    }

    function getSpenderPoints(
        address _spender
    ) external view returns (uint256) {
        return spenderToPointsEarned[_spender];
    }

    function getSpenderStatus(
        address _spender
    ) external view returns (SpenderStatus memory) {
        return spenderStatus[_spender];
    }

    function getSpenderMultiplier(
        address _spender
    ) public view returns (uint32) {
        if (spenderStatus[_spender].multiplier == 0) {
            return BASE_TIER_MULTIPLIER;
        } else {
            return spenderStatus[_spender].multiplier;
        }
    }
}
