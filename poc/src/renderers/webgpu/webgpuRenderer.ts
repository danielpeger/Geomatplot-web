import type { DrawItem, DrawList } from '../../presentation/drawlist/types.ts';
import { RendererUnavailableError, type Renderer } from '../renderer.ts';
import { SHADER } from './shader.ts';

const FLOATS_PER_INSTANCE = 16;
const BYTES_PER_INSTANCE = FLOATS_PER_INSTANCE * 4;

let sharedDevice: Promise<GPUDevice> | null = null;

/** One adapter and device for every plot on the page. */
function getDevice(): Promise<GPUDevice> {
  sharedDevice ??= (async () => {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new RendererUnavailableError('No WebGPU adapter is available (GPU blocked or unsupported).');
    const device = await adapter.requestDevice();
    device.lost.then(() => {
      sharedDevice = null;
    });
    return device;
  })().catch((error: unknown) => {
    sharedDevice = null;
    throw error;
  });
  return sharedDevice;
}

/** Native WebGPU renderer: all items in one instanced draw call, in draw-list order. */
export class WebGPURenderer implements Renderer {
  static readonly rendererName = 'WebGPU';

  static async create(canvas: HTMLCanvasElement): Promise<WebGPURenderer> {
    if (typeof navigator === 'undefined' || !('gpu' in navigator) || !navigator.gpu) {
      throw new RendererUnavailableError('This browser does not support WebGPU.');
    }
    // The device is requested before touching the canvas, so on failure the
    // canvas is still free to show the error message through a 2D context.
    const device = await getDevice();
    const context = canvas.getContext('webgpu');
    if (!context) throw new RendererUnavailableError('Could not get a WebGPU context for this canvas.');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });
    return new WebGPURenderer(device, context, format);
  }

  private readonly pipeline: GPURenderPipeline;
  private readonly uniforms: GPUBuffer;
  private readonly bindGroup: GPUBindGroup;
  private instances: GPUBuffer | null = null;
  private capacity = 0;
  private data = new Float32Array(0);

  private constructor(
    private readonly device: GPUDevice,
    private readonly context: GPUCanvasContext,
    format: GPUTextureFormat,
  ) {
    const module = device.createShaderModule({ code: SHADER });
    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: BYTES_PER_INSTANCE,
            stepMode: 'instance',
            attributes: [0, 1, 2, 3].map((i) => ({ shaderLocation: i, offset: i * 16, format: 'float32x4' as const })),
          },
        ],
      },
      fragment: {
        module,
        entryPoint: 'fs',
        targets: [
          {
            format,
            blend: {
              color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list' },
    });
    this.uniforms = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniforms } }],
    });
  }

  render(list: DrawList): void {
    const texture = this.context.getCurrentTexture();
    if (texture.width === 0 || texture.height === 0) return;

    const count = list.items.length;
    this.ensureCapacity(count);
    for (let i = 0; i < count; i++) encode(this.data, i * FLOATS_PER_INSTANCE, list.items[i]!);
    if (count > 0) this.device.queue.writeBuffer(this.instances!, 0, this.data, 0, count * FLOATS_PER_INSTANCE);
    this.device.queue.writeBuffer(this.uniforms, 0, new Float32Array([list.width, list.height, list.pixelRatio, 0]));

    const [r, g, b, a] = list.background;
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        { view: texture.createView(), clearValue: { r: r * a, g: g * a, b: b * a, a }, loadOp: 'clear', storeOp: 'store' },
      ],
    });
    if (count > 0) {
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, this.bindGroup);
      pass.setVertexBuffer(0, this.instances!);
      pass.draw(6, count);
    }
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  destroy(): void {
    this.instances?.destroy();
    this.uniforms.destroy();
    this.context.unconfigure();
  }

  private ensureCapacity(count: number): void {
    if (count <= this.capacity) return;
    let capacity = Math.max(64, this.capacity);
    while (capacity < count) capacity *= 2;
    this.instances?.destroy();
    this.instances = this.device.createBuffer({
      size: capacity * BYTES_PER_INSTANCE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.data = new Float32Array(capacity * FLOATS_PER_INSTANCE);
    this.capacity = capacity;
  }
}

function encode(out: Float32Array, o: number, item: DrawItem): void {
  out.fill(0, o, o + FLOATS_PER_INSTANCE);
  switch (item.kind) {
    case 'segment':
      out.set([item.a[0], item.a[1], item.b[0], item.b[1]], o);
      out.set(item.color, o + 4);
      out.set([0, item.width, item.dash?.[0] ?? 0, item.dash?.[1] ?? 0], o + 12);
      break;
    case 'circle':
      out.set([item.center[0], item.center[1], item.radius, 0], o);
      out.set(item.color, o + 4);
      out.set([1, item.width, item.dash?.[0] ?? 0, item.dash?.[1] ?? 0], o + 12);
      break;
    case 'point':
      out.set([item.center[0], item.center[1], item.radius, 0], o);
      out.set(item.fill, o + 4);
      out.set(item.stroke, o + 8);
      out.set([2, item.strokeWidth, 0, 0], o + 12);
      break;
  }
}
