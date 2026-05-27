//! wgsql — GPU-accelerated columnar OLAP via WebGPU.
//!
//! Goal of v0.1 (M1): execute a single hash-aggregate query on the GPU
//!     SELECT key, SUM(value) FROM <columns> GROUP BY key
//! where `key` is `i32` and `value` is `i32`.
//! That kernel is the unit cell every other operator extends.
//!
//! Public API:
//!     Engine::new()                 — initialize a wgpu Device+Queue
//!     Engine::group_by_sum_i32()    — run a GROUP BY/SUM on host slices
//!
//! Future milestones:
//!   M2: WHERE + multi-column GROUP BY + JOIN + WASM build
//!   M3: full query plan + Parquet zero-copy + browser demo
//!
//! Design constraints kept in this version:
//!   - All buffers are flat byte buffers; we don't bind torch/Arrow types
//!     into the GPU directly (yet).
//!   - Hash table is a power-of-two open-address linear probe table.
//!   - `i32` only; `f32` and `i64` follow the same pattern in M2.

#![deny(unsafe_op_in_unsafe_fn)]
#![warn(missing_debug_implementations)]

mod engine;
mod hash;

pub use engine::{Engine, EngineError, GroupBySumResult};
