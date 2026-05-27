//! WHERE filter tests. The filter is fused into the kernel; rows where
//! the predicate is false are skipped without ever touching the hash
//! table. Verify GPU == CPU on every operator.

use std::collections::HashMap;

use wgsql::{Engine, Filter, FilterOp, GroupByOptions};

fn cpu_filtered(keys: &[i32], values: &[i32], op: FilterOp, t: i32) -> HashMap<i32, i64> {
    let mut acc: HashMap<i32, i64> = HashMap::new();
    for (k, v) in keys.iter().zip(values.iter()) {
        let pass = match op {
            FilterOp::Eq => *v == t,
            FilterOp::Ne => *v != t,
            FilterOp::Lt => *v <  t,
            FilterOp::Le => *v <= t,
            FilterOp::Gt => *v >  t,
            FilterOp::Ge => *v >= t,
        };
        if pass { *acc.entry(*k).or_insert(0) += *v as i64; }
    }
    acc
}

fn data() -> (Vec<i32>, Vec<i32>) {
    // 1000 keys × 100 rows each. Values are i mod 100 → covers 0..100.
    let mut k = Vec::with_capacity(100_000);
    let mut v = Vec::with_capacity(100_000);
    for i in 0..1000 {
        for j in 0..100 {
            k.push(i);
            v.push(j);
        }
    }
    (k, v)
}

fn check(op: FilterOp, t: i32) {
    let engine = Engine::new().expect("engine");
    let (keys, values) = data();
    let cpu = cpu_filtered(&keys, &values, op, t);
    let gpu = engine
        .group_by_sum_i32_with_opts(
            &keys, &values,
            GroupByOptions {
                estimated_distinct: Some(1000),
                filter: Some(Filter { op, threshold: t }),
            },
        )
        .expect("gpu run");
    let gpu_map: HashMap<i32, i64> = gpu.iter().map(|r| (r.key, r.sum)).collect();
    assert_eq!(cpu, gpu_map, "filter {:?}>={} mismatch", op, t);
}

#[test] fn filter_eq() { check(FilterOp::Eq, 50); }
#[test] fn filter_ne() { check(FilterOp::Ne, 50); }
#[test] fn filter_lt() { check(FilterOp::Lt, 50); }
#[test] fn filter_le() { check(FilterOp::Le, 50); }
#[test] fn filter_gt() { check(FilterOp::Gt, 50); }
#[test] fn filter_ge() { check(FilterOp::Ge, 50); }

#[test]
fn filter_excludes_all() {
    let engine = Engine::new().expect("engine");
    let (keys, values) = data();
    let gpu = engine
        .group_by_sum_i32_with_opts(
            &keys, &values,
            GroupByOptions {
                estimated_distinct: Some(1000),
                filter: Some(Filter::gt(1_000_000)), // nothing passes
            },
        )
        .expect("gpu run");
    assert!(gpu.is_empty(), "expected empty result, got {} rows", gpu.len());
}

#[test]
fn filter_includes_all() {
    let engine = Engine::new().expect("engine");
    let (keys, values) = data();
    let gpu = engine
        .group_by_sum_i32_with_opts(
            &keys, &values,
            GroupByOptions {
                estimated_distinct: Some(1000),
                filter: Some(Filter::ge(i32::MIN)), // everything passes
            },
        )
        .expect("gpu run");
    let cpu_total: i64 = (0..100i64).sum::<i64>() * 1000;
    let gpu_total: i64 = gpu.iter().map(|r| r.sum).sum();
    assert_eq!(gpu_total, cpu_total);
    assert_eq!(gpu.len(), 1000);
}
