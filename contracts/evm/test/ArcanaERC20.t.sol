// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ArcanaERC20Factory} from "../src/erc20/ArcanaERC20Factory.sol";
import {ArcanaERC20Vault} from "../src/erc20/ArcanaERC20Vault.sol";
import {ArcanaMintableERC20} from "../src/erc20/ArcanaMintableERC20.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract ArcanaERC20Test is Test {
    address private admin = address(0xA11CE);
    address private minter = address(0xB0B);
    address private user = address(0xCAFE);
    address private recipient = address(0xDAD);

    function testFactoryCreatesMintableTokenAtPredictedAddress() external {
        ArcanaERC20Factory factory = new ArcanaERC20Factory();
        bytes32 salt = keccak256("token");
        address predicted = factory.predictTokenAddress("Arcana Gold", "AGLD", 6, admin, minter, salt);

        address tokenAddress = factory.createToken("Arcana Gold", "AGLD", 6, admin, minter, salt);
        ArcanaMintableERC20 token = ArcanaMintableERC20(tokenAddress);

        assertEq(tokenAddress, predicted);
        assertEq(token.name(), "Arcana Gold");
        assertEq(token.symbol(), "AGLD");
        assertEq(token.decimals(), 6);

        vm.prank(minter);
        token.mint(user, 1_000);
        assertEq(token.balanceOf(user), 1_000);

        vm.expectRevert();
        token.mint(user, 1);
    }

    function testVaultWrapsAndOwnerUnwrapsSupportedToken() external {
        MockERC20 token = new MockERC20("Ink Test USDC", "iUSDC", 6);
        ArcanaERC20Vault vault = new ArcanaERC20Vault(admin, false);

        vm.prank(admin);
        vault.setTokenSupported(address(token), true);

        token.mint(user, 1_000);
        vm.prank(user);
        token.approve(address(vault), 300);

        vm.prank(user);
        vault.wrap(address(token), 300, recipient);
        assertEq(token.balanceOf(address(vault)), 300);
        assertEq(token.balanceOf(user), 700);

        vm.expectRevert();
        vm.prank(user);
        vault.unwrap(address(token), user, recipient, 100);

        vm.prank(admin);
        vault.unwrap(address(token), user, recipient, 100);
        assertEq(token.balanceOf(address(vault)), 200);
        assertEq(token.balanceOf(recipient), 100);
    }

    function testVaultDepositsAndOwnerUnwrapsNativeEth() external {
        ArcanaERC20Vault vault = new ArcanaERC20Vault(admin, false);
        bytes32 recipientAccountId = keccak256("arcana-account");
        vm.deal(user, 2 ether);

        vm.prank(user);
        vault.depositNativeForArcana{value: 1 ether}(recipientAccountId);
        assertEq(address(vault).balance, 1 ether);

        vm.expectRevert();
        vm.prank(user);
        vault.unwrap(address(0), user, recipient, 0.25 ether);

        uint256 recipientBefore = recipient.balance;
        vm.prank(admin);
        vault.unwrap(address(0), user, recipient, 0.25 ether);

        assertEq(address(vault).balance, 0.75 ether);
        assertEq(recipient.balance, recipientBefore + 0.25 ether);
    }

    function testVaultRejectsEmptyNativeEthDeposit() external {
        ArcanaERC20Vault vault = new ArcanaERC20Vault(admin, false);
        bytes32 recipientAccountId = keccak256("arcana-account");

        vm.expectRevert("amount required");
        vm.prank(user);
        vault.depositNativeForArcana{value: 0}(recipientAccountId);
    }

    function testVaultWrapForArcanaWithRequestIdIsIdempotent() external {
        MockERC20 token = new MockERC20("Ink Test USDC", "iUSDC", 6);
        ArcanaERC20Vault vault = new ArcanaERC20Vault(admin, false);
        bytes32 recipientAccountId = keccak256("arcana-account");
        bytes32 requestId = keccak256("nado-withdraw-intent");

        vm.prank(admin);
        vault.setTokenSupported(address(token), true);

        token.mint(user, 1_000);
        vm.prank(user);
        token.approve(address(vault), 600);

        vm.prank(user);
        vault.wrapForArcanaWithRequestId(address(token), 300, recipientAccountId, requestId);
        assertEq(token.balanceOf(address(vault)), 300);
        assertEq(token.balanceOf(user), 700);
        assertTrue(vault.processedArcanaWrapRequests(requestId));

        vm.expectRevert("request already processed");
        vm.prank(user);
        vault.wrapForArcanaWithRequestId(address(token), 300, recipientAccountId, requestId);

        assertEq(token.balanceOf(address(vault)), 300);
        assertEq(token.balanceOf(user), 700);
    }

    function testVaultUnwrapWithRequestIdIsIdempotent() external {
        MockERC20 token = new MockERC20("Ink Test USDC", "iUSDC", 6);
        ArcanaERC20Vault vault = new ArcanaERC20Vault(admin, false);
        bytes32 requestId = keccak256("nado-deposit-intent");

        vm.prank(admin);
        vault.setTokenSupported(address(token), true);

        token.mint(address(vault), 1_000);

        vm.prank(admin);
        vault.unwrapWithRequestId(address(token), user, recipient, 300, requestId);
        assertEq(token.balanceOf(address(vault)), 700);
        assertEq(token.balanceOf(recipient), 300);
        assertTrue(vault.processedArcanaUnwrapRequests(requestId));

        vm.expectRevert("request already processed");
        vm.prank(admin);
        vault.unwrapWithRequestId(address(token), user, recipient, 300, requestId);

        assertEq(token.balanceOf(address(vault)), 700);
        assertEq(token.balanceOf(recipient), 300);
    }

    function testVaultRejectsUnsupportedTokenUnlessAllowAllIsEnabled() external {
        MockERC20 token = new MockERC20("Ink Test USDC", "iUSDC", 6);
        ArcanaERC20Vault vault = new ArcanaERC20Vault(admin, false);

        token.mint(user, 1_000);
        vm.prank(user);
        token.approve(address(vault), 500);

        vm.expectRevert("token not supported");
        vm.prank(user);
        vault.wrap(address(token), 500, recipient);

        vm.prank(admin);
        vault.setAllowAllTokens(true);

        vm.prank(user);
        vault.wrap(address(token), 500, recipient);
        assertEq(token.balanceOf(address(vault)), 500);
    }
}
