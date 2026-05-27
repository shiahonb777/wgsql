//! GPU vs CPU group-by/sum equivalence tests. These run only on machines
//! with a working wgpu adapter (Metal on macOS, Vulkan on Linux, DX12 on
//! Windows). On a CI runner without GPU, mark them ignored via env var.

use std::collections::HashMap;

use wgsql::Engine;

fn cpu_group_by_sum(keys: &[i32], values: &[i32]) -> HashMap<i32, i64> {
    let mut acc: HashMap<i32, i64> = HashMap::new();
    for (k, v) in keys.iter().zip(values.iter()) {
        *acc.entry(*k).or_insert(0) += *v as i64;
    }
    acc
}

fn assert_groupby_eq(engine: &Engine, keys: &[i32], values: &[i32]) {
    let cpu = cpu_group_by_sum(keys, values);
    let gpu = engine.group_by_sum_i32(keys, values).expect("gpu run");
    let gpu_map: HashMap<i32, i64> = gpu.iter().map(|r| (r.key, r.sum)).collect();
    assert_eq!(
        cpu, gpu_map,
        "GROUP BY mismatch on input of len {}", keys.len()
    );
}

#[test]
fn empty_input_returns_empty() {
    let engine = Engine::new().expect("engine init");
    let r = engine.group_by_sum_i32(&[], &[]).unwrap();
    assert!(r.is_empty());
}

#[test]
fn single_group() {
    let engine = Engine::new().expect("engine init");
    let keys = vec![7; 100];
    let values: Vec<i32> = (0..100).collect();
    let cpu_sum: i64 = values.iter().map(|&v| v as i64).sum();
    let gpu = engine.group_by_sum_i32(&keys, &values).unwrap();
    assert_eq!(gpu.len(), 1);
    assert_eq!(gpu[0].key, 7);
    assert_eq!(gpu[0].sum, cpu_sum);
}

#[test]
fn many_groups_dense() {
    let engine = Engine::new().expect("engine init");
    let mut keys = Vec::new();
    let mut values = Vec::new();
    for k in 0..1000 {
        for v in 0..50 {
            keys.push(k);
            values.push(v);
        }
    }
    assert_groupby_eq(&engine, &keys, &values);
}

#[test]
fn random_distribution() {
    let engine = Engine::new().expect("engine init");
    // xorshift32 — deterministic.
    let mut x: u32 = 0xCAFEBABE;
    let mut next = || -> u32 {
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        x
    };
    let n = 100_000;
    let mut keys = Vec::with_capacity(n);
    let mut values = Vec::with_capacity(n);
    for _ in 0..n {
        keys.push((next() % 256) as i32);   // 256 distinct groups
        values.push((next() % 1000) as i32);
    }
    assert_groupby_eq(&engine, &keys, &values);
}

#[test]
fn negative_keys() {
    let engine = Engine::new().expect("engine init");
    let keys: Vec<i32> = (-50..50).cycle().take(10_000).collect();
    let values: Vec<i32> = (0..10_000).map(|i| (i % 1000) as i32).collect();
    assert_groupby_eq(&engine, &keys, &values);
}

#[test]
fn many_distinct_keys_close_to_table_capacity() {
    // Stress the open-address probing.
    let engine = Engine::new().expect("engine init");
    let n = 50_000;
    let keys: Vec<i32> = (0..n).map(|i| i as i32).collect();
    let values: Vec<i32> = vec![1; n];
    let gpu = engine.group_by_sum_i32(&keys, &values).unwrap();
    assert_eq!(gpu.len(), n);
    for r in &gpu {
        assert_eq!(r.sum, 1);
    }
}
