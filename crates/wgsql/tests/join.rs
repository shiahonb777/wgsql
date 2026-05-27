//! Inner-join tests. GPU vs CPU equivalence.

use std::collections::{HashMap, HashSet};

use wgsql::{Engine, JoinResult};

fn cpu_inner_join(
    bk: &[i32], bv: &[i32], pk: &[i32], pv: &[i32],
) -> Vec<(i32, i32)> {
    // Match the GPU build side's "first writer wins" semantics: each
    // build key has at most one value.
    let mut bm: HashMap<i32, i32> = HashMap::new();
    for (k, v) in bk.iter().zip(bv.iter()) {
        bm.entry(*k).or_insert(*v);
    }
    let mut out = Vec::new();
    for (k, v) in pk.iter().zip(pv.iter()) {
        if let Some(&bv) = bm.get(k) {
            out.push((*v, bv));
        }
    }
    out
}

fn assert_match(gpu: &[JoinResult], cpu: &[(i32, i32)]) {
    let g: HashSet<(i32, i32)> = gpu.iter().map(|r| (r.probe_value, r.build_value)).collect();
    let mut c: HashMap<(i32, i32), usize> = HashMap::new();
    for &p in cpu { *c.entry(p).or_insert(0) += 1; }
    let mut count_g: HashMap<(i32, i32), usize> = HashMap::new();
    for &r in g.iter() { count_g.insert(r, 0); }
    for r in gpu.iter() {
        let key = (r.probe_value, r.build_value);
        *count_g.entry(key).or_insert(0) += 1;
    }
    assert_eq!(gpu.len(), cpu.len(),
               "row count mismatch: gpu={} cpu={}", gpu.len(), cpu.len());
    assert_eq!(count_g, c, "tuple-count mismatch (multiset)");
}

#[test]
fn empty_build() {
    let engine = Engine::new().expect("engine");
    let r = engine.inner_join_i32(&[], &[], &[1, 2, 3], &[10, 20, 30], 100).unwrap();
    assert!(r.is_empty());
}

#[test]
fn empty_probe() {
    let engine = Engine::new().expect("engine");
    let r = engine.inner_join_i32(&[1, 2, 3], &[10, 20, 30], &[], &[], 100).unwrap();
    assert!(r.is_empty());
}

#[test]
fn small_inner_join() {
    let engine = Engine::new().expect("engine");
    // Build: keys 1..=4 with values 10..=40
    let bk = vec![1, 2, 3, 4];
    let bv = vec![10, 20, 30, 40];
    // Probe: 1, 2, 99, 4, 4, 5
    let pk = vec![1, 2, 99, 4, 4, 5];
    let pv = vec![100, 200, 999, 400, 401, 500];

    let cpu = cpu_inner_join(&bk, &bv, &pk, &pv);
    let gpu = engine.inner_join_i32(&bk, &bv, &pk, &pv, 100).unwrap();
    assert_match(&gpu, &cpu);
}

#[test]
fn many_to_one_join() {
    let engine = Engine::new().expect("engine");
    // Dimension: 100 distinct keys.
    let bk: Vec<i32> = (0..100).collect();
    let bv: Vec<i32> = (0..100).map(|i| i * 10).collect();
    // Fact: 50K rows hitting random keys 0..200 (half miss).
    let mut x: u32 = 0xDEADBEEF;
    let mut next = || -> u32 { x ^= x << 13; x ^= x >> 17; x ^= x << 5; x };
    let n = 50_000;
    let pk: Vec<i32> = (0..n).map(|_| (next() % 200) as i32).collect();
    let pv: Vec<i32> = (0..n).map(|i| i as i32).collect();

    let cpu = cpu_inner_join(&bk, &bv, &pk, &pv);
    let gpu = engine.inner_join_i32(&bk, &bv, &pk, &pv, n as usize).unwrap();
    assert_match(&gpu, &cpu);
}

#[test]
fn output_cap_truncates() {
    let engine = Engine::new().expect("engine");
    // 1000 build rows, 1000 probe hitting same keys → all 1000 match.
    // But cap output at 50.
    let bk: Vec<i32> = (0..1000).collect();
    let bv: Vec<i32> = (0..1000).collect();
    let pk: Vec<i32> = (0..1000).collect();
    let pv: Vec<i32> = (0..1000).map(|i| i + 10000).collect();
    let gpu = engine.inner_join_i32(&bk, &bv, &pk, &pv, 50).unwrap();
    assert!(gpu.len() <= 50, "got {} > cap 50", gpu.len());
    // Pairs that did make it through must be valid.
    for r in &gpu {
        let probe_idx = (r.probe_value - 10000) as i32;
        assert!((0..1000).contains(&probe_idx));
        assert_eq!(r.build_value, probe_idx);  // bv[k] == k
    }
}
