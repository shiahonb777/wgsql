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

/// One row of a GROUP BY result.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct GroupBySumResult {
    pub key: i32,
    pub sum: i64,
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
    _pad: u32,
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
                    required_limits: wgpu::Limits::downlevel_defaults(),
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

        Ok(Self {
            device: Arc::new(device),
            queue: Arc::new(queue),
            pipeline,
            bind_group_layout,
            clear_pipeline,
            clear_bgl,
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

    /// Async variant of [`group_by_sum_i32`]. Use this in WASM (where
    /// thread-blocking is forbidden) or in async contexts.
    pub async fn group_by_sum_i32_async(
        &self,
        keys: &[i32],
        values: &[i32],
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
        let cap = next_pow2_capacity(n);
        if cap > u32::MAX as usize {
            return Err(EngineError::InputTooLarge(n));
        }

        let device = &*self.device;
        let queue = &*self.queue;

        // Uniforms.
        let uniforms = Uniforms {
            n: n as u32,
            cap: cap as u32,
            cap_minus_one: (cap - 1) as u32,
            _pad: 0,
        };
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
