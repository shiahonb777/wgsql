//! Browser bindings for wgsql via wasm-bindgen.
//!
//! The native crate's `Engine::new()` uses `pollster::block_on`, which
//! deadlocks the JS event loop in WASM. We expose a parallel async API
//! here:
//!
//!     await wgsql.init()                        // returns Engine
//!     engine.groupBySumI32(keys, values)        // sync; returns rows
//!
//! Inputs are typed `Int32Array` from JS; output is a flat
//! `Int32Array` of [k0, lo0, hi0, k1, lo1, hi1, ...] triples that JS
//! callers can repack into objects. (sums are i64 in the lib's API; we
//! split into low/high u32 halves to fit JS.)

#![allow(non_snake_case)]

use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::prelude::*;
use wgsql::Engine as InnerEngine;

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
            let opts = wgsql::GroupByOptions { estimated_distinct, filter: None };
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
}
