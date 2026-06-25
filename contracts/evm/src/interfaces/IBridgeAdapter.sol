// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Bridge adapter interface used by UserVault.
interface IBridgeAdapter {
    /**
     * @notice Bridge `amount` of `token` for `recipient`.
     * @dev Implementations pull funds from caller via `transferFrom`.
     * @param token Source chain token address.
     * @param amount Token amount (smallest units).
     * @param recipient Destination recipient (chain-specific encoding left to adapter/data).
     * @param data Adapter-specific opaque payload.
     * @return adapterResult Adapter-specific response bytes.
     */
    function bridge(address token, uint256 amount, address recipient, bytes calldata data)
        external
        payable
        returns (bytes memory adapterResult);
}
