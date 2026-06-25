// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title ArcanaMintableERC20
/// @notice Role-controlled ERC20 used by the Arcana ERC20 capability.
contract ArcanaMintableERC20 is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    uint8 private immutable TOKEN_DECIMALS;

    constructor(string memory name_, string memory symbol_, uint8 decimals_, address admin, address minter)
        ERC20(name_, symbol_)
    {
        require(admin != address(0), "admin required");
        require(minter != address(0), "minter required");

        TOKEN_DECIMALS = decimals_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
    }

    function decimals() public view override returns (uint8) {
        return TOKEN_DECIMALS;
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(from, amount);
    }
}
