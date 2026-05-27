//! Multi-aggregate (SUM, COUNT, MIN, MAX) tests. Same pattern as
//! group_by_sum: GPU vs CPU equivalence on synthetic inputs.

use std::collections::HashMap;

use wgsql::{AggResult, Engine, GroupByOptions};

struct Cpu {
    sum: HashMap<i32, i64>,
    count: HashMap<i32, u64>,
    min: HashMap<i32, i32>,
    max: HashMap<i32, i32>,
}

fn cpu_agg(keys: &[i32], values: &[i32]) -> Cpu {
    let mut s: HashMap<i32, i64> = HashMap::new();
    let mut c: HashMap<i32, u64> = HashMap::new();
    let mut mn: HashMap<i32, i32> = HashMap::new();
    let mut mx: HashMap<i32, i32> = HashMap::new();
    for (k, v) in keys.iter().zip(values.iter()) {
        *s.entry(*k).or_insert(0) += *v as i64;
        *c.entry(*k).or_insert(0) += 1;
        mn.entry(*k).and_modify(|cur| *cur = (*cur).min(*v)).or_insert(*v);
        mx.entry(*k).and_modify(|cur| *cur = (*cur).max(*v)).or_insert(*v);
    }
    Cpu { sum: s, count: c, min: mn, max: mx }
}

fn assert_agg_eq(engine: &Engine, keys: &[i32], values: &[i32], n_groups_hint: Option<usize>) {
    let cpu = cpu_agg(keys, values);
    let opts = GroupByOptions { estimated_distinct: n_groups_hint };
    let gpu = engine.agg_i32(keys, values, opts).expect("gpu run");
    assert_eq!(gpu.len(), cpu.sum.len(), "group count mismatch");
    let map: HashMap<i32, AggResult> = gpu.iter().map(|r| (r.key, *r)).collect();
    for (k, sum) in &cpu.sum {
        let r = map.get(k).expect(&format!("missing group {}", k));
        assert_eq!(r.sum, *sum, "sum mismatch for key {}", k);
        assert_eq!(r.count, cpu.count[k], "count mismatch for key {}", k);
        assert_eq!(r.min,   cpu.min[k],   "min mismatch for key {}", k);
        assert_eq!(r.max,   cpu.max[k],   "max mismatch for key {}", k);
    }
}

#[test]
fn empty() {
    let engine = Engine::new().expect("engine");
    let r = engine.agg_i32(&[], &[], GroupByOptions::default()).unwrap();
    assert!(r.is_empty());
}

#[test]
fn single_group() {
    let engine = Engine::new().expect("engine");
    let keys = vec![5; 100];
    let values: Vec<i32> = (0..100).collect();
    assert_agg_eq(&engine, &keys, &values, Some(1));
}

#[test]
fn many_groups_dense() {
    let engine = Engine::new().expect("engine");
    let mut keys = Vec::new();
    let mut values = Vec::new();
    for k in 0..1000 {
        for v in -100..100 {
            keys.push(k);
            values.push(v);
        }
    }
    assert_agg_eq(&engine, &keys, &values, Some(1000));
}

#[test]
fn random_distribution() {
    let engine = Engine::new().expect("engine");
    let mut x: u32 = 0xDEADBEEF;
    let mut next = || -> u32 {
        x ^= x << 13; x ^= x >> 17; x ^= x << 5; x
    };
    let n = 100_000;
    let mut keys = Vec::with_capacity(n);
    let mut values = Vec::with_capacity(n);
    for _ in 0..n {
        keys.push((next() % 256) as i32);
        let v = (next() as i32).rem_euclid(2000) - 1000;
        values.push(v);
    }
    assert_agg_eq(&engine, &keys, &values, Some(256));
}

#[test]
fn negative_keys_and_values() {
    let engine = Engine::new().expect("engine");
    let keys: Vec<i32> = (-50..50).cycle().take(10_000).collect();
    let values: Vec<i32> = (0..10_000).map(|i| ((i as i32) % 999) - 500).collect();
    assert_agg_eq(&engine, &keys, &values, Some(100));
}
