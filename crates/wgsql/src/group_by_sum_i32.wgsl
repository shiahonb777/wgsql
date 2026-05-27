// Hash GROUP BY + SUM aggregate, integer keys + integer values.
//
// Input:
//   keys[i]   — i32, the grouping key for row i
//   values[i] — i32, the value to sum for row i
//
// Hash table (size = uniform.cap, must be power of two):
//   slot_keys[s]  — i32, EMPTY_KEY (= i32::MIN) means free
//   slot_sums[s]  — atomic<i32>, sum accumulator
//
// One workgroup-thread per input row. Each thread:
//   1. Hashes its key.
//   2. Linear-probes the slot table.
//   3. CAS-installs its key into the first empty/matching slot.
//   4. atomicAdd's its value to that slot's sum.
//
// We use compareExchangeWeak on slot_keys (a non-atomic i32 array
// reinterpreted via atomic<i32>) — WebGPU lets you treat any storage i32
// array as an atomic store.

struct Uniforms {
    n: u32,
    cap: u32,    // power-of-two
    cap_minus_one: u32,
    _pad: u32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> keys: array<i32>;
@group(0) @binding(2) var<storage, read> values: array<i32>;
@group(0) @binding(3) var<storage, read_write> slot_keys: array<atomic<i32>>;
@group(0) @binding(4) var<storage, read_write> slot_sums: array<atomic<i32>>;

const EMPTY_KEY: i32 = -2147483648;  // i32::MIN

// Mix a 32-bit value to spread it across the table. Knuth-style
// multiplicative; cheap and good enough for hash aggregation.
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
    // We dispatch as either (X, 1, 1) when small or (65535, Y, 1) when
    // total threads exceed 65535. Linearize gx + gy * (num_wg.x * 64).
    let gx_threads: u32 = num_wg.x * 64u;
    let i: u32 = gid.x + gid.y * gx_threads;
    if (i >= u.n) {
        return;
    }
    let k = keys[i];
    let v = values[i];

    var slot: u32 = hash32(k) & u.cap_minus_one;
    // Bound the probe; if we somehow wrap around the whole table we
    // give up rather than livelock. With cap = 2*n_distinct rounded up
    // to pow2, this never triggers in practice.
    for (var probe: u32 = 0u; probe < u.cap; probe = probe + 1u) {
        let cur = atomicLoad(&slot_keys[slot]);
        if (cur == k) {
            atomicAdd(&slot_sums[slot], v);
            return;
        }
        if (cur == EMPTY_KEY) {
            // Try to install our key.
            let cas = atomicCompareExchangeWeak(&slot_keys[slot], EMPTY_KEY, k);
            if (cas.exchanged) {
                atomicAdd(&slot_sums[slot], v);
                return;
            }
            // Lost the race; cas.old_value is whatever the winner wrote.
            if (cas.old_value == k) {
                atomicAdd(&slot_sums[slot], v);
                return;
            }
            // else: another distinct key won this slot, fall through and
            // probe.
        }
        slot = (slot + 1u) & u.cap_minus_one;
    }
    // Table full — caller's capacity logic should prevent this.
}
