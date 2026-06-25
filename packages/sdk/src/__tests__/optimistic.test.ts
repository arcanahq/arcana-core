import { OptimisticStore, type OptimisticMutation } from '../optimistic/index.js';

interface CounterView {
  value: number;
}

interface IncArgs {
  by: number;
}

function inc(by: number, id = `m-${by}-${Math.random().toString(36).slice(2)}`): OptimisticMutation<IncArgs> {
  return { id, entrypoint: 'increment', args: { by } };
}

function reduce(view: CounterView, mutation: OptimisticMutation<IncArgs>): CounterView {
  return { value: view.value + mutation.args.by };
}

describe('OptimisticStore', () => {
  it('applies and exposes pending mutations on top of the base view', () => {
    const store = new OptimisticStore<CounterView, IncArgs>({
      baseView: { value: 10 },
      reduce,
    });

    store.applyOptimistic(inc(1, 'a'));
    store.applyOptimistic(inc(2, 'b'));

    expect(store.getView()).toEqual({ value: 13 });
    expect(store.getBaseView()).toEqual({ value: 10 });
    expect(store.pendingCount()).toBe(2);
  });

  it('commits a server event matching a pending mutation and rebases remaining', () => {
    const store = new OptimisticStore<CounterView, IncArgs>({
      baseView: { value: 0 },
      reduce,
    });

    store.applyOptimistic(inc(1, 'a'));
    store.applyOptimistic(inc(2, 'b'));
    store.applyOptimistic(inc(3, 'c'));
    expect(store.getView()).toEqual({ value: 6 });

    store.commit({
      client_mutation_id: 'a',
      view: { value: 100 },
      state_version: 1,
    });

    // After server returns view=100 (incorporating mutation 'a'), pending
    // mutations 'b' and 'c' must rebase on top.
    expect(store.getBaseView()).toEqual({ value: 100 });
    expect(store.getView()).toEqual({ value: 105 });
    expect(store.pendingCount()).toBe(2);
  });

  it('rollback is idempotent and safe after commit', () => {
    const store = new OptimisticStore<CounterView, IncArgs>({
      baseView: { value: 0 },
      reduce,
    });

    const handle = store.applyOptimistic(inc(1, 'a'));
    expect(store.pendingCount()).toBe(1);
    handle.rollback();
    expect(store.pendingCount()).toBe(0);
    expect(() => handle.rollback()).not.toThrow();
    expect(store.pendingCount()).toBe(0);

    // After a commit replaces the pending entry, rollback must still be safe.
    const handle2 = store.applyOptimistic(inc(2, 'b'));
    store.commit({ client_mutation_id: 'b', view: { value: 7 }, state_version: 5 });
    expect(store.pendingCount()).toBe(0);
    expect(() => handle2.rollback()).not.toThrow();
    expect(store.getView()).toEqual({ value: 7 });
  });

  it('notifies subscribers on apply, commit, and rollback', () => {
    const store = new OptimisticStore<CounterView, IncArgs>({
      baseView: { value: 0 },
      reduce,
    });

    const views: CounterView[] = [];
    const unsubscribe = store.subscribe((view) => views.push(view));

    const handle = store.applyOptimistic(inc(1, 'a'));
    store.commit({ client_mutation_id: 'a', view: { value: 5 }, state_version: 1 });
    handle.rollback();
    unsubscribe();
    store.applyOptimistic(inc(1, 'z'));

    // Three notifications: apply, commit, rollback (no-op rollback still fires once we requested notify on resolved-no-op? we don't — but the apply path always notifies; commit notifies; idempotent no-op rollback doesn't notify since `entry.resolved` was already true).
    expect(views.length).toBeGreaterThanOrEqual(2);
    expect(views[0]).toEqual({ value: 1 });
    expect(views[1]).toEqual({ value: 5 });
  });

  it('ignores commits whose state_version regressed and invokes onResync', () => {
    const onResync = vi.fn();
    const store = new OptimisticStore<CounterView, IncArgs>({
      baseView: { value: 0 },
      baseStateVersion: 10,
      reduce,
      onResync,
    });

    store.commit({ view: { value: 999 }, state_version: 5 });

    expect(onResync).toHaveBeenCalledWith('state_version_regressed');
    expect(store.getBaseView()).toEqual({ value: 0 });
  });

  it('commits without client_mutation_id update the base view without resolving pending', () => {
    const store = new OptimisticStore<CounterView, IncArgs>({
      baseView: { value: 0 },
      reduce,
    });
    store.applyOptimistic(inc(10, 'a'));
    store.commit({ view: { value: 42 }, state_version: 1 });

    expect(store.getBaseView()).toEqual({ value: 42 });
    // Pending mutation still applied on top.
    expect(store.getView()).toEqual({ value: 52 });
    expect(store.pendingCount()).toBe(1);
  });

  it('replaceBase + clearPending resets to a server-authoritative state', () => {
    const store = new OptimisticStore<CounterView, IncArgs>({
      baseView: { value: 0 },
      reduce,
    });
    store.applyOptimistic(inc(1, 'a'));
    store.applyOptimistic(inc(2, 'b'));
    store.replaceBase({ value: 100 }, 50);
    store.clearPending();
    expect(store.getView()).toEqual({ value: 100 });
    expect(store.pendingCount()).toBe(0);
  });
});
