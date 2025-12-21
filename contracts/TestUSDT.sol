// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestUSDT
 * @dev Test USDT token for local testing
 * Uses 6 decimals like real USDT
 */
contract TestUSDT is ERC20, Ownable {
    constructor() ERC20("Test USDT", "TUSDT") Ownable(msg.sender) {
        // Mint initial supply to deployer
        _mint(msg.sender, 1000000 * 10**decimals());
    }

    /**
     * @dev Override decimals to match USDT (6 decimals)
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /**
     * @dev Mint tokens - only owner can mint
     * @param to Address to receive tokens
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Faucet function - allows anyone to get test tokens
     * @param amount Amount to mint (limited to 1000 USDT per call)
     */
    function faucet(uint256 amount) public {
        require(amount <= 1000 * 10**decimals(), "TestUSDT: amount too large");
        _mint(msg.sender, amount);
    }
}
