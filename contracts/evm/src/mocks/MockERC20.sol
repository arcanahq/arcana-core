// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "forge-std/interfaces/IERC20.sol";

/**
 * @title MockERC20
 * @notice Mock ERC20 token for testing
 */
contract MockERC20 is IERC20 {
    error MintAmountExceedsPerTxLimit(uint256 requested, uint256 maxAllowed);

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    uint256 public override totalSupply;
    string public name;
    string public symbol;
    uint8 public immutable tokenDecimals;
    uint256 public immutable maxMintPerTx;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        tokenDecimals = _decimals;
        maxMintPerTx = 1_000_000 * (10 ** uint256(_decimals));
    }

    function decimals() external view returns (uint8) {
        return tokenDecimals;
    }

    function mint(address to, uint256 amount) external {
        if (amount > maxMintPerTx) {
            revert MintAmountExceedsPerTxLimit(amount, maxMintPerTx);
        }
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        emit Approval(from, msg.sender, allowance[from][msg.sender]);
        return true;
    }
}
