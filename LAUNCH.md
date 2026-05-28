# Launch checklist

Hold this private until ready. Update numbers from a fresh run on the
day-of, then post.

## Headline

> **wgsql** runs SQL GROUP BY on the user's GPU through WebGPU.
> JavaScript on the left, wgsql on the right, same slider — watch the
> lag pile up. 10 M rows, in the browser, no server.

## Twitter thread

**1/**
> "Just put your dashboard in a Web Worker, JS is fast enough."
>
> Same query. Same data. Same slider. JS Map (in a worker) on the left,
> wgsql GPU on the right. 10M rows.
>
> Drag the slider. Watch what happens.
>
> Demo: https://shiahonb777.github.io/wgsql/

**2/**
> Four scenarios — taxi tips, equity trades, game telemetry, ad clicks —
> all driven by the same WGSL kernel. The only thing that changes is
> the data and the labels. The GPU stays interactive past 1M distinct
> groups; the JS Map can't.

**3/**
> The whole engine is one WGSL compute kernel: open-address linear-probe
> hash table, atomic CAS on the key, atomicAdd on the sum. WHERE is
> fused into the same pass — slider drag = one kernel dispatch, not
> three.
>
> Same kernel runs on Metal, DX12, Vulkan, WebGPU. ~300 lines of code.

**4/**
> Honest numbers (M4 Pro / Chrome 138 / 10M rows × 1M groups):
> • JS Map: 900ms
> • DuckDB-WASM: ~3–5s (CSV ingest + query)
> • wgsql GPU: 111ms
>
> 8.1× over JS Map. At low cardinality (1K groups), JS Map fits in L2
> cache and beats us. The README says so.

**5/**
> Source: github.com/shiahonb777/wgsql
> Demo:   shiahonb777.github.io/wgsql/
> MIT, v0.1, ~388 KB wasm.
>
> Roadmap: i64/f32/string keys, OUTER JOIN, Parquet zero-copy, full SQL
> parser. Feedback welcome — especially from people doing client-side BI.

## HN Show submission

**Title:** Show HN: wgsql – JavaScript vs GPU, same slider, watch the lag pile up

**URL:** https://github.com/shiahonb777/wgsql

**Text (no link in body, comment after):**
> wgsql is a tiny columnar OLAP engine that compiles to a single WGSL
> kernel and runs on Metal/DX12/Vulkan natively or on WebGPU in the
> browser. It exists because most "browser dashboards" stop being
> interactive somewhere around 1M rows.
>
> The demo is a side-by-side race. Left panel: JavaScript Map running
> in a Web Worker (the most favourable JS setup — dedicated thread,
> never blocks the UI). Right panel: wgsql on WebGPU. Same data, same
> query, same slider. Drag the slider; the left side falls behind, the
> right side stays interactive. Four scenarios (taxi tips, equity
> trades, game telemetry, ad clicks) all driven by the same kernel —
> only the data and labels change.
>
> The kernel is ~300 lines: open-address linear-probe hash table on
> top of atomic<i32> storage buffers. WHERE is fused into the same
> pass — no separate filter kernel, no scratch buffer. Capacity is
> sized from a `estimated_distinct` hint, which was the single biggest
> speedup (1.13× → 8.1× in the browser) once we stopped over-allocating.
>
> What it's good for:
> - Frontend dashboards that need to stay interactive past 1M rows
> - Private analytics where the data can't leave the user's tab
> - Embeddable BI in SaaS without a per-customer backend
>
> Honest comparison (M4 Pro / Chrome 138 / 10M rows × 1M groups):
> JS Map 900ms, DuckDB-WASM ~3–5s (ingest+query), wgsql GPU 111ms.
> At low cardinality (1K groups), JS Map fits in L2 cache and beats
> us; the README says so.
>
> v0.1, MIT, ~388 KB wasm. Roadmap: i64/f32/string keys, multi-column
> GROUP BY, OUTER JOIN, Parquet zero-copy, full SQL parser. Feedback
> welcome.

## Reddit /r/rust crosspost

**Title:** wgsql: Same slider, JS in a worker on the left vs WebGPU on the right. Watch the lag.

(Same body as HN.)

## Reddit /r/dataengineering submission

**Title:** Built a WebGPU OLAP kernel — JS-in-a-worker vs GPU side by side, in the browser

**Text:** (Same body as HN.)

## Demo video script (90s)

**0:00–0:10** Open https://shiahonb777.github.io/wgsql/. Show "wgsql
ready on BrowserWebGpu / Apple M4 Pro". The split panels render with
🚖 NYC taxi tips selected.

**0:10–0:35** Drag the slider quickly back and forth. The left panel's
"slider moved" counter ticks up to ~50 while "left frames done" lags
to ~3; the latency pill shows "stale · still computing". The right
panel keeps up, "live", new top-20 bars on every drag.
> Voiceover: "Same query. Same data. Same slider. JS in a Web Worker
> on the left, GPU on the right. The lag isn't the main thread — that
> argument's gone."

**0:35–0:50** Click 🎮 Game telemetry tab (100K players). Drag again.
The gap stays.
> Voiceover: "Different data, same kernel. The thing that changes is
> the cardinality."

**0:50–1:10** Click 🛒 Ad clicks (1M users). Drag.
> Voiceover: "1M distinct keys. The Map's hash table doesn't fit in
> L2 anymore. This is where the GPU stops being a flex and starts
> being the only option."

**1:10–1:25** Scroll down to the benchmark panel, click "Run benchmark".
JS Map 900ms, DuckDB-WASM ~3–5s, wgsql 111ms.

**1:25–1:30** End slide:
  - github.com/shiahonb777/wgsql
  - shiahonb777.github.io/wgsql
  - MIT, v0.1, ~388 KB wasm

## Pre-launch checklist

- [ ] Refresh demo, confirm side-by-side race shows clear lag in all
      four scenarios when slider is dragged quickly
- [ ] Verify left panel correctly shows "stale" when behind the user
- [ ] Verify the speedup banner stays in the 5–15× range across
      scenarios (low-cardinality 🚖 may dip to 1.5–3×; that's expected)
- [ ] README datasheet matches today's numbers (re-run if stale)
- [ ] First issue ("Help wanted: i64 keys") opened to seed contributor
      activity
- [ ] OG image: a screen-capture of the split panels mid-drag with
      visible lag on the left

## Communities to seed

In rough order of fit:
- HN Show (the side-by-side race is the visual hook)
- /r/dataengineering (DuckDB-WASM comparison gives credibility)
- /r/webdev (frontend folks who fight 10M-row tables; the "Web Worker"
  framing is targeted at them specifically)
- /r/rust (Rust + WebGPU)
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
- The honest pitch: "GPU OLAP primitive, in the browser, no server,
  faster than JS even when JS is in a worker"
