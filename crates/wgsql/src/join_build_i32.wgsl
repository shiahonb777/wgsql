// Hash JOIN: build side. Inserts (key, value) pairs from the build
// table into a hash table. Used by join_probe_i32.wgsl.
//
// Slot layout (parallel arrays):
//   slot_keys[s]   - i32, EMPTY_KEY (= i32::MIN) means free
//   slot_values[s] - i32, build value for that key
//
// Note: we assume each key appears at most once in the build side
// (typical of a join's "smaller" table being a dimension table). If
// the build side has duplicate keys, only the first inserter wins.
// A future variant could store a chain offset per slot.

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
@group(0) @binding(4) var<storage, read_write> slot_values: array<i32>;

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
    let k = keys[i];
    let v = values[i];

    var slot: u32 = hash32(k) & u.cap_minus_one;
    for (var probe: u32 = 0u; probe < u.cap; probe = probe + 1u) {
        let cur = atomicLoad(&slot_keys[slot]);
        if (cur == k) {
            // Already present (build-side dup) — first writer wins.
            return;
        }
        if (cur == EMPTY_KEY) {
            let cas = atomicCompareExchangeWeak(&slot_keys[slot], EMPTY_KEY, k);
            if (cas.exchanged) {
                slot_values[slot] = v;
                return;
            }
            if (cas.old_value == k) {
                return;
            }
        }
        slot = (slot + 1u) & u.cap_minus_one;
    }
}
