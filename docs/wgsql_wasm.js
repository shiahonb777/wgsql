/* @ts-self-types="./wgsql_wasm.d.ts" */

export class Engine {
    static __wrap(ptr) {
        const obj = Object.create(Engine.prototype);
        obj.__wbg_ptr = ptr;
        EngineFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        EngineFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_engine_free(ptr, 0);
    }
    /**
     * Adapter name (e.g. "Apple M2 Pro"). Useful for the demo UI.
     * @returns {string}
     */
    get adapterName() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.engine_adapterName(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Backend identifier as a string ("Vulkan", "Metal", "BrowserWebGpu", ...).
     * @returns {string}
     */
    get backend() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.engine_backend(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Run SELECT key, SUM(value) GROUP BY key.
     *
     * `keys` and `values` are i32 typed arrays of equal length.
     * Returns a flat Int32Array of [key0, sum_lo0, sum_hi0, key1, ...]
     * because JS lacks a native i64 typed array.
     * @param {Int32Array} keys
     * @param {Int32Array} values
     * @returns {Promise<any>}
     */
    groupBySumI32(keys, values) {
        const ptr0 = passArray32ToWasm0(keys, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray32ToWasm0(values, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.engine_groupBySumI32(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        return ret;
    }
}
if (Symbol.dispose) Engine.prototype[Symbol.dispose] = Engine.prototype.free;

/**
 * Construct an Engine; resolves once the WebGPU adapter+device are ready.
 * @returns {Promise<Engine>}
 */
export function init() {
    const ret = wasm.init();
    return ret;
}

export function init_panic_hook() {
    wasm.init_panic_hook();
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Window_b0c275b50676d397: function(arg0) {
            const ret = arg0.Window;
            return ret;
        },
        __wbg_WorkerGlobalScope_7a1f78d9f7542cfa: function(arg0) {
            const ret = arg0.WorkerGlobalScope;
            return ret;
        },
        __wbg___wbindgen_debug_string_0accd80f45e5faa2: function(arg0, arg1) {
            const ret = debugString(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_is_function_754e9f305ff6029e: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_null_87c3bfe968c6a5ad: function(arg0) {
            const ret = arg0 === null;
            return ret;
        },
        __wbg___wbindgen_is_object_56732c2bc353f41d: function(arg0) {
            const val = arg0;
            const ret = typeof(val) === 'object' && val !== null;
            return ret;
        },
        __wbg___wbindgen_is_undefined_67b456be8673d3d7: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_string_get_72bdf95d3ae505b1: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_1506f2235d1bdba0: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg__wbg_cb_unref_61db23ac97f16c31: function(arg0) {
            arg0._wbg_cb_unref();
        },
        __wbg_beginComputePass_0fb772608bf84f44: function(arg0, arg1) {
            const ret = arg0.beginComputePass(arg1);
            return ret;
        },
        __wbg_beginRenderPass_c662486e5caabb09: function(arg0, arg1) {
            const ret = arg0.beginRenderPass(arg1);
            return ret;
        },
        __wbg_buffer_d370c8cae5692933: function(arg0) {
            const ret = arg0.buffer;
            return ret;
        },
        __wbg_call_9c758de292015997: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.call(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_clearBuffer_e063e34f4a181e05: function(arg0, arg1, arg2, arg3) {
            arg0.clearBuffer(arg1, arg2, arg3);
        },
        __wbg_clearBuffer_f330030ddc7767fc: function(arg0, arg1, arg2) {
            arg0.clearBuffer(arg1, arg2);
        },
        __wbg_configure_c71c9f57ca3edf98: function(arg0, arg1) {
            arg0.configure(arg1);
        },
        __wbg_copyBufferToBuffer_910ae8c201bdff01: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            arg0.copyBufferToBuffer(arg1, arg2, arg3, arg4, arg5);
        },
        __wbg_copyBufferToTexture_8c287708aff282a4: function(arg0, arg1, arg2, arg3) {
            arg0.copyBufferToTexture(arg1, arg2, arg3);
        },
        __wbg_copyExternalImageToTexture_540fcadea7d8323f: function(arg0, arg1, arg2, arg3) {
            arg0.copyExternalImageToTexture(arg1, arg2, arg3);
        },
        __wbg_copyTextureToBuffer_76965133f36672a4: function(arg0, arg1, arg2, arg3) {
            arg0.copyTextureToBuffer(arg1, arg2, arg3);
        },
        __wbg_copyTextureToTexture_04331d5254bea8fc: function(arg0, arg1, arg2, arg3) {
            arg0.copyTextureToTexture(arg1, arg2, arg3);
        },
        __wbg_createBindGroupLayout_fe258aa231f602a1: function(arg0, arg1) {
            const ret = arg0.createBindGroupLayout(arg1);
            return ret;
        },
        __wbg_createBindGroup_783178b92eca4f94: function(arg0, arg1) {
            const ret = arg0.createBindGroup(arg1);
            return ret;
        },
        __wbg_createBuffer_05c143bc69af7de1: function(arg0, arg1) {
            const ret = arg0.createBuffer(arg1);
            return ret;
        },
        __wbg_createCommandEncoder_eeac00d01e7c7215: function(arg0, arg1) {
            const ret = arg0.createCommandEncoder(arg1);
            return ret;
        },
        __wbg_createComputePipeline_70cb69a35311bb5a: function(arg0, arg1) {
            const ret = arg0.createComputePipeline(arg1);
            return ret;
        },
        __wbg_createPipelineLayout_3195019c488e9d1f: function(arg0, arg1) {
            const ret = arg0.createPipelineLayout(arg1);
            return ret;
        },
        __wbg_createQuerySet_a8afd88335f1ae22: function(arg0, arg1) {
            const ret = arg0.createQuerySet(arg1);
            return ret;
        },
        __wbg_createRenderBundleEncoder_0ae4be9a26b4f4aa: function(arg0, arg1) {
            const ret = arg0.createRenderBundleEncoder(arg1);
            return ret;
        },
        __wbg_createRenderPipeline_430c946fe289280f: function(arg0, arg1) {
            const ret = arg0.createRenderPipeline(arg1);
            return ret;
        },
        __wbg_createSampler_59ee59f9ce9c89e6: function(arg0, arg1) {
            const ret = arg0.createSampler(arg1);
            return ret;
        },
        __wbg_createShaderModule_cb92dd515bc68e5a: function(arg0, arg1) {
            const ret = arg0.createShaderModule(arg1);
            return ret;
        },
        __wbg_createTexture_ae83ede28133180f: function(arg0, arg1) {
            const ret = arg0.createTexture(arg1);
            return ret;
        },
        __wbg_createView_c0fb516125a12571: function(arg0, arg1) {
            const ret = arg0.createView(arg1);
            return ret;
        },
        __wbg_destroy_d1537bee2b5a7849: function(arg0) {
            arg0.destroy();
        },
        __wbg_destroy_d28e196e9dbc3b27: function(arg0) {
            arg0.destroy();
        },
        __wbg_destroy_ddd5bee0b4b02f49: function(arg0) {
            arg0.destroy();
        },
        __wbg_dispatchWorkgroupsIndirect_e915df9199133ac5: function(arg0, arg1, arg2) {
            arg0.dispatchWorkgroupsIndirect(arg1, arg2);
        },
        __wbg_dispatchWorkgroups_0d71a3ed9fcaee9f: function(arg0, arg1, arg2, arg3) {
            arg0.dispatchWorkgroups(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0);
        },
        __wbg_document_aceb08cd6489baf5: function(arg0) {
            const ret = arg0.document;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_drawIndexedIndirect_0954a720a9b13248: function(arg0, arg1, arg2) {
            arg0.drawIndexedIndirect(arg1, arg2);
        },
        __wbg_drawIndexedIndirect_7882fca885de47ce: function(arg0, arg1, arg2) {
            arg0.drawIndexedIndirect(arg1, arg2);
        },
        __wbg_drawIndexed_280977bb1d3baf3d: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            arg0.drawIndexed(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4, arg5 >>> 0);
        },
        __wbg_drawIndexed_9a150a51a8427045: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            arg0.drawIndexed(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4, arg5 >>> 0);
        },
        __wbg_drawIndirect_b393626eb70ae7fb: function(arg0, arg1, arg2) {
            arg0.drawIndirect(arg1, arg2);
        },
        __wbg_drawIndirect_c6c299eb2ddf8fd7: function(arg0, arg1, arg2) {
            arg0.drawIndirect(arg1, arg2);
        },
        __wbg_draw_26370233bc7d2e7e: function(arg0, arg1, arg2, arg3, arg4) {
            arg0.draw(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4 >>> 0);
        },
        __wbg_draw_83285c3877561ec1: function(arg0, arg1, arg2, arg3, arg4) {
            arg0.draw(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4 >>> 0);
        },
        __wbg_end_420d93a37f764933: function(arg0) {
            arg0.end();
        },
        __wbg_end_97a4259681c42d8d: function(arg0) {
            arg0.end();
        },
        __wbg_engine_new: function(arg0) {
            const ret = Engine.__wrap(arg0);
            return ret;
        },
        __wbg_error_a6fa202b58aa1cd3: function(arg0, arg1) {
            let deferred0_0;
            let deferred0_1;
            try {
                deferred0_0 = arg0;
                deferred0_1 = arg1;
                console.error(getStringFromWasm0(arg0, arg1));
            } finally {
                wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
            }
        },
        __wbg_error_d9a855c84f9b4e4c: function(arg0) {
            const ret = arg0.error;
            return ret;
        },
        __wbg_executeBundles_452872ac4afbbf92: function(arg0, arg1) {
            arg0.executeBundles(arg1);
        },
        __wbg_features_15adc13e5b141301: function(arg0) {
            const ret = arg0.features;
            return ret;
        },
        __wbg_features_f6c1f470639a88e2: function(arg0) {
            const ret = arg0.features;
            return ret;
        },
        __wbg_finish_23cbd862d4229ec3: function(arg0, arg1) {
            const ret = arg0.finish(arg1);
            return ret;
        },
        __wbg_finish_52172eac54898d16: function(arg0) {
            const ret = arg0.finish();
            return ret;
        },
        __wbg_finish_94bc184b535e2a90: function(arg0, arg1) {
            const ret = arg0.finish(arg1);
            return ret;
        },
        __wbg_finish_dad34d81d4500e85: function(arg0) {
            const ret = arg0.finish();
            return ret;
        },
        __wbg_getBindGroupLayout_6d503a1fba524ee6: function(arg0, arg1) {
            const ret = arg0.getBindGroupLayout(arg1 >>> 0);
            return ret;
        },
        __wbg_getBindGroupLayout_bc897888c0670dbe: function(arg0, arg1) {
            const ret = arg0.getBindGroupLayout(arg1 >>> 0);
            return ret;
        },
        __wbg_getCompilationInfo_469a33f449854be7: function(arg0) {
            const ret = arg0.getCompilationInfo();
            return ret;
        },
        __wbg_getContext_469d34698d869fc1: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.getContext(getStringFromWasm0(arg1, arg2));
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        }, arguments); },
        __wbg_getContext_7d3a8f461c828713: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.getContext(getStringFromWasm0(arg1, arg2));
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        }, arguments); },
        __wbg_getCurrentTexture_e27b103ea7a3ce3c: function(arg0) {
            const ret = arg0.getCurrentTexture();
            return ret;
        },
        __wbg_getMappedRange_4f36f39e059a63c6: function(arg0, arg1, arg2) {
            const ret = arg0.getMappedRange(arg1, arg2);
            return ret;
        },
        __wbg_getPreferredCanvasFormat_13332df72e63723a: function(arg0) {
            const ret = arg0.getPreferredCanvasFormat();
            return (__wbindgen_enum_GpuTextureFormat.indexOf(ret) + 1 || 96) - 1;
        },
        __wbg_get_2b48c7d0d006a781: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_cb935c1402921898: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_gpu_c773d7932dc745d7: function(arg0) {
            const ret = arg0.gpu;
            return ret;
        },
        __wbg_has_b54bd7b6e9da11c7: function(arg0, arg1, arg2) {
            const ret = arg0.has(getStringFromWasm0(arg1, arg2));
            return ret;
        },
        __wbg_instanceof_GpuAdapter_0731153d2b08720b: function(arg0) {
            let result;
            try {
                result = arg0 instanceof GPUAdapter;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_GpuCanvasContext_d14121c7bd72fcef: function(arg0) {
            let result;
            try {
                result = arg0 instanceof GPUCanvasContext;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_GpuDeviceLostInfo_a3677ebb8241d800: function(arg0) {
            let result;
            try {
                result = arg0 instanceof GPUDeviceLostInfo;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_GpuOutOfMemoryError_391d9a08edbfa04b: function(arg0) {
            let result;
            try {
                result = arg0 instanceof GPUOutOfMemoryError;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_GpuValidationError_f4d803c383da3c92: function(arg0) {
            let result;
            try {
                result = arg0 instanceof GPUValidationError;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Object_873c13f9f41aec78: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Object;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Window_e093be59ee9a8e14: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Window;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_label_614ef5e608843844: function(arg0, arg1) {
            const ret = arg1.label;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_length_27cfc5149a8eb2e7: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_length_4a591ecaa01354d9: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_length_66f1a4b2e9026940: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_length_d34bf7d191aa0640: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_limits_2bfe39eb5f0b5a01: function(arg0) {
            const ret = arg0.limits;
            return ret;
        },
        __wbg_limits_77193ad8b62f8502: function(arg0) {
            const ret = arg0.limits;
            return ret;
        },
        __wbg_lineNum_95b780ade9fb4ba3: function(arg0) {
            const ret = arg0.lineNum;
            return ret;
        },
        __wbg_lost_21e9db8a9502a0ca: function(arg0) {
            const ret = arg0.lost;
            return ret;
        },
        __wbg_mapAsync_f4fc38ac51855b15: function(arg0, arg1, arg2, arg3) {
            const ret = arg0.mapAsync(arg1 >>> 0, arg2, arg3);
            return ret;
        },
        __wbg_maxBindGroups_cc0c1b6031ac310e: function(arg0) {
            const ret = arg0.maxBindGroups;
            return ret;
        },
        __wbg_maxBindingsPerBindGroup_d950de0c90e382e0: function(arg0) {
            const ret = arg0.maxBindingsPerBindGroup;
            return ret;
        },
        __wbg_maxBufferSize_01e5e024c304478a: function(arg0) {
            const ret = arg0.maxBufferSize;
            return ret;
        },
        __wbg_maxColorAttachmentBytesPerSample_91fc5eb9155186fd: function(arg0) {
            const ret = arg0.maxColorAttachmentBytesPerSample;
            return ret;
        },
        __wbg_maxColorAttachments_69f3bac8513cd2ce: function(arg0) {
            const ret = arg0.maxColorAttachments;
            return ret;
        },
        __wbg_maxComputeInvocationsPerWorkgroup_5d8e1f9e65b5443c: function(arg0) {
            const ret = arg0.maxComputeInvocationsPerWorkgroup;
            return ret;
        },
        __wbg_maxComputeWorkgroupSizeX_e8c75fa90e0b00b7: function(arg0) {
            const ret = arg0.maxComputeWorkgroupSizeX;
            return ret;
        },
        __wbg_maxComputeWorkgroupSizeY_72bce71ec7fa9330: function(arg0) {
            const ret = arg0.maxComputeWorkgroupSizeY;
            return ret;
        },
        __wbg_maxComputeWorkgroupSizeZ_8c7050ac47c80e42: function(arg0) {
            const ret = arg0.maxComputeWorkgroupSizeZ;
            return ret;
        },
        __wbg_maxComputeWorkgroupStorageSize_b789a39c5a0fd04a: function(arg0) {
            const ret = arg0.maxComputeWorkgroupStorageSize;
            return ret;
        },
        __wbg_maxComputeWorkgroupsPerDimension_a02a7f66f7c68b9c: function(arg0) {
            const ret = arg0.maxComputeWorkgroupsPerDimension;
            return ret;
        },
        __wbg_maxDynamicStorageBuffersPerPipelineLayout_90d4eb33665de8d1: function(arg0) {
            const ret = arg0.maxDynamicStorageBuffersPerPipelineLayout;
            return ret;
        },
        __wbg_maxDynamicUniformBuffersPerPipelineLayout_835864d8a793cc95: function(arg0) {
            const ret = arg0.maxDynamicUniformBuffersPerPipelineLayout;
            return ret;
        },
        __wbg_maxSampledTexturesPerShaderStage_f1fdaca8bd10047f: function(arg0) {
            const ret = arg0.maxSampledTexturesPerShaderStage;
            return ret;
        },
        __wbg_maxSamplersPerShaderStage_a0126ce660fc903a: function(arg0) {
            const ret = arg0.maxSamplersPerShaderStage;
            return ret;
        },
        __wbg_maxStorageBufferBindingSize_9ed12d54b564312c: function(arg0) {
            const ret = arg0.maxStorageBufferBindingSize;
            return ret;
        },
        __wbg_maxStorageBuffersPerShaderStage_7db5a7548c1199e6: function(arg0) {
            const ret = arg0.maxStorageBuffersPerShaderStage;
            return ret;
        },
        __wbg_maxStorageTexturesPerShaderStage_3df697d427690d26: function(arg0) {
            const ret = arg0.maxStorageTexturesPerShaderStage;
            return ret;
        },
        __wbg_maxTextureArrayLayers_759d0ac67e0a7d26: function(arg0) {
            const ret = arg0.maxTextureArrayLayers;
            return ret;
        },
        __wbg_maxTextureDimension1D_4bfdff8638ada7c1: function(arg0) {
            const ret = arg0.maxTextureDimension1D;
            return ret;
        },
        __wbg_maxTextureDimension2D_ea0c9c4d0b239666: function(arg0) {
            const ret = arg0.maxTextureDimension2D;
            return ret;
        },
        __wbg_maxTextureDimension3D_e76f3604806f47be: function(arg0) {
            const ret = arg0.maxTextureDimension3D;
            return ret;
        },
        __wbg_maxUniformBufferBindingSize_591ad000ffe10aad: function(arg0) {
            const ret = arg0.maxUniformBufferBindingSize;
            return ret;
        },
        __wbg_maxUniformBuffersPerShaderStage_6e5696dba506ca6c: function(arg0) {
            const ret = arg0.maxUniformBuffersPerShaderStage;
            return ret;
        },
        __wbg_maxVertexAttributes_fef434a4cf2ba188: function(arg0) {
            const ret = arg0.maxVertexAttributes;
            return ret;
        },
        __wbg_maxVertexBufferArrayStride_de60c38ec574b423: function(arg0) {
            const ret = arg0.maxVertexBufferArrayStride;
            return ret;
        },
        __wbg_maxVertexBuffers_d1a4a2fba06ae7d6: function(arg0) {
            const ret = arg0.maxVertexBuffers;
            return ret;
        },
        __wbg_message_8fd23df93c50075a: function(arg0, arg1) {
            const ret = arg1.message;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_message_b00edacf4a520b03: function(arg0, arg1) {
            const ret = arg1.message;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_message_d2eedafa0bd554a6: function(arg0, arg1) {
            const ret = arg1.message;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_messages_1df11461d071c92c: function(arg0) {
            const ret = arg0.messages;
            return ret;
        },
        __wbg_minStorageBufferOffsetAlignment_49f6b6baa1d34111: function(arg0) {
            const ret = arg0.minStorageBufferOffsetAlignment;
            return ret;
        },
        __wbg_minUniformBufferOffsetAlignment_39ec7837ddc9ee2c: function(arg0) {
            const ret = arg0.minUniformBufferOffsetAlignment;
            return ret;
        },
        __wbg_navigator_3833ecdbc19d2757: function(arg0) {
            const ret = arg0.navigator;
            return ret;
        },
        __wbg_navigator_391291470f58c650: function(arg0) {
            const ret = arg0.navigator;
            return ret;
        },
        __wbg_new_227d7c05414eb861: function() {
            const ret = new Error();
            return ret;
        },
        __wbg_new_ce1ab61c1c2b300d: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_new_d90091b82fdf5b91: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_new_from_slice_18fa1f71286d66b8: function(arg0, arg1) {
            const ret = new Uint8Array(getArrayU8FromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_typed_bf31d18f92484486: function(arg0, arg1) {
            try {
                var state0 = {a: arg0, b: arg1};
                var cb0 = (arg0, arg1) => {
                    const a = state0.a;
                    state0.a = 0;
                    try {
                        return wasm_bindgen__convert__closures_____invoke__h3b3162ad98dd918f(a, state0.b, arg0, arg1);
                    } finally {
                        state0.a = a;
                    }
                };
                const ret = new Promise(cb0);
                return ret;
            } finally {
                state0.a = 0;
            }
        },
        __wbg_new_with_byte_offset_and_length_d836f26d916dd9ad: function(arg0, arg1, arg2) {
            const ret = new Uint8Array(arg0, arg1 >>> 0, arg2 >>> 0);
            return ret;
        },
        __wbg_new_with_length_1eb3643ef8ff666a: function(arg0) {
            const ret = new Int32Array(arg0 >>> 0);
            return ret;
        },
        __wbg_offset_78dcfcd1f3ebc4ea: function(arg0) {
            const ret = arg0.offset;
            return ret;
        },
        __wbg_popErrorScope_efb23ea2dcc3b587: function(arg0) {
            const ret = arg0.popErrorScope();
            return ret;
        },
        __wbg_prototypesetcall_3249fc62a0fafa30: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
        },
        __wbg_pushErrorScope_9a7570b7a9f67657: function(arg0, arg1) {
            arg0.pushErrorScope(__wbindgen_enum_GpuErrorFilter[arg1]);
        },
        __wbg_push_a6822215aa43e71c: function(arg0, arg1) {
            const ret = arg0.push(arg1);
            return ret;
        },
        __wbg_querySelectorAll_4dcc230a2f8a2498: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.querySelectorAll(getStringFromWasm0(arg1, arg2));
            return ret;
        }, arguments); },
        __wbg_queueMicrotask_35c611f4a14830b2: function(arg0) {
            queueMicrotask(arg0);
        },
        __wbg_queueMicrotask_404ed0a58e0b63cc: function(arg0) {
            const ret = arg0.queueMicrotask;
            return ret;
        },
        __wbg_queue_9595c5175ef399b9: function(arg0) {
            const ret = arg0.queue;
            return ret;
        },
        __wbg_reason_f9df4a653cfa764b: function(arg0) {
            const ret = arg0.reason;
            return (__wbindgen_enum_GpuDeviceLostReason.indexOf(ret) + 1 || 3) - 1;
        },
        __wbg_requestAdapter_592f04f645dfaf68: function(arg0, arg1) {
            const ret = arg0.requestAdapter(arg1);
            return ret;
        },
        __wbg_requestDevice_52bb2980e6280ebc: function(arg0, arg1) {
            const ret = arg0.requestDevice(arg1);
            return ret;
        },
        __wbg_resolveQuerySet_b316102e1d152b52: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            arg0.resolveQuerySet(arg1, arg2 >>> 0, arg3 >>> 0, arg4, arg5 >>> 0);
        },
        __wbg_resolve_25a7e548d5881dca: function(arg0) {
            const ret = Promise.resolve(arg0);
            return ret;
        },
        __wbg_setBindGroup_0fb411b7d1ec4966: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
            arg0.setBindGroup(arg1 >>> 0, arg2, getArrayU32FromWasm0(arg3, arg4), arg5, arg6 >>> 0);
        },
        __wbg_setBindGroup_1c6bfc705c95f81f: function(arg0, arg1, arg2) {
            arg0.setBindGroup(arg1 >>> 0, arg2);
        },
        __wbg_setBindGroup_2ec8db65419ec50c: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
            arg0.setBindGroup(arg1 >>> 0, arg2, getArrayU32FromWasm0(arg3, arg4), arg5, arg6 >>> 0);
        },
        __wbg_setBindGroup_3afbefd496741277: function(arg0, arg1, arg2) {
            arg0.setBindGroup(arg1 >>> 0, arg2);
        },
        __wbg_setBindGroup_4ac51c0e16178380: function(arg0, arg1, arg2) {
            arg0.setBindGroup(arg1 >>> 0, arg2);
        },
        __wbg_setBindGroup_c2fbfec522cc7572: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
            arg0.setBindGroup(arg1 >>> 0, arg2, getArrayU32FromWasm0(arg3, arg4), arg5, arg6 >>> 0);
        },
        __wbg_setBlendConstant_00bed453ac51c91b: function(arg0, arg1) {
            arg0.setBlendConstant(arg1);
        },
        __wbg_setIndexBuffer_42017bb879ab062b: function(arg0, arg1, arg2, arg3) {
            arg0.setIndexBuffer(arg1, __wbindgen_enum_GpuIndexFormat[arg2], arg3);
        },
        __wbg_setIndexBuffer_4876c05f77106bb6: function(arg0, arg1, arg2, arg3, arg4) {
            arg0.setIndexBuffer(arg1, __wbindgen_enum_GpuIndexFormat[arg2], arg3, arg4);
        },
        __wbg_setIndexBuffer_8c79ee0b0b6460fa: function(arg0, arg1, arg2, arg3) {
            arg0.setIndexBuffer(arg1, __wbindgen_enum_GpuIndexFormat[arg2], arg3);
        },
        __wbg_setIndexBuffer_e10a7cf5d063fdab: function(arg0, arg1, arg2, arg3, arg4) {
            arg0.setIndexBuffer(arg1, __wbindgen_enum_GpuIndexFormat[arg2], arg3, arg4);
        },
        __wbg_setPipeline_5c5a949bf12f8a5f: function(arg0, arg1) {
            arg0.setPipeline(arg1);
        },
        __wbg_setPipeline_c4793bebd98b8e56: function(arg0, arg1) {
            arg0.setPipeline(arg1);
        },
        __wbg_setPipeline_ce7a683c2c94919d: function(arg0, arg1) {
            arg0.setPipeline(arg1);
        },
        __wbg_setScissorRect_cf24179de05b8393: function(arg0, arg1, arg2, arg3, arg4) {
            arg0.setScissorRect(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4 >>> 0);
        },
        __wbg_setStencilReference_7a98f054e2f31f54: function(arg0, arg1) {
            arg0.setStencilReference(arg1 >>> 0);
        },
        __wbg_setVertexBuffer_06dd033f8e75af24: function(arg0, arg1, arg2, arg3) {
            arg0.setVertexBuffer(arg1 >>> 0, arg2, arg3);
        },
        __wbg_setVertexBuffer_c973cd35605098e4: function(arg0, arg1, arg2, arg3, arg4) {
            arg0.setVertexBuffer(arg1 >>> 0, arg2, arg3, arg4);
        },
        __wbg_setVertexBuffer_e80315ecd1774568: function(arg0, arg1, arg2, arg3) {
            arg0.setVertexBuffer(arg1 >>> 0, arg2, arg3);
        },
        __wbg_setVertexBuffer_ef41a6013dba1352: function(arg0, arg1, arg2, arg3, arg4) {
            arg0.setVertexBuffer(arg1 >>> 0, arg2, arg3, arg4);
        },
        __wbg_setViewport_75637b1c9a301986: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
            arg0.setViewport(arg1, arg2, arg3, arg4, arg5, arg6);
        },
        __wbg_set_6e30c9374c26414c: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = Reflect.set(arg0, arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_set_ad3bde048c79fe2b: function(arg0, arg1, arg2) {
            arg0.set(getArrayI32FromWasm0(arg1, arg2));
        },
        __wbg_set_c775d84916be79ea: function(arg0, arg1, arg2) {
            arg0.set(arg1, arg2 >>> 0);
        },
        __wbg_set_height_0739170de8653cc4: function(arg0, arg1) {
            arg0.height = arg1 >>> 0;
        },
        __wbg_set_height_c661af0c0b5376f9: function(arg0, arg1) {
            arg0.height = arg1 >>> 0;
        },
        __wbg_set_onuncapturederror_5c20c4125b115c22: function(arg0, arg1) {
            arg0.onuncapturederror = arg1;
        },
        __wbg_set_width_7ca43f32db1cfe8e: function(arg0, arg1) {
            arg0.width = arg1 >>> 0;
        },
        __wbg_set_width_87301412247f3343: function(arg0, arg1) {
            arg0.width = arg1 >>> 0;
        },
        __wbg_size_b5c1b72884cb3fa5: function(arg0) {
            const ret = arg0.size;
            return ret;
        },
        __wbg_stack_3b0d974bbf31e44f: function(arg0, arg1) {
            const ret = arg1.stack;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_static_accessor_GLOBAL_9d53f2689e622ca1: function() {
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_GLOBAL_THIS_a1a35cec07001a8a: function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_SELF_4c59f6c7ea29a144: function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_WINDOW_e70ae9f2eb052253: function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_submit_6ffa2ed48b3eaecf: function(arg0, arg1) {
            arg0.submit(arg1);
        },
        __wbg_then_18f476d590e58992: function(arg0, arg1, arg2) {
            const ret = arg0.then(arg1, arg2);
            return ret;
        },
        __wbg_then_47213a40b6aeb86c: function(arg0, arg1) {
            const ret = arg0.then(arg1);
            return ret;
        },
        __wbg_then_529ea37d9bdbf95d: function(arg0, arg1, arg2) {
            const ret = arg0.then(arg1, arg2);
            return ret;
        },
        __wbg_then_ac7b025999b52837: function(arg0, arg1) {
            const ret = arg0.then(arg1);
            return ret;
        },
        __wbg_type_ba6bfed8f5073b9e: function(arg0) {
            const ret = arg0.type;
            return (__wbindgen_enum_GpuCompilationMessageType.indexOf(ret) + 1 || 4) - 1;
        },
        __wbg_unmap_d610a495d70ebb5e: function(arg0) {
            arg0.unmap();
        },
        __wbg_usage_92ae9f7605bb82c1: function(arg0) {
            const ret = arg0.usage;
            return ret;
        },
        __wbg_valueOf_e4efa16772d31e25: function(arg0) {
            const ret = arg0.valueOf();
            return ret;
        },
        __wbg_writeBuffer_28f398e6955ad305: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            arg0.writeBuffer(arg1, arg2, arg3, arg4, arg5);
        },
        __wbg_writeTexture_4eafae0e29b3eac0: function(arg0, arg1, arg2, arg3, arg4) {
            arg0.writeTexture(arg1, arg2, arg3, arg4);
        },
        __wbindgen_cast_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [Externref], shim_idx: 256, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen__convert__closures_____invoke__h2ebc7f38a7a57206);
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [Externref], shim_idx: 282, ret: Result(Unit), inner_ret: Some(Result(Unit)) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen__convert__closures_____invoke__h64f41ba5f43c9580);
            return ret;
        },
        __wbindgen_cast_0000000000000003: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [NamedExternref("GPUUncapturedErrorEvent")], shim_idx: 256, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen__convert__closures_____invoke__h2ebc7f38a7a57206_2);
            return ret;
        },
        __wbindgen_cast_0000000000000004: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000005: function(arg0, arg1) {
            // Cast intrinsic for `Ref(Slice(U8)) -> NamedExternref("Uint8Array")`.
            const ret = getArrayU8FromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000006: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./wgsql_wasm_bg.js": import0,
    };
}

function wasm_bindgen__convert__closures_____invoke__h2ebc7f38a7a57206(arg0, arg1, arg2) {
    wasm.wasm_bindgen__convert__closures_____invoke__h2ebc7f38a7a57206(arg0, arg1, arg2);
}

function wasm_bindgen__convert__closures_____invoke__h2ebc7f38a7a57206_2(arg0, arg1, arg2) {
    wasm.wasm_bindgen__convert__closures_____invoke__h2ebc7f38a7a57206_2(arg0, arg1, arg2);
}

function wasm_bindgen__convert__closures_____invoke__h64f41ba5f43c9580(arg0, arg1, arg2) {
    const ret = wasm.wasm_bindgen__convert__closures_____invoke__h64f41ba5f43c9580(arg0, arg1, arg2);
    if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
    }
}

function wasm_bindgen__convert__closures_____invoke__h3b3162ad98dd918f(arg0, arg1, arg2, arg3) {
    wasm.wasm_bindgen__convert__closures_____invoke__h3b3162ad98dd918f(arg0, arg1, arg2, arg3);
}


const __wbindgen_enum_GpuCompilationMessageType = ["error", "warning", "info"];


const __wbindgen_enum_GpuDeviceLostReason = ["unknown", "destroyed"];


const __wbindgen_enum_GpuErrorFilter = ["validation", "out-of-memory", "internal"];


const __wbindgen_enum_GpuIndexFormat = ["uint16", "uint32"];


const __wbindgen_enum_GpuTextureFormat = ["r8unorm", "r8snorm", "r8uint", "r8sint", "r16uint", "r16sint", "r16float", "rg8unorm", "rg8snorm", "rg8uint", "rg8sint", "r32uint", "r32sint", "r32float", "rg16uint", "rg16sint", "rg16float", "rgba8unorm", "rgba8unorm-srgb", "rgba8snorm", "rgba8uint", "rgba8sint", "bgra8unorm", "bgra8unorm-srgb", "rgb9e5ufloat", "rgb10a2uint", "rgb10a2unorm", "rg11b10ufloat", "rg32uint", "rg32sint", "rg32float", "rgba16uint", "rgba16sint", "rgba16float", "rgba32uint", "rgba32sint", "rgba32float", "stencil8", "depth16unorm", "depth24plus", "depth24plus-stencil8", "depth32float", "depth32float-stencil8", "bc1-rgba-unorm", "bc1-rgba-unorm-srgb", "bc2-rgba-unorm", "bc2-rgba-unorm-srgb", "bc3-rgba-unorm", "bc3-rgba-unorm-srgb", "bc4-r-unorm", "bc4-r-snorm", "bc5-rg-unorm", "bc5-rg-snorm", "bc6h-rgb-ufloat", "bc6h-rgb-float", "bc7-rgba-unorm", "bc7-rgba-unorm-srgb", "etc2-rgb8unorm", "etc2-rgb8unorm-srgb", "etc2-rgb8a1unorm", "etc2-rgb8a1unorm-srgb", "etc2-rgba8unorm", "etc2-rgba8unorm-srgb", "eac-r11unorm", "eac-r11snorm", "eac-rg11unorm", "eac-rg11snorm", "astc-4x4-unorm", "astc-4x4-unorm-srgb", "astc-5x4-unorm", "astc-5x4-unorm-srgb", "astc-5x5-unorm", "astc-5x5-unorm-srgb", "astc-6x5-unorm", "astc-6x5-unorm-srgb", "astc-6x6-unorm", "astc-6x6-unorm-srgb", "astc-8x5-unorm", "astc-8x5-unorm-srgb", "astc-8x6-unorm", "astc-8x6-unorm-srgb", "astc-8x8-unorm", "astc-8x8-unorm-srgb", "astc-10x5-unorm", "astc-10x5-unorm-srgb", "astc-10x6-unorm", "astc-10x6-unorm-srgb", "astc-10x8-unorm", "astc-10x8-unorm-srgb", "astc-10x10-unorm", "astc-10x10-unorm-srgb", "astc-12x10-unorm", "astc-12x10-unorm-srgb", "astc-12x12-unorm", "astc-12x12-unorm-srgb"];
const EngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_engine_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(state => wasm.__wbindgen_destroy_closure(state.a, state.b));

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayI32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getInt32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedInt32ArrayMemory0 = null;
function getInt32ArrayMemory0() {
    if (cachedInt32ArrayMemory0 === null || cachedInt32ArrayMemory0.byteLength === 0) {
        cachedInt32ArrayMemory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachedInt32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function makeMutClosure(arg0, arg1, f) {
    const state = { a: arg0, b: arg1, cnt: 1 };
    const real = (...args) => {

        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            state.a = a;
            real._wbg_cb_unref();
        }
    };
    real._wbg_cb_unref = () => {
        if (--state.cnt === 0) {
            wasm.__wbindgen_destroy_closure(state.a, state.b);
            state.a = 0;
            CLOSURE_DTORS.unregister(state);
        }
    };
    CLOSURE_DTORS.register(real, state, state);
    return real;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedInt32ArrayMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('wgsql_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
