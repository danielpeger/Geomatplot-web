import type { DrawList } from '../presentation/drawlist/types.ts';

/** A renderer only ever receives a finished draw list. */
export interface Renderer {
  render(list: DrawList): void;
  destroy(): void;
}

/** What `Geomatplot.use(...)` accepts: a renderer class with an async factory. */
export interface RendererClass {
  readonly rendererName: string;
  create(canvas: HTMLCanvasElement): Promise<Renderer>;
}

/** Thrown by `create` when the renderer cannot run in this browser. */
export class RendererUnavailableError extends Error {
  override readonly name = 'RendererUnavailableError';
}
