// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {UserVault} from "../src/UserVault.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {IBridgeAdapter} from "../src/interfaces/IBridgeAdapter.sol";
import {DebridgeAdapter} from "../src/bridges/DebridgeAdapter.sol";

contract MockBridgeAdapter is IBridgeAdapter {
    event Bridged(address token, uint256 amount, address recipient, bytes data);

    function bridge(address token, uint256 amount, address recipient, bytes calldata data)
        external
        payable
        returns (bytes memory adapterResult)
    {
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "pull failed");
        emit Bridged(token, amount, recipient, data);
        return abi.encodePacked("ok");
    }
}

contract UserVaultBridgeTest is Test {
    UserVault internal vault;
    MockERC20 internal token;
    MockBridgeAdapter internal adapter;

    address internal owner = address(this);
    address internal server = address(0x1001);
    address internal user = address(0x2002);
    address internal recipient = address(0x3003);

    function setUp() public {
        vault = new UserVault();
        token = new MockERC20("Mock USDC", "mUSDC", 6);
        adapter = new MockBridgeAdapter();

        vault.setServerAddress(server);
        token.mint(address(vault), 1_000_000e6);
    }

    function test_ServerWithdrawToBridgeWithNonce_WhenEnabledAndAllowed() public {
        vm.startPrank(server);
        vault.setBridgeWithdrawExtension(true);
        vault.setBridgeAdapter(address(adapter), true);

        uint256 amount = 250e6;
        uint64 nonce = 7;
        bytes memory bridgeData = abi.encode("route:arb->eth");
        vault.serverWithdrawToBridgeWithNonce(
            address(token), user, amount, nonce, address(adapter), recipient, bridgeData
        );
        vm.stopPrank();

        assertEq(token.balanceOf(address(adapter)), amount);
        assertTrue(vault.isWithdrawalNonceUsed(address(token), user, nonce));
    }

    function test_ServerWithdrawToBridgeWithNonce_RevertsWhenExtensionDisabled() public {
        vm.prank(server);
        vault.setBridgeAdapter(address(adapter), true);

        vm.prank(server);
        vm.expectRevert("Bridge extension disabled");
        vault.serverWithdrawToBridgeWithNonce(address(token), user, 100e6, 1, address(adapter), recipient, bytes(""));
    }

    function test_ServerWithdrawToBridgeWithNonce_RevertsWhenAdapterNotAllowed() public {
        vm.prank(server);
        vault.setBridgeWithdrawExtension(true);

        vm.prank(server);
        vm.expectRevert("Bridge adapter not allowed");
        vault.serverWithdrawToBridgeWithNonce(address(token), user, 100e6, 1, address(adapter), recipient, bytes(""));
    }

    function test_ServerWithdrawToBridgeWithNonce_ReplayBlockedByNonce() public {
        vm.startPrank(server);
        vault.setBridgeWithdrawExtension(true);
        vault.setBridgeAdapter(address(adapter), true);
        vault.serverWithdrawToBridgeWithNonce(address(token), user, 100e6, 1, address(adapter), recipient, bytes(""));
        vm.expectRevert("Nonce too old");
        vault.serverWithdrawToBridgeWithNonce(address(token), user, 100e6, 1, address(adapter), recipient, bytes(""));
        vm.stopPrank();
    }
}

contract MockNoopTarget {
    function run() external payable {}
    function runFor(address) external payable {}
}

contract DebridgeAdapterTest is Test {
    DebridgeAdapter internal adapter;
    MockERC20 internal token;
    MockNoopTarget internal noop;

    address internal owner = address(this);
    address internal vault = address(0x1111);
    address internal user = address(0x2222);

    function setUp() public {
        adapter = new DebridgeAdapter();
        token = new MockERC20("Mock USDC", "mUSDC", 6);
        noop = new MockNoopTarget();

        adapter.setExecutor(vault, true);
        adapter.setTarget(address(noop), true);
        token.mint(vault, 1_000_000e6);
    }

    function test_Bridge_RevertsIfTargetDoesNotConsumeTokens() public {
        uint256 amount = 100e6;
        vm.startPrank(vault);
        token.approve(address(adapter), amount);
        bytes memory data = abi.encode(address(noop), abi.encodeWithSignature("runFor(address)", user), user);
        vm.expectRevert("Token leftover after bridge");
        adapter.bridge(address(token), amount, user, data);
        vm.stopPrank();
    }

    function test_Bridge_RevertsOnRecipientMismatch() public {
        uint256 amount = 50e6;
        vm.startPrank(vault);
        token.approve(address(adapter), amount);
        bytes memory data = abi.encode(address(noop), abi.encodeWithSignature("runFor(address)", user), address(0x9999));
        vm.expectRevert("Recipient mismatch");
        adapter.bridge(address(token), amount, user, data);
        vm.stopPrank();
    }

    function test_OnlyOwnerCanRecoverToken() public {
        token.mint(address(adapter), 10e6);

        vm.prank(user);
        vm.expectRevert();
        adapter.recoverToken(address(token), user, 1e6);

        uint256 before = token.balanceOf(user);
        adapter.recoverToken(address(token), user, 2e6);
        uint256 afterBal = token.balanceOf(user);
        assertEq(afterBal - before, 2e6);
    }
}
