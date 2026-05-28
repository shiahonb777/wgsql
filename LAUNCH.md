# Launch checklist

Hold this private until ready. Update numbers from a fresh run on the
day-of, then post.

## Headline

> **wgsql** lets your dashboard scrub through 10 million rows
> interactively in the browser, on the user's GPU. No backend, no
> upload. ~388 KB wasm.

## Twitter thread

**1/**
> Most "browser dashboards" choke past ~1M rows because every filter
> rebuild runs through `Array.reduce`.
>
> wgsql runs SQL GROUP BY + WHERE on the user's GPU through WebGPU.
> 10M rows. Drag a slider. The chart updates in 80–120ms.
>
> Demo: https://shiahonb777.github.io/wgsql/

**2/**
> The whole engine is a single WGSL compute kernel: open-address
> linear-probe hash table, atomic CAS on the key, atomicAdd on the sum.
> WHERE is fused into the same pass — so a slider drag is one kernel
> dispatch, not three.
>
> Same kernel runs on Metal, DX12, Vulkan, WebGPU. ~300 lines.

**3/**
> What it's good for:
> • client-side BI / dashboards that need to stay smooth at 10M rows
> • private analytics — healthcare, finance, internal HR — where data
>   shouldn't leave the device
> • embeddable BI in SaaS without a backend per customer

**4/**
> Honest numbers (M4 Pro / Chrome 138 / 10M rows × 1M groups):
> • JS Map: 900ms
> • DuckDB-WASM: ~3–5s (CSV ingest + query)
> • wgsql GPU: 111ms
>
> 8.1× over JS Map. At low cardinality (1K groups), JS Map fits in L2
> and beats us. We don't pretend otherwise.

**5/**
> Source: github.com/shiahonb777/wgsql
> Demo:   shiahonb777.github.io/wgsql/
> MIT, v0.1.
>
> Roadmap: i64/f32/string keys, OUTER JOIN, Parquet zero-copy, full SQL
> parser. Feedback welcome.

## HN Show submission

**Title:** Show HN: wgsql — 10M-row dashboards in the browser, on the GPU

**URL:** https://github.com/shiahonb777/wgsql

**Text (no link in body, comment after):**
> wgsql is a tiny columnar OLAP engine that compiles to a single WGSL
> kernel and runs on Metal/DX12/Vulkan natively or on WebGPU in the
> browser. It exists because most "browser dashboards" stop being
> interactive somewhere around 1M rows.
>
> The default demo loads 10M synthetic sales rows and gives you a
> filter slider. Dragging the slider re-runs `SELECT product,
> SUM(amount), COUNT(*) WHERE amount >= ? GROUP BY product` on the GPU
> from scratch every frame. ~80–120 ms typical on M-series Chrome.
>
> The kernel is ~300 lines: open-address linear-probe hash table on
> top of atomic<i32> storage buffers. WHERE is fused into the same
> pass — no separate filter kernel, no scratch buffer. Capacity is
> sized from a `estimated_distinct` hint, which was the single biggest
> speedup (1.13× → 8.1× in the browser) once we stopped over-allocating.
>
> What it's good for:
> - Frontend dashboards that need to stay 60 fps past 1M rows
> - Private analytics where the data can't leave the user's tab
> - Embeddable BI in SaaS without a per-customer backend
>
> Honest comparison (M4 Pro / Chrome 138 / 10M rows × 1M groups):
> JS Map 900ms, DuckDB-WASM ~3–5s (ingest+query), wgsql GPU 111ms.
> At low cardinality (1K groups), JS Map fits in L2 cache and beats
> us; the README says so.
>
> v0.1, MIT. Roadmap: i64/f32/string keys, multi-column GROUP BY,
> OUTER JOIN, Parquet zero-copy, full SQL parser. Feedback welcome,
> especially from people doing client-side BI.

## Reddit /r/rust crosspost

**Title:** wgsql: GPU-accelerated SQL GROUP BY in the browser, via WebGPU

(Same body as HN.)

## Reddit /r/dataengineering submission

**Title:** Built a WebGPU OLAP kernel — 10M-row dashboards stay smooth in
the browser without a backend

**Text:** (Same body as HN.)

## Demo video script (90s)

**0:00–0:08** Open https://shiahonb777.github.io/wgsql/. Show "wgsql
ready on BrowserWebGpu / Apple M4 Pro". Dashboard fills in.

**0:08–0:30** The KPI cards show 10M rows / total revenue / avg order /
GPU latency. Below: top-20 product bar chart. Drag the "min amount"
slider from 0 → 800. The chart re-orders smoothly, KPIs update each
frame, "GPU compute" stays around 80–120 ms.
> Voiceover: "10 million rows. The slider isn't pre-computing index
> rebuilds — every drag re-runs the entire GROUP BY on the GPU."

**0:30–0:50** Switch the region dropdown. Bars rebuild. Then scroll
down to the benchmark panel, click "Run benchmark". Numbers land:
JS Map 900ms vs wgsql 111ms. 8.1×.

**0:50–1:10** Scroll to the Parquet drop zone. Drag in a 10M-row
sample file. "10.0M rows parsed. JS Map 870ms / wgsql GPU 110ms /
7.9× speedup."
> Voiceover: "And nothing left the tab."

**1:10–1:30** End slide:
  - github.com/shiahonb777/wgsql
  - shiahonb777.github.io/wgsql
  - MIT, v0.1, ~388 KB wasm

## Pre-launch checklist

- [ ] Refresh demo, confirm dashboard latency stays ≤ 150 ms typical
      with the slider at any position
- [ ] Double-check KPI calculations match the JS baseline at slider=0
- [ ] README datasheet matches today's numbers (re-run if stale)
- [ ] First issue ("Help wanted: i64 keys") opened to seed contributor
      activity
- [ ] OG image generated showing the dashboard with bars + KPIs
- [ ] Have a 10M-row sample Parquet ready to drop in if anyone asks

## Communities to seed

In rough order of fit:
- HN Show (the dashboard demo is the hook)
- /r/dataengineering (DuckDB-WASM comparison gives credibility)
- /r/rust (Rust + WebGPU)
- /r/webdev (frontend folks who fight 10M-row tables)
- WebGPU Discord (gpuweb)
- Polars / Arrow community channels
- Twitter: @gfx_rs, @wgpu_rs, @WebGPU mentions
- ObservableHQ forums (lots of dashboarders)

## What NOT to claim

- Don't say "faster than DuckDB" — only DuckDB-WASM in a browser
  context, only on this workload
- Don't say "complete SQL engine" — it's GROUP BY + WHERE + multi-agg
  + inner JOIN at v0.1
- Don't promise WASM size below current ~388 KB
- Don't promise i64 keys, OUTER JOIN, or string keys for v0.1 — they're
  not in
- The honest pitch: "GPU OLAP primitive that you can drop into a
  browser app and ship dashboards that stay smooth past 10M rows"
