# Standardized u256 Handling System

This document describes the clean, non-error-prone system for handling u256 amounts from onchain contracts to AssemblyScript game engine execution.

## Architecture Principle

**Exact accounting happens in Rust (U256). AssemblyScript receives only normalized fixed-point integers (u64 at 1e6 scale) for game logic/scoring/simulation.**

- **Source of Truth**: Rust maintains full U256 precision for all balances and accounting
- **AssemblyScript**: Receives normalized u64 values at fixed scale (1e6) - any precision loss is only in serialization/deserialization
- **No Risk**: The source of truth (Rust/DB) never loses precision - only the AS representation is normalized

## Overview

The system provides:
1. **Fixed-point normalization** - U256 amounts are normalized to u64 at 1e6 scale before passing to AS
2. **Source of truth preservation** - Full U256 precision maintained in Rust/DB
3. **Type-safe conversions** between U256 (string) and fixed-point u64 (number)
4. **Explicit field detection** using naming conventions
5. **Validation** of u256 values
6. **Reusable utilities** for all game engines

## Architecture

### Flow Diagram

```
Onchain Contract (U256)
    ↓
Rust Server (U256 - source of truth)
    ↓
[Normalize: U256 → human-readable → fixed-point u64 (default 1e8 scale, can override)]
    ↓
AssemblyScript Game Engine (u64 at specified scale)
    ↓
[Denormalize: fixed-point u64 (at specified scale) → human-readable → U256]
    ↓
Rust Server (U256 - source of truth)
    ↓
Effects/Output (U256 string)
```

**Key Points:**
- Rust always maintains full U256 precision (source of truth)
- AS only receives normalized u64 values for game logic
- Any precision loss is only in the AS round-trip, never in the source of truth
- Withdrawals and exact balances stay in Rust

### Key Components

1. **Rust Conversion Functions** (`arcana/crates/contracts-db/src/conversions.rs`)
   - `is_amount_field()` - Detects amount fields by naming convention
   - `is_valid_u256_string()` - Validates u256 strings
   - `downscale_amounts_in_json()` - Converts u256 strings to u64 numbers
   - `upscale_amounts_in_json()` - Converts u64 numbers back to u256 strings

2. **AssemblyScript Utilities** (`libs/@core/assembly/`)
   - `conversions.ts` - u256 validation and conversion functions
   - `amount_utils.ts` - High-level amount parsing and manipulation utilities

## Amount Field Detection

Amount fields are automatically detected by naming convention. Fields ending in:
- `amount`, `Amount`
- `wager`, `Wager`
- `bet`, `Bet`
- `stake`, `Stake`
- `balance`, `Balance`
- `value`, `Value`
- `sb`, `bb`, `ante`, `rake`, `rapecap`, `price`, `cost`

### Example

```typescript
// These fields will be automatically detected as amounts:
{
  "amount": "1000000000000000000",      // ✓ Detected
  "betAmount": "500000000000000000",    // ✓ Detected
  "wager": "2000000000000000000",       // ✓ Detected
  "token": "ETH",                       // ✗ Not detected (not an amount)
  "playerId": "player1"                 // ✗ Not detected (not an amount)
}
```

## Usage in Game Engines

### Basic Amount Parsing

```typescript
import {
  parse_amount_required,
  parse_amount_positive,
  amount_to_string
} from "@arcanahq/core/assembly/index";

// Parse and validate an amount (throws if invalid)
const amount = parse_amount_positive(args.amount, "amount");

// Use BigInt for calculations
const doubled = amount.mul(BigInt.from(2));

// Convert back to string for effects
const amountStr = amount_to_string(doubled);
```

### Handling Optional Amounts

```typescript
import { parse_amount } from "@arcanahq/core/assembly/index";

// Parse optional amount (returns null if invalid or missing)
const amount = parse_amount(args.amount);
if (amount != null && amount.gt(BigInt.ZERO)) {
  // Process amount
}
```

### Amount Arithmetic

```typescript
import {
  add_amounts,
  subtract_amounts,
  multiply_amount,
  compare_amounts
} from "@arcanahq/core/assembly/index";

const total = add_amounts(amount1, amount2);
const difference = subtract_amounts(amount1, amount2);
const scaled = multiply_amount(amount, 2);

if (compare_amounts(amount1, amount2) > 0) {
  // amount1 > amount2
}
```

### Converting to u64 (if needed)

```typescript
import { parse_amount_to_u64 } from "@arcanahq/core/assembly/index";

// Convert to u64 if value fits (returns null if too large)
const amountU64 = parse_amount_to_u64(args.amount);
if (amountU64 != null) {
  // Use u64 for performance-critical operations
} else {
  // Value exceeds u64::MAX, use BigInt instead
  const amount = parse_amount_required(args.amount);
}
```

## Rust Server Configuration

### Enabling/Disabling Normalization

Set `downscaleAmounts` and optionally `fixedPointScale` in the `ContractContext`:

```rust
let context = ContractContext {
    contract_id: "contract1".to_string(),
    caller_id: "user1".to_string(),
    now_ms: now,
    server_seed: seed,
    downscale_amounts: Some(true),  // Enable normalization to fixed-point u64
    token_decimals: Some(18),       // Token decimals (required when normalizing)
    fixed_point_scale: Some(8),     // Optional: override scale (default: 8 = 1e8)
    // For very small memecoins, you might use:
    // fixed_point_scale: Some(9),   // Use 1e9 for extra precision
    // fixed_point_scale: Some(10),  // Use 1e10 for even more precision
};
```

