# wgsql

GPU-accelerated columnar OLAP via WebGPU. **8× faster than JavaScript
in your browser**, on a 10 M-row GROUP BY. One WGSL kernel, four
backends: native Metal/DX12/Vulkan + browser WebGPU.

```rust
use wgsql::Engine;
let engine = Engine::new()?;
let rows = engine.group_by_sum_i32(&category, &amount)?;
// SELECT category, SUM(amount) FROM ... GROUP BY category
```

## Live demo

**https://shiahonb777.github.io/wgsql/** — click "Run benchmark".

On a Chromium browser with WebGPU enabled (Chrome / Edge / recent
Safari TP):

| Workload                     | JavaScript Map | wgsql GPU | Speedup |
|------------------------------|---------------:|----------:|--------:|
| 10 M rows × 1 M groups       |       900 ms   |   111 ms  | **8.1×** |

(Apple M4 Pro / Chrome 138 / WebGPU Metal backend. Numbers vary by
GPU — but the shape holds: GPU dominates whenever the hash table
exceeds CPU cache, which is most real-world OLAP.)

## Status

**v0.1.** One operator (GROUP BY + SUM on i32 keys and i32 values),
runs in browser and natively. WebGPU integration tested on Chrome /
Metal. The native side passes 9 GPU correctness tests; the browser
side passes a live spot-check vs the JS baseline on every benchmark
run.

## What it can and can't do today

| op                     | status |
|---|---|
| `GROUP BY i32 + SUM`   | ✅ works |
| WASM build / browser   | ✅ works (see live demo above) |
| `WHERE` filter          | ❌ M2 |
| `GROUP BY` on i64/f32 keys | ❌ M2 |
| Multi-aggregate (SUM+COUNT+MIN+MAX in one pass) | ❌ M2 |
| `JOIN`                 | ❌ M3 |
| Parquet zero-copy load | ❌ M3 |
| Full SQL parser         | ❌ later |

## Honest performance

`./target/release/wgsql selftest` on M4 Pro / Metal:

| n      | groups   | CPU HashMap | wgsql GPU | speedup |
|--------|---------:|------------:|----------:|--------:|
| 1M     |    1K    |     5 ms    |     7 ms  | 0.64x — close |
| 1M     |  100K    |     8 ms    |     5 ms  | 1.69x |
| 10M    |    1K    |    48 ms    |    26 ms  | 1.83x |
| **10M** |   **1M** | **357 ms**  |  **29 ms** | **12.5x** |

In the browser (Chrome 138 / WebGPU on M4 Pro):

| n      | groups   | JS Map (`new Map()`) | wgsql GPU | speedup |
|--------|---------:|---------------------:|----------:|--------:|
| **10M** |   **1M** |          **900 ms** |  **111 ms** | **8.1x** |

Reading these numbers honestly:

- **wgsql wins big when the hash table outgrows CPU cache.** That's the
  regime where a 1024-bin Map sitting in L2 stops being free, and where
  every hot OLAP workload eventually lives.
- **At low cardinality, plain CPU HashMap is hard to beat.** A 1K-bucket
  Map is essentially memory-unbound; the GPU's atomic contention costs
  show through. We don't try to win this regime.
- **Native vs browser:** the same kernel runs on both, with the only
  difference being WebGPU's higher dispatch overhead. The browser story
  is what makes this project differentiated; native CPU has Polars and
  DuckDB.

## Architecture

```
Cargo workspace
├── crates/
│   ├── wgsql/             core library
│   │   ├── src/lib.rs     public API
│   │   ├── src/engine.rs  wgpu Device/Queue + pipeline
│   │   ├── src/hash.rs    capacity selection
│   │   └── src/group_by_sum_i32.wgsl   the kernel
│   ├── wgsql-cli/         `wgsql` CLI: info, selftest
│   └── wgsql-wasm/        wasm-bindgen wrapper for the browser
├── examples/
│   └── hello_groupby.rs   10-line "SELECT k, SUM(v) GROUP BY k"
├── docs/                  GitHub Pages: live in-browser demo
│   ├── index.html
│   ├── wgsql_wasm.js
│   └── wgsql_wasm_bg.wasm
└── build_wasm.sh          rebuild the WASM bundle into docs/
```

The kernel is a textbook open-address linear-probe hash table on top
of `atomic<i32>` storage buffers. One thread per row; CAS the key,
atomicAdd the value. Capacity is `next_pow2(2*n)`; sentinel is
`i32::MIN`.

## Build

Native:

```bash
cargo build --release
./target/release/wgsql info        # what GPU am I on?
./target/release/wgsql selftest    # CPU vs GPU benchmark
./target/release/hello_groupby     # the 10-line example
```

Browser (WASM):

```bash
# Once: install the WASM target and wasm-pack.
rustup target add wasm32-unknown-unknown
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Build + copy artifacts into docs/.
./build_wasm.sh

# Serve locally; needs HTTPS or localhost for WebGPU.
python3 -m http.server 8088 --directory docs
# open http://127.0.0.1:8088/
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
