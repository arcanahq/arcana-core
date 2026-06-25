import { createZeroDevArcanaWalletAdapter } from './zerodev.js';
import type { ZeroDevArcanaAdapterOptions, ZeroDevArcanaWalletAdapter } from './zerodev.js';

export { registerArcanaDeviceWithAdapter } from './authenticate.js';
export type { ArcanaClientForDeviceRegistration, RegisterArcanaDeviceOptions } from './authenticate.js';
export { createPrivyArcanaWalletAdapter } from './privy.js';
export type { PrivyArcanaAdapterOptions, PrivyWalletLike } from './privy.js';
export { createZeroDevArcanaWalletAdapter } from './zerodev.js';
export type { ZeroDevAccountLike, ZeroDevArcanaAdapterOptions, ZeroDevArcanaWalletAdapter, ZeroDevClientLike } from './zerodev.js';

export function createPrivyZeroDevArcanaWalletAdapter(
  options: ZeroDevArcanaAdapterOptions
): ZeroDevArcanaWalletAdapter {
  return createZeroDevArcanaWalletAdapter(options);
}
