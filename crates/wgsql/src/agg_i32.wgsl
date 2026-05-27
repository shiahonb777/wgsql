// Multi-aggregate hash GROUP BY:
//   SELECT key, SUM(value), COUNT(*), MIN(value), MAX(value)
//   FROM (keys, values) GROUP BY key.
//
// One pass; four aggregates per group, all in atomic operations on
// per-slot storage. Atomics:
//   - sum   : atomicAdd (saturates host-side to i64)
//   - count : atomicAdd
//   - min   : atomicMin
//   - max   : atomicMax
//
// Slot layout (5 i32 fields per slot):
//   slot_keys[s]   - i32 (atomic, EMPTY_KEY = i32::MIN means free)
//   slot_sums[s]   - atomic<i32>
//   slot_counts[s] - atomic<i32>
//   slot_mins[s]   - atomic<i32>, init i32::MAX
//   slot_maxs[s]   - atomic<i32>, init i32::MIN
//
// Hash table is power-of-two; linear probing on collision.

struct Uniforms {
    n: u32,
    cap: u32,
    cap_minus_one: u32,
    _pad: u32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> keys: array<i32>;
@group(0) @binding(2) var<storage, read> values: array<i32>;
@group(0) @binding(3) var<storage, read_write> slot_keys: array<atomic<i32>>;
@group(0) @binding(4) var<storage, read_write> slot_sums: array<atomic<i32>>;
@group(0) @binding(5) var<storage, read_write> slot_counts: array<atomic<i32>>;
@group(0) @binding(6) var<storage, read_write> slot_mins: array<atomic<i32>>;
@group(0) @binding(7) var<storage, read_write> slot_maxs: array<atomic<i32>>;

const EMPTY_KEY: i32 = -2147483648;  // i32::MIN

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
    let k = keys[i];
    let v = values[i];

    var slot: u32 = hash32(k) & u.cap_minus_one;
    for (var probe: u32 = 0u; probe < u.cap; probe = probe + 1u) {
        let cur = atomicLoad(&slot_keys[slot]);
        if (cur == k) {
            atomicAdd(&slot_sums[slot], v);
            atomicAdd(&slot_counts[slot], 1);
            atomicMin(&slot_mins[slot], v);
            atomicMax(&slot_maxs[slot], v);
            return;
        }
        if (cur == EMPTY_KEY) {
            let cas = atomicCompareExchangeWeak(&slot_keys[slot], EMPTY_KEY, k);
            if (cas.exchanged) {
                atomicAdd(&slot_sums[slot], v);
                atomicAdd(&slot_counts[slot], 1);
                atomicMin(&slot_mins[slot], v);
                atomicMax(&slot_maxs[slot], v);
                return;
            }
            if (cas.old_value == k) {
                atomicAdd(&slot_sums[slot], v);
                atomicAdd(&slot_counts[slot], 1);
                atomicMin(&slot_mins[slot], v);
                atomicMax(&slot_maxs[slot], v);
                return;
            }
        }
        slot = (slot + 1u) & u.cap_minus_one;
    }
}
