# wgsql

A SQL aggregation kernel for WebGPU. Runs `GROUP BY`, `WHERE`, multi-aggregate,
and inner JOIN on the user's GPU through a single WGSL compute kernel. Ten
million rows in roughly a hundred milliseconds, in a browser tab, with no
server and no upload. ~388 KB wasm, MIT.

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

## The demo

[shiahonb777.github.io/wgsql](https://shiahonb777.github.io/wgsql/) shows
the same query running twice on every slider movement: once on a JavaScript
`Map` in a Web Worker, and once on the GPU. Same data, same code path, ten
million rows.

The Web Worker is the most generous JavaScript baseline available in a
browser. It gets its own thread, never blocks the UI, and is what most
production "browser dashboards" are built on. The latency you see between
the two columns is the cost of an aggregation that doesn't fit in CPU cache.

Four scenarios share the same kernel — only the data changes.

| Scenario          | Rows | Distinct keys | Top names                          |
|-------------------|-----:|--------------:|------------------------------------|
| NYC taxi tips     | 10 M | 263           | Times Square, JFK, Williamsburg    |
| Equity trades     | 10 M | 5,000         | AAPL, NVDA, MSFT, BRK.B            |
| Game leaderboard  | 10 M | 50,000        | DragonSlayer42, ShadowMage_X       |
| Product sales     | 10 M | 1,000         | iPhone 15 Pro, AirPods Pro         |

The page also includes a fixed benchmark against `JS Map` and `DuckDB-WASM`,
and a Parquet drop-zone for your own files. The drop-zone parses with
DuckDB-WASM in the same tab and hands the columns to the GPU as `Int32Array`s.

## Where this is useful

It's a primitive, not a product. Three places it's a good fit:

A client-side dashboard that needs to stay interactive past one or two
million rows. JavaScript-side aggregations stop fitting in 16 ms frames at
that point, and the user starts feeling lag on every filter change. wgsql
keeps the work on the GPU and the dashboard on the user's machine.

Private analytics. Healthcare, financial advisory, internal HR. Workloads
where shipping every byte to a backend is a compliance fight or a latency
tax. wgsql aggregates in the user's tab; nothing leaves the device.

Embeddable BI inside a SaaS, without a per-customer backend. A single-page
app plus a Parquet file in object storage is a viable topology for tens of
millions of rows when the aggregation runs on the user's GPU.

## Numbers

Native, on M4 Pro / Metal, via `./target/release/wgsql selftest`:

| n     | groups | CPU HashMap | wgsql GPU | speedup |
|-------|-------:|------------:|----------:|--------:|
| 1 M   | 1 K    | 5 ms        | 7 ms      | 0.64×   |
| 1 M   | 100 K  | 8 ms        | 5 ms      | 1.69×   |
| 10 M  | 1 K    | 48 ms       | 26 ms     | 1.83×   |
| 10 M  | 1 M    | 357 ms      | 29 ms     | 12.5×   |

Browser, on the same M4 Pro / Chrome 138 / WebGPU on Metal:

| n    | groups | JS Map (`new Map()`) | wgsql GPU | speedup |
|------|-------:|---------------------:|----------:|--------:|
| 10 M | 1 M    | 900 ms               | 111 ms    | 8.1×    |

Reading these honestly:

wgsql wins decisively when the hash table outgrows CPU cache. That is the
regime where a 1,024-bin `Map` sitting in L2 stops being free, and where
every hot OLAP workload eventually lives.

At low cardinality, plain CPU `HashMap` is hard to beat. A 1 K-bucket Map is
essentially memory-unbound; the GPU's atomic-contention costs show through.
We don't try to win this regime, and the demo says so on the page.

Native vs. browser: the same kernel runs on both. The browser version is
slower only because of WebGPU's higher dispatch overhead. Native CPU has
Polars and DuckDB; the browser story is the differentiated one.

## Status — v0.1

| Operation                                                | Status |
|----------------------------------------------------------|--------|
| `GROUP BY i32` + `SUM`                                   | done   |
| Multi-aggregate (`SUM`/`COUNT`/`MIN`/`MAX` in one pass)  | done   |
| `WHERE` filter (`eq` / `ne` / `lt` / `le` / `gt` / `ge`) | done   |
| Inner JOIN on `i32` keys                                 | done   |
| WASM build, browser demo                                 | done   |
| Drag-drop Parquet                                        | done   |
| `GROUP BY` on `i64` / `f32` / string keys                | later  |
| Outer / anti JOIN                                        | later  |
| Full SQL parser                                          | later  |

Tested on Chrome 138 + Metal (browser) and natively on Metal, DX12, Vulkan.
27 tests pass: 3 unit (capacity sizing), 6 `GROUP BY`/`SUM` correctness,
5 multi-aggregate, 8 `WHERE` filter, 5 inner JOIN.

## Browser API

```js
import init, { init as wgsqlInit } from "./wgsql_wasm.js";
await init();
const engine = await wgsqlInit();

// SUM only.
const rows = await engine.groupBySumI32(productIds, amounts, /* hint */ 1024);

// SUM + COUNT + MIN + MAX, with optional WHERE.
const flat = await engine.aggI32(
  productIds, amounts, /* hint */ 1024,
  { op: "ge", threshold: 100 }    // or null for no filter
);
// `flat` is [k, sum_lo, sum_hi, count_lo, count_hi, min, max] per row.
```

## Architecture

```
crates/
├── wgsql/             core library
│   ├── src/lib.rs     public API
│   ├── src/engine.rs  wgpu Device/Queue + pipelines
│   └── src/*.wgsl     the kernels
├── wgsql-cli/         `wgsql` CLI: info, selftest
└── wgsql-wasm/        wasm-bindgen wrapper for the browser
examples/
└── hello_groupby.rs   ten-line `SELECT k, SUM(v) GROUP BY k`
docs/                  GitHub Pages: live in-browser demo
└── …
build_wasm.sh          rebuild the WASM bundle into docs/
```

The aggregation kernel is an open-address, linear-probe hash table over
`atomic<i32>` storage buffers. One thread per row, CAS the key, `atomicAdd`
the value. `WHERE` is fused into the same pass; non-matching rows never
touch the hash table. Capacity is `next_pow2(2 × estimated_distinct)`;
the empty sentinel is `i32::MIN`.

## Build

```bash
# native
cargo build --release
./target/release/wgsql info        # check the GPU adapter
./target/release/wgsql selftest    # CPU vs. GPU benchmark
./target/release/hello_groupby     # the ten-line example

# browser (WASM)
rustup target add wasm32-unknown-unknown
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
./build_wasm.sh
python3 -m http.server 8088 --directory docs
# WebGPU requires HTTPS or localhost.
```

## License

MIT.
