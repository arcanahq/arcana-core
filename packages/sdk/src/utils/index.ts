/**
 * SDK Utility Functions
 * 
 * Common utilities for working with Arcana data:
 * - Balance formatting
 * - Asset ID generation
 * - Amount parsing
 */

/**
 * Format a raw balance amount for display.
 * 
 * @param amount - Raw amount as string (in smallest units)
 * @param decimals - Number of decimals (default: 18)
 * @param precision - Display precision (default: 2)
 * @returns Formatted balance string
 * 
 * @example
 * formatBalance('1000000000000000000', 18, 2) // '1.00'
 * formatBalance('1500000', 6, 4) // '1.5000'
 */
export function formatBalance(
  amount: string | bigint,
  decimals: number = 18,
  precision: number = 2
): string {
  const amountBigInt = typeof amount === 'string' ? BigInt(amount || '0') : amount;
  const divisor = BigInt(10) ** BigInt(decimals);
  const result = Number(amountBigInt) / Number(divisor);
  return result.toFixed(precision);
}

/**
 * Parse a human-readable amount to raw units.
 * 
 * @param amount - Human-readable amount (e.g., '1.5')
 * @param decimals - Number of decimals (default: 18)
 * @returns Raw amount as string
 * 
 * @example
 * parseAmount('1.5', 18) // '1500000000000000000'
 * parseAmount('100', 6) // '100000000'
 */
export function parseAmount(amount: string, decimals: number = 18): string {
  const [whole, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const combined = whole + paddedFraction;
  // Remove leading zeros but keep at least one digit
  return combined.replace(/^0+/, '') || '0';
}

/**
 * Generate an asset ID from chain ID and token address.
 * 
 * @param chainId - EVM chain ID
 * @param tokenAddress - Token contract address (with or without 0x prefix)
 * @returns Formatted asset ID
 * 
 * @example
 * generateAssetId(1, '0x1234...') // 'asset:1:1234...'
 */
export function generateAssetId(chainId: number, tokenAddress: string): string {
  let address = tokenAddress.toLowerCase();
  if (address.startsWith('0x')) {
    address = address.slice(2);
  }
  return `asset:${chainId}:${address}`;
}

/**
 * Parse an asset ID into its components.
 * 
 * @param assetId - Asset ID string
 * @returns Parsed components or null if invalid
 * 
 * @example
 * parseAssetId('asset:1:1234...') // { chainId: 1, address: '0x1234...' }
 */
export function parseAssetId(assetId: string): { chainId: number; address: string } | null {
  const parts = assetId.split(':');
  if (parts.length !== 3 || parts[0] !== 'asset') {
    return null;
  }
  const chainId = parseInt(parts[1], 10);
  if (isNaN(chainId)) {
    return null;
  }
  return {
    chainId,
    address: `0x${parts[2]}`,
  };
}

/**
 * Truncate an address for display.
 * 
 * @param address - Full address
 * @param startChars - Characters to show at start (default: 6)
 * @param endChars - Characters to show at end (default: 4)
 * @returns Truncated address
 * 
 * @example
 * truncateAddress('0x1234567890abcdef1234567890abcdef12345678') // '0x1234...5678'
 */
export function truncateAddress(
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string {
  if (address.length <= startChars + endChars) {
    return address;
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Compare two amounts (in raw units).
 * 
 * @param a - First amount
 * @param b - Second amount
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareAmounts(a: string, b: string): number {
  const aBigInt = BigInt(a || '0');
  const bBigInt = BigInt(b || '0');
  if (aBigInt < bBigInt) return -1;
  if (aBigInt > bBigInt) return 1;
  return 0;
}

/**
 * Check if an amount is zero.
 * 
 * @param amount - Amount to check
 * @returns true if zero or empty
 */
export function isZeroAmount(amount: string): boolean {
  return !amount || amount === '0' || BigInt(amount) === BigInt(0);
}

/**
 * Add two amounts (in raw units).
 * 
 * @param a - First amount
 * @param b - Second amount
 * @returns Sum as string
 */
export function addAmounts(a: string, b: string): string {
  return (BigInt(a || '0') + BigInt(b || '0')).toString();
}

/**
 * Subtract two amounts (in raw units).
 * 
 * @param a - First amount
 * @param b - Amount to subtract
 * @returns Difference as string (clamped to 0 if negative)
 */
export function subtractAmounts(a: string, b: string): string {
  const result = BigInt(a || '0') - BigInt(b || '0');
  return result < BigInt(0) ? '0' : result.toString();
}

export {
  encodeArgsBytes,
  decodeArgsBytes,
  decodeMsgpackResponse,
  decodeMsgpackBase64,
  decodeMsgpackHex,
  decodeViewResponseData,
  decodeActionEnvelope,
  decodeActionResultHex,
  decodeActionResponseData,
} from './bytes.js';
