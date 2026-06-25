import {
  formatBalance,
  parseAmount,
  generateAssetId,
  parseAssetId,
  truncateAddress,
  compareAmounts,
  isZeroAmount,
  addAmounts,
  subtractAmounts,
  encodeArgsBytes,
  decodeArgsBytes,
  decodeActionEnvelope,
  decodeActionResultHex,
  decodeActionResponseData,
  decodeViewResponseData,
} from '../utils/index.js';
import { encode } from '@msgpack/msgpack';

describe('Utils', () => {
  describe('formatBalance', () => {
    it('should format balance with 18 decimals', () => {
      expect(formatBalance('1000000000000000000', 18, 2)).toBe('1.00');
      expect(formatBalance('1500000000000000000', 18, 2)).toBe('1.50');
      expect(formatBalance('100000000000000000', 18, 2)).toBe('0.10');
    });

    it('should format balance with 6 decimals', () => {
      expect(formatBalance('1000000', 6, 2)).toBe('1.00');
      expect(formatBalance('1500000', 6, 4)).toBe('1.5000');
    });

    it('should handle zero', () => {
      expect(formatBalance('0', 18, 2)).toBe('0.00');
      expect(formatBalance('', 18, 2)).toBe('0.00');
    });

    it('should handle bigint input', () => {
      expect(formatBalance(BigInt('1000000000000000000'), 18, 2)).toBe('1.00');
    });
  });

  describe('parseAmount', () => {
    it('should parse amount with 18 decimals', () => {
      expect(parseAmount('1', 18)).toBe('1000000000000000000');
      expect(parseAmount('1.5', 18)).toBe('1500000000000000000');
      expect(parseAmount('0.1', 18)).toBe('100000000000000000');
    });

    it('should parse amount with 6 decimals', () => {
      expect(parseAmount('1', 6)).toBe('1000000');
      expect(parseAmount('1.5', 6)).toBe('1500000');
      expect(parseAmount('100', 6)).toBe('100000000');
    });

    it('should handle zero', () => {
      expect(parseAmount('0', 18)).toBe('0');
    });

    it('should handle more decimal places than specified', () => {
      // Should truncate extra decimals
      expect(parseAmount('1.123456789', 6)).toBe('1123456');
    });
  });

  describe('generateAssetId', () => {
    it('should generate asset ID with 0x prefix', () => {
      expect(generateAssetId(1, '0xabc123')).toBe('asset:1:abc123');
    });

    it('should generate asset ID without 0x prefix', () => {
      expect(generateAssetId(31337, 'def456')).toBe('asset:31337:def456');
    });

    it('should lowercase address', () => {
      expect(generateAssetId(1, '0xABC123')).toBe('asset:1:abc123');
    });
  });

  describe('parseAssetId', () => {
    it('should parse valid asset ID', () => {
      const result = parseAssetId('asset:1:abc123');
      expect(result).toEqual({ chainId: 1, address: '0xabc123' });
    });

    it('should return null for invalid format', () => {
      expect(parseAssetId('invalid')).toBeNull();
      expect(parseAssetId('token:1:abc')).toBeNull();
      expect(parseAssetId('asset:abc:123')).toBeNull();
    });
  });

  describe('truncateAddress', () => {
    it('should truncate address', () => {
      expect(truncateAddress('0x1234567890abcdef1234567890abcdef12345678'))
        .toBe('0x1234...5678');
    });

    it('should not truncate short addresses', () => {
      expect(truncateAddress('0x1234')).toBe('0x1234');
    });

    it('should use custom lengths', () => {
      expect(truncateAddress('0x1234567890abcdef1234567890abcdef12345678', 10, 6))
        .toBe('0x12345678...345678');
    });
  });

  describe('compareAmounts', () => {
    it('should compare amounts', () => {
      expect(compareAmounts('100', '200')).toBe(-1);
      expect(compareAmounts('200', '100')).toBe(1);
      expect(compareAmounts('100', '100')).toBe(0);
    });

    it('should handle empty strings', () => {
      expect(compareAmounts('', '100')).toBe(-1);
      expect(compareAmounts('100', '')).toBe(1);
      expect(compareAmounts('', '')).toBe(0);
    });
  });

  describe('isZeroAmount', () => {
    it('should return true for zero', () => {
      expect(isZeroAmount('0')).toBe(true);
      expect(isZeroAmount('')).toBe(true);
    });

    it('should return false for non-zero', () => {
      expect(isZeroAmount('100')).toBe(false);
      expect(isZeroAmount('1')).toBe(false);
    });
  });

  describe('addAmounts', () => {
    it('should add amounts', () => {
      expect(addAmounts('100', '200')).toBe('300');
      expect(addAmounts('1000000000000000000', '1000000000000000000')).toBe('2000000000000000000');
    });

    it('should handle empty strings', () => {
      expect(addAmounts('', '100')).toBe('100');
      expect(addAmounts('100', '')).toBe('100');
    });
  });

  describe('subtractAmounts', () => {
    it('should subtract amounts', () => {
      expect(subtractAmounts('300', '100')).toBe('200');
      expect(subtractAmounts('2000000000000000000', '1000000000000000000')).toBe('1000000000000000000');
    });

    it('should clamp to zero for negative results', () => {
      expect(subtractAmounts('100', '200')).toBe('0');
    });

    it('should handle empty strings', () => {
      expect(subtractAmounts('', '100')).toBe('0');
      expect(subtractAmounts('100', '')).toBe('100');
    });
  });

  describe('args byte helpers', () => {
    it('encodes args to base64 MessagePack bytes', () => {
      const encoded = encodeArgsBytes({ foo: 'bar', n: 2 });
      expect(decodeArgsBytes(encoded)).toEqual({ foo: 'bar', n: 2 });
      expect(encoded).not.toBe(Buffer.from(JSON.stringify({ foo: 'bar', n: 2 }), 'utf8').toString('base64'));
    });

    it('encodes undefined args as empty object', () => {
      const encoded = encodeArgsBytes(undefined);
      expect(encoded).toBe('gA==');
    });

    it('decodes base64 MessagePack bytes to value', () => {
      const payload = { hello: 'world', count: 7 };
      const encoded = encodeArgsBytes(payload);
      expect(decodeArgsBytes(encoded)).toEqual(payload);
    });
  });

  describe('action envelope helpers', () => {
    it('decodes a tuple action envelope', () => {
      const decoded = decodeActionEnvelope([{ value: 3 }, [{ type: 'test' }], [], null, null]);
      expect(decoded.state).toEqual({ value: 3 });
      expect(decoded.events).toEqual([{ type: 'test' }]);
      expect(decoded.error).toBeNull();
    });

    it('decodes a hex-encoded MessagePack action envelope', () => {
      const tuple = [{ value: 9 }, [], [], null, ['E_BAD', 'bad input', { reason: 'x' }]];
      const hex = Buffer.from(encode(tuple)).toString('hex');
      const decoded = decodeActionResultHex<{ value: number }>(hex);
      expect(decoded.state).toEqual({ value: 9 });
      expect(decoded.error?.code).toBe('E_BAD');
      expect(decoded.error?.message).toBe('bad input');
      expect(decoded.error?.data).toEqual({ reason: 'x' });
    });

    it('normalizes action response payload with result_hex', () => {
      const tuple = [{ score: 12 }, [{ type: 'moved' }], [], null, null];
      const hex = Buffer.from(encode(tuple)).toString('hex');
      const normalized = decodeActionResponseData<{ score: number }>({
        result_hex: hex,
        performance: { wasm_execution_ms: 1 },
      });
      expect(normalized.state).toEqual({ score: 12 });
      expect(normalized.new_state).toEqual({ score: 12 });
      expect(normalized.events).toEqual([{ type: 'moved' }]);
      expect(normalized.performance).toEqual({ wasm_execution_ms: 1 });
    });

    it('normalizes action response payload with resultHex', () => {
      const tuple = [{ score: 7 }, [{ type: 'updated' }], [], null, null];
      const hex = Buffer.from(encode(tuple)).toString('hex');
      const normalized = decodeActionResponseData<{ score: number }>({
        resultHex: hex,
        performance: { wasmExecutionMs: 1.5 },
      });
      expect(normalized.resultHex).toBe(hex);
      expect(normalized.state).toEqual({ score: 7 });
      expect(normalized.events).toEqual([{ type: 'updated' }]);
      expect(normalized.performance).toEqual({ wasmExecutionMs: 1.5 });
    });
  });

  describe('view response helpers', () => {
    it('decodes view response payload with result_hex', () => {
      const hex = Buffer.from(encode({ value: 7, status: 'active' })).toString('hex');
      const decoded = decodeViewResponseData<{ value: number; status: string }>({ result_hex: hex });
      expect(decoded).toEqual({ value: 7, status: 'active' });
    });

    it('decodes view response payload with resultHex', () => {
      const hex = Buffer.from(encode({ value: 11, status: 'ready' })).toString('hex');
      const decoded = decodeViewResponseData<{ value: number; status: string }>({ resultHex: hex });
      expect(decoded).toEqual({ value: 11, status: 'ready' });
    });

    it('passes through decoded view payloads', () => {
      const decoded = decodeViewResponseData<{ ready: boolean }>({ ready: true });
      expect(decoded).toEqual({ ready: true });
    });
  });
});
