import { createZeroDevArcanaWalletAdapter } from './zerodev.js';
import type { ZeroDevArcanaAdapterOptions, ZeroDevArcanaWalletAdapter } from './zerodev.js';

export { registerArcanaDeviceWithAdapter } from './authenticate.js';
export type { ArcanaClientForDeviceRegistration, RegisterArcanaDeviceOptions } from './authenticate.js';
export { createDynamicArcanaWalletAdapter } from './dynamic.js';
export type { DynamicArcanaAdapterOptions, DynamicWalletLike } from './dynamic.js';
export { createZeroDevArcanaWalletAdapter } from './zerodev.js';
export type { ZeroDevAccountLike, ZeroDevArcanaAdapterOptions, ZeroDevArcanaWalletAdapter, ZeroDevClientLike } from './zerodev.js';

export function createDynamicZeroDevArcanaWalletAdapter(
  options: ZeroDevArcanaAdapterOptions
): ZeroDevArcanaWalletAdapter {
  return createZeroDevArcanaWalletAdapter(options);
}
