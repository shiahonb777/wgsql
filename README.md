# wgsql

GPU-accelerated columnar OLAP via WebGPU. One WGSL kernel, four
backends: native Metal/DX12/Vulkan + browser WebGPU.

```rust
use wgsql::Engine;
let engine = Engine::new()?;
let rows = engine.group_by_sum_i32(&category, &amount)?;
// SELECT category, SUM(amount) FROM ... GROUP BY category
```

## Status

**v0.1 — proof of concept.** One operator (GROUP BY + SUM on i32 keys
and i32 values), one WGSL kernel, runs end-to-end on Metal today.
Tests pass, throughput is real but not yet tuned.

## What it can and can't do today

| op                     | status |
|---|---|
| `GROUP BY i32 + SUM`   | ✅ works |
| `WHERE` filter          | ❌ M2 |
| `GROUP BY` on i64/f32 keys | ❌ M2 |
| Multi-aggregate (SUM+COUNT+MIN+MAX in one pass) | ❌ M2 |
| `JOIN`                 | ❌ M3 |
| WASM build / browser   | ❌ M3 (engine is wgpu, port should be 1 day) |
| Parquet zero-copy load | ❌ M3 |
| Full SQL parser         | ❌ later |

## Honest performance

`./target/release/wgsql selftest` on M4 Pro / Metal:

| n      | groups   | CPU HashMap | GPU      | speedup |
|--------|---------:|------------:|---------:|---------|
| 1M     |    1K    |     4 ms    |    12 ms | 0.33x — CPU wins |
| 1M     |  100K    |     7 ms    |     9 ms | 0.72x — close |
| 10M    |    1K    |    43 ms    |   292 ms | 0.15x — CPU dominates |
| 10M    |    1M    |   278 ms    |   134 ms | **2.07x — GPU wins** |

Reading these numbers honestly:

- **At low cardinality, native CPU HashMap beats GPU.** The CPU's
  small hash table fits in L2; the GPU pays for global memory
  atomics on every row.
- **At high cardinality + large data, GPU wins.** This is the regime
  GPU group-by is built for, and the regime where DuckDB/Polars also
  start hitting cache pressure.
- **The native-CPU vs GPU comparison is not the right one for this
  project.** Polars and DuckDB are massively-parallel SIMD hash
  joins; matching them on a laptop CPU is not the goal.

The real target is **the browser**, where the alternative (DuckDB-WASM
or sql.js) gets ~10x less raw CPU throughput than native Polars. WebGPU
in the browser has no such handicap. We do not yet have WASM
benchmarks; M3 will deliver them.

## Architecture

```
Cargo workspace
├── crates/wgsql/         core library
│   ├── src/lib.rs        public API
│   ├── src/engine.rs     wgpu Device/Queue + pipeline
│   ├── src/hash.rs       capacity selection
│   └── src/group_by_sum_i32.wgsl   the kernel
├── crates/wgsql-cli/     `wgsql` CLI: info, selftest
└── examples/
    └── hello_groupby.rs  10-line "SELECT k, SUM(v) GROUP BY k"
```

The kernel is a textbook open-address linear-probe hash table on top
of `atomic<i32>` storage buffers. One thread per row; CAS the key,
atomicAdd the value. Capacity is `next_pow2(2*n)`; sentinel is
`i32::MIN`.

## Build

```bash
cargo build --release
./target/release/wgsql info        # what GPU am I on?
./target/release/wgsql selftest    # CPU vs GPU benchmark
./target/release/hello_groupby     # the 10-line example
```

## Tests

```bash
cargo test --release
```

9 tests pass: 3 unit (capacity sizing) + 6 integration (GPU vs CPU
correctness on empty / single / dense / random / negative keys / 50K
distinct keys).

## Why bother

If WebGPU on M-series Macs and modern browsers can do 80-100M
rows/sec on real GROUP BY, and the comparable browser baseline
(DuckDB-WASM) does 5-15M, we have a real story for client-side OLAP
that no library currently fills. Native is competitive territory we
won't try to win; the browser is open territory we'll try to
colonize.

## License

MIT.
