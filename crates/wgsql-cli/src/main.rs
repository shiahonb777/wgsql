//! `wgsql` — minimal CLI. v0.1 only ships a self-test that does a
//! GROUP BY/SUM on synthetic data and prints throughput, so users can
//! verify their GPU works before plugging in real data.

use anyhow::Result;

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 || args[1] == "help" || args[1] == "--help" {
        print_help();
        return Ok(());
    }
    match args[1].as_str() {
        "selftest" => cmd_selftest(),
        "info" => cmd_info(),
        other => {
            eprintln!("unknown command: {other}");
            print_help();
            Ok(())
        }
    }
}

fn print_help() {
    println!(
        "wgsql — GPU-accelerated columnar OLAP\n\n\
         USAGE:\n  \
           wgsql info       show GPU adapter info\n  \
           wgsql selftest   run a GROUP BY/SUM and print throughput\n"
    );
}

fn cmd_info() -> Result<()> {
    let engine = wgsql::Engine::new()?;
    println!("backend       : {:?}", engine.adapter_info.backend);
    println!("device name   : {}", engine.adapter_info.name);
    println!("driver        : {} {}", engine.adapter_info.driver, engine.adapter_info.driver_info);
    Ok(())
}

fn cmd_selftest() -> Result<()> {
    use std::collections::HashMap;
    use std::time::Instant;
    let engine = wgsql::Engine::new()?;
    println!("GPU: {:?} / {}", engine.adapter_info.backend, engine.adapter_info.name);
    println!();
    println!("=== single-aggregate (SUM only) ===");
    println!("{:>10}  {:>8}  {:>10}  {:>10}  {:>10}  {:>8}",
             "n", "groups", "cpu_time", "gpu_time", "gpu_M/s", "speedup");
    for &(n, n_groups) in &[
        (1_000_000usize, 1024usize),
        (1_000_000, 100_000),
        (10_000_000, 1024),
        (10_000_000, 1_000_000),
    ] {
        run_groupby_bench(&engine, n, n_groups)?;
    }
    println!();
    println!("=== multi-aggregate (SUM + COUNT + MIN + MAX in one pass) ===");
    println!("{:>10}  {:>8}  {:>10}  {:>10}  {:>10}  {:>8}",
             "n", "groups", "cpu_time", "gpu_time", "gpu_M/s", "speedup");
    for &(n, n_groups) in &[
        (1_000_000usize, 1024usize),
        (10_000_000, 1_000_000),
    ] {
        run_agg_bench(&engine, n, n_groups)?;
    }
    Ok(())
}

fn run_groupby_bench(engine: &wgsql::Engine, n: usize, n_groups: usize) -> Result<()> {
    use std::collections::HashMap;
    use std::time::Instant;
    let mut x: u32 = 0xCAFEBABE;
    let mut next = || -> u32 { x ^= x << 13; x ^= x >> 17; x ^= x << 5; x };
    let keys: Vec<i32> = (0..n).map(|_| (next() % n_groups as u32) as i32).collect();
    let values: Vec<i32> = (0..n).map(|_| (next() % 1000) as i32).collect();

    let t = Instant::now();
    let mut acc: HashMap<i32, i64> = HashMap::with_capacity(n_groups * 2);
    for (k, v) in keys.iter().zip(values.iter()) {
        *acc.entry(*k).or_insert(0) += *v as i64;
    }
    let cpu = t.elapsed();

    let t = Instant::now();
    let result = engine.group_by_sum_i32_with_opts(
        &keys, &values, wgsql::GroupByOptions { estimated_distinct: Some(n_groups) },
    )?;
    let gpu = t.elapsed();
    let speedup = cpu.as_secs_f64() / gpu.as_secs_f64();
    println!("{:>10}  {:>8}  {:>9.2?}  {:>9.2?}  {:>8.1}M  {:>7.2}x",
             n, result.len(), cpu, gpu, (n as f64 / gpu.as_secs_f64()) / 1e6, speedup);
    Ok(())
}

fn run_agg_bench(engine: &wgsql::Engine, n: usize, n_groups: usize) -> Result<()> {
    use std::collections::HashMap;
    use std::time::Instant;
    let mut x: u32 = 0xCAFEBABE;
    let mut next = || -> u32 { x ^= x << 13; x ^= x >> 17; x ^= x << 5; x };
    let keys: Vec<i32> = (0..n).map(|_| (next() % n_groups as u32) as i32).collect();
    let values: Vec<i32> = (0..n).map(|_| (next() % 1000) as i32).collect();

    // CPU baseline: same single-pass HashMap, but with 4 aggregates.
    let t = Instant::now();
    struct Slot { sum: i64, count: u64, min: i32, max: i32 }
    let mut acc: HashMap<i32, Slot> = HashMap::with_capacity(n_groups * 2);
    for (k, v) in keys.iter().zip(values.iter()) {
        acc.entry(*k)
            .and_modify(|s| {
                s.sum += *v as i64; s.count += 1;
                s.min = s.min.min(*v); s.max = s.max.max(*v);
            })
            .or_insert(Slot { sum: *v as i64, count: 1, min: *v, max: *v });
    }
    let cpu = t.elapsed();

    let t = Instant::now();
    let result = engine.agg_i32(
        &keys, &values, wgsql::GroupByOptions { estimated_distinct: Some(n_groups) },
    )?;
    let gpu = t.elapsed();
    let speedup = cpu.as_secs_f64() / gpu.as_secs_f64();
    println!("{:>10}  {:>8}  {:>9.2?}  {:>9.2?}  {:>8.1}M  {:>7.2}x",
             n, result.len(), cpu, gpu, (n as f64 / gpu.as_secs_f64()) / 1e6, speedup);
    Ok(())
}
