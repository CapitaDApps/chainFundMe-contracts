// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ICapitaFundingFactory} from "./interfaces/ICapitaFundingFactory.sol";
import {PriceFeed} from "./lib/PriceFeed.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract ChainFundMe is Initializable {
    using PriceFeed for uint256;

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error ChainFundMe__NotFactory();
    error ChainFundMe__NotOwner();
    error ChainFundMe__FundingPeriodOver();
    error ChainFundMe__FundingPeriodNotStarted();
    error ChainFundMe__FundingStillActive();
    error ChainFundMe__AlreadyApproved();
    error ChainFundMe__NotApproved();
    error ChainFundMe__WithdrawFailed();
    error ChainFundMe__TokenNotAllowed();
    error ChainFundMe__TokenTransferFailed();
    error ChainFundMe__ValueSentNotEqualAmount();
    error ChainFundMe__FundingPaused();
    error ChainFundMe__FeeTransferFailed_Token();
    error ChainFundMe__FeeTransferFailed_ETH();
    error ChainFundMe__InvalidAmount();
    error ChainFundMe__FundingNotApproved();
    error ChainFundMe__FundingDisapproved();
    error ChainFundMe__FundingLimitExceeded();

    /*//////////////////////////////////////////////////////////////
                                STRUCTS
    //////////////////////////////////////////////////////////////*/

    struct Funder {
        address funderAddress;
        address tokenAddress;
        uint256 amount;
    }

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    uint256 public startTime;
    uint256 public endTime;

    bool public isWithdrawApproved;
    bool public isWithdrawalPointsMinted;
    bool public withdrawalApprovalRevoked;
    bool public fundingApproved;
    bool public fundingDisapproved;
    bool public ended;

    string public campaignMetadataUri;

    address public owner;
    address public stableCoinAddress;
    address public capitaTokenAddress;
    address[] public otherAcceptableTokens;

    address public fundingFactoryAddress;

    bool public isPaused;
    uint256 public fundersCount;

    mapping(address => mapping(address => uint256))
        public otherTokenContribution; // funder -> token -> amount funded
    mapping(address => uint256) public ethContribution;
    mapping(uint256 => Funder) public allFunders; // index -> funder -> funded

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event Deposited(
        address indexed funder,
        address indexed otherToken,
        uint256 amount
    );
    event WithdrawApproved();
    event WithdrawnETH(address indexed owner, uint256 amount);
    event WithdrawnToken(
        address indexed toAddress,
        uint256 amount,
        address tokenAddress
    );
    event Paused(bool paused);
    event FailedOtherTokensWithdrawal(address[] otherTokensAddresses);
    event ApprovalRevoked(bool indexed revoked);
    event FundingApproved(bool isApproved);
    event FundingDisapproved(bool isDisapproved);
    event EndedCampaign(bool isEnded);

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOwner() {
        if (msg.sender != owner) revert ChainFundMe__NotOwner();
        _;
    }

    modifier campaignStarted() {
        if (block.timestamp < startTime)
            revert ChainFundMe__FundingPeriodNotStarted();
        _;
    }

    modifier campaignNotOver() {
        if (block.timestamp > endTime || ended)
            revert ChainFundMe__FundingPeriodOver();
        _;
    }

    modifier campaignNotInProgress() {
        if (block.timestamp > startTime && block.timestamp < endTime)
            revert ChainFundMe__FundingStillActive();
        _;
    }

    modifier onlyFactory() {
        if (msg.sender != fundingFactoryAddress)
            revert ChainFundMe__NotFactory();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                               FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        uint256 _startTime,
        uint256 _endTime,
        string memory _campaignMetadataUri,
        address _stableCoinAddress,
        address _capitaTokenAddress,
        address[] memory _otherAcceptableTokens,
        address _fundingFactoryAddress
    ) external initializer {
        owner = _owner;
        startTime = _startTime;
        endTime = _endTime;
        campaignMetadataUri = _campaignMetadataUri;

        stableCoinAddress = _stableCoinAddress;
        capitaTokenAddress = _capitaTokenAddress;
        otherAcceptableTokens = _otherAcceptableTokens;

        fundingFactoryAddress = _fundingFactoryAddress;
    }

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function deposit(
        address _anotherToken,
        uint256 _amount,
        address _contributor
    ) external payable campaignStarted campaignNotOver onlyFactory {
        ICapitaFundingFactory capitaFundingFactory = ICapitaFundingFactory(
            fundingFactoryAddress
        );
        uint8 platformFee = capitaFundingFactory.platformFee();
        address feeWallet = capitaFundingFactory.feeWalletAddress();
        bool verified = capitaFundingFactory.verifiedCreators(owner);

        if (isPaused) revert ChainFundMe__FundingPaused();

        bool limitsEnabled = getLimitsEnabled();

        if (limitsEnabled) {
            if (!fundingApproved) revert ChainFundMe__FundingNotApproved();
            if (fundingDisapproved) revert ChainFundMe__FundingDisapproved();
        }

        if (!verified) {
            address priceFeedAddress = capitaFundingFactory.priceFeedAddress();
            uint256 unverifiedFundLimit = capitaFundingFactory
                .unverifiedFundLimit();
            uint256 usdcBalance = IERC20(stableCoinAddress).balanceOf(
                address(this)
            ) * 1e12; // convert balance from 6 decimals to 18
            uint256 ethToUsdBalance = address(this).balance.ethToUsd(
                AggregatorV3Interface(priceFeedAddress)
            );

            if (_anotherToken != address(0)) {
                usdcBalance += _amount * 1e12; // convert balance from 6 decimals to 18;
            }

            uint256 totalCurrentlyFunded = ethToUsdBalance + usdcBalance;
            if (totalCurrentlyFunded > unverifiedFundLimit)
                revert ChainFundMe__FundingLimitExceeded();
        }

        address tokenUsedForFunding;

        if (_anotherToken != address(0)) {
            // deposit with the token
            if (_amount <= 0) revert ChainFundMe__InvalidAmount();
            if (
                _anotherToken != stableCoinAddress &&
                _anotherToken != capitaTokenAddress &&
                !checkTokenAddress(_anotherToken)
            ) revert ChainFundMe__TokenNotAllowed();

            IERC20 token = IERC20(_anotherToken);
            bool success = token.transferFrom(
                _contributor,
                address(this),
                _amount
            );

            if (!success) revert ChainFundMe__TokenTransferFailed();

            // withdraw fees
            uint256 feeInOtherTokens = (_amount * platformFee) / 100;
            if (feeInOtherTokens > 0) {
                token.transfer(feeWallet, feeInOtherTokens);
            }

            tokenUsedForFunding = _anotherToken;

            // update funded amount
            otherTokenContribution[_contributor][_anotherToken] += _amount;
        } else {
            // deposit eth
            uint256 fundAmount = msg.value;
            if (fundAmount <= 0) revert ChainFundMe__InvalidAmount();
            if (_amount != fundAmount)
                revert ChainFundMe__ValueSentNotEqualAmount();

            // withdraw fee
            uint256 feeInEth = (fundAmount * platformFee) / 100;
            (bool success, ) = payable(feeWallet).call{value: feeInEth}("");
            if (!success) revert ChainFundMe__FeeTransferFailed_ETH();

            tokenUsedForFunding = address(0);
            // update funded amount
            ethContribution[_contributor] += fundAmount;
        }

        allFunders[fundersCount] = Funder({
            funderAddress: _contributor,
            tokenAddress: tokenUsedForFunding,
            amount: _amount
        });
        fundersCount++;

        emit Deposited(_contributor, tokenUsedForFunding, _amount);
    }

    function approveWithdraw()
        external
        campaignStarted
        campaignNotInProgress
        onlyFactory
    {
        if (isWithdrawApproved) revert ChainFundMe__AlreadyApproved();

        isWithdrawApproved = true;
        ended = true;
        emit WithdrawApproved();
    }

    function revokeApproval(bool _approvalRevoked) external onlyFactory {
        withdrawalApprovalRevoked = _approvalRevoked;
        emit ApprovalRevoked(_approvalRevoked);
    }

    function withdrawETH() external onlyFactory {
        bool limitsEnabled = getLimitsEnabled();
        if (limitsEnabled) {
            if (!isWithdrawApproved || withdrawalApprovalRevoked)
                revert ChainFundMe__NotApproved();
        }
        uint256 balance = address(this).balance;

        (bool success, ) = payable(owner).call{value: balance}("");
        if (!success) revert ChainFundMe__WithdrawFailed();

        emit WithdrawnETH(owner, balance);
    }

    function withdrawOtherTokens() external onlyFactory {
        bool limitsEnabled = getLimitsEnabled();
        if (limitsEnabled) {
            if (!isWithdrawApproved || withdrawalApprovalRevoked)
                revert ChainFundMe__NotApproved();
        }

        address[] memory tempArray = new address[](
            otherAcceptableTokens.length
        );
        uint256 failureCount = 0;
        for (uint256 i = 0; i < otherAcceptableTokens.length; i++) {
            address otherTokenAddress = (otherAcceptableTokens[i]);
            (
                bool otherToken_success,
                uint256 otherToken_transferred_amount,
                address otherToken_sentTo
            ) = _tokenTransfer(otherTokenAddress);

            if (otherToken_transferred_amount > 0) {
                if (!otherToken_success) {
                    tempArray[failureCount] = otherTokenAddress;
                    failureCount++;
                } else {
                    emit WithdrawnToken(
                        otherToken_sentTo,
                        otherToken_transferred_amount,
                        otherTokenAddress
                    );
                }
            }
        }
        if (failureCount > 0) {
            address[] memory failedTokens = new address[](failureCount);
            for (uint256 j = 0; j < failureCount; j++) {
                failedTokens[j] = tempArray[j];
            }
            emit FailedOtherTokensWithdrawal(failedTokens);
        }

        if (stableCoinAddress != address(0)) {
            (
                bool stable_success,
                uint256 stable_transferred_amount,
                address stable_sentTo
            ) = _tokenTransfer(stableCoinAddress);
            if (stable_transferred_amount > 0) {
                if (!stable_success) revert ChainFundMe__WithdrawFailed();
                emit WithdrawnToken(
                    stable_sentTo,
                    stable_transferred_amount,
                    stableCoinAddress
                );
            }
        }
        if (capitaTokenAddress != address(0)) {
            (
                bool capita_success,
                uint256 capita_transferred_amount,
                address capita_sentTo
            ) = _tokenTransfer(capitaTokenAddress);
            if (capita_transferred_amount > 0) {
                if (!capita_success) revert ChainFundMe__WithdrawFailed();
                emit WithdrawnToken(
                    capita_sentTo,
                    capita_transferred_amount,
                    capitaTokenAddress
                );
            }
        }
    }

    function endCampaign() external campaignStarted campaignNotOver onlyOwner {
        ended = true;
        endTime = block.timestamp;
        emit EndedCampaign(ended);
    }

    function updateEndTime(
        uint256 _endTime
    ) external campaignNotOver onlyOwner {
        endTime = _endTime;
    }

    function updateStartTime(
        uint256 _startTime
    ) external campaignNotInProgress campaignNotOver onlyOwner {
        startTime = _startTime;
    }

    function updatePause(bool pause) external onlyFactory {
        isPaused = pause;
        emit Paused(pause);
    }

    function updateMetadataURI(
        string memory _uri
    ) external campaignNotOver onlyOwner {
        campaignMetadataUri = _uri;
    }

    function updateFundingApproval() external onlyFactory {
        fundingApproved = true;
        emit FundingApproved(true);
    }

    function updateFundingDisapproval(bool disapproved) external onlyFactory {
        fundingDisapproved = disapproved;
        emit FundingDisapproved(disapproved);
    }

    function updateIsWithdrawalPointsMinted() external onlyFactory {
        isWithdrawalPointsMinted = true;
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _tokenTransfer(
        address tokenAddress
    ) internal returns (bool, uint256, address) {
        bool success;
        IERC20 token = IERC20(tokenAddress);
        uint256 tokenBalance = token.balanceOf(address(this));

        if (tokenBalance > 0) {
            success = token.transfer(owner, tokenBalance);
        }
        return (success, tokenBalance, owner);
    }

    /*//////////////////////////////////////////////////////////////
                            PUBLIC FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function checkTokenAddress(
        address _tokenAddress
    ) public view returns (bool) {
        for (uint256 i = 0; i < otherAcceptableTokens.length; i++) {
            if (otherAcceptableTokens[i] == _tokenAddress) {
                return true;
            }
        }
        return false;
    }

    /*//////////////////////////////////////////////////////////////
                            GETTER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getFundersDetails() external view returns (Funder[] memory) {
        Funder[] memory funders = new Funder[](fundersCount);
        for (uint256 i = 0; i < fundersCount; i++) {
            funders[i] = allFunders[i];
        }
        return funders;
    }

    function getFunderEthContribution(
        address _funderAddress
    ) external view returns (uint256) {
        return ethContribution[_funderAddress];
    }

    function getFunderOtherTokenContribution(
        address _funderAddress,
        address tokenAddress
    ) external view returns (uint256) {
        return otherTokenContribution[_funderAddress][tokenAddress];
    }

    function getLimitsEnabled() public view returns (bool) {
        return ICapitaFundingFactory(fundingFactoryAddress).limitsEnabled();
    }
}
