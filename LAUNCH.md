# Launch checklist

Hold this private until ready. Update numbers from a fresh run on the
day-of, then post.

## Headline

> **wgsql** runs OLAP on your GPU through your browser. 8× faster than
> JavaScript on a 10 M-row GROUP BY. One WGSL kernel, no server.

## Twitter thread

**1/**
> I built a SQL GROUP BY engine that runs on your GPU in the browser.
>
> 10 million rows, hash aggregate over 1 million distinct keys.
> JS Map: 900ms. wgsql GPU: 111ms.
>
> 8.1× speedup. Try it: https://shiahonb777.github.io/wgsql/

**2/**
> The engine is a single WGSL compute kernel: open-address linear-probe
> hash table, atomic CAS on the key, atomicAdd on the sum.
>
> Same kernel runs on Metal, DX12, Vulkan, and WebGPU. Native and
> browser. ~300 lines of Rust + WGSL.

**3/**
> Cardinality matters. At 1024 distinct groups, JavaScript's Map fits in
> L2 cache and beats GPU because the atomic contention is brutal.
>
> At 1M distinct groups (real-world OLAP territory) the cache stops
> being free and the GPU's parallelism dominates.

**4/**
> The biggest unlock came from a "tight cap" hint. If you tell the
> engine "I expect ~1M distinct keys", it sizes the hash table to 2M
> instead of 2× row count. Clear-kernel and result-scan time drop by
> ~17×.
>
> 1.13× → 8.1× from one parameter.

**5/**
> Source: github.com/shiahonb777/wgsql
> Demo:   shiahonb777.github.io/wgsql/
> MIT.
>
> v0.1. WHERE / multi-aggregate / JOIN are the next milestones.

## HN Show submission

**Title:** Show HN: wgsql — GPU-accelerated SQL GROUP BY in your browser

**URL:** https://github.com/shiahonb777/wgsql

**Text (no link in body, comment after):**
> wgsql is a tiny columnar OLAP engine that compiles to a single WGSL
> kernel and runs on Metal/DX12/Vulkan natively or on WebGPU in the
> browser.
>
> The browser demo (linked from the README) runs SELECT key, SUM(value)
> GROUP BY key on 10M synthetic rows and compares to a JavaScript Map
> baseline. On my M4 Pro / Chrome it shows 8.1× speedup at the
> cardinality where it matters (1M distinct groups). At low
> cardinality, JS Map is hard to beat and we're honest about that.
>
> The engine is ~300 lines of Rust + WGSL. The kernel is a textbook
> open-address linear-probe hash table with atomic CAS for keys and
> atomicAdd for sums.
>
> v0.1, MIT. Roadmap: WHERE filter, multi-aggregate (SUM/COUNT/MIN/MAX
> in one pass), JOIN, Parquet zero-copy. Feedback welcome.

## Reddit /r/rust crosspost

**Title:** wgsql: 8× faster than JS for GROUP BY in the browser, via WebGPU

(Same body as HN.)

## Demo video script (90s)

**0:00–0:10** Open https://shiahonb777.github.io/wgsql/. Show the page
loads, "wgsql ready on BrowserWebGpu / Apple M4 Pro" appears.

**0:10–0:20** Default selection is 10M rows × 1M groups. Click "Run
benchmark."

**0:20–0:35** Wait ~1 second. Numbers populate:
  - data generation: ~120 ms
  - JS Map: ~900 ms
  - wgsql GPU: ~110 ms
  - **8.08× GPU vs JS Map. OK (50/50 sums match)**

**0:35–0:55** Switch to 1M × 1K. Click run again.
  - JS Map wins (~5ms vs ~10ms).
  - Voiceover: "This is the cardinality regime where CPU caches make
    JavaScript hard to beat. We're honest about that — wgsql owns
    high-cardinality OLAP, not toy queries."

**0:55–1:10** Cut to terminal: `cargo test --release` — 9 tests pass.
Show README architecture section briefly.

**1:10–1:30** End slide:
  - github.com/shiahonb777/wgsql
  - shiahonb777.github.io/wgsql
  - MIT, v0.1

## Pre-launch checklist

- [ ] Refresh demo, confirm 5x+ speedup on default settings
- [ ] README datasheet matches today's numbers (re-run if stale)
- [ ] DuckDB-WASM comparison merged (if available — adds credibility
      vs the JS Map baseline)
- [ ] License + CONTRIBUTING in place
- [ ] First issue ("Help wanted: WHERE filter") opened to seed contributor activity

## Communities to seed

In rough order of fit:
- /r/rust (Rust + WebGPU users)
- HN Show
- /r/dataengineering (we'll need DuckDB-WASM comparison first)
- WebGPU Discord (gpuweb)
- Polars / Arrow community channels
- Twitter: @gfx_rs, @wgpu_rs, @WebGPU mentions

## What NOT to claim

- Don't say "faster than DuckDB" (we haven't measured against full
  DuckDB; only DuckDB-WASM in a browser context, and only on this
  workload)
- Don't say "complete SQL engine" — it's GROUP BY/SUM only at v0.1
- Don't promise WASM size below current ~350 KB
- Don't promise i64 keys, JOIN, or WHERE for v0.1 — they're not in
- The honest pitch: "GPU OLAP primitive that you can drop into a
  browser app, beats JS at the regimes where SQL on GPU should beat JS"
