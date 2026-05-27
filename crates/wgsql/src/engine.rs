//! GPU engine: owns wgpu Device/Queue and runs the M1 kernel.

use std::sync::Arc;

use bytemuck::{Pod, Zeroable};
use wgpu::util::DeviceExt;

use crate::hash::{next_pow2_capacity, EMPTY_KEY};

#[derive(thiserror::Error, Debug)]
pub enum EngineError {
    #[error("no compatible GPU adapter found")]
    NoAdapter,
    #[error("GPU device request failed: {0}")]
    Device(String),
    #[error("input length mismatch: keys={keys}, values={values}")]
    LengthMismatch { keys: usize, values: usize },
    #[error("input too large: {0} rows exceeds u32::MAX")]
    InputTooLarge(usize),
    #[error("buffer mapping failed: {0}")]
    Map(String),
}

/// Optional knobs for query execution. `Default::default()` is fine for
/// most users; the main reason to override is when you have a tight
/// estimate of distinct group count, which lets us shrink the GPU hash
/// table dramatically.
#[derive(Clone, Copy, Debug, Default)]
pub struct GroupByOptions {
    /// Approximate number of distinct keys. Used as the lower bound for
    /// hash-table capacity. If `None`, capacity is sized at `2*n`, which
    /// is conservative but wastes memory and clear-kernel time when
    /// `distinct << n`.
    pub estimated_distinct: Option<usize>,
    /// Optional WHERE filter on the value column. The filter is fused
    /// into the aggregation kernel; rows where the predicate evaluates
    /// to false are skipped without ever touching the hash table.
    pub filter: Option<Filter>,
}

/// A filter predicate over the value column.
///
/// Evaluated as `value <op> threshold`. WHERE-clause analogues:
///   `Filter::ge(100)` ↔ `WHERE value >= 100`.
#[derive(Clone, Copy, Debug)]
pub struct Filter {
    pub op: FilterOp,
    pub threshold: i32,
}

#[derive(Clone, Copy, Debug)]
pub enum FilterOp {
    Eq, Ne, Lt, Le, Gt, Ge,
}

impl Filter {
    pub fn eq(t: i32) -> Self { Self { op: FilterOp::Eq, threshold: t } }
    pub fn ne(t: i32) -> Self { Self { op: FilterOp::Ne, threshold: t } }
    pub fn lt(t: i32) -> Self { Self { op: FilterOp::Lt, threshold: t } }
    pub fn le(t: i32) -> Self { Self { op: FilterOp::Le, threshold: t } }
    pub fn gt(t: i32) -> Self { Self { op: FilterOp::Gt, threshold: t } }
    pub fn ge(t: i32) -> Self { Self { op: FilterOp::Ge, threshold: t } }
}

/// One row of a GROUP BY result.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct GroupBySumResult {
    pub key: i32,
    pub sum: i64,
}

/// One row of a multi-aggregate result. SUM/COUNT/MIN/MAX in one pass.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AggResult {
    pub key: i32,
    pub sum: i64,
    pub count: u64,
    pub min: i32,
    pub max: i32,
}

/// The engine owns a wgpu Device + Queue and a precompiled pipeline.
/// Reuse a single Engine across many queries to amortize the device
/// initialization (~50–200ms on first construction).
pub struct Engine {
    device: Arc<wgpu::Device>,
    queue: Arc<wgpu::Queue>,
    pipeline: wgpu::ComputePipeline,
    bind_group_layout: wgpu::BindGroupLayout,
    /// Tiny i32-fill kernel used to initialize slot_keys with EMPTY_KEY.
    /// Avoids issuing many `queue.write_buffer` chunks, which is slow
    /// on browser WebGPU.
    clear_pipeline: wgpu::ComputePipeline,
    clear_bgl: wgpu::BindGroupLayout,
    /// Multi-aggregate pipeline (SUM, COUNT, MIN, MAX in one pass).
    agg_pipeline: wgpu::ComputePipeline,
    agg_bgl: wgpu::BindGroupLayout,
    pub adapter_info: wgpu::AdapterInfo,
}

impl std::fmt::Debug for Engine {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Engine")
            .field("backend", &self.adapter_info.backend)
            .field("device_name", &self.adapter_info.name)
            .finish()
    }
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct Uniforms {
    n: u32,
    cap: u32,
    cap_minus_one: u32,
    filter_kind: u32,
    filter_threshold: i32,
    _pad0: u32,
    _pad1: u32,
    _pad2: u32,
}

