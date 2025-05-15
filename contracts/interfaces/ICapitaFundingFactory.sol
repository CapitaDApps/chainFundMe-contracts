// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICapitaFundingFactory {
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

    /*//////////////////////////////////////////////////////////////
                              VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function stableCoinAddress() external view returns (address);

    function capitaTokenAddress() external view returns (address);

    function feeWalletAddress() external view returns (address);

    function paused() external view returns (bool);

    function platformFee() external view returns (uint8);

    function limitsEnabled() external view returns (bool);

    function deployedCampaignsCount() external view returns (uint256);

    function checkAcceptableTokenAddress(
        address _tokenAddress
    ) external view returns (bool);

    function getUserCampaigns(
        address _user
    ) external view returns (address[] memory);

    function getDeployedCampaigns() external view returns (address[] memory);

    function verifiedCreators(address _creator) external view returns (bool);

    function priceFeedAddress() external view returns (address);

    function unverifiedFundLimit() external view returns (uint256);

    /*//////////////////////////////////////////////////////////////
                            MUTATIVE FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function createChainFundMe(
        uint256 startTime,
        uint256 endTime,
        string calldata _metadataUri,
        address[] calldata _otherTokenAddresses
    ) external;

    function removeModerator(address _moderator) external;

    function setCapitaPointsAddress(address _capitaPointsAddress) external;

    function setAcceptableToken(address _tokenAddress) external;

    function removeTokenAddress(address _tokenAddress) external;

    function updatePlatformFee(uint8 _platformFee) external;

    function updateFeeWalletAddress(address _feeWalletAddress) external;

    function updatePaused(bool _paused) external;

    function updateCapitaTokenAddress(address _capitaTokenAddress) external;

    function addModerator(address _moderator) external;

    function chainFundMe_fundChainFundMe(
        address _campaignAddress,
        address _otherToken,
        uint256 _amount
    ) external payable;

    function chainFundMe_approveWithdraw(address _campaignAddress) external;

    function chainFundMe_batchWithdrawApproval(
        address[] calldata _fundMeAddresses
    ) external;

    function chainFundMe_revokeApproval(
        address _campaignAddress,
        bool revoke
    ) external;

    function chainFundMe_pauseChainFundMeContract(
        address _campaignAddress,
        bool pause
    ) external;

    function chainFundMe_approveFunding(address _campaignAddress) external;

    function chainFundMe_batchApproveFunding(
        address[] calldata _fundMeAddresses
    ) external;

    function chainFundMe_disapproveFunding(
        address _campaignAddress,
        bool _disapproved
    ) external;

    function chainFundMe_batchDisapproveFunding(
        address[] calldata _fundMeAddresses,
        bool _disapproved
    ) external;

    function chainFundMe_withdrawETH(
        address _campaignAddress,
        address _toAddress
    ) external;

    function chainFundMe__withdrawTokens(
        address _campaignAddress,
        address _toAddress
    ) external;
}
