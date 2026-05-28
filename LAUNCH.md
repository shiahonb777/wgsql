# Launch checklist

Hold this private until ready. Update every number from a fresh run on the
day of, then post.

## Headline

The same SQL `GROUP BY` runs twice on every slider movement: once on a
JavaScript `Map` in a Web Worker, once on the GPU. Same data, ten million
rows, in a browser tab. Read the latency column on each side.

## Twitter thread

**1.** Most "browser dashboards" stop being interactive somewhere around
one or two million rows. Filter changes start dropping frames; users start
feeling the lag.

This demo runs the same `GROUP BY` twice on every slider move — once on a
JavaScript `Map` in a Web Worker, once on the GPU. Ten million rows. Watch
the latency on each side.

shiahonb777.github.io/wgsql

**2.** The Web Worker matters. It's the most generous baseline JavaScript
has in a browser: dedicated thread, never blocks the UI, what most
production analytics frontends are built on. The gap between the two
columns isn't a main-thread argument.

**3.** Four scenarios share one WGSL kernel — taxi tips, equity trades, a
game leaderboard, product sales. Distinct-key counts span 263 to 50,000.
Below ~10⁵ keys, JavaScript is hard to beat. Above that, the hash table
stops fitting in L2 cache and the GPU pulls away.

**4.** On M4 Pro / Chrome 138, the worst-case row of the comparison is
1 M distinct keys × 10 M rows. JS `Map`: 900 ms. DuckDB-WASM (CSV ingest +
query): about 3–5 seconds. wgsql GPU: 111 ms.

**5.** Source: github.com/shiahonb777/wgsql. MIT, v0.1, ~388 KB wasm. WHERE
filters are fused into the aggregation pass. Roadmap: i64 / f32 / string
keys, multi-column GROUP BY, OUTER JOIN, Parquet zero-copy.

## Show HN

**Title:** Show HN: wgsql — JavaScript in a Web Worker vs WebGPU, same query

**URL:** https://github.com/shiahonb777/wgsql

**Body (no link in body, comment after):**

wgsql is a small SQL aggregation kernel for WebGPU. It runs `GROUP BY`,
multi-aggregate, fused `WHERE`, and inner JOIN through a single WGSL
compute kernel. Native (Metal, DX12, Vulkan) and browser, same code.

The demo on the project page is a side-by-side comparison. The same query
runs twice on every slider movement: once on a JavaScript `Map` in a Web
Worker, once on the GPU. Same data path, same code, ten million rows. The
Web Worker baseline is deliberate — it's the most generous JavaScript
setup available in a browser, and it's what most production analytics
frontends actually use. The point isn't "main thread is slow."

Four scenarios share the same kernel: taxi tips (263 zones), equity
trades (5K tickers), a game leaderboard (50K players), and product sales
(1K SKUs). The kernel doesn't change between them; only the data and the
labels.

The kernel is short — open-address linear-probe hash table over
`atomic<i32>` storage buffers, one thread per row, CAS the key, `atomicAdd`
the value. `WHERE` is fused into the same pass. The single biggest win
came from a capacity hint: shrinking the hash table from `2 × n` down to
`2 × estimated_distinct` took the browser run from 1.13× to 8.1× over JS
Map. The README documents this.

Honest numbers, M4 Pro / Chrome 138, 10 M rows × 1 M distinct keys: JS Map
900 ms, DuckDB-WASM 3–5 s (CSV ingest + query), wgsql 111 ms. At low
cardinality (1 K groups), the JS Map fits in L2 and beats us; the demo
says so.

Where this fits, in plain language: a client-side dashboard that needs to
stay interactive past a few million rows; private analytics that
shouldn't leave the device; embeddable BI in a SaaS without a per-customer
backend.

v0.1, MIT, ~388 KB wasm. Feedback welcome.

## /r/dataengineering

**Title:** WebGPU OLAP kernel: JS-in-a-worker vs GPU, same query, side by side

(Same body.)

## /r/rust

**Title:** wgsql — a tiny WGSL/Rust aggregation kernel that runs natively
and in the browser

(Same body.)

## Demo capture

A 30-second screen recording is sufficient. Capture, in order:

1. Page loaded, "Ready on BrowserWebGpu / Apple M4 Pro" line visible.
2. Default scenario (Equity trades). Drag the slider quickly across its
   full range. The right column updates each frame; the left lags behind
   the slider position by several frames and shows "Behind by N frames."
3. Switch to Game leaderboard. Drag again. Same pattern, larger gap.
4. Click `Run 5-second sweep`. The slider sweeps automatically. The
   sparklines underneath each latency strip show the shape difference: a
   roughly flat line on the right (GPU), a noisier and higher line on the
   left (JS Map).
5. Scroll to the benchmark table, click `Run`, wait for the row to fill in.
6. End on the GitHub URL.

## Pre-launch checklist

- Refresh the demo on a fresh browser session and confirm the latency gap
  is visible in all four scenarios when the slider is dragged quickly.
- Verify the headline figure shows live numbers (not the placeholder
  dashes) within a few seconds of load.
- Check the Parquet drop-zone with at least one real file.
- Re-run the README datasheet on the day of and update if anything
  changed.
- Open one issue on the repo (e.g. *Help wanted: GROUP BY on i64 keys*)
  to seed contributor activity.

## Communities, in priority

1. Show HN — the side-by-side comparison is the hook.
2. /r/dataengineering — DuckDB-WASM context gives credibility.
3. /r/webdev — the audience that fights 10 M-row tables in production.
4. /r/rust — Rust + WebGPU.
5. WebGPU Discord (`gpuweb`).
6. Polars / Arrow community channels.
7. Twitter, mentioning `@gfx_rs`, `@wgpu_rs`, `@WebGPU`.

## Don't claim

- "Faster than DuckDB." Only DuckDB-WASM, only this workload.
- "Complete SQL engine." It's `GROUP BY` + `WHERE` + multi-agg + inner JOIN.
- A WASM size below the current ~388 KB. It's whatever it is.
- `i64` / OUTER JOIN / string keys for v0.1. They're not in.

The honest pitch is on the README's first paragraph.