impl Uniforms {
    fn build(n: usize, cap: usize, filter: Option<Filter>) -> Self {
        let (kind, t) = match filter {
            None => (0, 0),
            Some(f) => (
                match f.op {
                    FilterOp::Eq => 1, FilterOp::Ne => 2,
                    FilterOp::Lt => 3, FilterOp::Le => 4,
                    FilterOp::Gt => 5, FilterOp::Ge => 6,
                },
                f.threshold,
            ),
        };
        Self {
            n: n as u32,
            cap: cap as u32,
            cap_minus_one: (cap - 1) as u32,
            filter_kind: kind,
            filter_threshold: t,
            _pad0: 0,
            _pad1: 0,
            _pad2: 0,
        }
    }
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct ClearUniforms {
    n: u32,
    fill: i32,
    _pad0: u32,
    _pad1: u32,
}

const SHADER: &str = include_str!("group_by_sum_i32.wgsl");
const CLEAR_SHADER: &str = include_str!("clear_i32.wgsl");
const AGG_SHADER: &str = include_str!("agg_i32.wgsl");
const WORKGROUP_SIZE: u32 = 64;

impl Engine {
    /// Initialize a wgpu device and compile the kernel.
    /// Blocking; call from a regular synchronous context.
    pub fn new() -> Result<Self, EngineError> {
        pollster::block_on(Self::new_async())
    }

