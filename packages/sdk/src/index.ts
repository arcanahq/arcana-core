/**
 * Arcana Frontend SDK
 * 
 * A general-purpose TypeScript SDK for building frontends that interact with Arcana instances.
 * 
 * ## Quick Start (React)
 * 
 * ```tsx
 * import { ArcanaProvider, useArcana, useArcanaHooks } from '@arcanahq/sdk';
 * 
 * // 1. Wrap your app
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
 * // 2. Use in components
 * function MyComponent() {
 *   const { isAuthenticated, authenticate, signOut } = useArcana();
 *   const hooks = useArcanaHooks();
 *   const { data: balances } = hooks.bank.useBalances();
 * }
 * ```
 * 
 * ## Authentication
 * 
 * The SDK supports two authentication modes:
 * - **Device Auth** (recommended): Device-bound tokens with automatic refresh
 * - **Session Auth** (legacy): Simple session tokens
 * 
 * Device auth is enabled by default in browsers and requires a one-time wallet signature.
 * 
 * ## Building Games
 * 
 * Extend `GameClient` to build type-safe game clients:
 * 
 * ```typescript
 * import { GameClient, BaseGameState } from '@arcanahq/sdk';
 * 
 * interface MyGameState extends BaseGameState {
 *   score: number;
 * }
 * 
 * class MyGame extends GameClient<MyGameState> {
 *   async move(x: number, y: number) {
 *     return this.actionOrThrow('move', { x, y });
 *   }
 * }
 * ```
 */

// =============================================================================
// Core Client
// =============================================================================

export { ArcanaClient } from './client.js';
export type { ArcanaClientConfig } from './client.js';

// =============================================================================
// React Integration (Provider + Hooks)
// =============================================================================

export {
  // Provider
  ArcanaProvider,
  // Context hooks
  useArcana,
  useArcanaClientFromContext,
  // Convenience hooks
  useArcanaHooks,
  useBankHooks,
  useContractsHooks,
  useScopesHooks,
  useChainHooks,
  // Game hooks
  useGame,
  useCustomGame,
  // Legacy standalone hook
  useArcanaClient,
} from './react/index.js';

export type {
  ArcanaContextValue,
  ArcanaProviderProps,
  UseArcanaClientOptions,
  UseArcanaClientResult,
  UseGameOptions,
  UseGameResult,
} from './react/index.js';

// =============================================================================
// Browser Developer Tools
// =============================================================================

export {
  ArcanaDeveloperTools,
  installArcanaDeveloperToolsMonitor,
} from './devtools/index.js';
export type {
  ArcanaDeveloperToolsProps,
  ArcanaDevtoolsRequestEntry,
} from './devtools/index.js';

// =============================================================================
// Authentication
// =============================================================================

// Legacy session-based auth
export { AuthModule } from './auth/index.js';
export type {
  DomainInfo,
  SignInRequest,
  SignInResponse,
  UserInfo,
  EIP712Domain,
  SignInMessage,
} from './auth/types.js';

// Device auth (recommended)
export { DeviceAuthModule } from './auth/device-auth.js';
export type {
  DeviceAuthConfig,
  DeviceKeyStorage,
  TokenStorage,
  StoredTokens,
  DeviceRegistrationRequest,
  DeviceRegistrationResponse,
  TokenRefreshRequest,
  TokenRefreshResponse,
  DeviceInfo,
  NonceResponse,
  RequestEnvelope,
  SignedRequest,
  DeviceRegistrationTypedData,
} from './auth/device-types.js';

// Storage implementations
export {
  WebKeyStorage,
  WebTokenStorage,
  MemoryKeyStorage,
  MemoryTokenStorage,
} from './auth/device-storage.js';

// Request signing utilities
export {
  signRequest,
  requiresSigning,
  NonceManager,
  createSigningInterceptor,
} from './auth/request-signing.js';
export type { SignRequestOptions, SigningInterceptorConfig } from './auth/request-signing.js';

export type {
  ArcanaTypedDataField,
  ArcanaTypedDataRequest,
  ArcanaWalletAdapter,
} from './auth/wallet-adapter.js';
export { isArcanaWalletAdapter } from './auth/wallet-adapter.js';

// =============================================================================
// API Modules
// =============================================================================

// Programs/Instances. `ContractsModule` remains the exported class name for
// backwards compatibility; ArcanaClient exposes it as both `programs` and
// `contracts`.
export { ContractsModule, EventHistoryCursor } from './contracts/index.js';
export type {
  ArgsStruct,
  InstanceOperation,
  InstanceActionRequest,
  InstanceActionResponse,
  InstanceInfo,
  InstanceEvent,
  TransactionEnvelope,
  TransactionBundle,
  BundleResponse,
  BundleTransactionResult,
  GetEventsOptions,
  GetEventsPageOptions,
  EventHistoryOptions,
  EventHistoryState,
  EventPage,
  TableOrderBy,
  TableReadRequest,
  TableReadResult,
  ViewReadsRequest,
  ViewReadsResult,
  ViewWithReadsResponse,
} from './contracts/types.js';

