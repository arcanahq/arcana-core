// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title ArcanaERC20Wrapper
/// @notice Locks an underlying ERC20 and mints/burns this wrapped ERC20.
contract ArcanaERC20Wrapper is ERC20 {
    IERC20 private immutable UNDERLYING;
    uint8 private immutable TOKEN_DECIMALS;

    event Wrapped(address indexed source, address indexed recipient, uint256 amount);
    event Unwrapped(address indexed source, address indexed recipient, uint256 amount);

    constructor(address underlying_, string memory name_, string memory symbol_, uint8 decimals_)
        ERC20(name_, symbol_)
    {
        require(underlying_ != address(0), "underlying required");
        UNDERLYING = IERC20(underlying_);
        TOKEN_DECIMALS = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return TOKEN_DECIMALS;
    }

    function underlying() external view returns (address) {
        return address(UNDERLYING);
    }

    function wrapFor(address source, address recipient, uint256 amount) external {
        require(source != address(0), "source required");
        require(recipient != address(0), "recipient required");
        require(amount > 0, "amount required");
        require(UNDERLYING.transferFrom(source, address(this), amount), "underlying transfer failed");
        _mint(recipient, amount);
        emit Wrapped(source, recipient, amount);
    }

    function unwrapFor(address source, address recipient, uint256 amount) external {
        require(source != address(0), "source required");
        require(recipient != address(0), "recipient required");
        require(amount > 0, "amount required");
        if (msg.sender != source) {
            _spendAllowance(source, msg.sender, amount);
        }
        _burn(source, amount);
        require(UNDERLYING.transfer(recipient, amount), "underlying transfer failed");
        emit Unwrapped(source, recipient, amount);
    }
}
