import { Geomatplot } from './api/geomatplot.ts';
import { Canvas2DRenderer } from './renderers/canvas2d/canvas2dRenderer.ts';
import { WebGPURenderer } from './renderers/webgpu/webgpuRenderer.ts';

/**
 * Script-tag entry: the global `Geomatplot` is the plot class itself, with
 * the renderers attached, e.g. `Geomatplot.use(Geomatplot.WebGPURenderer)`.
 */
export default Object.assign(Geomatplot, { WebGPURenderer, Canvas2DRenderer });
