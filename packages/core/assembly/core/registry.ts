// @ts-nocheck
/**
 * EntrypointRegistry - simple registry for entrypoint handlers
 * No built-in container dependency
 */

export type BytesEntrypoint<ContextT> = (
  context: ContextT,
  stateBytes: Uint8Array,
  argsBytes: Uint8Array
) => i64;

export class EntrypointRegistry<ContextT> {
  private names: Array<string> = new Array<string>();
  private fns: Array<BytesEntrypoint<ContextT>> = new Array<BytesEntrypoint<ContextT>>();

  add(name: string, fn: BytesEntrypoint<ContextT>): void {
    this.names.push(name);
    this.fns.push(fn);
  }

  get(name: string): BytesEntrypoint<ContextT> | null {
    for (let i = 0; i < this.names.length; i++) {
      if (this.names[i] == name) return this.fns[i];
    }
    return null;
  }

  // Debug: get all registered names
  getAllNames(): Array<string> {
    return this.names;
  }
}

