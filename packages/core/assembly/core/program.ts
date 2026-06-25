// @ts-nocheck
/**
 * Program authoring helpers for common AssemblyScript boilerplate.
 */

import { ProgramState } from "./state";
import { GameStateView, ProgramStateView } from "./views";

/**
 * Normalize wallet/caller IDs before comparisons or KV key construction.
 */
export function normalizeCallerId(callerId: string): string {
  let normalized = callerId.trim().toLowerCase();
  if (normalized.length >= 2 && normalized.startsWith('"') && normalized.endsWith('"')) {
    normalized = normalized.slice(1, normalized.length - 1);
  }
  return normalized;
}

/**
 * Copy base ProgramState fields into an existing state object.
 */
export function applyProgramStateView<T extends ProgramState>(state: T, view: ProgramStateView): T {
  const baseState = ProgramState.fromView(view);
  state.randomSeedFields = baseState.randomSeedFields;
  state.status = baseState.status;
  state.environment = baseState.environment;
  state.createdAt = baseState.createdAt;
  return state;
}

/**
 * Create the nested ProgramStateView used by hybrid view classes.
 */
export function programStateToView(state: ProgramState): ProgramStateView {
  const view = new ProgramStateView();
  view.randomSeedFields = state.randomSeedFields.toView();
  view.status = state.status;
  view.environment = state.environment;
  view.createdAt = state.createdAt;
  return view;
}

/**
 * Create the nested GameStateView used by legacy hybrid game view classes.
 */
export function gameStateToView(state: ProgramState): GameStateView {
  const view = new GameStateView();
  view.randomSeedFields = state.randomSeedFields.toView();
  view.status = state.status;
  view.environment = state.environment;
  view.createdAt = state.createdAt;
  return view;
}

export function copyStringArray(source: string[] | null): string[] {
  if (source === null || source.length === 0) {
    return new Array<string>(0);
  }
  const out = new Array<string>(source.length);
  for (let i = 0; i < source.length; i++) {
    out[i] = source[i];
  }
  return out;
}

export function copyStringMatrix(source: string[][] | null): string[][] {
  if (source === null || source.length === 0) {
    return new Array<string[]>(0);
  }
  const out = new Array<string[]>(source.length);
  for (let i = 0; i < source.length; i++) {
    out[i] = copyStringArray(source[i]);
  }
  return out;
}

export function copyI64Matrix(source: i64[][] | null): i64[][] {
  if (source === null || source.length === 0) {
    return new Array<i64[]>(0);
  }
  const out = new Array<i64[]>(source.length);
  for (let i = 0; i < source.length; i++) {
    const row = source[i];
    if (row !== null && row.length > 0) {
      const rowCopy = new Array<i64>(row.length);
      for (let j = 0; j < row.length; j++) {
        rowCopy[j] = row[j];
      }
      out[i] = rowCopy;
    } else {
      out[i] = new Array<i64>(0);
    }
  }
  return out;
}
