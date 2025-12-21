// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title ISCRToken
 * @notice Minimal interface for interacting with the SCR token
 * This interface includes only the methods needed for role management
 */
interface ISCRToken {
    /**
     * @dev Returns true if `account` has been granted `role`.
     */
    function hasRole(bytes32 role, address account) external view returns (bool);

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     */
    function grantRole(bytes32 role, address account) external;

    /**
     * @dev Emitted when `account` is granted `role`.
     *
     * `sender` is the account that originated the contract call, an admin role
     * bearer except when using {AccessControl-_setupRole}.
     */
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
}
