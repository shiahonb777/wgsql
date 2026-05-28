/* tslint:disable */
/* eslint-disable */

export class Engine {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Run SELECT key, SUM(v), COUNT(*), MIN(v), MAX(v) GROUP BY key
     * optionally fused with WHERE (see top-of-file docs).
     *
     * Returns a flat Int32Array of 7 i32 fields per row:
     *   [key, sum_lo, sum_hi, count_lo, count_hi, min, max]
     * JS callers can repack into objects; the layout is dense and
     * avoids any object allocation in the hot path.
     */
    aggI32(keys: Int32Array, values: Int32Array, estimated_distinct: number | null | undefined, filter: any): Promise<any>;
    /**
     * Run SELECT key, SUM(value) GROUP BY key.
     *
     * `keys` and `values` are i32 typed arrays of equal length.
     * `estimatedDistinct` (optional) is the approximate group cardinality;
     * passing it lets us size the GPU hash table tightly and is a 5x+
     * speedup when distinct keys ≪ row count.
     * Returns a flat Int32Array of [key0, sum_lo0, sum_hi0, key1, ...]
     * because JS lacks a native i64 typed array.
     */
    groupBySumI32(keys: Int32Array, values: Int32Array, estimated_distinct?: number | null): Promise<any>;
    /**
     * Adapter name (e.g. "Apple M2 Pro"). Useful for the demo UI.
     */
    readonly adapterName: string;
    /**
     * Backend identifier as a string ("Vulkan", "Metal", "BrowserWebGpu", ...).
     */
    readonly backend: string;
}

/**
 * Construct an Engine; resolves once the WebGPU adapter+device are ready.
 */
export function init(): Promise<Engine>;

export function init_panic_hook(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_engine_free: (a: number, b: number) => void;
    readonly engine_adapterName: (a: number) => [number, number];
    readonly engine_aggI32: (a: number, b: number, c: number, d: number, e: number, f: number, g: any) => any;
    readonly engine_backend: (a: number) => [number, number];
    readonly engine_groupBySumI32: (a: number, b: number, c: number, d: number, e: number, f: number) => any;
    readonly init: () => any;
    readonly init_panic_hook: () => void;
    readonly wasm_bindgen__convert__closures_____invoke__h64f41ba5f43c9580: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen__convert__closures_____invoke__h3b3162ad98dd918f: (a: number, b: number, c: any, d: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h2ebc7f38a7a57206: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h2ebc7f38a7a57206_2: (a: number, b: number, c: any) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_destroy_closure: (a: number, b: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
