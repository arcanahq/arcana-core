#!/usr/bin/env bash
set -euo pipefail

RPC_URL="${RPC_URL:-http://127.0.0.1:9545}"
ANVIL_HOST="${ANVIL_HOST:-127.0.0.1}"
ANVIL_PORT="${ANVIL_PORT:-9545}"
PRIVATE_KEY="${PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
USER_PRIVATE_KEY="${USER_PRIVATE_KEY:-0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d}"
SERVER_ADDRESS="${SERVER_ADDRESS:-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266}"
USER_ADDRESS="${USER_ADDRESS:-0x70997970C51812dc3A010C7d01b50e0d17dc79C8}"
OTHER_USER_ADDRESS="${OTHER_USER_ADDRESS:-0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ANVIL_PID=""

cleanup() {
  if [ -n "$ANVIL_PID" ]; then
    kill "$ANVIL_PID" >/dev/null 2>&1 || true
    wait "$ANVIL_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

log() {
  printf '[bank-intents-anvil] %s\n' "$*"
}

fail() {
  printf '[bank-intents-anvil] ERROR: %s\n' "$*" >&2
  exit 1
}

require_tool() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

wait_for_anvil() {
  for _ in $(seq 1 60); do
    if cast block-number --rpc-url "$RPC_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  fail "Anvil did not become ready at $RPC_URL"
}

ensure_anvil() {
  if cast block-number --rpc-url "$RPC_URL" >/dev/null 2>&1; then
    log "using existing Anvil at $RPC_URL"
    return
  fi

  log "starting Anvil at $ANVIL_HOST:$ANVIL_PORT"
  anvil --host "$ANVIL_HOST" --port "$ANVIL_PORT" >/tmp/arcana-bank-intents-anvil.log 2>&1 &
  ANVIL_PID="$!"
  wait_for_anvil
}

deploy_contract() {
  local target="$1"
  shift
  forge create "$target" --broadcast --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" "$@" \
    | awk '/Deployed to:/ {print $3}'
}

expect_revert() {
  local name="$1"
  shift
  set +e
  local output
  output=$("$@" 2>&1)
  local code=$?
  set -e
  if [ "$code" -eq 0 ] && ! printf '%s\n' "$output" | grep -q 'status[[:space:]]*0 (failed)'; then
    printf '%s\n' "$output"
    fail "$name unexpectedly succeeded"
  fi
  log "ok: $name rejected"
}

assert_bool() {
  local name="$1"
  local expected="$2"
  shift 2
  local actual
  actual=$("$@")
  if [ "$actual" != "$expected" ]; then
    fail "$name expected $expected, got $actual"
  fi
  log "ok: $name == $expected"
}

assert_u256() {
  local name="$1"
  local expected="$2"
  shift 2
  local actual
  actual=$("$@")
  actual="${actual%% *}"
  if [ "$actual" != "$expected" ]; then
    fail "$name expected $expected, got $actual"
  fi
  log "ok: $name == $expected"
}

require_tool anvil
require_tool cast
require_tool forge

cd "$CONTRACTS_DIR"
ensure_anvil

log "deploying MockERC20 and UserVault"
TOKEN_ADDRESS="$(deploy_contract src/mocks/MockERC20.sol:MockERC20 --constructor-args USDC USDC 18)"
VAULT_ADDRESS="$(deploy_contract src/UserVault.sol:UserVault)"
if [ -z "$TOKEN_ADDRESS" ] || [ -z "$VAULT_ADDRESS" ]; then
  fail "failed to deploy contracts"
fi

cast send "$VAULT_ADDRESS" 'setServerAddress(address)' "$SERVER_ADDRESS" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null
cast send "$VAULT_ADDRESS" 'whitelistToken(address)' "$TOKEN_ADDRESS" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null
cast send "$TOKEN_ADDRESS" 'mint(address,uint256)' "$USER_ADDRESS" 1000000000000000000000 \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null

log "testing deposit intents on Anvil"
DEPOSIT_OLD=0x1111111111111111111111111111111111111111111111111111111111111111
DEPOSIT_NEW=0x2222222222222222222222222222222222222222222222222222222222222222
DEPOSIT_RETRY=0x3333333333333333333333333333333333333333333333333333333333333333
DEPOSIT_ZERO=0x0000000000000000000000000000000000000000000000000000000000000000
DEPOSIT_LOW=0x4444444444444444444444444444444444444444444444444444444444444444
DEPOSIT_UNLISTED=0x5555555555555555555555555555555555555555555555555555555555555555
UNLISTED_TOKEN="$(deploy_contract src/mocks/MockERC20.sol:MockERC20 --constructor-args OTHER OTHER 18)"

expect_revert "zero deposit id" \
  cast send "$VAULT_ADDRESS" 'deposit(address,uint256,bytes32)' "$TOKEN_ADDRESS" 1000000 "$DEPOSIT_ZERO" \
  --rpc-url "$RPC_URL" --private-key "$USER_PRIVATE_KEY"

expect_revert "below minimum deposit does not consume id" \
  cast send "$VAULT_ADDRESS" 'deposit(address,uint256,bytes32)' "$TOKEN_ADDRESS" 1 "$DEPOSIT_LOW" \
  --rpc-url "$RPC_URL" --private-key "$USER_PRIVATE_KEY"
assert_bool "below-min deposit id remains reusable" false \
  cast call "$VAULT_ADDRESS" 'usedDepositIds(bytes32)(bool)' "$DEPOSIT_LOW" --rpc-url "$RPC_URL"

expect_revert "unlisted token deposit does not consume id" \
  cast send "$VAULT_ADDRESS" 'deposit(address,uint256,bytes32)' "$UNLISTED_TOKEN" 1000000 "$DEPOSIT_UNLISTED" \
  --rpc-url "$RPC_URL" --private-key "$USER_PRIVATE_KEY"
assert_bool "unlisted-token deposit id remains reusable" false \
  cast call "$VAULT_ADDRESS" 'usedDepositIds(bytes32)(bool)' "$DEPOSIT_UNLISTED" --rpc-url "$RPC_URL"

expect_revert "deposit transfer failure does not consume id" \
  cast send "$VAULT_ADDRESS" 'deposit(address,uint256,bytes32)' "$TOKEN_ADDRESS" 1000000 "$DEPOSIT_RETRY" \
  --rpc-url "$RPC_URL" --private-key "$USER_PRIVATE_KEY"
assert_bool "failed-transfer deposit id remains reusable" false \
  cast call "$VAULT_ADDRESS" 'usedDepositIds(bytes32)(bool)' "$DEPOSIT_RETRY" --rpc-url "$RPC_URL"

cast send "$TOKEN_ADDRESS" 'approve(address,uint256)' "$VAULT_ADDRESS" 4000000 \
  --rpc-url "$RPC_URL" --private-key "$USER_PRIVATE_KEY" >/dev/null
cast send "$VAULT_ADDRESS" 'deposit(address,uint256,bytes32)' "$TOKEN_ADDRESS" 1000000 "$DEPOSIT_RETRY" \
  --rpc-url "$RPC_URL" --private-key "$USER_PRIVATE_KEY" >/dev/null
assert_bool "retried deposit id is consumed after success" true \
  cast call "$VAULT_ADDRESS" 'usedDepositIds(bytes32)(bool)' "$DEPOSIT_RETRY" --rpc-url "$RPC_URL"

cast send "$VAULT_ADDRESS" 'deposit(address,uint256,bytes32)' "$TOKEN_ADDRESS" 1000000 "$DEPOSIT_OLD" \
  --rpc-url "$RPC_URL" --private-key "$USER_PRIVATE_KEY" >/dev/null
expect_revert "old deposit id replay" \
  cast send "$VAULT_ADDRESS" 'deposit(address,uint256,bytes32)' "$TOKEN_ADDRESS" 1000000 "$DEPOSIT_OLD" \
  --rpc-url "$RPC_URL" --private-key "$USER_PRIVATE_KEY"
cast send "$VAULT_ADDRESS" 'deposit(address,uint256,bytes32)' "$TOKEN_ADDRESS" 1000000 "$DEPOSIT_NEW" \
  --rpc-url "$RPC_URL" --private-key "$USER_PRIVATE_KEY" >/dev/null
assert_bool "old deposit id used" true \
  cast call "$VAULT_ADDRESS" 'usedDepositIds(bytes32)(bool)' "$DEPOSIT_OLD" --rpc-url "$RPC_URL"
assert_bool "new deposit id used" true \
  cast call "$VAULT_ADDRESS" 'usedDepositIds(bytes32)(bool)' "$DEPOSIT_NEW" --rpc-url "$RPC_URL"
assert_u256 "vault balance after deposits" 3000000 \
  cast call "$TOKEN_ADDRESS" 'balanceOf(address)(uint256)' "$VAULT_ADDRESS" --rpc-url "$RPC_URL"

log "testing withdrawal intents on Anvil"
WITHDRAW_NONCE=41
WITHDRAW_LOW_GAS_NONCE=42
WITHDRAW_RETRY_NONCE=43
WITHDRAW_FAR_NONCE=9999

expect_revert "unauthorized withdrawal" \
  cast send "$VAULT_ADDRESS" 'serverWithdrawWithNonce(address,address,uint256,uint64)' "$TOKEN_ADDRESS" "$USER_ADDRESS" 100000 "$WITHDRAW_NONCE" \
  --rpc-url "$RPC_URL" --private-key "$USER_PRIVATE_KEY"
assert_bool "unauthorized withdrawal nonce unused" false \
  cast call "$VAULT_ADDRESS" 'isWithdrawalNonceUsed(address,address,uint64)(bool)' "$TOKEN_ADDRESS" "$USER_ADDRESS" "$WITHDRAW_NONCE" --rpc-url "$RPC_URL"

expect_revert "zero amount withdrawal" \
  cast send "$VAULT_ADDRESS" 'serverWithdrawWithNonce(address,address,uint256,uint64)' "$TOKEN_ADDRESS" "$USER_ADDRESS" 0 "$WITHDRAW_NONCE" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
expect_revert "zero user withdrawal" \
  cast send "$VAULT_ADDRESS" 'serverWithdrawWithNonce(address,address,uint256,uint64)' "$TOKEN_ADDRESS" 0x0000000000000000000000000000000000000000 100000 "$WITHDRAW_NONCE" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
expect_revert "zero token withdrawal" \
  cast send "$VAULT_ADDRESS" 'serverWithdrawWithNonce(address,address,uint256,uint64)' 0x0000000000000000000000000000000000000000 "$USER_ADDRESS" 100000 "$WITHDRAW_NONCE" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
assert_bool "validation failure withdrawal nonce unused" false \
  cast call "$VAULT_ADDRESS" 'isWithdrawalNonceUsed(address,address,uint64)(bool)' "$TOKEN_ADDRESS" "$USER_ADDRESS" "$WITHDRAW_NONCE" --rpc-url "$RPC_URL"

expect_revert "insufficient vault balance leaves nonce reusable" \
  cast send "$VAULT_ADDRESS" 'serverWithdrawWithNonce(address,address,uint256,uint64)' "$TOKEN_ADDRESS" "$USER_ADDRESS" 999999999999 "$WITHDRAW_RETRY_NONCE" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
assert_bool "insufficient-balance withdrawal nonce unused" false \
  cast call "$VAULT_ADDRESS" 'isWithdrawalNonceUsed(address,address,uint64)(bool)' "$TOKEN_ADDRESS" "$USER_ADDRESS" "$WITHDRAW_RETRY_NONCE" --rpc-url "$RPC_URL"

expect_revert "low gas withdrawal leaves nonce reusable" \
  cast send "$VAULT_ADDRESS" 'serverWithdrawWithNonce(address,address,uint256,uint64)' "$TOKEN_ADDRESS" "$OTHER_USER_ADDRESS" 100000 "$WITHDRAW_LOW_GAS_NONCE" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --gas-limit 30000
assert_bool "low-gas withdrawal nonce unused" false \
  cast call "$VAULT_ADDRESS" 'isWithdrawalNonceUsed(address,address,uint64)(bool)' "$TOKEN_ADDRESS" "$OTHER_USER_ADDRESS" "$WITHDRAW_LOW_GAS_NONCE" --rpc-url "$RPC_URL"
cast send "$VAULT_ADDRESS" 'serverWithdrawWithNonce(address,address,uint256,uint64)' "$TOKEN_ADDRESS" "$OTHER_USER_ADDRESS" 100000 "$WITHDRAW_LOW_GAS_NONCE" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null
assert_bool "low-gas retried withdrawal nonce consumed" true \
  cast call "$VAULT_ADDRESS" 'isWithdrawalNonceUsed(address,address,uint64)(bool)' "$TOKEN_ADDRESS" "$OTHER_USER_ADDRESS" "$WITHDRAW_LOW_GAS_NONCE" --rpc-url "$RPC_URL"

cast send "$VAULT_ADDRESS" 'serverWithdrawWithNonce(address,address,uint256,uint64)' "$TOKEN_ADDRESS" "$USER_ADDRESS" 100000 "$WITHDRAW_NONCE" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null
assert_bool "successful withdrawal nonce consumed" true \
  cast call "$VAULT_ADDRESS" 'isWithdrawalNonceUsed(address,address,uint64)(bool)' "$TOKEN_ADDRESS" "$USER_ADDRESS" "$WITHDRAW_NONCE" --rpc-url "$RPC_URL"
expect_revert "duplicate withdrawal nonce replay" \
  cast send "$VAULT_ADDRESS" 'serverWithdrawWithNonce(address,address,uint256,uint64)' "$TOKEN_ADDRESS" "$USER_ADDRESS" 100000 "$WITHDRAW_NONCE" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
expect_revert "nonce too far ahead rejected" \
  cast send "$VAULT_ADDRESS" 'serverWithdrawWithNonce(address,address,uint256,uint64)' "$TOKEN_ADDRESS" "$USER_ADDRESS" 100000 "$WITHDRAW_FAR_NONCE" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"

log "completed successfully token=$TOKEN_ADDRESS vault=$VAULT_ADDRESS"
