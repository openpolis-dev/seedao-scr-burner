// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title ISCRBurnable
 * @dev Interface for SCR token with burn functionality
 */
interface ISCRBurnable is IERC20 {
    /**
     * @dev Burns tokens from the caller
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) external;

    /**
     * @dev Burns tokens from account using allowance
     * @param account Account to burn from
     * @param amount Amount of tokens to burn
     */
    function burnFrom(address account, uint256 amount) external;
}

/**
 * @title SCRBurnerUpgradeable
 * @dev Upgradeable contract that allows users to burn SCR tokens and receive USDT
 * @notice Uses UUPS (Universal Upgradeable Proxy Standard) pattern
 * @author Taoist Labs
 *
 * Features:
 * - Configurable exchange rate (numerator/denominator) with bounds
 * - Pausable for emergencies
 * - Owner can fund/withdraw USDT pool
 * - Reentrancy protection
 * - Upgradeable via UUPS pattern
 * - Gas optimized with cached token decimals
 */
contract SCRBurnerUpgradeable is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    /// @dev SCR token contract with burn functionality
    ISCRBurnable public scrToken;

    /// @dev USDT token contract
    IERC20 public usdtToken;

    // Exchange rate: 1 SCR = (rateNumerator / rateDenominator) USDT
    // Default: 3/100 = 0.03 USDT per SCR
    uint256 public rateNumerator;
    uint256 public rateDenominator;

    /// @dev Cached decimals for gas optimization
    uint8 private scrTokenDecimals;
    uint8 private usdtTokenDecimals;

    /// @dev Rate bounds to prevent extreme values
    uint256 public constant MIN_RATE_NUMERATOR = 1; // Minimum 0.01 (1/100)
    uint256 public constant MAX_RATE_NUMERATOR = 100; // Maximum 1.0 (100/100)
    uint256 public constant FIXED_RATE_DENOMINATOR = 100; // Fixed at 100 for clarity

    // Custom Errors
    error InvalidAddress();
    error AmountMustBeGreaterThanZero();
    error DenominatorCannotBeZero();
    error RateTooLow();
    error RateTooHigh();
    error USDTAmountTooSmall();
    error InsufficientUSDTInPool();
    error InsufficientBalance();
    error TransferFailed();

    // Events
    event SCRBurned(
        address indexed user,
        uint256 scrAmount,
        uint256 usdtAmount,
        uint256 timestamp
    );
    event BurnRateUpdated(
        uint256 oldNumerator,
        uint256 oldDenominator,
        uint256 newNumerator,
        uint256 newDenominator
    );
    event USDTPoolFunded(address indexed from, uint256 amount);
    event USDTWithdrawn(address indexed to, uint256 amount);

    /**
     * @dev Storage gap for future upgrades
     * @notice Allows adding new state variables without shifting down storage in child contracts
     */
    uint256[44] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializer function (replaces constructor for upgradeable contracts)
     * @param _scrToken Address of SCR token
     * @param _usdtToken Address of USDT token
     * @param _rateNumerator Initial rate numerator (default: 3)
     * @param _rateDenominator Initial rate denominator (default: 100)
     * @notice Can only be called once during deployment
     * @notice Rate numerator must be between MIN_RATE_NUMERATOR and MAX_RATE_NUMERATOR
     */
    function initialize(
        address _scrToken,
        address _usdtToken,
        uint256 _rateNumerator,
        uint256 _rateDenominator
    ) public initializer {
        if (_scrToken == address(0)) revert InvalidAddress();
        if (_usdtToken == address(0)) revert InvalidAddress();
        if (_rateDenominator == 0) revert DenominatorCannotBeZero();
        if (_rateNumerator < MIN_RATE_NUMERATOR) revert RateTooLow();
        if (_rateNumerator > MAX_RATE_NUMERATOR) revert RateTooHigh();

        __Ownable_init(msg.sender);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        scrToken = ISCRBurnable(_scrToken);
        usdtToken = IERC20(_usdtToken);
        rateNumerator = _rateNumerator;
        rateDenominator = _rateDenominator;

        // Cache decimals for gas optimization
        scrTokenDecimals = IERC20Metadata(_scrToken).decimals();
        usdtTokenDecimals = IERC20Metadata(_usdtToken).decimals();
    }

    /**
     * @dev Main function: Burn SCR tokens and receive USDT
     * @param scrAmount Amount of SCR tokens to burn
     * @notice User must approve this contract to spend their SCR tokens first
     * @notice SCR tokens are permanently burned (removed from total supply)
     */
    function burnSCRForUSDT(uint256 scrAmount)
        external
        nonReentrant
        whenNotPaused
    {
        if (scrAmount == 0) revert AmountMustBeGreaterThanZero();

        // Calculate USDT amount to send
        uint256 usdtAmount = calculateUSDTAmount(scrAmount);
        if (usdtAmount == 0) revert USDTAmountTooSmall();

        // Check if contract has enough USDT
        uint256 usdtBalance = usdtToken.balanceOf(address(this));
        if (usdtBalance < usdtAmount) revert InsufficientUSDTInPool();

        // Burn SCR tokens directly from user (requires approval)
        scrToken.burnFrom(msg.sender, scrAmount);

        // Transfer USDT to user
        bool success = usdtToken.transfer(msg.sender, usdtAmount);
        if (!success) revert TransferFailed();

        emit SCRBurned(msg.sender, scrAmount, usdtAmount, block.timestamp);
    }

    /**
     * @dev Calculate USDT amount based on SCR amount and current rate
     * @param scrAmount Amount of SCR tokens to burn
     * @return usdtAmount Amount of USDT to receive
     * @notice Uses cached decimals for gas optimization
     * @notice Formula: (scrAmount * rateNumerator / rateDenominator) adjusted for decimals
     */
    function calculateUSDTAmount(uint256 scrAmount) public view returns (uint256 usdtAmount) {
        // Calculate USDT amount: scrAmount * rateNumerator / rateDenominator
        usdtAmount = (scrAmount * rateNumerator) / rateDenominator;

        // Adjust for decimal differences using cached values
        if (scrTokenDecimals > usdtTokenDecimals) {
            usdtAmount = usdtAmount / (10 ** (scrTokenDecimals - usdtTokenDecimals));
        } else if (usdtTokenDecimals > scrTokenDecimals) {
            usdtAmount = usdtAmount * (10 ** (usdtTokenDecimals - scrTokenDecimals));
        }

        return usdtAmount;
    }

    /**
     * @dev Update the burn rate - only owner
     * @param newNumerator New rate numerator
     * @param newDenominator New rate denominator
     * @notice Numerator must be between MIN_RATE_NUMERATOR and MAX_RATE_NUMERATOR
     * @notice Denominator must match FIXED_RATE_DENOMINATOR for consistency
     * @notice Emits BurnRateUpdated event
     */
    function setBurnRate(uint256 newNumerator, uint256 newDenominator)
        external
        onlyOwner
    {
        if (newDenominator == 0) revert DenominatorCannotBeZero();
        if (newNumerator < MIN_RATE_NUMERATOR) revert RateTooLow();
        if (newNumerator > MAX_RATE_NUMERATOR) revert RateTooHigh();
        if (newDenominator != FIXED_RATE_DENOMINATOR) revert DenominatorCannotBeZero();

        emit BurnRateUpdated(
            rateNumerator,
            rateDenominator,
            newNumerator,
            newDenominator
        );

        rateNumerator = newNumerator;
        rateDenominator = newDenominator;
    }

    /**
     * @dev Fund the USDT pool - only owner
     * @param amount Amount of USDT to deposit
     * @notice Owner must approve this contract to spend their USDT first
     * @notice Emits USDTPoolFunded event
     */
    function fundUSDTPool(uint256 amount) external onlyOwner {
        if (amount == 0) revert AmountMustBeGreaterThanZero();

        bool success = usdtToken.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        emit USDTPoolFunded(msg.sender, amount);
    }

    /**
     * @dev Withdraw USDT from pool - only owner (emergency)
     * @param amount Amount of USDT to withdraw
     * @notice Use this function to recover USDT in emergency situations
     * @notice Emits USDTWithdrawn event
     */
    function withdrawUSDT(uint256 amount) external onlyOwner {
        if (amount == 0) revert AmountMustBeGreaterThanZero();

        uint256 balance = usdtToken.balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance();

        bool success = usdtToken.transfer(msg.sender, amount);
        if (!success) revert TransferFailed();

        emit USDTWithdrawn(msg.sender, amount);
    }

    /**
     * @dev Pause the contract - only owner
     * @notice Prevents all burning operations when paused
     * @notice Use in emergency situations to halt operations
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract - only owner
     * @notice Resumes normal operations after pause
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Get current USDT pool balance
     * @return balance The amount of USDT available in the pool
     * @notice Returns the total USDT balance held by this contract
     */
    function getUSDTPoolBalance() external view returns (uint256 balance) {
        return usdtToken.balanceOf(address(this));
    }

    /**
     * @dev Get current SCR balance in contract
     * @return balance The amount of SCR tokens in the contract
     * @notice Should always be 0 since SCR tokens are burned immediately
     */
    function getSCRBalance() external view returns (uint256 balance) {
        return scrToken.balanceOf(address(this));
    }

    /**
     * @dev Get current exchange rate
     * @return numerator The rate numerator
     * @return denominator The rate denominator
     * @notice Rate = numerator / denominator (e.g., 3/100 = 0.03 USDT per SCR)
     */
    function getCurrentRate() external view returns (uint256 numerator, uint256 denominator) {
        return (rateNumerator, rateDenominator);
    }

    /**
     * @dev Function that authorizes an upgrade - only owner can upgrade
     * @param newImplementation Address of the new implementation contract
     * @notice Required by UUPS pattern
     * @notice Only owner can authorize upgrades
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
