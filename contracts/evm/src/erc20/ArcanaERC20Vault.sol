// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ArcanaERC20Vault
/// @notice Custody vault for wrapping and unwrapping ERC20 tokens or native ETH into Arcana.
contract ArcanaERC20Vault is Ownable {
    address public constant NATIVE_ETH = address(0);

    bool public allowAllTokens;
    mapping(address => bool) public supportedTokens;
    mapping(bytes32 => bool) public processedArcanaWrapRequests;
    mapping(bytes32 => bool) public processedArcanaUnwrapRequests;

    event AllowAllTokensSet(bool enabled);
    event TokenSupportSet(address indexed token, bool supported);
    event Wrapped(address indexed source, address indexed recipient, address indexed token, uint256 amount);
    event WrappedForArcana(
        address indexed source, bytes32 indexed recipientAccountId, address indexed token, uint256 amount
    );
    event WrappedForArcanaRequest(
        bytes32 indexed requestId,
        address indexed source,
        bytes32 indexed recipientAccountId,
        address token,
        uint256 amount
    );
    event Unwrapped(address indexed source, address indexed recipient, address indexed token, uint256 amount);
    event UnwrappedForRequest(
        bytes32 indexed requestId,
        address indexed source,
        address indexed recipient,
        address token,
        uint256 amount
    );

    constructor(address owner_, bool allowAllTokens_) Ownable(owner_) {
        require(owner_ != address(0), "owner required");
        allowAllTokens = allowAllTokens_;
        emit AllowAllTokensSet(allowAllTokens_);
    }

    function setAllowAllTokens(bool enabled) external onlyOwner {
        allowAllTokens = enabled;
        emit AllowAllTokensSet(enabled);
    }

    function setTokenSupported(address token, bool supported) external onlyOwner {
        require(token != address(0), "token required");
        supportedTokens[token] = supported;
        emit TokenSupportSet(token, supported);
    }

    function isTokenSupported(address token) public view returns (bool) {
        return allowAllTokens || supportedTokens[token];
    }

    function wrap(address token, uint256 amount, address recipient) external {
        require(recipient != address(0), "recipient required");
        require(amount > 0, "amount required");
        require(isTokenSupported(token), "token not supported");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "transfer failed");
        emit Wrapped(msg.sender, recipient, token, amount);
    }

    function wrapForArcana(address token, uint256 amount, bytes32 recipientAccountId) external {
        require(recipientAccountId != bytes32(0), "recipient account required");
        require(amount > 0, "amount required");
        require(isTokenSupported(token), "token not supported");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "transfer failed");
        emit WrappedForArcana(msg.sender, recipientAccountId, token, amount);
    }

    function wrapForArcanaWithRequestId(address token, uint256 amount, bytes32 recipientAccountId, bytes32 requestId)
        external
    {
        require(requestId != bytes32(0), "request id required");
        require(!processedArcanaWrapRequests[requestId], "request already processed");
        require(recipientAccountId != bytes32(0), "recipient account required");
        require(amount > 0, "amount required");
        require(isTokenSupported(token), "token not supported");
        processedArcanaWrapRequests[requestId] = true;
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "transfer failed");
        emit WrappedForArcanaRequest(requestId, msg.sender, recipientAccountId, token, amount);
    }

    function depositNativeForArcana(bytes32 recipientAccountId) external payable {
        require(recipientAccountId != bytes32(0), "recipient account required");
        require(msg.value > 0, "amount required");
        emit WrappedForArcana(msg.sender, recipientAccountId, NATIVE_ETH, msg.value);
    }

    function unwrap(address token, address source, address recipient, uint256 amount) external onlyOwner {
        _unwrap(token, source, recipient, amount);
    }

    function unwrapWithRequestId(address token, address source, address recipient, uint256 amount, bytes32 requestId)
        external
        onlyOwner
    {
        require(requestId != bytes32(0), "request id required");
        require(!processedArcanaUnwrapRequests[requestId], "request already processed");
        processedArcanaUnwrapRequests[requestId] = true;
        _unwrap(token, source, recipient, amount);
        emit UnwrappedForRequest(requestId, source, recipient, token, amount);
    }

    function _unwrap(address token, address source, address recipient, uint256 amount) internal {
        require(source != address(0), "source required");
        require(recipient != address(0), "recipient required");
        require(amount > 0, "amount required");
        if (token == NATIVE_ETH) {
            (bool sent,) = payable(recipient).call{value: amount}("");
            require(sent, "transfer failed");
            emit Unwrapped(source, recipient, token, amount);
            return;
        }
        require(isTokenSupported(token), "token not supported");
        require(IERC20(token).transfer(recipient, amount), "transfer failed");
        emit Unwrapped(source, recipient, token, amount);
    }
}