    pub async fn new_async() -> Result<Self, EngineError> {
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor::default());
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: None,
                force_fallback_adapter: false,
            })
            .await
            .ok_or(EngineError::NoAdapter)?;
        let adapter_info = adapter.get_info();

        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label: Some("wgsql-device"),
                    required_features: wgpu::Features::empty(),
                    // We require at least 8 storage buffers per stage
                    // (WebGPU spec floor; downlevel_defaults caps at 4
                    // which isn't enough for the multi-aggregate kernel).
                    required_limits: wgpu::Limits::default(),
                    memory_hints: wgpu::MemoryHints::Performance,
                },
                None,
            )
            .await
            .map_err(|e| EngineError::Device(e.to_string()))?;

        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("group_by_sum_i32"),
            source: wgpu::ShaderSource::Wgsl(SHADER.into()),
        });

        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("group_by_sum_i32-bgl"),
            entries: &[
                // 0: uniforms
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                // 1: keys (read)
                Self::storage_layout_entry(1, true),
                // 2: values (read)
                Self::storage_layout_entry(2, true),
                // 3: slot_keys (read_write)
                Self::storage_layout_entry(3, false),
                // 4: slot_sums (read_write)
                Self::storage_layout_entry(4, false),
            ],
        });

        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("group_by_sum_i32-pl"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        let pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("group_by_sum_i32-pipe"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("main"),
            compilation_options: wgpu::PipelineCompilationOptions::default(),
            cache: None,
        });

        // ---- clear_i32 kernel: fills an i32 buffer with a uniform value.
        let clear_shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("clear_i32"),
            source: wgpu::ShaderSource::Wgsl(CLEAR_SHADER.into()),
        });
        let clear_bgl = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("clear_i32-bgl"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                Self::storage_layout_entry(1, false),
            ],
        });
        let clear_pl = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("clear_i32-pl"),
            bind_group_layouts: &[&clear_bgl],
            push_constant_ranges: &[],
        });
        let clear_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("clear_i32-pipe"),
            layout: Some(&clear_pl),
            module: &clear_shader,
            entry_point: Some("main"),
            compilation_options: wgpu::PipelineCompilationOptions::default(),
            cache: None,
        });

        // ---- agg_i32 kernel: SUM/COUNT/MIN/MAX in one pass.
        let agg_shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("agg_i32"),
            source: wgpu::ShaderSource::Wgsl(AGG_SHADER.into()),
        });
        let agg_bgl = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("agg_i32-bgl"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                Self::storage_layout_entry(1, true),  // keys
                Self::storage_layout_entry(2, true),  // values
                Self::storage_layout_entry(3, false), // slot_keys
                Self::storage_layout_entry(4, false), // slot_sums
                Self::storage_layout_entry(5, false), // slot_counts
                Self::storage_layout_entry(6, false), // slot_mins
                Self::storage_layout_entry(7, false), // slot_maxs
            ],
        });
        let agg_pl = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("agg_i32-pl"),
            bind_group_layouts: &[&agg_bgl],
            push_constant_ranges: &[],
        });
        let agg_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("agg_i32-pipe"),
            layout: Some(&agg_pl),
            module: &agg_shader,
            entry_point: Some("main"),
            compilation_options: wgpu::PipelineCompilationOptions::default(),
            cache: None,
        });

        Ok(Self {
            device: Arc::new(device),
            queue: Arc::new(queue),
            pipeline,
            bind_group_layout,
            clear_pipeline,
            clear_bgl,
            agg_pipeline,
            agg_bgl,
            adapter_info,
        })
    }

    fn storage_layout_entry(binding: u32, read_only: bool) -> wgpu::BindGroupLayoutEntry {
        wgpu::BindGroupLayoutEntry {
            binding,
            visibility: wgpu::ShaderStages::COMPUTE,
            ty: wgpu::BindingType::Buffer {
                ty: wgpu::BufferBindingType::Storage { read_only },
                has_dynamic_offset: false,
                min_binding_size: None,
            },
            count: None,
        }
    }

    /// Execute SELECT key, SUM(value) FROM (keys, values) GROUP BY key.
    ///
    /// Synchronous on native; calls into the GPU and blocks the current
    /// thread until results are mapped. **Do not call from WASM** —
    /// use `group_by_sum_i32_async` instead.
    pub fn group_by_sum_i32(
        &self,
        keys: &[i32],
        values: &[i32],
    ) -> Result<Vec<GroupBySumResult>, EngineError> {
        pollster::block_on(self.group_by_sum_i32_async(keys, values))
    }

    /// Synchronous variant of [`group_by_sum_i32_with_opts_async`].
    pub fn group_by_sum_i32_with_opts(
        &self,
        keys: &[i32],
        values: &[i32],
        opts: GroupByOptions,
    ) -> Result<Vec<GroupBySumResult>, EngineError> {
        pollster::block_on(self.group_by_sum_i32_with_opts_async(keys, values, opts))
    }

    /// Async variant of [`group_by_sum_i32`]. Use this in WASM (where
    /// thread-blocking is forbidden) or in async contexts.
    pub async fn group_by_sum_i32_async(
        &self,
        keys: &[i32],
        values: &[i32],
    ) -> Result<Vec<GroupBySumResult>, EngineError> {
        self.group_by_sum_i32_with_opts_async(keys, values, GroupByOptions::default()).await
    }

    /// Like [`group_by_sum_i32_async`] but lets the caller pass a
    /// distinct-count hint. Sizing the hash table to ~2× expected
    /// distinct (instead of 2× row count) is a 5–10× speedup on the
    /// clear+materialize path when distinct ≪ n.
    pub async fn group_by_sum_i32_with_opts_async(
        &self,
        keys: &[i32],
        values: &[i32],
        opts: GroupByOptions,
    ) -> Result<Vec<GroupBySumResult>, EngineError> {
        if keys.len() != values.len() {
            return Err(EngineError::LengthMismatch {
                keys: keys.len(),
                values: values.len(),
            });
        }
        let n = keys.len();
        if n == 0 {
            return Ok(Vec::new());
        }
        if n > u32::MAX as usize {
            return Err(EngineError::InputTooLarge(n));
        }
        // Hash-table capacity. Default = 2*n; with a hint we use 2*hint
        // (clamped to >= 64). This shrinks the clear+materialize work
        // by ~n/distinct when groups are concentrated.
        let cap_seed = match opts.estimated_distinct {
            Some(d) => d.max(1),
            None => n,
        };
        let cap = next_pow2_capacity(cap_seed);
        if cap > u32::MAX as usize {
            return Err(EngineError::InputTooLarge(n));
        }

        let device = &*self.device;
        let queue = &*self.queue;

        // Uniforms.
        let uniforms = Uniforms::build(n, cap, opts.filter);
        let uniform_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("uniforms"),
            contents: bytemuck::bytes_of(&uniforms),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        // Input buffers.
        let keys_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("keys"),
            contents: bytemuck::cast_slice(keys),
            usage: wgpu::BufferUsages::STORAGE,
        });
        let values_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("values"),
            contents: bytemuck::cast_slice(values),
            usage: wgpu::BufferUsages::STORAGE,
        });

        // Slot tables. Initialize keys to EMPTY_KEY, sums to 0.
        // Allocate uninitialized; we'll clear via a tiny GPU kernel.
        // Using GPU-side fill avoids the per-chunk overhead of
        // queue.write_buffer in browser WebGPU.
        let slot_keys_buf = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("slot_keys"),
            size: (cap * std::mem::size_of::<i32>()) as u64,
            usage: wgpu::BufferUsages::STORAGE
                | wgpu::BufferUsages::COPY_SRC,
            mapped_at_creation: false,
        });
        let slot_sums_buf = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("slot_sums"),
            size: (cap * std::mem::size_of::<i32>()) as u64,
            usage: wgpu::BufferUsages::STORAGE
                | wgpu::BufferUsages::COPY_SRC,
            mapped_at_creation: false,
        });

        // Clear-uniforms for both passes (we issue two clear dispatches
        // back-to-back: keys -> EMPTY_KEY, sums -> 0).
        let clear_uniforms_keys = ClearUniforms { n: cap as u32, fill: EMPTY_KEY, _pad0: 0, _pad1: 0 };
        let clear_uniforms_sums = ClearUniforms { n: cap as u32, fill: 0,         _pad0: 0, _pad1: 0 };
        let clear_u_keys = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("clear_u_keys"),
            contents: bytemuck::bytes_of(&clear_uniforms_keys),
            usage: wgpu::BufferUsages::UNIFORM,
        });
        let clear_u_sums = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("clear_u_sums"),
            contents: bytemuck::bytes_of(&clear_uniforms_sums),
            usage: wgpu::BufferUsages::UNIFORM,
        });
        let clear_bg_keys = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("clear-bg-keys"),
            layout: &self.clear_bgl,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: clear_u_keys.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 1, resource: slot_keys_buf.as_entire_binding() },
            ],
        });
        let clear_bg_sums = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("clear-bg-sums"),
            layout: &self.clear_bgl,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: clear_u_sums.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 1, resource: slot_sums_buf.as_entire_binding() },
            ],
        });

        // One staging buffer for both keys and sums concatenated.
        // Layout: [slot_keys (cap × i32) | slot_sums (cap × i32)]
        // Single map_async => single browser round-trip (vs the previous
        // two), which is the dominant cost on browser WebGPU.
        let stage_size = (2 * cap * std::mem::size_of::<i32>()) as u64;
        let combined_stage = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("combined_stage"),
            size: stage_size,
            usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
            mapped_at_creation: false,
        });

        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("group_by_sum_i32-bg"),
            layout: &self.bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: uniform_buf.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 1, resource: keys_buf.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 2, resource: values_buf.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 3, resource: slot_keys_buf.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 4, resource: slot_sums_buf.as_entire_binding() },
            ],
        });

        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("group_by_sum_i32-enc"),
        });
        // Helper: dispatch the clear kernel to fill `cap` elements.
        let cap_total_threads = (cap as u64 + WORKGROUP_SIZE as u64 - 1) / WORKGROUP_SIZE as u64;
        let max_dim = 65_535u64;
        let dispatch = |pass: &mut wgpu::ComputePass<'_>, total: u64| {
            if total <= max_dim {
                pass.dispatch_workgroups(total as u32, 1, 1);
            } else {
                let gx = max_dim as u32;
                let gy = ((total + max_dim - 1) / max_dim) as u32;
                pass.dispatch_workgroups(gx, gy, 1);
            }
        };
        // Clear pass: keys + sums in one compute pass to share command-
        // buffer overhead.
        {
            let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("clear-pass"),
                timestamp_writes: None,
            });
            pass.set_pipeline(&self.clear_pipeline);
            pass.set_bind_group(0, &clear_bg_keys, &[]);
            dispatch(&mut pass, cap_total_threads);
            pass.set_bind_group(0, &clear_bg_sums, &[]);
            dispatch(&mut pass, cap_total_threads);
        }
        {
            let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("group_by_sum_i32-pass"),
                timestamp_writes: None,
            });
            pass.set_pipeline(&self.pipeline);
            pass.set_bind_group(0, &bind_group, &[]);
            let total_threads = ((n as u64) + (WORKGROUP_SIZE as u64 - 1))
                / (WORKGROUP_SIZE as u64);
            dispatch(&mut pass, total_threads);
        }
        let half = (cap * std::mem::size_of::<i32>()) as u64;
        encoder.copy_buffer_to_buffer(&slot_keys_buf, 0, &combined_stage, 0,    half);
        encoder.copy_buffer_to_buffer(&slot_sums_buf, 0, &combined_stage, half, half);

        queue.submit(Some(encoder.finish()));

        // Single mapped read.
        let raw = read_buffer_i32(device, &combined_stage).await?;
        let (keys_out, sums_out) = raw.split_at(cap);

        let mut out = Vec::new();
        for (k, s) in keys_out.iter().zip(sums_out.iter()) {
            if *k != EMPTY_KEY {
                out.push(GroupBySumResult { key: *k, sum: *s as i64 });
            }
        }
        Ok(out)
    }

    /// Multi-aggregate GROUP BY: SUM, COUNT, MIN, MAX in one pass.
    ///
    /// Same shape as `group_by_sum_i32_with_opts_async` but reads four
    /// aggregates per group from a single shared kernel — what GPU OLAP
    /// is built for. CPU has to scan four times (or build one Map but
    /// with branches per aggregate); GPU does all four in the same
    /// memory transaction.
    pub async fn agg_i32_async(
        &self,
        keys: &[i32],
        values: &[i32],
        opts: GroupByOptions,
    ) -> Result<Vec<AggResult>, EngineError> {
        if keys.len() != values.len() {
            return Err(EngineError::LengthMismatch {
                keys: keys.len(),
                values: values.len(),
            });
        }
        let n = keys.len();
        if n == 0 {
            return Ok(Vec::new());
        }
        if n > u32::MAX as usize {
            return Err(EngineError::InputTooLarge(n));
        }
        let cap_seed = match opts.estimated_distinct {
            Some(d) => d.max(1),
            None => n,
        };
        let cap = next_pow2_capacity(cap_seed);
        if cap > u32::MAX as usize {
            return Err(EngineError::InputTooLarge(n));
        }

        let device = &*self.device;
        let queue = &*self.queue;

        let uniforms = Uniforms::build(n, cap, opts.filter);
        let uniform_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("agg-uniforms"),
            contents: bytemuck::bytes_of(&uniforms),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        let keys_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("agg-keys"),
            contents: bytemuck::cast_slice(keys),
            usage: wgpu::BufferUsages::STORAGE,
        });
        let values_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("agg-values"),
            contents: bytemuck::cast_slice(values),
            usage: wgpu::BufferUsages::STORAGE,
        });

        let bytes = (cap * std::mem::size_of::<i32>()) as u64;
        let mk_slot = |label: &'static str| -> wgpu::Buffer {
            device.create_buffer(&wgpu::BufferDescriptor {
                label: Some(label),
                size: bytes,
                usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
                mapped_at_creation: false,
            })
        };
        let slot_keys = mk_slot("agg-slot_keys");
        let slot_sums = mk_slot("agg-slot_sums");
        let slot_counts = mk_slot("agg-slot_counts");
        let slot_mins = mk_slot("agg-slot_mins");
        let slot_maxs = mk_slot("agg-slot_maxs");

        // Clear uniforms: each slot table needs a different fill value.
        let mk_clear_u = |fill: i32, label: &'static str| -> wgpu::Buffer {
            device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some(label),
                contents: bytemuck::bytes_of(&ClearUniforms {
                    n: cap as u32, fill, _pad0: 0, _pad1: 0,
                }),
                usage: wgpu::BufferUsages::UNIFORM,
            })
        };
        let cu_keys   = mk_clear_u(EMPTY_KEY,    "cu_keys");
        let cu_sums   = mk_clear_u(0,            "cu_sums");
        let cu_counts = mk_clear_u(0,            "cu_counts");
        let cu_mins   = mk_clear_u(i32::MAX,     "cu_mins");
        let cu_maxs   = mk_clear_u(i32::MIN,     "cu_maxs");

        let mk_clear_bg = |u: &wgpu::Buffer, slot: &wgpu::Buffer, label: &'static str| {
            device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some(label),
                layout: &self.clear_bgl,
                entries: &[
                    wgpu::BindGroupEntry { binding: 0, resource: u.as_entire_binding() },
                    wgpu::BindGroupEntry { binding: 1, resource: slot.as_entire_binding() },
                ],
            })
        };
        let cbg_keys   = mk_clear_bg(&cu_keys,   &slot_keys,   "cbg_keys");
        let cbg_sums   = mk_clear_bg(&cu_sums,   &slot_sums,   "cbg_sums");
        let cbg_counts = mk_clear_bg(&cu_counts, &slot_counts, "cbg_counts");
        let cbg_mins   = mk_clear_bg(&cu_mins,   &slot_mins,   "cbg_mins");
        let cbg_maxs   = mk_clear_bg(&cu_maxs,   &slot_maxs,   "cbg_maxs");

        let bg = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("agg-bg"),
            layout: &self.agg_bgl,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: uniform_buf.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 1, resource: keys_buf.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 2, resource: values_buf.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 3, resource: slot_keys.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 4, resource: slot_sums.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 5, resource: slot_counts.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 6, resource: slot_mins.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 7, resource: slot_maxs.as_entire_binding() },
            ],
        });

        // Combined readback: 5 columns × cap × i32 in one staging buffer.
        let combined_size = 5 * bytes;
        let stage = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("agg-stage"),
            size: combined_size,
            usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
            mapped_at_creation: false,
        });

        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("agg-enc"),
        });
        let cap_total = (cap as u64 + WORKGROUP_SIZE as u64 - 1) / WORKGROUP_SIZE as u64;
        let max_dim = 65_535u64;
        let dispatch = |pass: &mut wgpu::ComputePass<'_>, total: u64| {
            if total <= max_dim {
                pass.dispatch_workgroups(total as u32, 1, 1);
            } else {
                let gx = max_dim as u32;
                let gy = ((total + max_dim - 1) / max_dim) as u32;
                pass.dispatch_workgroups(gx, gy, 1);
            }
        };
        {
            let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("agg-clear-pass"),
                timestamp_writes: None,
            });
            pass.set_pipeline(&self.clear_pipeline);
            for bg in [&cbg_keys, &cbg_sums, &cbg_counts, &cbg_mins, &cbg_maxs] {
                pass.set_bind_group(0, bg, &[]);
                dispatch(&mut pass, cap_total);
            }
        }
        {
            let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("agg-pass"),
                timestamp_writes: None,
            });
            pass.set_pipeline(&self.agg_pipeline);
            pass.set_bind_group(0, &bg, &[]);
            let total_threads = ((n as u64) + (WORKGROUP_SIZE as u64 - 1))
                / (WORKGROUP_SIZE as u64);
            dispatch(&mut pass, total_threads);
        }
        // Copy 5 buffers contiguously into the combined staging buffer.
        encoder.copy_buffer_to_buffer(&slot_keys,   0, &stage, 0 * bytes, bytes);
        encoder.copy_buffer_to_buffer(&slot_sums,   0, &stage, 1 * bytes, bytes);
        encoder.copy_buffer_to_buffer(&slot_counts, 0, &stage, 2 * bytes, bytes);
        encoder.copy_buffer_to_buffer(&slot_mins,   0, &stage, 3 * bytes, bytes);
        encoder.copy_buffer_to_buffer(&slot_maxs,   0, &stage, 4 * bytes, bytes);

        queue.submit(Some(encoder.finish()));

        let raw = read_buffer_i32(device, &stage).await?;
        let (k_part, rest)   = raw.split_at(cap);
        let (s_part, rest)   = rest.split_at(cap);
        let (c_part, rest)   = rest.split_at(cap);
        let (lo_part, hi_part) = rest.split_at(cap);

        let mut out = Vec::new();
        for i in 0..cap {
            if k_part[i] != EMPTY_KEY {
                out.push(AggResult {
                    key: k_part[i],
                    sum: s_part[i] as i64,
                    count: c_part[i] as u64,
                    min: lo_part[i],
                    max: hi_part[i],
                });
            }
        }
        Ok(out)
    }

    /// Synchronous variant of [`agg_i32_async`].
    pub fn agg_i32(
        &self,
        keys: &[i32],
        values: &[i32],
        opts: GroupByOptions,
    ) -> Result<Vec<AggResult>, EngineError> {
        pollster::block_on(self.agg_i32_async(keys, values, opts))
    }
}

async fn read_buffer_i32(
    device: &wgpu::Device,
    buf: &wgpu::Buffer,
) -> Result<Vec<i32>, EngineError> {
    let slice = buf.slice(..);
    let (sender, receiver) = futures_channel::oneshot::channel();
    slice.map_async(wgpu::MapMode::Read, move |res| {
        let _ = sender.send(res);
    });
    // wgpu 23: poll(Maintain) -> MaintainResult; we don't need to inspect it.
    let _ = device.poll(wgpu::Maintain::Wait);
    let mapped_result = receiver.await
        .map_err(|e| EngineError::Map(e.to_string()))?;
    mapped_result.map_err(|e| EngineError::Map(e.to_string()))?;
    let view = slice.get_mapped_range();
    let out = bytemuck::cast_slice::<u8, i32>(&view).to_vec();
    drop(view);
    buf.unmap();
    Ok(out)
}
