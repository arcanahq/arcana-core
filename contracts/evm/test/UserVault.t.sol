// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {UserVault} from "../src/UserVault.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract FalseReturnERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
}

contract UserVaultTest is Test {
    UserVault internal vault;
    MockERC20 internal token;

    address internal server = address(0x1001);
    address internal user = address(0x2002);
    address internal user2 = address(0x3003);

    function setUp() public {
        vault = new UserVault();
        token = new MockERC20("Mock USDC", "mUSDC", 6);

        vault.setServerAddress(server);
        vm.prank(server);
        vault.whitelistToken(address(token));

        token.mint(user, 1_000_000e6);
        token.mint(user2, 1_000_000e6);
    }

    function test_DepositWithIdRejectsDuplicateIntentId() public {
        bytes32 depositId = bytes32(uint256(0xabc));
        uint256 amount = 100e6;

        vm.startPrank(user);
        token.approve(address(vault), amount * 2);
        vault.deposit(address(token), amount, depositId);

        vm.expectRevert("Deposit ID already used");
        vault.deposit(address(token), amount, depositId);
        vm.stopPrank();

        assertEq(token.balanceOf(address(vault)), amount);
        assertTrue(vault.usedDepositIds(depositId));
    }

    function test_DepositIdIsNotConsumedWhenTransferReverts() public {
        bytes32 depositId = bytes32(uint256(0xdef));
        uint256 amount = 100e6;

        vm.prank(user);
        vm.expectRevert();
        vault.deposit(address(token), amount, depositId);

        assertFalse(vault.usedDepositIds(depositId));

        vm.startPrank(user);
        token.approve(address(vault), amount);
        vault.deposit(address(token), amount, depositId);
        vm.stopPrank();

        assertTrue(vault.usedDepositIds(depositId));
        assertEq(token.balanceOf(address(vault)), amount);
    }

    function test_DepositIdIsNotConsumedWhenTokenReturnsFalse() public {
        FalseReturnERC20 badToken = new FalseReturnERC20();
        bytes32 depositId = bytes32(uint256(0xbeef));

        vm.prank(server);
        vault.whitelistToken(address(badToken));

        badToken.mint(user, 100e6);
        vm.startPrank(user);
        badToken.approve(address(vault), 100e6);
        vm.expectRevert("Transfer failed");
        vault.deposit(address(badToken), 100e6, depositId);
        vm.stopPrank();

        assertFalse(vault.usedDepositIds(depositId));
    }

    function test_DepositIdIsNotConsumedWhenValidationFails() public {
        bytes32 belowMinId = bytes32(uint256(0x1111));
        bytes32 unlistedId = bytes32(uint256(0x2222));
        MockERC20 unlisted = new MockERC20("Other", "OTHER", 6);

        vm.startPrank(user);
        vm.expectRevert("Amount below minimum deposit");
        vault.deposit(address(token), 1, belowMinId);

        vm.expectRevert("Token not whitelisted");
        vault.deposit(address(unlisted), 100e6, unlistedId);
        vm.stopPrank();

        assertFalse(vault.usedDepositIds(belowMinId));
        assertFalse(vault.usedDepositIds(unlistedId));
    }

    function test_WithdrawNonceIsNotConsumedWhenVaultBalanceIsInsufficient() public {
        uint64 nonce = 42;

        vm.prank(server);
        vm.expectRevert("Insufficient vault balance");
        vault.serverWithdrawWithNonce(address(token), user, 10e6, nonce);

        assertFalse(vault.isWithdrawalNonceUsed(address(token), user, nonce));

        token.mint(address(vault), 10e6);
        vm.prank(server);
        vault.serverWithdrawWithNonce(address(token), user, 10e6, nonce);

        assertTrue(vault.isWithdrawalNonceUsed(address(token), user, nonce));
    }

    function test_WithdrawNonceIsNotConsumedWhenTokenReturnsFalse() public {
        FalseReturnERC20 badToken = new FalseReturnERC20();
        uint64 nonce = 43;

        badToken.mint(address(vault), 100e6);

        vm.prank(server);
        vm.expectRevert("Transfer failed");
        vault.serverWithdrawWithNonce(address(badToken), user, 10e6, nonce);

        assertFalse(vault.isWithdrawalNonceUsed(address(badToken), user, nonce));
    }

    function test_WithdrawStillWorksAfterTokenRemovedFromDepositWhitelist() public {
        token.mint(address(vault), 10e6);

        vm.prank(server);
        vault.removeWhitelistToken(address(token));

        vm.startPrank(user);
        token.approve(address(vault), 10e6);
        vm.expectRevert("Token not whitelisted");
        vault.deposit(address(token), 10e6, bytes32(uint256(1)));
        vm.stopPrank();

        uint256 before = token.balanceOf(user);
        vm.prank(server);
        vault.serverWithdrawWithNonce(address(token), user, 10e6, 1);
        assertEq(token.balanceOf(user) - before, 10e6);
    }

    function test_BatchWithdrawalRevertsAtomicallyWhenTotalExceedsVaultBalance() public {
        token.mint(address(vault), 100e6);

        address[] memory users = new address[](2);
        users[0] = user;
        users[1] = user2;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 90e6;
        amounts[1] = 20e6;

        uint256 userBefore = token.balanceOf(user);
        uint256 user2Before = token.balanceOf(user2);
        vm.prank(server);
        vm.expectRevert("Insufficient vault balance");
        vault.serverWithdrawBatch(address(token), users, amounts);

        assertEq(token.balanceOf(address(vault)), 100e6);
        assertEq(token.balanceOf(user), userBefore);
        assertEq(token.balanceOf(user2), user2Before);
    }

    function test_BatchWithdrawalRejectsMismatchedArrays() public {
        address[] memory users = new address[](2);
        users[0] = user;
        users[1] = user2;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1e6;

        vm.prank(server);
        vm.expectRevert("Arrays length mismatch");
        vault.serverWithdrawBatch(address(token), users, amounts);
    }

    function test_BatchWithdrawalRevertsAtomicallyWhenLaterRecipientIsInvalid() public {
        token.mint(address(vault), 100e6);

        address[] memory users = new address[](2);
        users[0] = user;
        users[1] = address(0);
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10e6;
        amounts[1] = 10e6;

        uint256 userBefore = token.balanceOf(user);
        vm.prank(server);
        vm.expectRevert("Invalid user address");
        vault.serverWithdrawBatch(address(token), users, amounts);

        assertEq(token.balanceOf(address(vault)), 100e6);
        assertEq(token.balanceOf(user), userBefore);
    }
}
