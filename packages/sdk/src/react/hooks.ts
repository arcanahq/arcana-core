/**
 * Convenience hooks for Arcana SDK.
 * 
 * These hooks use the ArcanaProvider context and provide
 * easy access to common operations.
 */

import { useMemo } from 'react';
import { useArcana } from './context.js';
import { createBankHooks } from '../hooks/bank.js';
import { createContractsHooks } from '../hooks/contracts.js';
import { createScopesHooks } from '../hooks/scopes.js';
import { createConfigHooks } from '../hooks/config.js';
import { createChainHooks } from '../hooks/chain.js';

/**
 * useArcanaHooks - Get all TanStack Query hooks for Arcana modules.
 * 
 * Must be used within ArcanaProvider.
 * 
 * @example
 * ```tsx
 * function BalanceDisplay() {
 *   const hooks = useArcanaHooks();
 *   const { data: balances, isLoading } = hooks.bank.useBalances();
 *   
 *   if (isLoading) return <div>Loading...</div>;
 *   
 *   return (
 *     <ul>
 *       {balances?.map(b => (
 *         <li key={b.asset_id}>{b.amount}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useArcanaHooks() {
  const { client, chain } = useArcana();

  return useMemo(() => ({
    /** Bank hooks (balances, transfers, withdrawals) */
    bank: createBankHooks(client.bank),
    /** Contract/instance hooks (view, action, events) */
    contracts: createContractsHooks(client.contracts),
    /** Scope hooks (scopes, programs, instances) */
    scopes: createScopesHooks(client.scopes),
    /** Config hooks (metadata, deployment) */
    config: createConfigHooks(client.config),
    /** Chain hooks (token balances, native balance) */
    chain: createChainHooks(chain),
  }), [client, chain]);
}

/**
 * useBankHooks - Get just the bank hooks.
 */
export function useBankHooks() {
  const { client } = useArcana();
  return useMemo(() => createBankHooks(client.bank), [client.bank]);
}

/**
 * useContractsHooks - Get just the contracts hooks.
 */
export function useContractsHooks() {
  const { client } = useArcana();
  return useMemo(() => createContractsHooks(client.contracts), [client.contracts]);
}

/**
 * useScopesHooks - Get just the scopes hooks.
 */
export function useScopesHooks() {
  const { client } = useArcana();
  return useMemo(() => createScopesHooks(client.scopes), [client.scopes]);
}

/**
 * useChainHooks - Get just the chain hooks.
 */
export function useChainHooks() {
  const { chain } = useArcana();
  return useMemo(() => createChainHooks(chain), [chain]);
}

