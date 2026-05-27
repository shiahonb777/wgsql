// Hash GROUP BY + SUM aggregate, integer keys + integer values.
// Optionally fuses a WHERE filter on the value column.

struct Uniforms {
    n: u32,
    cap: u32,             // power-of-two
    cap_minus_one: u32,
    filter_kind: u32,     // 0=none 1=eq 2=ne 3=lt 4=le 5=gt 6=ge
    filter_threshold: i32,
    _pad0: u32,
    _pad1: u32,
    _pad2: u32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> keys: array<i32>;
@group(0) @binding(2) var<storage, read> values: array<i32>;
@group(0) @binding(3) var<storage, read_write> slot_keys: array<atomic<i32>>;
@group(0) @binding(4) var<storage, read_write> slot_sums: array<atomic<i32>>;

const EMPTY_KEY: i32 = -2147483648;

fn passes_filter(v: i32) -> bool {
    let kind = u.filter_kind;
    if (kind == 0u) { return true; }
    let t = u.filter_threshold;
    if (kind == 1u) { return v == t; }
    if (kind == 2u) { return v != t; }
    if (kind == 3u) { return v <  t; }
    if (kind == 4u) { return v <= t; }
    if (kind == 5u) { return v >  t; }
    return v >= t;
}

fn hash32(x: i32) -> u32 {
    var h: u32 = bitcast<u32>(x);
    h = (h ^ (h >> 16u)) * 0x85ebca6bu;
    h = (h ^ (h >> 13u)) * 0xc2b2ae35u;
    h = h ^ (h >> 16u);
    return h;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>,
        @builtin(num_workgroups) num_wg: vec3<u32>) {
    let gx_threads: u32 = num_wg.x * 64u;
    let i: u32 = gid.x + gid.y * gx_threads;
    if (i >= u.n) {
        return;
    }
    let v = values[i];
    if (!passes_filter(v)) {
        return;
    }
    let k = keys[i];

    var slot: u32 = hash32(k) & u.cap_minus_one;
    for (var probe: u32 = 0u; probe < u.cap; probe = probe + 1u) {
        let cur = atomicLoad(&slot_keys[slot]);
        if (cur == k) {
            atomicAdd(&slot_sums[slot], v);
            return;
        }
        if (cur == EMPTY_KEY) {
            let cas = atomicCompareExchangeWeak(&slot_keys[slot], EMPTY_KEY, k);
            if (cas.exchanged) {
                atomicAdd(&slot_sums[slot], v);
                return;
            }
            if (cas.old_value == k) {
                atomicAdd(&slot_sums[slot], v);
                return;
            }
        }
        slot = (slot + 1u) & u.cap_minus_one;
    }
}
