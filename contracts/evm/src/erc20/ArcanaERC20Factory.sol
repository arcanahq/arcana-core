// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ArcanaMintableERC20} from "./ArcanaMintableERC20.sol";
import {ArcanaERC20Wrapper} from "./ArcanaERC20Wrapper.sol";
import {ArcanaERC20Vault} from "./ArcanaERC20Vault.sol";

/// @title ArcanaERC20Factory
/// @notice Deterministically creates mintable ERC20 assets for Arcana apps.
contract ArcanaERC20Factory {
    event TokenCreated(
        address indexed token,
        address indexed admin,
        address indexed minter,
        string name,
        string symbol,
        uint8 decimals,
        bytes32 salt
    );
    event WrapperCreated(
        address indexed wrapper, address indexed underlying, string name, string symbol, uint8 decimals, bytes32 salt
    );
    event VaultCreated(address indexed vault, address indexed owner, bool allowAllTokens, bytes32 salt);

    function createToken(
        string calldata name,
        string calldata symbol,
        uint8 decimals_,
        address admin,
        address minter,
        bytes32 salt
    ) external returns (address token) {
        token = address(new ArcanaMintableERC20{salt: salt}(name, symbol, decimals_, admin, minter));
        emit TokenCreated(token, admin, minter, name, symbol, decimals_, salt);
    }

    function predictTokenAddress(
        string calldata name,
        string calldata symbol,
        uint8 decimals_,
        address admin,
        address minter,
        bytes32 salt
    ) external view returns (address) {
        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(type(ArcanaMintableERC20).creationCode, abi.encode(name, symbol, decimals_, admin, minter))
        );
        bytes32 digest = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, bytecodeHash));
        return address(uint160(uint256(digest)));
    }

    function createWrapper(
        address underlying,
        string calldata name,
        string calldata symbol,
        uint8 decimals_,
        bytes32 salt
    ) external returns (address wrapper) {
        wrapper = address(new ArcanaERC20Wrapper{salt: salt}(underlying, name, symbol, decimals_));
        emit WrapperCreated(wrapper, underlying, name, symbol, decimals_, salt);
    }

    function predictWrapperAddress(
        address underlying,
        string calldata name,
        string calldata symbol,
        uint8 decimals_,
        bytes32 salt
    ) external view returns (address) {
        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(type(ArcanaERC20Wrapper).creationCode, abi.encode(underlying, name, symbol, decimals_))
        );
        bytes32 digest = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, bytecodeHash));
        return address(uint160(uint256(digest)));
    }

    function createVault(address owner, bool allowAllTokens, bytes32 salt) external returns (address vault) {
        vault = address(new ArcanaERC20Vault{salt: salt}(owner, allowAllTokens));
        emit VaultCreated(vault, owner, allowAllTokens, salt);
    }

    function predictVaultAddress(address owner, bool allowAllTokens, bytes32 salt) external view returns (address) {
        bytes32 bytecodeHash =
            keccak256(abi.encodePacked(type(ArcanaERC20Vault).creationCode, abi.encode(owner, allowAllTokens)));
        bytes32 digest = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, bytecodeHash));
        return address(uint160(uint256(digest)));
    }
}
