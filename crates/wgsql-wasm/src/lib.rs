//! Browser bindings for wgsql via wasm-bindgen.
//!
//! The native crate's `Engine::new()` uses `pollster::block_on`, which
//! deadlocks the JS event loop in WASM. We expose a parallel async API
//! here (JS, not Rust):
//!
//! ```text
//! await wgsql.init()                          // returns Engine
//! engine.groupBySumI32(keys, values, hint?)   // SUM only
//! engine.aggI32(keys, values, hint?, filter?) // SUM + COUNT + MIN + MAX
//! ```
//!
//! `filter` (when provided) is `{ op: "ge"|"le"|"gt"|"lt"|"eq"|"ne",
//! threshold: i32 }` and is fused into the kernel so non-matching rows
//! are skipped before they ever touch the hash table — i.e. WHERE does
//! not cost a separate pass.
//!
//! Sum results are split into low/high i32 halves because JS lacks a
//! native i64 typed array. JS callers reassemble with `hi*2^32 + lo`.

#![allow(non_snake_case)]

use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::prelude::*;
use wgsql::{
    Engine as InnerEngine, Filter as InnerFilter, FilterOp, GroupByOptions,
};

#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

/// Construct an Engine; resolves once the WebGPU adapter+device are ready.
#[wasm_bindgen(js_name = "init")]
pub async fn init() -> Result<Engine, JsValue> {
    let inner = InnerEngine::new_async()
        .await
        .map_err(|e| JsValue::from_str(&format!("engine init: {e}")))?;
    Ok(Engine { inner: Rc::new(RefCell::new(inner)) })
}

#[wasm_bindgen]
pub struct Engine {
    // Rc<RefCell<...>> so we can hand out async methods that don't take &self
    // (wasm-bindgen async methods can't easily reborrow). The RefCell is only
    // borrowed transiently inside the future's body, never across awaits.
    inner: Rc<RefCell<InnerEngine>>,
}

/// Parse the JS `{ op, threshold }` object into our Rust filter type.
fn parse_filter(value: &JsValue) -> Result<Option<InnerFilter>, JsValue> {
    if value.is_null() || value.is_undefined() {
        return Ok(None);
    }
    let obj: js_sys::Object = value.clone().dyn_into().map_err(|_| {
        JsValue::from_str("filter must be { op: 'ge'|'le'|'gt'|'lt'|'eq'|'ne', threshold: number }")
    })?;
    let op_js = js_sys::Reflect::get(&obj, &JsValue::from_str("op"))?;
    let threshold_js = js_sys::Reflect::get(&obj, &JsValue::from_str("threshold"))?;
    let op_str = op_js.as_string().ok_or_else(|| JsValue::from_str("filter.op must be a string"))?;
    let threshold = threshold_js
        .as_f64()
        .ok_or_else(|| JsValue::from_str("filter.threshold must be a number"))? as i32;
    let op = match op_str.as_str() {
        "eq" => FilterOp::Eq,
        "ne" => FilterOp::Ne,
        "lt" => FilterOp::Lt,
        "le" => FilterOp::Le,
        "gt" => FilterOp::Gt,
        "ge" => FilterOp::Ge,
        other => return Err(JsValue::from_str(&format!("unknown filter op: {other}"))),
    };
    Ok(Some(InnerFilter { op, threshold }))
}

#[wasm_bindgen]
impl Engine {
    /// Adapter name (e.g. "Apple M2 Pro"). Useful for the demo UI.
    #[wasm_bindgen(getter, js_name = "adapterName")]
    pub fn adapter_name(&self) -> String {
        self.inner.borrow().adapter_info.name.clone()
    }

    /// Backend identifier as a string ("Vulkan", "Metal", "BrowserWebGpu", ...).
    #[wasm_bindgen(getter, js_name = "backend")]
    pub fn backend(&self) -> String {
        format!("{:?}", self.inner.borrow().adapter_info.backend)
    }

    /// Run SELECT key, SUM(value) GROUP BY key.
    ///
    /// `keys` and `values` are i32 typed arrays of equal length.
    /// `estimatedDistinct` (optional) is the approximate group cardinality;
    /// passing it lets us size the GPU hash table tightly and is a 5x+
    /// speedup when distinct keys ≪ row count.
    /// Returns a flat Int32Array of [key0, sum_lo0, sum_hi0, key1, ...]
    /// because JS lacks a native i64 typed array.
    #[wasm_bindgen(js_name = "groupBySumI32")]
    pub fn group_by_sum_i32(
        &self,
        keys: Vec<i32>,
        values: Vec<i32>,
        estimated_distinct: Option<usize>,
    ) -> js_sys::Promise {
        let inner = Rc::clone(&self.inner);
        wasm_bindgen_futures::future_to_promise(async move {
            let opts = GroupByOptions { estimated_distinct, filter: None };
            let result = {
                let engine = inner.borrow();
                engine.group_by_sum_i32_with_opts_async(&keys, &values, opts).await
            };
            let rows = result.map_err(|e| JsValue::from_str(&format!("group_by failed: {e}")))?;
            let mut flat = Vec::with_capacity(rows.len() * 3);
            for r in rows {
                flat.push(r.key);
                let s = r.sum as u64;
                flat.push(s as i32);
                flat.push((s >> 32) as i32);
            }
            let arr = js_sys::Int32Array::new_with_length(flat.len() as u32);
            arr.copy_from(&flat);
            Ok(arr.into())
        })
    }

    /// Run SELECT key, SUM(v), COUNT(*), MIN(v), MAX(v) GROUP BY key
    /// optionally fused with WHERE (see top-of-file docs).
    ///
    /// Returns a flat Int32Array of 7 i32 fields per row:
    ///   [key, sum_lo, sum_hi, count_lo, count_hi, min, max]
    /// JS callers can repack into objects; the layout is dense and
    /// avoids any object allocation in the hot path.
    #[wasm_bindgen(js_name = "aggI32")]
    pub fn agg_i32(
        &self,
        keys: Vec<i32>,
        values: Vec<i32>,
        estimated_distinct: Option<usize>,
        filter: JsValue,
    ) -> js_sys::Promise {
        let inner = Rc::clone(&self.inner);
        wasm_bindgen_futures::future_to_promise(async move {
            let parsed_filter = parse_filter(&filter)?;
            let opts = GroupByOptions { estimated_distinct, filter: parsed_filter };
            let result = {
                let engine = inner.borrow();
                engine.agg_i32_async(&keys, &values, opts).await
            };
            let rows = result.map_err(|e| JsValue::from_str(&format!("agg failed: {e}")))?;
            let mut flat = Vec::with_capacity(rows.len() * 7);
            for r in rows {
                flat.push(r.key);
                let s = r.sum as u64;
                flat.push(s as i32);
                flat.push((s >> 32) as i32);
                let c = r.count;
                flat.push(c as i32);
                flat.push((c >> 32) as i32);
                flat.push(r.min);
                flat.push(r.max);
            }
            let arr = js_sys::Int32Array::new_with_length(flat.len() as u32);
            arr.copy_from(&flat);
            Ok(arr.into())
        })
    }
}
