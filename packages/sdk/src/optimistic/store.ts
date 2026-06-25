/**
 * Optimistic view store.
 *
 * Holds an authoritative server view plus a stack of pending optimistic
 * mutations. Subscribers see the "computed view" (server view with all pending
 * mutations re-applied on top) until the matching server event arrives.
 *
 * When the server publishes a `SubscriptionEvent` carrying the
 * `client_mutation_id` of a pending mutation, the matching mutation is dropped
 * from the stack and any remaining mutations are rebased onto the new server
 * view. If a server event arrives with a `state_version` lower than what's
 * already committed, that is a monotonicity violation: the store calls the
 * configured `onResync` hook so the caller can refetch authoritative state.
 *
 * The store is transport-agnostic — feed it events from SSE, WebSocket, or a
 * test harness. Rollbacks are idempotent; calling `rollback()` after the
 * mutation has already been committed or rolled back is a no-op.
 */

export interface OptimisticMutation<TArgs = unknown> {
  /** Opaque echo identifier. The server returns this in `client_mutation_id`. */
  id: string;
  entrypoint: string;
  args: TArgs;
}

export interface OptimisticServerEvent<TView> {
  /** Mutation id echoed by the server. When matched, the pending entry is dropped. */
  client_mutation_id?: string;
  /** Authoritative server view to install as the new base. */
  view: TView;
  /** Monotonic version. Lower-than-current triggers a resync. */
  state_version: number;
}

export type OptimisticReducer<TView, TArgs = unknown> = (
  view: TView,
  mutation: OptimisticMutation<TArgs>,
) => TView;

export interface OptimisticStoreOptions<TView, TArgs = unknown> {
  baseView: TView;
  baseStateVersion?: number;
  reduce: OptimisticReducer<TView, TArgs>;
  /**
   * Invoked when a server event's `state_version` is strictly lower than the
   * version already committed locally. The caller should refetch the
   * authoritative view and call `replaceBase`.
   */
  onResync?: (reason: 'state_version_regressed' | 'unknown') => void;
}

export interface OptimisticApplyResult {
  /**
   * Drop this optimistic mutation. Idempotent: safe to call multiple times,
   * and safe to call after the mutation has already been committed (no-op).
   */
  rollback: () => void;
}

interface PendingEntry<TArgs> {
  mutation: OptimisticMutation<TArgs>;
  /** Already removed from the stack — used to make rollback idempotent. */
  resolved: boolean;
}

/**
 * Optimistic view store with mutation-id-based reconciliation.
 *
 * Generic over view type `TView` and mutation args type `TArgs`. Use one
 * instance per logical view (e.g. one per game instance).
 */
export class OptimisticStore<TView, TArgs = unknown> {
  private baseView: TView;
  private baseStateVersion: number;
  private pending: PendingEntry<TArgs>[] = [];
  private cachedView: TView;
  private cachedViewDirty = false;
  private readonly listeners = new Set<(view: TView) => void>();
  private readonly reduce: OptimisticReducer<TView, TArgs>;
  private readonly onResync?: OptimisticStoreOptions<TView, TArgs>['onResync'];

  constructor(opts: OptimisticStoreOptions<TView, TArgs>) {
    this.baseView = opts.baseView;
    this.baseStateVersion = opts.baseStateVersion ?? 0;
    this.cachedView = opts.baseView;
    this.reduce = opts.reduce;
    this.onResync = opts.onResync;
  }

  /** The most recent authoritative server view. */
  getBaseView(): TView {
    return this.baseView;
  }

  /** The current best-effort view: base + pending mutations reduced on top. */
  getView(): TView {
    if (this.cachedViewDirty) {
      this.recomputeCache();
    }
    return this.cachedView;
  }

  /** Number of pending optimistic mutations. */
  pendingCount(): number {
    return this.pending.reduce((n, entry) => n + (entry.resolved ? 0 : 1), 0);
  }

  /**
   * Apply an optimistic mutation on top of the current computed view.
   * Returns a handle whose `rollback()` removes the mutation idempotently.
   */
  applyOptimistic(mutation: OptimisticMutation<TArgs>): OptimisticApplyResult {
    const entry: PendingEntry<TArgs> = { mutation, resolved: false };
    this.pending.push(entry);
    this.cachedViewDirty = true;
    this.notify();
    return {
      rollback: () => {
        if (entry.resolved) return;
        entry.resolved = true;
        this.compactPending();
        this.cachedViewDirty = true;
        this.notify();
      },
    };
  }

  /**
   * Commit an authoritative server view. If `client_mutation_id` matches a
   * pending mutation, that mutation is dropped and any subsequent pending
   * mutations are rebased onto the new view. If `state_version` is strictly
   * lower than the current base, the store invokes `onResync` and otherwise
   * ignores the event.
   */
  commit(event: OptimisticServerEvent<TView>): void {
    if (event.state_version < this.baseStateVersion) {
      this.onResync?.('state_version_regressed');
      return;
    }
    this.baseView = event.view;
    this.baseStateVersion = event.state_version;
    if (event.client_mutation_id) {
      const idx = this.pending.findIndex(
        (entry) => !entry.resolved && entry.mutation.id === event.client_mutation_id,
      );
      if (idx >= 0) {
        this.pending[idx].resolved = true;
        // Drop everything up to and including the matched mutation. Any earlier
        // unresolved entries are also dropped because they're either duplicates
        // or were committed in an event we never saw; trust the server view.
        for (let i = 0; i <= idx; i++) {
          this.pending[i].resolved = true;
        }
        this.compactPending();
      }
    }
    this.cachedViewDirty = true;
    this.notify();
  }

  /**
   * Replace the authoritative base view without reconciling any pending
   * mutations. Used when the caller has refetched after a resync.
   */
  replaceBase(view: TView, stateVersion: number): void {
    this.baseView = view;
    this.baseStateVersion = stateVersion;
    this.cachedViewDirty = true;
    this.notify();
  }

  /** Drop all pending optimistic mutations. Used by resync flows. */
  clearPending(): void {
    if (this.pending.length === 0) return;
    this.pending = [];
    this.cachedViewDirty = true;
    this.notify();
  }

  /**
   * Subscribe to view changes. Listener is called synchronously after each
   * `applyOptimistic`, `commit`, `replaceBase`, or `clearPending` call.
   * Returns an unsubscribe function.
   */
  subscribe(listener: (view: TView) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private compactPending(): void {
    if (this.pending.every((entry) => !entry.resolved)) return;
    this.pending = this.pending.filter((entry) => !entry.resolved);
  }

  private recomputeCache(): void {
    let view = this.baseView;
    for (const entry of this.pending) {
      if (entry.resolved) continue;
      view = this.reduce(view, entry.mutation);
    }
    this.cachedView = view;
    this.cachedViewDirty = false;
  }

  private notify(): void {
    if (this.listeners.size === 0) {
      return;
    }
    const view = this.getView();
    for (const listener of this.listeners) {
      listener(view);
    }
  }
}
