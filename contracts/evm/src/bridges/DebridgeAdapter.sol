// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IBridgeAdapter} from "../interfaces/IBridgeAdapter.sol";

/**
 * @title DebridgeAdapter
 * @notice Generic deBridge adapter that can execute prepared DLN tx payloads.
 * @dev Executor (vault) must be allowlisted. Targets are allowlisted for safety.
 */
contract DebridgeAdapter is Ownable, IBridgeAdapter {
    mapping(address => bool) public allowedExecutors;
    mapping(address => bool) public allowedTargets;

    event ExecutorSet(address indexed executor, bool enabled);
    event TargetSet(address indexed target, bool enabled);
    event DebridgeCallExecuted(
        address indexed executor, address indexed token, uint256 amount, address indexed recipient, address target
    );
    event TokensRecovered(address indexed token, address indexed to, uint256 amount);
    event NativeRecovered(address indexed to, uint256 amount);

    constructor() Ownable(msg.sender) {}

    function setExecutor(address executor, bool enabled) external onlyOwner {
        require(executor != address(0), "Invalid executor");
        allowedExecutors[executor] = enabled;
        emit ExecutorSet(executor, enabled);
    }

    function setTarget(address target, bool enabled) external onlyOwner {
        require(target != address(0), "Invalid target");
        allowedTargets[target] = enabled;
        emit TargetSet(target, enabled);
    }

    /**
     * @param data ABI-encoded payload: (address target, bytes targetCalldata, address expectedRecipient)
     */
    function bridge(address token, uint256 amount, address recipient, bytes calldata data)
        external
        payable
        override
        returns (bytes memory adapterResult)
    {
        require(allowedExecutors[msg.sender], "Executor not allowed");
        require(token != address(0), "Invalid token");
        require(amount > 0, "Invalid amount");
        require(recipient != address(0), "Invalid recipient");

        (address target, bytes memory targetCalldata, address expectedRecipient) =
            abi.decode(data, (address, bytes, address));
        require(expectedRecipient == recipient, "Recipient mismatch");
        require(allowedTargets[target], "Target not allowed");
        require(_containsRecipientWord(targetCalldata, recipient), "Recipient not present in calldata");

        IERC20 tokenContract = IERC20(token);
        uint256 preBalance = tokenContract.balanceOf(address(this));
        require(tokenContract.transferFrom(msg.sender, address(this), amount), "Pull failed");
        require(tokenContract.approve(target, 0), "Approve reset failed");
        require(tokenContract.approve(target, amount), "Approve failed");

        (bool ok, bytes memory result) = target.call{value: msg.value}(targetCalldata);
        require(ok, "Debridge target call failed");

        require(tokenContract.approve(target, 0), "Approve cleanup failed");
        uint256 postBalance = tokenContract.balanceOf(address(this));
        require(postBalance <= preBalance, "Token leftover after bridge");
        emit DebridgeCallExecuted(msg.sender, token, amount, recipient, target);
        return result;
    }

    function _containsRecipientWord(bytes memory blob, address recipient) private pure returns (bool) {
        if (blob.length < 32) {
            return false;
        }
        bytes32 needle = bytes32(uint256(uint160(recipient)));
        for (uint256 i = 0; i + 32 <= blob.length; i++) {
            bytes32 word;
            assembly {
                word := mload(add(add(blob, 32), i))
            }
            if (word == needle) {
                return true;
            }
        }
        return false;
    }

    function recoverToken(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(to != address(0), "Invalid recipient");
        require(IERC20(token).transfer(to, amount), "Recover transfer failed");
        emit TokensRecovered(token, to, amount);
    }

    function recoverNative(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        (bool ok,) = to.call{value: amount}("");
        require(ok, "Native recover failed");
        emit NativeRecovered(to, amount);
    }
}
