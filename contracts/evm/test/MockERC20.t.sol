// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract MockERC20Test is Test {
    function testMintRespectsCapForSixDecimals() external {
        MockERC20 token = new MockERC20("Ink Test USDC", "iUSDC", 6);
        uint256 cap = token.maxMintPerTx();

        assertEq(cap, 1_000_000 * 10 ** 6);
        token.mint(address(this), cap);
        assertEq(token.balanceOf(address(this)), cap);
    }

    function testMintRevertsAboveCapForSixDecimals() external {
        MockERC20 token = new MockERC20("Ink Test USDC", "iUSDC", 6);
        uint256 cap = token.maxMintPerTx();

        vm.expectRevert(abi.encodeWithSelector(MockERC20.MintAmountExceedsPerTxLimit.selector, cap + 1, cap));
        token.mint(address(this), cap + 1);
    }

    function testMintRespectsCapForEighteenDecimals() external {
        MockERC20 token = new MockERC20("Ink Test USDC", "iUSDC", 18);
        uint256 cap = token.maxMintPerTx();

        assertEq(cap, 1_000_000 * 10 ** 18);
        token.mint(address(this), cap);
        assertEq(token.balanceOf(address(this)), cap);
    }
}
