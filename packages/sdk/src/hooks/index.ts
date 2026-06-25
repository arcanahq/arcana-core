/**
 * React hooks for Arcana SDK.
 * 
 * These are hook factory functions that create TanStack Query hooks
 * bound to specific module instances.
 * 
 * For easier usage, use the hooks from `@arcanahq/sdk/react`:
 * - `useArcanaHooks()` - Get all hooks from context
 * - `useBankHooks()` - Get bank hooks from context
 * - etc.
 */

export { createBillingHooks } from './billing.js';
export { createScopesHooks } from './scopes.js';
export { createAuthHooks } from './auth.js';
export { createBankHooks } from './bank.js';
export { createContractsHooks, type ContractsHooks } from './contracts.js';
export { createConfigHooks, type ConfigHooks } from './config.js';
export { createChainHooks, type ChainHooks } from './chain.js';
export { createGameHooks, type GameHooks } from './games.js';
