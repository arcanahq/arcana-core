// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IBridgeAdapter} from "./interfaces/IBridgeAdapter.sol";

/**
 * @title UserVault
 * @notice Manages user deposits and withdrawals for game balances
 * @dev Users deposit tokens to this vault to play games. The server monitors Deposit events
 *      and updates balances in its database. The server can withdraw tokens on behalf of users
 *      via serverWithdraw. Only whitelisted tokens can be deposited. Withdrawals work for all tokens
 *      regardless of whitelist status, ensuring funds are never trapped if a token is removed from
 *      the whitelist. All balance tracking is done off-chain by the server.
 */
contract UserVault is Ownable {
    // Server address that can update balances for game outcomes and whitelist tokens
    address public serverAddress;

    // Counter for unique deposit IDs
    uint256 private depositCounter;

    uint256 public constant MAX_DEPOSIT_SIZE = 10000000000000000000000000000000000; // 1e34

    // Mapping of whitelisted token addresses
    mapping(address => bool) public whitelistedTokens;
    mapping(bytes32 => bool) public usedDepositIds;
    // Optional bridge-withdraw extension controls
    bool public bridgeWithdrawalsEnabled;
    mapping(address => bool) public allowedBridgeAdapters;

    // Sliding nonce window per (token,user) channel for bounded replay protection
    struct NonceWindow {
        uint64 baseNonce;
        uint256 usedBitmap;
    }
    mapping(bytes32 => NonceWindow) private nonceWindows;

    // Array to track all whitelisted tokens (for enumeration)
    address[] public whitelistedTokensList;

    // Maximum number of whitelisted tokens
    uint256 public constant MAX_WHITELISTED_TOKENS = 30;

    event Deposit(address indexed user, address indexed token, uint256 amount, bytes32 indexed depositId);
    event DepositFor(address indexed user, address indexed recipient, address indexed token, uint256 amount);
    event Withdrawal(address indexed user, address indexed token, uint256 amount);
    event WithdrawalProcessedWithNonce(
        address indexed user, address indexed token, uint256 amount, uint64 indexed nonce
    );
    event BridgeWithdrawExtensionSet(bool enabled);
    event BridgeAdapterSet(address indexed adapter, bool enabled);
    event WithdrawalBridgedWithNonce(
        address indexed user, address indexed token, uint256 amount, uint64 nonce, address adapter, address recipient
    );
    event TokenWhitelisted(address indexed token);
    event TokenRemovedFromWhitelist(address indexed token);
    event MinDepositAmountSet(address indexed token, uint256 amount);

    /// Per-token minimum deposit (0 = use default 1e6)
    mapping(address => uint256) public minDepositAmountPerToken;

    /// Default minimum deposit when per-token min not set
    uint256 public constant DEFAULT_MIN_DEPOSIT = 1e6;

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Set the server address (can only be set once)
     * @param _serverAddress The server address that can update balances
     */
    function setServerAddress(address _serverAddress) external {
        require(msg.sender == owner(), "Only owner can set server");
        require(serverAddress == address(0), "Server address already set");
        require(_serverAddress != address(0), "Invalid server address");
        serverAddress = _serverAddress;
    }

    /// @notice Enable/disable bridge-withdraw extension (server-only).
    function setBridgeWithdrawExtension(bool enabled) external {
        require(msg.sender == serverAddress, "Only server can configure bridge extension");
        bridgeWithdrawalsEnabled = enabled;
        emit BridgeWithdrawExtensionSet(enabled);
    }

    /// @notice Allow or deny a bridge adapter (server-only).
    function setBridgeAdapter(address adapter, bool enabled) external {
        require(msg.sender == serverAddress, "Only server can configure bridge adapter");
        require(adapter != address(0), "Invalid bridge adapter");
        allowedBridgeAdapters[adapter] = enabled;
        emit BridgeAdapterSet(adapter, enabled);
    }

    /**
     * @notice Whitelist a token for deposits (server-only)
     * @param token Address of the token to whitelist
     */
    function whitelistToken(address token) external {
        require(msg.sender == serverAddress, "Only server can whitelist tokens");
        require(token != address(0), "Invalid token address");
        require(!whitelistedTokens[token], "Token already whitelisted");
        require(whitelistedTokensList.length < MAX_WHITELISTED_TOKENS, "Maximum whitelisted tokens reached");

        whitelistedTokens[token] = true;
        whitelistedTokensList.push(token);
        emit TokenWhitelisted(token);
    }

    /**
     * @notice Remove a token from the whitelist (server-only)
     * @param token Address of the token to remove from whitelist
     */
    function removeWhitelistToken(address token) external {
        require(msg.sender == serverAddress, "Only server can remove whitelist tokens");
        require(token != address(0), "Invalid token address");
        require(whitelistedTokens[token], "Token not whitelisted");

        whitelistedTokens[token] = false;

        // Remove from array by finding and swapping with last element, then popping
        for (uint256 i = 0; i < whitelistedTokensList.length; i++) {
            if (whitelistedTokensList[i] == token) {
                // Swap with last element
                whitelistedTokensList[i] = whitelistedTokensList[whitelistedTokensList.length - 1];
                // Remove last element
                whitelistedTokensList.pop();
                break;
            }
        }

        emit TokenRemovedFromWhitelist(token);
    }

    /**
     * @notice Set minimum deposit amount for a token (server-only)
     * @param token Address of the whitelisted token
     * @param minAmount Minimum deposit amount (0 to use default 1e6)
     */
    function setMinDepositAmount(address token, uint256 minAmount) external {
        require(msg.sender == serverAddress, "Only server can set min deposit");
        require(whitelistedTokens[token], "Token not whitelisted");
        minDepositAmountPerToken[token] = minAmount;
        emit MinDepositAmountSet(token, minAmount);
    }

    /**
     * @notice Get the effective minimum deposit amount for a token
     * @param token Address of the token
     * @return Effective minimum (per-token setting, or DEFAULT_MIN_DEPOSIT if not set)
     */
    function getMinDepositAmount(address token) external view returns (uint256) {
        uint256 perToken = minDepositAmountPerToken[token];
        return perToken == 0 ? DEFAULT_MIN_DEPOSIT : perToken;
    }

    /**
     * @notice Get the number of whitelisted tokens
     * @return count Number of whitelisted tokens
     */
    function getWhitelistedTokensCount() external view returns (uint256) {
        return whitelistedTokensList.length;
    }

    /**
     * @notice Get all whitelisted token addresses
     * @return tokens Array of whitelisted token addresses
     */
    function getWhitelistedTokens() external view returns (address[] memory) {
        return whitelistedTokensList;
    }

    /**
     * @notice Deposit tokens to user's game balance
     * @param token Address of the token to deposit
     * @param amount Amount of tokens to deposit
     */
    function deposit(address token, uint256 amount) external {
        // Backward-compatible path: generate a unique deposit ID when caller does not provide one.
        depositCounter++;
        bytes32 depositId =
            keccak256(abi.encodePacked(msg.sender, token, amount, depositCounter, block.timestamp, block.number));
        _depositWithId(token, amount, depositId);
    }

    /**
     * @notice Deposit tokens with a caller-provided intent/deposit ID
     * @param token Address of the token to deposit
     * @param amount Amount of tokens to deposit
     * @param depositId Caller-provided bytes32 intent/deposit ID (one-time use expected off-chain)
     */
    function deposit(address token, uint256 amount, bytes32 depositId) external {
        require(depositId != bytes32(0), "Invalid deposit ID");
        _depositWithId(token, amount, depositId);
    }

    /**
     * @notice Deposit tokens directly for a recipient without an off-chain intent ID
     * @param token Address of the token to deposit
     * @param amount Amount of tokens to deposit
     * @param recipient Recipient wallet address to credit off-chain
     */
    function deposit(address token, uint256 amount, address recipient) external {
        require(recipient != address(0), "Invalid recipient");
        _depositForRecipient(token, amount, recipient);
    }

    function _depositWithId(address token, uint256 amount, bytes32 depositId) private {
        _validateDeposit(token, amount);
        require(!usedDepositIds[depositId], "Deposit ID already used");

        IERC20 tokenContract = IERC20(token);
        usedDepositIds[depositId] = true;
        require(tokenContract.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        emit Deposit(msg.sender, token, amount, depositId);
    }

    function _depositForRecipient(address token, uint256 amount, address recipient) private {
        _validateDeposit(token, amount);

        IERC20 tokenContract = IERC20(token);
        require(tokenContract.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        emit DepositFor(msg.sender, recipient, token, amount);
    }

    function _validateDeposit(address token, uint256 amount) private view {
        uint256 minDeposit = minDepositAmountPerToken[token];
        if (minDeposit == 0) minDeposit = DEFAULT_MIN_DEPOSIT;
        require(amount >= minDeposit, "Amount below minimum deposit");
        require(whitelistedTokens[token], "Token not whitelisted");
        require(amount <= MAX_DEPOSIT_SIZE, "Amount exceeds maximum deposit size");
    }

    /**
     * @notice Withdraw tokens from user's game balance to their wallet (server-only)
     * @param token Address of the token to withdraw
     * @param user User address to withdraw for
     * @param amount Amount of tokens to withdraw
     * @dev Only the server can call this to withdraw funds to a user's wallet.
     *      The vault must have sufficient balance. The transfer will revert if insufficient.
     */
    function serverWithdraw(address token, address user, uint256 amount) external {
        require(msg.sender == serverAddress, "Only server can withdraw");
        require(amount > 0, "Amount must be greater than 0");
        require(user != address(0), "Invalid user address");
        require(token != address(0), "Invalid token address");

        IERC20 tokenContract = IERC20(token);

        // Check that vault has sufficient balance
        uint256 vaultBalance = tokenContract.balanceOf(address(this));
        require(vaultBalance >= amount, "Insufficient vault balance");

        require(tokenContract.transfer(user, amount), "Transfer failed");

        emit Withdrawal(user, token, amount);
    }

    /**
     * @notice Withdraw tokens with nonce-window idempotency (server-only)
     * @dev Replay protection uses a 256-wide bitmap per (token,user) channel.
     */
    function serverWithdrawWithNonce(address token, address user, uint256 amount, uint64 nonce) external {
        require(msg.sender == serverAddress, "Only server can withdraw");
        require(amount > 0, "Amount must be greater than 0");
        require(user != address(0), "Invalid user address");
        require(token != address(0), "Invalid token address");

        bytes32 channelKey = keccak256(abi.encodePacked(token, user));
        NonceWindow storage w = nonceWindows[channelKey];

        // Initialize the window on first use.
        if (w.baseNonce == 0 && w.usedBitmap == 0) {
            w.baseNonce = nonce;
        } else {
            _compactNonceWindow(w);
        }

        require(nonce >= w.baseNonce, "Nonce too old");
        uint256 offset = uint256(nonce - w.baseNonce);
        require(offset < 256, "Nonce too far ahead");

        uint256 mask = uint256(1) << offset;
        require((w.usedBitmap & mask) == 0, "Nonce already used");

        IERC20 tokenContract = IERC20(token);
        uint256 vaultBalance = tokenContract.balanceOf(address(this));
        require(vaultBalance >= amount, "Insufficient vault balance");

        // Mark used before transfer to preserve exactly-once semantics.
        w.usedBitmap |= mask;
        require(tokenContract.transfer(user, amount), "Transfer failed");

        emit Withdrawal(user, token, amount);
        emit WithdrawalProcessedWithNonce(user, token, amount, nonce);
    }

    /**
     * @notice Withdraw to a bridge adapter in one transaction (server-only).
     * @dev Uses same nonce channel semantics as `serverWithdrawWithNonce`.
     *      Adapter must be explicitly enabled and extension toggle must be true.
     * @param token Source token in vault.
     * @param user User whose nonce channel this withdrawal consumes.
     * @param amount Amount to bridge.
     * @param nonce Monotonic nonce in (token,user) channel.
     * @param adapter Allowed bridge adapter contract.
     * @param recipient Destination recipient (adapter-specific interpretation).
     * @param bridgeData Adapter-specific calldata blob.
     */
    function serverWithdrawToBridgeWithNonce(
        address token,
        address user,
        uint256 amount,
        uint64 nonce,
        address adapter,
        address recipient,
        bytes calldata bridgeData
    ) external payable {
        require(msg.sender == serverAddress, "Only server can withdraw");
        require(bridgeWithdrawalsEnabled, "Bridge extension disabled");
        require(allowedBridgeAdapters[adapter], "Bridge adapter not allowed");
        require(amount > 0, "Amount must be greater than 0");
        require(user != address(0), "Invalid user address");
        require(token != address(0), "Invalid token address");
        require(recipient != address(0), "Invalid recipient address");

        bytes32 channelKey = keccak256(abi.encodePacked(token, user));
        NonceWindow storage w = nonceWindows[channelKey];

        // Initialize the window on first use.
        if (w.baseNonce == 0 && w.usedBitmap == 0) {
            w.baseNonce = nonce;
        } else {
            _compactNonceWindow(w);
        }

        require(nonce >= w.baseNonce, "Nonce too old");
        uint256 offset = uint256(nonce - w.baseNonce);
        require(offset < 256, "Nonce too far ahead");

        uint256 mask = uint256(1) << offset;
        require((w.usedBitmap & mask) == 0, "Nonce already used");

        IERC20 tokenContract = IERC20(token);
        uint256 vaultBalance = tokenContract.balanceOf(address(this));
        require(vaultBalance >= amount, "Insufficient vault balance");

        // Mark used before external calls. Reverts roll this write back.
        w.usedBitmap |= mask;

        // Reset allowance first for compatibility with strict ERC20 implementations.
        require(tokenContract.approve(adapter, 0), "Approve reset failed");
        require(tokenContract.approve(adapter, amount), "Approve failed");

        // Adapter is expected to pull tokens from vault and initiate bridging.
        IBridgeAdapter(adapter).bridge{value: msg.value}(token, amount, recipient, bridgeData);

        // Best-effort allowance cleanup.
        require(tokenContract.approve(adapter, 0), "Approve cleanup failed");

        emit Withdrawal(user, token, amount);
        emit WithdrawalProcessedWithNonce(user, token, amount, nonce);
        emit WithdrawalBridgedWithNonce(user, token, amount, nonce, adapter, recipient);
    }

    function isWithdrawalNonceUsed(address token, address user, uint64 nonce) external view returns (bool) {
        bytes32 channelKey = keccak256(abi.encodePacked(token, user));
        NonceWindow memory w = nonceWindows[channelKey];
        if (w.baseNonce == 0 && w.usedBitmap == 0) {
            return false;
        }
        if (nonce < w.baseNonce) {
            return true;
        }
        uint256 offset = uint256(nonce - w.baseNonce);
        if (offset >= 256) {
            return false;
        }
        return (w.usedBitmap & (uint256(1) << offset)) != 0;
    }

    function getNonceWindow(address token, address user) external view returns (uint64 baseNonce, uint256 usedBitmap) {
        bytes32 channelKey = keccak256(abi.encodePacked(token, user));
        NonceWindow memory w = nonceWindows[channelKey];
        return (w.baseNonce, w.usedBitmap);
    }

    function _compactNonceWindow(NonceWindow storage w) private {
        // Slide over the contiguous consumed prefix so old nonces are reclaimed.
        while ((w.usedBitmap & 1) == 1) {
            w.usedBitmap >>= 1;
            unchecked {
                w.baseNonce += 1;
            }
        }
    }

    /**
     * @notice Batch withdraw tokens for multiple users (server-only)
     * @param token Address of the token to withdraw
     * @param users Array of user addresses to withdraw for
     * @param amounts Array of amounts to withdraw (must match users array length)
     * @dev Only the server can call this. Processes multiple withdrawals in a single transaction.
     *      Useful for batch processing withdrawals to save gas.
     */
    function serverWithdrawBatch(address token, address[] calldata users, uint256[] calldata amounts) external {
        require(msg.sender == serverAddress, "Only server can withdraw");
        require(token != address(0), "Invalid token address");
        require(users.length == amounts.length, "Arrays length mismatch");
        require(users.length > 0, "Empty arrays");

        IERC20 tokenContract = IERC20(token);

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        // Check that vault has sufficient balance for all withdrawals
        uint256 vaultBalance = tokenContract.balanceOf(address(this));
        require(vaultBalance >= totalAmount, "Insufficient vault balance");

        // Process all withdrawals
        for (uint256 i = 0; i < users.length; i++) {
            require(amounts[i] > 0, "Amount must be greater than 0");
            require(users[i] != address(0), "Invalid user address");
            require(tokenContract.transfer(users[i], amounts[i]), "Transfer failed");
            emit Withdrawal(users[i], token, amounts[i]);
        }
    }
}
