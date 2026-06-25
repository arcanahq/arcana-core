/**
 * React integration for Arcana SDK.
 * 
 * This module provides:
 * - ArcanaProvider: Context provider for the SDK
 * - useArcana: Hook to access the SDK context
 * - useArcanaHooks: Hook to access TanStack Query hooks
 * - useArcanaClient: Legacy hook for standalone usage
 * 
 * @example
 * ```tsx
 * // Setup in your app root
 * import { ArcanaProvider } from '@arcanahq/sdk';
 * 
 * function App() {
 *   return (
 *     <WagmiProvider config={wagmiConfig}>
 *       <QueryClientProvider client={queryClient}>
 *         <ArcanaProvider apiUrl="http://localhost:3003">
 *           <MyApp />
 *         </ArcanaProvider>
 *       </QueryClientProvider>
 *     </WagmiProvider>
 *   );
 * }
 * 
 * // Use in components
 * import { useArcana, useArcanaHooks } from '@arcanahq/sdk';
 * 
 * function MyComponent() {
 *   const { isAuthenticated, authenticate, signOut } = useArcana();
 *   const hooks = useArcanaHooks();
 *   const { data: balances } = hooks.bank.useBalances();
 * }
 * ```
 */

// Context and provider
export { ArcanaProvider, useArcana, useArcanaClientFromContext } from './context.js';
export type { ArcanaContextValue, ArcanaProviderProps } from './context.js';

// Convenience hooks
export {
  useArcanaHooks,
  useBankHooks,
  useContractsHooks,
  useScopesHooks,
  useChainHooks,
} from './hooks.js';

// Game hooks
export { useGame, useCustomGame } from './useGame.js';
export type { UseGameOptions, UseGameResult } from './useGame.js';

// Legacy standalone hook (for apps not using provider)
export { useArcanaClient } from './useArcanaClient.js';
export type { UseArcanaClientOptions, UseArcanaClientResult } from './useArcanaClient.js';
