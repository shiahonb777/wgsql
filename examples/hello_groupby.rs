//! Minimum-viable demo: hardcoded data, GPU group-by, print rows.

fn main() -> anyhow::Result<()> {
    // Imagine: SELECT category, SUM(amount) FROM orders GROUP BY category
    // category_id 0..3, amount in dollars
    let categories = vec![0i32, 1, 2, 0, 1, 2, 0, 0, 2, 1];
    let amounts    = vec![ 5,    3, 7,  2, 4,  1, 9,  6, 8,  2];

    let engine = wgsql::Engine::new()?;
    println!("running on {:?} / {}", engine.adapter_info.backend, engine.adapter_info.name);

    let mut rows = engine.group_by_sum_i32(&categories, &amounts)?;
    rows.sort_by_key(|r| r.key);
    for r in &rows {
        println!("category={}  total={}", r.key, r.sum);
    }
    Ok(())
}
