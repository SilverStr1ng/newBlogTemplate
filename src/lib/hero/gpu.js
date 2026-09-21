import { fieldSize, cascadeConfig } from './scene.js';
import { FIELD, CASCADE, COMPOSITE } from './shaders.js';

const LEVELS = 5;
const MAX_SHAPES = 96;

/** No framework or GPU library dependency. A failed/lost device falls back through onLost. */
export async function createGPU(canvas, onLost, signal) {
  if (!navigator.gpu) throw new Error('WebGPU unavailable');
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
  if (!adapter || signal.aborted) throw new Error('WebGPU initialization cancelled or no adapter');
  const device = await adapter.requestDevice();
  if (signal.aborted) { device.destroy(); throw new Error('WebGPU initialization cancelled'); }
  let destroyed = false;
  let context;
  const buffers = [], textures = [];
  const clean = () => {
    if (destroyed) return;
    destroyed = true;
    for (const texture of textures) texture.destroy();
    for (const buffer of buffers) buffer.destroy();
    context?.unconfigure(); device.destroy();
  };
  try {
    context = canvas.getContext('webgpu');
    if (!context) throw new Error('WebGPU canvas context unavailable');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'opaque' });
    const fail = (reason) => { if (!destroyed) { clean(); onLost(reason); } };
    device.lost.then((info) => fail(new Error(`WebGPU device lost: ${info.reason}`)));
    device.addEventListener('uncapturederror', (event) => fail(event.error));
    signal.addEventListener('abort', clean, { once: true });

    const module = async (code, label) => {
      const shader = device.createShaderModule({ code, label });
      const info = await shader.getCompilationInfo();
      const errors = info.messages.filter((message) => message.type === 'error');
      if (errors.length) throw new Error(errors.map((m) => `${label}:${m.lineNum} ${m.message}`).join('\n'));
      return shader;
    };
    const [fieldModule, cascadeModule, compositeModule] = await Promise.all([
      module(FIELD, 'hero/field'), module(CASCADE, 'hero/cascade'), module(COMPOSITE, 'hero/composite'),
    ]);
    const [fieldPipeline, cascadePipeline, compositePipeline] = await Promise.all([
      device.createComputePipelineAsync({ layout: 'auto', compute: { module: fieldModule, entryPoint: 'main' } }),
      device.createComputePipelineAsync({ layout: 'auto', compute: { module: cascadeModule, entryPoint: 'main' } }),
      device.createRenderPipelineAsync({ layout: 'auto', vertex: { module: compositeModule, entryPoint: 'vertex' }, fragment: { module: compositeModule, entryPoint: 'fragment', targets: [{ format }] }, primitive: { topology: 'triangle-list' } }),
    ]);
    if (signal.aborted || destroyed) throw new Error('WebGPU initialization cancelled');
    const buffer = (size, usage) => { const b = device.createBuffer({ size, usage }); buffers.push(b); return b; };
    const shapeBuffer = buffer(MAX_SHAPES * 32, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    const params = Array.from({ length: LEVELS + 2 }, () => buffer(48, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST));
    const shapeData = new Float32Array(MAX_SHAPES * 8);
    const uniformData = new Float32Array(12);
    let width = 0, height = 0, cssWidth = 1, cssHeight = 1;
    let fieldGroup, compositeGroup;
    let cascadeGroups = [];
    const bind = (pipeline, entries) => device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: entries.map((resource, binding) => ({ binding, resource })) });
    const texture = () => {
      const t = device.createTexture({ size: [width, height], format: 'rgba16float', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });
      textures.push(t); return t;
    };
    return {
      get alive() { return !destroyed; },
      resize(w, h, dpr = 1) {
        if (destroyed) return;
        cssWidth = Math.max(1, w); cssHeight = Math.max(1, h);
        const ratio = Math.min(dpr || 1, 1.5, Math.sqrt(1_600_000 / (cssWidth * cssHeight)));
        const max = device.limits.maxTextureDimension2D;
        canvas.width = Math.min(max, Math.max(1, Math.round(cssWidth * ratio)));
        canvas.height = Math.min(max, Math.max(1, Math.round(cssHeight * ratio)));
        const size = fieldSize(cssWidth, cssHeight);
        if (size.width === width && size.height === height) return;
        width = size.width; height = size.height;
        textures.splice(0).forEach((t) => t.destroy());
        const field = texture(); const cascades = Array.from({ length: LEVELS }, texture);
        // A distinct dummy input avoids binding the same subresource for read and write.
        const dummy = texture();
        fieldGroup = bind(fieldPipeline, [{ buffer: params[0] }, { buffer: shapeBuffer }, field.createView()]);
        cascadeGroups = cascades.map((t, i) => bind(cascadePipeline, [{ buffer: params[i + 1] }, field.createView(), (cascades[i + 1] || dummy).createView(), t.createView()]));
        compositeGroup = bind(compositePipeline, [{ buffer: params[LEVELS + 1] }, field.createView(), cascades[0].createView()]);
      },
      render(scene) {
        if (destroyed || !width) return;
        if (scene.shapes.length > MAX_SHAPES) throw new RangeError('Hero shape buffer capacity exceeded');
        const sx = width / cssWidth, sy = height / cssHeight;
        scene.shapes.forEach((shape, i) => shapeData.set([
          shape.x0 * sx, shape.y0 * sy, shape.x1 * sx, shape.y1 * sy,
          ...shape.color, Math.max(.8, shape.radius * Math.min(sx, sy)),
        ], i * 8));
        device.queue.writeBuffer(shapeBuffer, 0, shapeData, 0, scene.shapes.length * 8);
        const write = (buffer, config = { spacing: 0, side: 0, start: 0, end: 0 }, last = false) => {
          uniformData.set([width, height, canvas.width, canvas.height, config.spacing, config.side, config.start, config.end, scene.shapes.length, last ? 1 : 0, 1.05, 0]);
          device.queue.writeBuffer(buffer, 0, uniformData);
        };
        write(params[0]); write(params[LEVELS + 1]);
        for (let i = 0; i < LEVELS; i++) write(params[i + 1], cascadeConfig(i), i === LEVELS - 1);
        const encoder = device.createCommandEncoder({ label: 'hero/radiance-cascades' });
        const compute = (pipeline, group) => {
          const pass = encoder.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0, group);
          pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8)); pass.end();
        };
        compute(fieldPipeline, fieldGroup);
        for (let i = LEVELS - 1; i >= 0; i--) compute(cascadePipeline, cascadeGroups[i]);
        const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
        pass.setPipeline(compositePipeline); pass.setBindGroup(0, compositeGroup); pass.draw(3); pass.end();
        device.queue.submit([encoder.finish()]);
      },
      destroy: clean,
    };
  } catch (error) { clean(); throw error; }
}