### Scale Override for Special Cases

For assets with extremely small values that need more precision:

```rust
// Example: Very small memecoin that needs 1e9 scale
let context = ContractContext {
    contract_id: "tiny-memecoin-contract".to_string(),
    caller_id: "user1".to_string(),
    now_ms: now,
    server_seed: seed,
    downscale_amounts: Some(true),
    token_decimals: Some(18),
    fixed_point_scale: Some(9),  // Override to 1e9 for this asset
};
```

### Fixed-Point Normalization

The system normalizes U256 amounts to fixed-point u64 (1e6 scale) before passing to AssemblyScript:

- **Normalization**: U256 → human-readable → fixed-point u64 (default 1e8 scale)
- **Fixed Scale**: All amounts in AS are at default 1e8 scale (e.g., 1.95 = 195000000)
- **Scale Override**: Can be overridden per-asset via `ContractContext.fixedPointScale` for special cases
- **Small Value Support**: Default 1e8 scale supports very small memecoin values (down to 0.00000001)
- **Source of Truth**: Rust always maintains full U256 precision
- **Precision Loss**: Only occurs in the serialization/deserialization to AS, never in source of truth
- **Denormalization**: Fixed-point u64 → human-readable → U256 when returning from AS
- **Token Decimals**: Conversion uses token-specific decimals (18 for ETH, 6 for USDC, etc.)

**Examples:**
- Large value: `"1000000000000000000"` (1 ETH, 18 decimals, default 1e8 scale)
  - Normalized to AS: `100000000` (u64 at 1e8 scale = 1.0)
  - AS works with: `100000000` (simple integer)
  - Denormalized back: `"1000000000000000000"` (full U256 precision restored)

- Small memecoin value: `"10000"` (0.00000000001 tokens, 18 decimals, default 1e8 scale)
  - Normalized to AS: `1` (u64 at 1e8 scale = 0.00000001)
  - AS works with: `1` (simple integer)
  - Denormalized back: `"10000"` (full U256 precision restored, no precision loss)

- Very small memecoin (needs override): `"1000"` (0.000000000001 tokens, 18 decimals)
  - With default 1e8: Normalized to AS: `0` (precision loss - too small)
  - With override 1e9: Normalized to AS: `1` (u64 at 1e9 scale = 0.000000001)
  - Set `fixedPointScale: 9` in ContractContext to use 1e9 for this asset

## Validation Rules

### u256 String Validation

- Must be non-empty
- Must contain only digits (0-9)
- Maximum length: 78 digits (u256 max value)
- Maximum value: `115792089237316195423570985008687907853269984665640564039457584007913129639935`

### Downscaling Validation

- Only amount fields (by naming convention) are downscaled
- Values must fit in u64::MAX (`18446744073709551615`)
- Invalid or oversized values cause errors (no silent fallback)

## Best Practices

1. **Always use string fields for amounts** in schema definitions:
   ```typescript
   @json
   export class PlaceBetArgs extends ContractArgs {
     amount: string = "";  // ✓ Good: string for u256
     // amount: i64 = 0;   // ✗ Bad: loses precision
   }
   ```

2. **Parse amounts early** in entrypoint handlers:
   ```typescript
   export function place_bet(...) {
     const amount = parse_amount_positive(args.amount, "amount");
     // Use amount for validation and calculations
   }
   ```

3. **Use BigInt for calculations** to preserve precision:
   ```typescript
   const total = add_amounts(bet1, bet2);  // ✓ Good
   // const total = bet1 + bet2;          // ✗ Bad: may lose precision
   ```

4. **Convert to string for effects**:
   ```typescript
   const effect = createDecrementBalanceEffect(
     playerId,
     token,
     amount_to_string(amount)  // ✓ Convert to string
   );
   ```

5. **Validate amounts before use**:
   ```typescript
   const amount = parse_amount_positive(args.amount, "amount");
   if (amount.gt(maxBet)) {
     throw new Error("Amount exceeds maximum bet");
   }
   ```

## Migration Guide

### Updating Existing Game Engines

1. **Ensure amount fields are strings**:
   ```typescript
   // Before
   amount: i64 = 0;
   
   // After
   amount: string = "";
   ```

2. **Update amount parsing**:
   ```typescript
   // Before
   const amount = BigInt.fromString(args.amount);
   
   // After
   import { parse_amount_positive } from "@arcanahq/core/assembly/index";
   const amount = parse_amount_positive(args.amount, "amount");
   ```

3. **Use amount utilities for arithmetic**:
   ```typescript
   // Before
   const total = amount1.add(amount2);
   
   // After
   import { add_amounts } from "@arcanahq/core/assembly/index";
   const total = add_amounts(amount1, amount2);
   ```

## Examples

See the following game engines for reference implementations:
- `libs/coinflip/` - Basic amount handling
- `libs/texas-holdem/` - Complex amount calculations
- `libs/blackjack/` - Multiple amount fields

## Troubleshooting

### Error: "Failed to downscale amounts"

**Cause**: An amount value exceeds u64::MAX or is invalid.

**Solution**: 
- Set `downscaleAmounts: false` to use full u256 precision
- Or reduce the amount values to fit in u64

### Error: "Invalid u256 string"

**Cause**: Amount string contains non-numeric characters or exceeds u256 max.

**Solution**: Validate amounts before passing to the game engine.

### Amount precision lost

**Cause**: Using number types instead of strings for amounts.

**Solution**: Always use `string` type for amount fields in schema definitions.

