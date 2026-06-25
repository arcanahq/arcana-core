/**
 * Decorators for contract entrypoints
 * These are compile-time markers used by the transform to generate wrappers
 * 
 * Following the pattern from AssemblyScript decorator stubs.
 * Note: Unlike .d.ts definitions, we need .ts here because these decorators
 * must be importable. The implementations are empty as they're only used by the transform.
 */

/**
 * Constructor decorator - marks a function as a contract constructor
 * Signature: (context: ContractContext, args: ArgsType) => ContractResponse<StateType>
 * Bytes mode: ArgsType may be Uint8Array or ArrayBuffer to receive raw args bytes.
 * Note: This is a compile-time marker, never called at runtime
 */
export function constructor(): void {}

/**
 * Action decorator - marks a function as a contract action
 * Signature: (context: ContractContext, state: StateType, args?: ArgsType) => ContractResponse<StateType>
 * Bytes mode: ArgsType may be Uint8Array or ArrayBuffer to receive raw args bytes.
 * Note: This is a compile-time marker, never called at runtime
 */
export function action(): void {}

/**
 * View decorator - marks a function as a contract view
 * 
 * Usage:
 * - @view - marks the default public view entrypoint, named "view"
 * - @view("custom_name") - custom named view entrypoint
 * 
 * Signature: (context: ContractContext, state: StateType, args?: ArgsType) => ViewType
 * Bytes mode: ArgsType may be Uint8Array or ArrayBuffer to receive raw args bytes.
 * Note: This is a compile-time marker, never called at runtime
 */
export function view(nameOrOptions: string = ""): void {}

/**
 * MessagePack view decorator - marks a data class for compile-time positional
 * MessagePack encode/decode generation.
 *
 * Field declaration order is the wire format.
 * Note: This is a compile-time marker, never called at runtime.
 */
export function msgpackView(): void {}

/**
 * MessagePack args decorator - marks a ContractArgs class for compile-time
 * positional MessagePack argument decoding generation.
 *
 * Field declaration order is the wire format.
 * Note: This is a compile-time marker, never called at runtime.
 */
export function msgpackArgs(): void {}

/**
 * Arcana state decorator - marks a mirror working-state class for compile-time
 * generation of fromBytes/fromView/toView/toBytes from the matching *View class.
 *
 * The matching view is inferred by naming convention: FooState -> FooStateView.
 * The generated toView() is the persisted storage projection. Public/private
 * view entrypoints should return separately named view types when they expose
 * a different shape.
 * Note: This is a compile-time marker, never called at runtime.
 */
export function arcanaState(): void {}

/**
 * Arcana event decorator - marks a data class for compile-time typed event
 * payload generation.
 *
 * Field names become payload keys. Primitive field values are converted to
 * strings to match the existing event wire format.
 * Note: This is a compile-time marker, never called at runtime.
 */
export function arcanaEvent(type: string): void {}

/**
 * Event topic decorator - marks an @arcanaEvent field as an indexed topic.
 *
 * Topics are emitted in source declaration order, capped at four slots.
 * Note: This is a compile-time marker, never called at runtime.
 */
export function topic(): void {}
