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

const SHADER: &str = include_str!("group_by_sum_i32.wgsl");
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

        Ok(Self {
            device: Arc::new(device),
            queue: Arc::new(queue),
            pipeline,
            bind_group_layout,
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
        // For large `cap`, the host-side vec![EMPTY_KEY; cap] dominates
        // overall query time. Use the GPU's own clear-buffer to fill
        // sums (which are zero) and a small repeated-pattern upload for
        // keys (which need EMPTY_KEY = i32::MIN).
        let slot_keys_buf = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("slot_keys"),
            size: (cap * std::mem::size_of::<i32>()) as u64,
            usage: wgpu::BufferUsages::STORAGE
                | wgpu::BufferUsages::COPY_SRC
                | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        // Fill slot_keys with EMPTY_KEY in chunks via queue.write_buffer.
        // We allocate a single chunk-sized scratch, then re-use it.
        const CHUNK_BYTES: usize = 64 * 1024; // 16K i32 entries per chunk
        let chunk_count = CHUNK_BYTES / std::mem::size_of::<i32>();
        let scratch: Vec<i32> = vec![EMPTY_KEY; chunk_count];
        let scratch_bytes: &[u8] = bytemuck::cast_slice(&scratch);
        let total_bytes = (cap * std::mem::size_of::<i32>()) as u64;
        let mut written: u64 = 0;
        while written < total_bytes {
            let remaining = total_bytes - written;
            let chunk = remaining.min(scratch_bytes.len() as u64) as usize;
            queue.write_buffer(&slot_keys_buf, written, &scratch_bytes[..chunk]);
            written += chunk as u64;
        }

        let slot_sums_buf = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("slot_sums"),
            size: (cap * std::mem::size_of::<i32>()) as u64,
            usage: wgpu::BufferUsages::STORAGE
                | wgpu::BufferUsages::COPY_SRC
                | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        // sums initialize to 0; wgpu buffers without mapped_at_creation
        // are zero-initialized by the implementation.

        // Staging buffers for readback.
        let slot_keys_stage = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("slot_keys_stage"),
            size: (cap * std::mem::size_of::<i32>()) as u64,
            usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
            mapped_at_creation: false,
        });
        let slot_sums_stage = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("slot_sums_stage"),
            size: (cap * std::mem::size_of::<i32>()) as u64,
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
        {
            let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("group_by_sum_i32-pass"),
                timestamp_writes: None,
            });
            pass.set_pipeline(&self.pipeline);
            pass.set_bind_group(0, &bind_group, &[]);
            // wgpu/WebGPU caps each grid dimension at 65535. Use a 2-D
            // dispatch when we'd exceed that on x. The shader uses
            // global_invocation_id.x only, but mapping (gx, gy) ->
            // i = gy * MAX_X + gx is still safe because we still bounds-
            // check `i >= n` inside the shader. We pass the same `n`
            // uniform; rows beyond `n` simply early-return.
            let total_threads = ((n as u64) + (WORKGROUP_SIZE as u64 - 1))
                / (WORKGROUP_SIZE as u64);
            let max_dim = 65_535u64;
            let workgroups = total_threads as u32;
            if (workgroups as u64) <= max_dim {
                pass.dispatch_workgroups(workgroups, 1, 1);
            } else {
                // Pick gx = max_dim, gy = ceil(total / max_dim).
                let gx = max_dim as u32;
                let gy = ((total_threads + max_dim - 1) / max_dim) as u32;
                pass.dispatch_workgroups(gx, gy, 1);
            }
        }
        encoder.copy_buffer_to_buffer(
            &slot_keys_buf, 0, &slot_keys_stage, 0,
            (cap * std::mem::size_of::<i32>()) as u64,
        );
        encoder.copy_buffer_to_buffer(
            &slot_sums_buf, 0, &slot_sums_stage, 0,
            (cap * std::mem::size_of::<i32>()) as u64,
        );

        queue.submit(Some(encoder.finish()));

        // Map both staging buffers and read.
        let keys_out = read_buffer_i32(device, &slot_keys_stage).await?;
        let sums_out = read_buffer_i32(device, &slot_sums_stage).await?;

        let mut out = Vec::new();
        for (k, s) in keys_out.into_iter().zip(sums_out.into_iter()) {
            if k != EMPTY_KEY {
                out.push(GroupBySumResult { key: k, sum: s as i64 });
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
