// Hash JOIN: probe side.
//
// For each row of the probe table:
//   1. Look up the key in the build hash table.
//   2. If found, emit (probe_value, build_value) at an atomic-incremented
//      slot in the output buffer.
//
// Output buffer layout: a flat array `out[2*K]` of i32 where each
// matched pair occupies two consecutive entries. The host knows how many
// pairs were written by reading `out_count`.
//
// Caller MUST size `out_keys` and `out_values` to be at least as large as
// the maximum number of expected matches. We also accept a
// `max_output` cap; threads that would overflow drop their match.

struct Uniforms {
    n: u32,                 // number of probe rows
    cap: u32,
    cap_minus_one: u32,
    max_output: u32,        // capacity of output buffers
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> probe_keys: array<i32>;
@group(0) @binding(2) var<storage, read> probe_values: array<i32>;
@group(0) @binding(3) var<storage, read> slot_keys: array<i32>;
@group(0) @binding(4) var<storage, read> slot_values: array<i32>;
@group(0) @binding(5) var<storage, read_write> out_count: atomic<u32>;
@group(0) @binding(6) var<storage, read_write> out_left: array<i32>;
@group(0) @binding(7) var<storage, read_write> out_right: array<i32>;

const EMPTY_KEY: i32 = -2147483648;

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
    let k = probe_keys[i];
    let pv = probe_values[i];

    var slot: u32 = hash32(k) & u.cap_minus_one;
    for (var probe: u32 = 0u; probe < u.cap; probe = probe + 1u) {
        let cur = slot_keys[slot];
        if (cur == k) {
            let bv = slot_values[slot];
            let pos = atomicAdd(&out_count, 1u);
            if (pos < u.max_output) {
                out_left[pos] = pv;
                out_right[pos] = bv;
            }
            return;
        }
        if (cur == EMPTY_KEY) {
            return;  // miss
        }
        slot = (slot + 1u) & u.cap_minus_one;
    }
}
