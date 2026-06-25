import { describe, it, expect, vi } from 'vitest';
import { Erc20Module, NATIVE_ETH_ADDRESS } from '../erc20/index.js';

describe('Erc20Module pure helpers', () => {
  it('needsApproval compares allowance against amount', () => {
    expect(Erc20Module.needsApproval(0n, 100n)).toBe(true);
    expect(Erc20Module.needsApproval(99n, 100n)).toBe(true);
    expect(Erc20Module.needsApproval(100n, 100n)).toBe(false);
    expect(Erc20Module.needsApproval(200n, 100n)).toBe(false);
    // string inputs are coerced
    expect(Erc20Module.needsApproval('5', '10')).toBe(true);
  });

  it('arcanaAccountIdToBytes32 passes through an existing bytes32', async () => {
    const b32 = '0x' + 'ab'.repeat(32);
    expect(await Erc20Module.arcanaAccountIdToBytes32(b32)).toBe(b32);
    // mixed-case is normalized to lower-case
    expect(await Erc20Module.arcanaAccountIdToBytes32(b32.toUpperCase().replace('0X', '0x'))).toBe(
      b32
    );
  });

  it('arcanaAccountIdToBytes32 derives keccak256 for non-bytes32 ids', async () => {
    const out = await Erc20Module.arcanaAccountIdToBytes32('account-123');
    expect(out).toMatch(/^0x[0-9a-f]{64}$/);
    // deterministic
    expect(await Erc20Module.arcanaAccountIdToBytes32('account-123')).toBe(out);
    // distinct inputs differ
    expect(await Erc20Module.arcanaAccountIdToBytes32('account-124')).not.toBe(out);
  });

  it('deposits native ETH with value and no token approval args', async () => {
    const module = new Erc20Module({} as never);
    const writeContract = vi.fn().mockResolvedValue('0xdeposit');
    const wallet = { writeContract };
    const accountId = `0x${'12'.repeat(32)}`;

    await module.depositNativeForArcana(wallet, {
      wrapperAddress: '0x0000000000000000000000000000000000000001',
      amount: '123',
      arcanaAccountId: accountId,
    });

    expect(writeContract).toHaveBeenCalledWith(expect.objectContaining({
      address: '0x0000000000000000000000000000000000000001',
      functionName: 'depositNativeForArcana',
      args: [accountId],
      value: 123n,
    }));
  });

  it('withdraws native ETH through the vault unwrap entrypoint', async () => {
    const module = new Erc20Module({} as never);
    const writeContract = vi.fn().mockResolvedValue('0xwithdraw');
    const wallet = { writeContract };

    await module.withdrawFromArcana(wallet, {
      wrapperAddress: '0x0000000000000000000000000000000000000001',
      tokenAddress: NATIVE_ETH_ADDRESS,
      source: '0x0000000000000000000000000000000000000002',
      to: '0x0000000000000000000000000000000000000003',
      amount: 456n,
    });

    expect(writeContract).toHaveBeenCalledWith(expect.objectContaining({
      address: '0x0000000000000000000000000000000000000001',
      functionName: 'unwrap',
      args: [
        NATIVE_ETH_ADDRESS,
        '0x0000000000000000000000000000000000000002',
        '0x0000000000000000000000000000000000000003',
        456n,
      ],
    }));
  });
});
