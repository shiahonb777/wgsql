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
    println!("{:>10}  {:>8}  {:>10}  {:>10}  {:>10}  {:>8}",
             "n", "groups", "cpu_time", "gpu_time", "gpu_M/s", "speedup");

    for &(n, n_groups) in &[
        (1_000_000usize, 1024usize),
        (1_000_000, 100_000),
        (10_000_000, 1024),
        (10_000_000, 1_000_000),
    ] {
        let mut x: u32 = 0xCAFEBABE;
        let mut next = || -> u32 {
            x ^= x << 13; x ^= x >> 17; x ^= x << 5; x
        };
        let keys: Vec<i32> = (0..n).map(|_| (next() % n_groups as u32) as i32).collect();
        let values: Vec<i32> = (0..n).map(|_| (next() % 1000) as i32).collect();

        // CPU baseline: HashMap. Single-thread reference.
        let t_cpu = Instant::now();
        let mut acc: HashMap<i32, i64> = HashMap::with_capacity(n_groups * 2);
        for (k, v) in keys.iter().zip(values.iter()) {
            *acc.entry(*k).or_insert(0) += *v as i64;
        }
        let cpu_dur = t_cpu.elapsed();

        let t_gpu = Instant::now();
        let result = engine.group_by_sum_i32_with_opts(
            &keys, &values,
            wgsql::GroupByOptions { estimated_distinct: Some(n_groups) },
        )?;
        let gpu_dur = t_gpu.elapsed();
        let gpu_throughput = (n as f64) / gpu_dur.as_secs_f64();
        let speedup = cpu_dur.as_secs_f64() / gpu_dur.as_secs_f64();
        println!(
            "{:>10}  {:>8}  {:>9.2?}  {:>9.2?}  {:>8.1}M  {:>7.2}x",
            n, result.len(), cpu_dur, gpu_dur,
            gpu_throughput / 1e6, speedup,
        );
    }
    Ok(())
}
