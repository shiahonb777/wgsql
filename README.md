# wgsql

**Build dashboards that handle 10 million rows without lag, all in the
browser, on the user's GPU. Data never leaves the device.**

wgsql is a WebGPU compute kernel that runs columnar OLAP — `GROUP BY`,
`WHERE`, multi-aggregate, hash JOIN — directly on whatever GPU is
already in the user's machine. One WGSL kernel, four backends: native
Metal / DX12 / Vulkan + browser WebGPU. ~388 KB wasm, no server, no
upload.

```rust
use wgsql::{Engine, GroupByOptions, Filter};
let engine = Engine::new()?;

// SELECT product, SUM(amount), COUNT(*), MIN(amount), MAX(amount)
// FROM orders WHERE amount >= 100 GROUP BY product
let rows = engine.agg_i32(&product, &amount, GroupByOptions {
    estimated_distinct: Some(1024),
    filter: Some(Filter::ge(100)),
})?;
```

## Live demo

**https://shiahonb777.github.io/wgsql/**

The demo is a side-by-side race. Same data, same query, same slider —
**JavaScript Map running in a Web Worker on the left, wgsql GPU on the
right**. Drag the slider; watch the lag pile up on the left while the
right stays interactive.

Four scenarios share the same WGSL kernel — only the data changes:

| Scenario           | Rows   | Distinct keys | What you do                       |
|--------------------|-------:|--------------:|-----------------------------------|
| 🚖 NYC taxi tips   | 10 M   | 250           | Filter by minimum fare            |
| 📈 Equity trades   | 10 M   | 5 K           | Filter by minimum trade size      |
| 🎮 Game telemetry  | 10 M   | 100 K         | Filter by minimum damage          |
| 🛒 Ad clicks       | 10 M   | 1 M           | Filter by minimum click value     |

The page also has a benchmark panel (GPU vs JS Map vs DuckDB-WASM) and
a drag-drop Parquet box for your own files. Both run entirely in the
tab — nothing is uploaded.

## What this is for

- **Client-side dashboards that don't choke on 10 M rows.** Frontend
  engineers shipping analytics UIs to customers know the moment row
  counts hit single-digit millions, JS-side aggregations stop fitting
  in 16 ms frames. wgsql is the GPU primitive that lets the dashboard
  stay interactive at row counts where `Map` and `Array.reduce` give up.
- **Private analytics.** Healthcare, financial advisory, internal HR
  data — workloads where shipping every byte to a backend is either a
  compliance fight or a latency tax. wgsql aggregates in the user's
  tab. Nothing leaves the device.
- **Embeddable BI.** SaaS founders who want a "data explorer" tab without
  spinning up a Snowflake bill or a backend service per customer. A
  single-page app + a Parquet file in object storage is now a viable
  topology for tens of millions of rows.

## Live numbers

`./target/release/wgsql selftest` on M4 Pro / Metal:

| n      | groups   | CPU HashMap | wgsql GPU | speedup |
|--------|---------:|------------:|----------:|--------:|
| 1M     |    1K    |     5 ms    |     7 ms  | 0.64x — close |
| 1M     |  100K    |     8 ms    |     5 ms  | 1.69x |
| 10M    |    1K    |    48 ms    |    26 ms  | 1.83x |
| **10M** |   **1M** | **357 ms**  |  **29 ms** | **12.5x** |

In Chrome 138 / WebGPU on the same M4 Pro:

| n      | groups   | JS Map (`new Map()`) | wgsql GPU | speedup |
|--------|---------:|---------------------:|----------:|--------:|
| **10M** |   **1M** |          **900 ms** |  **111 ms** | **8.1x** |

Reading these honestly:

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

## Status

**v0.1.** Tested on Chrome 138 + Metal (browser), and natively on
Metal / DX12 / Vulkan. 27 tests pass.

| op                     | status |
|---|---|
| `GROUP BY i32 + SUM`   | ✅ |
| Multi-aggregate (SUM+COUNT+MIN+MAX in one pass) | ✅ |
| `WHERE` filter (eq/ne/lt/le/gt/ge), fused into the kernel | ✅ |
| Inner JOIN on i32 keys | ✅ |
| WASM build / browser   | ✅ |
| Drag-drop Parquet in the demo | ✅ (DuckDB-WASM parses; GPU aggregates) |
| `GROUP BY` on i64 / f32 / string keys | ❌ later |
| OUTER JOIN, ANTI JOIN  | ❌ later |
| Full SQL parser         | ❌ later |

JS API exposed today (see the demo for full usage):

```js
import init, { init as wgsqlInit } from "./wgsql_wasm.js";
await init();
const engine = await wgsqlInit();

// SUM only
const rows = await engine.groupBySumI32(productIds, amounts, /* hint */ 1024);

// SUM + COUNT + MIN + MAX, with optional WHERE
const flat = await engine.aggI32(
  productIds, amounts, /* hint */ 1024,
  { op: "ge", threshold: 100 }    // or null for no filter
);
// flat is [k, sum_lo, sum_hi, count_lo, count_hi, min, max] per row
```

## Architecture

```
Cargo workspace
├── crates/
│   ├── wgsql/             core library
│   │   ├── src/lib.rs     public API
│   │   ├── src/engine.rs  wgpu Device/Queue + pipelines
│   │   └── src/*.wgsl     the kernels
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

The aggregate kernel is a textbook open-address linear-probe hash
table on top of `atomic<i32>` storage buffers. One thread per row;
CAS the key, atomicAdd the value. WHERE is fused into the same pass.
Capacity is `next_pow2(2*estimated_distinct)`; sentinel is `i32::MIN`.

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

27 tests pass: 3 unit (capacity sizing) + 6 GROUP BY/SUM correctness +
5 multi-aggregate + 8 WHERE filter + 5 hash JOIN.

## License

MIT.
