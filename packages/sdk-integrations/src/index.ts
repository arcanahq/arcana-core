export {
  createEip1193ArcanaWalletAdapter,
  createViemArcanaWalletAdapter,
} from './common.js';
export type {
  AdapterOptions,
  Eip1193ProviderLike,
  HexAddress,
  HexSignature,
  SignTypedDataCapable,
  ViemWalletClientLike,
} from './common.js';

export { registerArcanaDeviceWithAdapter } from './authenticate.js';
export type {
  ArcanaClientForDeviceRegistration,
  RegisterArcanaDeviceOptions,
} from './authenticate.js';

export { createPrivyArcanaWalletAdapter } from './privy.js';
export type { PrivyArcanaAdapterOptions, PrivyWalletLike } from './privy.js';

export {
  authenticateArcanaWithDynamic,
  createDynamicArcanaWalletAdapter,
  ensureArcanaSessionWithDynamic,
} from './dynamic.js';
export type {
  DynamicArcanaAdapterOptions,
  DynamicArcanaAuthClient,
  DynamicArcanaAuthOptions,
  DynamicArcanaAuthResult,
  DynamicWalletLike,
} from './dynamic.js';

export {
  DEFAULT_ARCANA_TEST_PRIVATE_KEY,
  createTestArcanaWalletAdapter,
} from './test.js';
export type { TestArcanaAdapterOptions } from './test.js';

export { createZeroDevArcanaWalletAdapter } from './zerodev.js';
export type {
  ZeroDevAccountLike,
  ZeroDevArcanaAdapterOptions,
  ZeroDevArcanaWalletAdapter,
  ZeroDevClientLike,
} from './zerodev.js';