export { EventsModule } from './events/index.js';
export type { QueryEventsOptions } from './events/index.js';

// Real-time subscriptions
export { SubscriptionsModule, connectWebSocket } from './subscriptions/index.js';
export type {
  SubscribeInstanceOptions,
  SubscribeOptions,
  SubscribeScopeOptions,
  SubscriptionEvent,
  SubscriptionHandle,
  SubscriptionStatus,
  WsConnectOptions,
  WsTopic,
  WsTopicKind,
} from './subscriptions/index.js';

// Optimistic view store
export { OptimisticStore } from './optimistic/index.js';
export type {
  OptimisticApplyResult,
  OptimisticMutation,
  OptimisticReducer,
  OptimisticServerEvent,
  OptimisticStoreOptions,
} from './optimistic/index.js';

// History
export { HistoryModule } from './history/index.js';
export type {
  HistoryItem,
  HistoryPage,
  HistoryListOptions,
  ScopeSummary,
  CapsuleInfo,
  RenderedCapsule,
  SessionView,
} from './history/types.js';

// Tables
export { TablesModule } from './tables/index.js';
export type {
  Table,
  CreateTableRequest,
  JoinTableRequest,
  TableSeat,
  ListTablesOptions,
} from './tables/types.js';

// Transactions
export { TransactionsModule } from './transactions/index.js';
export type {
  TransactionStatus,
  TransactionResult,
  TransactionInfo,
  WaitOptions,
} from './transactions/types.js';

// Billing
export { BillingModule } from './billing/index.js';
export type {
  Project,
  ProjectFunding,
  BillingEvent,
  Budget,
  BillingTransaction,
  UserBalance,
  CreateProjectRequest,
  FundProjectRequest,
  FundUserRequest,
  ProjectUsage,
  ProjectStorage,
} from './billing/types.js';

// Scopes
export { ScopesModule } from './scopes/index.js';
export type {
  Scope,
  Program,
  Instance,
  CreateScopeRequest,
  DeployProgramRequest,
  InstallProgramRequest,
  UpdateProgramSettingsRequest,
  CreateInstanceRequest,
  KVStore,
  ListScopesOptions,
  ListProgramsOptions,
  ListInstancesOptions,
  Aggregation,
  AggregationTopOptions,
  AggregationTopUser,
} from './scopes/types.js';

// Bank
export { BankModule } from './bank/index.js';
export type {
  BankBalance,
  BankAsset,
  BankAuthorization,
  BankWithdrawal,
  BankTransfer,
  CreateWithdrawalRequest,
  CreateTransferRequest,
  CreateAuthorizationRequest,
  RegisterAssetRequest,
  ListWithdrawalsOptions,
  ListAuthorizationsOptions,
  DepositIntentStatus,
  DepositIntentAmountMode,
  BankDepositIntent,
  CreateDepositIntentRequest,
  ListDepositIntentsOptions,
  WalletIntent,
  ListIntentsOptions,
} from './bank/types.js';

// ERC20 wrapper capability
export { Erc20Module } from './erc20/index.js';
export type {
  Erc20WrapperMetadata,
  Erc20WrapCredit,
  ListErc20CreditsOptions,
  Erc20WalletClient,
} from './erc20/types.js';

// Config
export { ConfigModule } from './config/index.js';
export type {
  ServerMetadata,
  DeploymentConfig,
  BankConfig,
  AssetConfig,
  MonitorStatus,
} from './config/types.js';

// Chain
export { ChainModule, createChainModule } from './chain/index.js';
export type {
  ChainConfig,
  ChainBalance,
  TokenInfo,
} from './chain/types.js';

// =============================================================================
// Games
// =============================================================================

export { GameClient } from './games/index.js';
export type {
  GameActionResult,
  GameEvent,
  BaseGameState,
  GamePlace,
  CreateGameOptions,
} from './games/types.js';

// =============================================================================
// Utilities
// =============================================================================

export {
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
  decodeMsgpackResponse,
  decodeMsgpackBase64,
  decodeMsgpackHex,
  decodeViewResponseData,
  decodeActionEnvelope,
  decodeActionResultHex,
  decodeActionResponseData,
} from './utils/index.js';

// =============================================================================
// Errors and Common Types
// =============================================================================

export {
  ArcanaApiError,
  ArcanaNetworkError,
  ArcanaInstanceError,
  extractData,
} from './types/common.js';
export type { ApiResponse, ApiError } from './types/common.js';

// =============================================================================
// Hook Factories (for advanced usage)
// =============================================================================

export {
  createBillingHooks,
  createScopesHooks,
  createAuthHooks,
  createBankHooks,
  createContractsHooks,
  createConfigHooks,
  createChainHooks,
  createGameHooks,
} from './hooks/index.js';
export type { ContractsHooks, ConfigHooks, ChainHooks, GameHooks } from './hooks/index.js';
