// Fill an i32 storage buffer with a single value supplied by uniform.
// One thread per element; standard 1-D dispatch.

struct Uniforms {
    n: u32,
    fill: i32,
    _pad0: u32,
    _pad1: u32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read_write> dst: array<i32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>,
        @builtin(num_workgroups) num_wg: vec3<u32>) {
    let gx_threads: u32 = num_wg.x * 64u;
    let i: u32 = gid.x + gid.y * gx_threads;
    if (i >= u.n) {
        return;
    }
    dst[i] = u.fill;
}
