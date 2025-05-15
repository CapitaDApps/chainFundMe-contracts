// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {ChainFundMe} from "./ChainFundMe.sol";
import {CapitaPoints} from "./CapitaPoints.sol";
import {AccessControl} from "./AccessControl.sol";

contract CapitaFundingFactory is AccessControl {
    using Clones for address;

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error CapitaFundingFactory__NotModerator();
    error CapitaFundingFactory__InsufficientFee();
    error CapitaFundingFactory__WithdrawFailed();
    error CapitaFundingFactory__TokenNotAllowed(address _tokenAddress);
    error CapitaFundingFactory__InvalidAddress(address);
    error CapitaFundingFactory__FeeCannotBeLessThan_1();
    error CapitaFundingFactory__FeeCannotBeGreaterThan_20();
    error CapitaFundingFactory__ContractPaused();
    error CapitaFundingFactory__MaxOf5TokensExceeded();
    error CapitaFundingFactory__InvalidDatesSet();
    error CapitaFundingFactory__CapitaPointsAlreadySet();
    error CapitaFundingFactory__CampaignApproved(address);
    error CapitaFundingFactory__UnverifiedUser();

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    uint8 public platformFee = 5; // 5%. Enforced in ChainFundMe
    uint256 public deployedCampaignsCount;
    uint256 public unverifiedFundLimit = 50000e18; // $50k

    address public priceFeedAddress;

    address public immutable chainFundMeImplementation;
    address public immutable stableCoinAddress;
    address public capitaTokenAddress;
    address public feeWalletAddress;
    bool public paused; // pause factory contract
    bool public limitsEnabled = true; // Enforced in ChainFundMe

    CapitaPoints public capitaPoints;

    mapping(uint256 => address) private indexToDeployedCampaigns; // Maps campaign ID to contract address
    mapping(address => bool) public moderators;
    mapping(address => address[]) private userCampaigns; // Tracks each user's chainFundMe contracts
    mapping(address => bool) public otherAcceptedTokensAddresses;
    mapping(address => bool) public verifiedCreators;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event ChainFundMeCreated(
        address indexed creator,
        address indexed fundMeAddress
    );
    event ModeratorAdded(address indexed moderator);
    event ModeratorRemoved(address indexed moderator);
    event CapitaPointsAddressSet(address indexed capitaPointsAddress);
    event FeeWithdrawn(uint256 amount);
    event UpdatedFeeWalletAddress(address indexed _feeWalletAddress);
    event CapitaFactoryPaused(bool isPaused);
    event PlatformFeeUpdated(uint8 newFee);
    event AcceptableTokenSet(address indexed token, bool accepted);
    event UpdatedLimitsEnabled(bool indexed enabled);
    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyModerator() {
        if (!moderators[msg.sender])
            revert CapitaFundingFactory__NotModerator();
        _;
    }

    modifier onlyCampaignOwner(address _campaignAddress) {
        if (msg.sender != ChainFundMe(_campaignAddress).owner()) {
            revert AccessControl.Capita__NotOwner();
        }
        _;
    }

    /*//////////////////////////////////////////////////////////////
                               FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    constructor(
        address _stableCoinAddress,
        address _capitaTokenAddress,
        address _feeWalletAddress,
        address _priceFeedAddress
    ) AccessControl(msg.sender) {
        stableCoinAddress = _stableCoinAddress;
        capitaTokenAddress = _capitaTokenAddress;
        if (_feeWalletAddress == address(0))
            revert CapitaFundingFactory__InvalidAddress(_feeWalletAddress);
        if (_priceFeedAddress == address(0))
            revert CapitaFundingFactory__InvalidAddress(_priceFeedAddress);

        feeWalletAddress = _feeWalletAddress;
        chainFundMeImplementation = address(new ChainFundMe());
        priceFeedAddress = _priceFeedAddress;

        addModerator(msg.sender);
    }

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function removeModerator(address _moderator) external onlyOwner {
        moderators[_moderator] = false;
        emit ModeratorRemoved(_moderator);
    }

    function setCapitaPointsAddress(
        address _capitaPointsAddress
    ) external onlyOwner {
        capitaPoints = CapitaPoints(_capitaPointsAddress);
        emit CapitaPointsAddressSet(_capitaPointsAddress);
    }

    function createChainFundMe(
        uint256 startTime,
        uint256 endTime,
        string memory _metadataUri,
        address[] memory _otherTokenAddresses
    ) external {
        if (paused) revert CapitaFundingFactory__ContractPaused();

        uint256 addressesLength = _otherTokenAddresses.length;

        if (addressesLength > 5)
            revert CapitaFundingFactory__MaxOf5TokensExceeded();

        if (address(capitaPoints) == address(0))
            revert CapitaFundingFactory__InvalidAddress(address(capitaPoints));

        if (addressesLength > 0) {
            if (!verifiedCreators[msg.sender])
                revert CapitaFundingFactory__UnverifiedUser();
        }

        if (startTime >= endTime || startTime < block.timestamp)
            revert CapitaFundingFactory__InvalidDatesSet();

        for (uint i = 0; i < addressesLength; i++) {
            address _otherTokenAddress = _otherTokenAddresses[i];
            if (_otherTokenAddress == address(0)) {
                revert CapitaFundingFactory__InvalidAddress(_otherTokenAddress);
            }
            if (!checkAcceptableTokenAddress(_otherTokenAddress)) {
                revert CapitaFundingFactory__TokenNotAllowed(
                    _otherTokenAddress
                );
            }
        }

        address chainFundMeClone = chainFundMeImplementation.clone();

        ChainFundMe(chainFundMeClone).initialize(
            msg.sender,
            startTime,
            endTime,
            _metadataUri,
            stableCoinAddress,
            capitaTokenAddress,
            _otherTokenAddresses,
            address(this)
        );
        indexToDeployedCampaigns[deployedCampaignsCount] = address(
            chainFundMeClone
        ); // Store campaign ID to contract address
        deployedCampaignsCount++;
        userCampaigns[msg.sender].push(address(chainFundMeClone)); // Store campaign for creator

        emit ChainFundMeCreated(msg.sender, address(chainFundMeClone));
    }

    function chainFundMe_fundChainFundMe(
        address _campaignAddress,
        address _otherToken,
        uint256 _amount
    ) external payable {
        address sender = msg.sender;
        uint256 value = msg.value;
        ChainFundMe(_campaignAddress).deposit{value: value}(
            _otherToken,
            _amount,
            sender
        );

        if (_otherToken == stableCoinAddress) {
            // mint points for the user
            capitaPoints.mintPointsUSD(sender, _amount);
        }
        if (_otherToken == address(0)) {
            // mint points for the user
            capitaPoints.mintPointsETH(sender, value);
        }
    }

    function chainFundMe_approveWithdraw(
        address _campaignAddress
    ) external onlyModerator {
        ChainFundMe(_campaignAddress).approveWithdraw();
    }

    function chainFundMe_batchWithdrawApproval(
        address[] memory _fundMeAddresses
    ) external onlyModerator {
        for (uint256 i = 0; i < _fundMeAddresses.length; i++) {
            ChainFundMe(_fundMeAddresses[i]).approveWithdraw();
        }
    }

    function chainFundMe_revokeApproval(
        address _campaignAddress,
        bool revoke
    ) external onlyOwner {
        ChainFundMe(_campaignAddress).revokeApproval(revoke);
    }

    function chainFundMe_pauseChainFundMeContract(
        address _campaignAddress,
        bool pause
    ) external onlyModerator {
        ChainFundMe(_campaignAddress).updatePause(pause);
    }

    function chainFundMe_approveFunding(
        address _campaignAddress
    ) external onlyModerator {
        ChainFundMe chainFundMe = ChainFundMe(_campaignAddress);
        bool approved = chainFundMe.fundingApproved();
        address campaignOwner = chainFundMe.owner();
        uint256 basePoints = capitaPoints.BASE_POINTS();
        if (approved)
            revert CapitaFundingFactory__CampaignApproved(_campaignAddress);
        chainFundMe.updateFundingApproval();
        capitaPoints.mintPoints(campaignOwner, basePoints);
    }

    function chainFundMe_batchApproveFunding(
        address[] memory _fundMeAddresses
    ) external onlyModerator {
        for (uint256 i = 0; i < _fundMeAddresses.length; i++) {
            ChainFundMe(_fundMeAddresses[i]).updateFundingApproval();
        }
    }

    function chainFundMe_disapproveFunding(
        address _campaignAddress,
        bool _disapproved
    ) external onlyModerator {
        ChainFundMe(_campaignAddress).updateFundingDisapproval(_disapproved);
    }

    function chainFundMe_batchDisapproveFunding(
        address[] memory _fundMeAddresses,
        bool _disapproved
    ) external onlyModerator {
        for (uint256 i = 0; i < _fundMeAddresses.length; i++) {
            ChainFundMe(_fundMeAddresses[i]).updateFundingDisapproval(
                _disapproved
            );
        }
    }

    function chainFundMe_withdrawAllFunds(
        address _campaignAddress
    ) external onlyCampaignOwner(_campaignAddress) {
        chainFundMe_withdrawETH(_campaignAddress);
        chainFundMe_withdrawTokens(_campaignAddress);
    }

    function chainFundMe_withdrawETH(
        address _campaignAddress
    ) public onlyCampaignOwner(_campaignAddress) {
        ChainFundMe chainFundMe = ChainFundMe(_campaignAddress);
        address campaignOwner = chainFundMe.owner();
        bool isMinted = chainFundMe.isWithdrawalPointsMinted();

        chainFundMe.withdrawETH();
        if (!isMinted) {
            chainFundMe.updateIsWithdrawalPointsMinted();
            uint256 basePoints = capitaPoints.BASE_POINTS();
            capitaPoints.mintPoints(campaignOwner, basePoints);
        }
    }

    function chainFundMe_withdrawTokens(
        address _campaignAddress
    ) public onlyCampaignOwner(_campaignAddress) {
        ChainFundMe chainFundMe = ChainFundMe(_campaignAddress);
        address campaignOwner = chainFundMe.owner();
        bool isMinted = chainFundMe.isWithdrawalPointsMinted();

        chainFundMe.withdrawOtherTokens();
        if (!isMinted) {
            chainFundMe.updateIsWithdrawalPointsMinted();
            uint256 basePoints = capitaPoints.BASE_POINTS();
            capitaPoints.mintPoints(campaignOwner, basePoints);
        }
    }

    function setAcceptableToken(address _tokenAddress) external onlyOwner {
        otherAcceptedTokensAddresses[_tokenAddress] = true;
        emit AcceptableTokenSet(_tokenAddress, true);
    }

    function removeTokenAddress(address _tokenAddress) external onlyOwner {
        otherAcceptedTokensAddresses[_tokenAddress] = false;
        emit AcceptableTokenSet(_tokenAddress, false);
    }

    function updatePlatformFee(uint8 _platformFee) external onlyOwner {
        if (_platformFee < 1)
            revert CapitaFundingFactory__FeeCannotBeLessThan_1();
        if (_platformFee > 20)
            revert CapitaFundingFactory__FeeCannotBeGreaterThan_20();
        platformFee = _platformFee;
        emit PlatformFeeUpdated(_platformFee);
    }

    function updateFeeWalletAddress(
        address _feeWalletAddress
    ) external onlyOwner {
        if (address(capitaPoints) != address(0)) {
            revert CapitaFundingFactory__CapitaPointsAlreadySet();
        }
        feeWalletAddress = _feeWalletAddress;
        emit UpdatedFeeWalletAddress(_feeWalletAddress);
    }

    function updatePaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit CapitaFactoryPaused(_paused);
    }

    function updateCapitaTokenAddress(
        address _capitaTokenAddress
    ) external onlyOwner {
        capitaTokenAddress = _capitaTokenAddress;
    }

    function updateLimitsEnabled(bool _enabled) external onlyOwner {
        limitsEnabled = _enabled;
        emit UpdatedLimitsEnabled(_enabled);
    }

    function verifyCreator(
        address _creator,
        bool _verify
    ) external onlyModerator {
        verifiedCreators[_creator] = _verify;
    }

    function updateUnverifiedFundingLimit(
        uint256 _fundingLimit
    ) external onlyOwner {
        unverifiedFundLimit = _fundingLimit;
    }

    /*//////////////////////////////////////////////////////////////
                            PUBLIC FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function checkAcceptableTokenAddress(
        address _tokenAddress
    ) public view returns (bool) {
        return otherAcceptedTokensAddresses[_tokenAddress];
    }

    function addModerator(address _moderator) public onlyOwner {
        moderators[_moderator] = true;
        emit ModeratorAdded(_moderator);
    }

    /*//////////////////////////////////////////////////////////////
                            GETTER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getUserCampaigns(
        address _user
    ) external view returns (address[] memory) {
        return userCampaigns[_user];
    }

    function getDeployedCampaigns() external view returns (address[] memory) {
        address[] memory campaigns = new address[](deployedCampaignsCount);
        for (uint256 i = 0; i < deployedCampaignsCount; i++) {
            campaigns[i] = indexToDeployedCampaigns[i];
        }
        return campaigns;
    }
}
