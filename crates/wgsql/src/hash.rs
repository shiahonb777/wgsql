//! Hash sizing helpers, separate from the GPU code so we can unit-test
//! capacity selection without a GPU.

/// Round up to next power of two, with a sane minimum.
pub fn next_pow2_capacity(n: usize) -> usize {
    let target = (n.saturating_mul(2)).max(64);
    target.next_power_of_two()
}

/// Sentinel for an empty slot. Chosen so that `i32::MIN` is unlikely to
/// be a real key (and we document it explicitly so users know).
pub const EMPTY_KEY: i32 = i32::MIN;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capacity_at_least_64() {
        assert_eq!(next_pow2_capacity(0), 64);
        assert_eq!(next_pow2_capacity(1), 64);
        assert_eq!(next_pow2_capacity(31), 64);
    }

    #[test]
    fn capacity_doubles_input() {
        // For n=100, we want >= 200, rounded up = 256.
        assert_eq!(next_pow2_capacity(100), 256);
    }

    #[test]
    fn capacity_is_pow2() {
        for n in [0, 1, 99, 1000, 1_000_000] {
            let c = next_pow2_capacity(n);
            assert_eq!(c.count_ones(), 1, "n={n} cap={c}");
        }
    }
}
