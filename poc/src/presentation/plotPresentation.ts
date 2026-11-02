import type { GeometryReader } from '../geometry/shapes.ts';
import type { Renderer, RendererClass } from '../renderers/renderer.ts';
import { buildDrawList } from './drawlist/buildDrawList.ts';
import type { StyleLookup } from './drawlist/style.ts';
import { showCanvasError } from './errorMessage.ts';
import { InteractionHandler } from './interaction/interactionHandler.ts';
import type { FrameScheduler, FrameTarget } from './scheduler/frameScheduler.ts';
import { InteractionState } from './state/interactionState.ts';
import { View } from './view/view.ts';

/**
 * The presentation side of one plot: interaction handler, View, interaction
 * state, draw list and renderer. Any change only marks the plot dirty; the
 * scheduler then calls `renderFrame` at most once per frame.
 */
export class PlotPresentation implements FrameTarget {
  readonly view = new View();
  readonly state = new InteractionState();
  private readonly interaction: InteractionHandler;
  private renderer: Renderer | null = null;
  private readonly resizeObserver: ResizeObserver;
  private readonly unsubscribe: Array<() => void> = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly geometry: GeometryReader,
    private readonly style: StyleLookup,
    rendererClass: RendererClass,
    private readonly scheduler: FrameScheduler,
  ) {
    const invalidate = (): void => this.scheduler.markDirty(this);
    this.unsubscribe.push(geometry.subscribe(invalidate), this.view.subscribe(invalidate), this.state.subscribe(invalidate));

    this.interaction = new InteractionHandler(canvas, this.view, this.state, geometry, {
      isHittable: (id) => this.style(id)?.visible !== false,
    });

    this.resizeObserver = new ResizeObserver(() => this.syncSize());
    this.resizeObserver.observe(canvas);
    this.syncSize();

    rendererClass.create(canvas).then(
      (renderer) => {
        this.renderer = renderer;
        invalidate();
      },
      (error: unknown) => {
        this.interaction.destroy();
        this.resizeObserver.disconnect();
        const detail = error instanceof Error ? error.message : String(error);
        showCanvasError(canvas, `${rendererClass.rendererName} renderer unavailable`, detail);
        console.error(error);
      },
    );
  }

  renderFrame(): void {
    if (!this.renderer || this.view.width === 0 || this.view.height === 0) return;
    this.renderer.render(
      buildDrawList({
        elements: this.geometry.elements(),
        style: this.style,
        highlight: this.state,
        view: this.view,
        pixelRatio: window.devicePixelRatio || 1,
      }),
    );
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    this.interaction.destroy();
    for (const off of this.unsubscribe) off();
    this.renderer?.destroy();
    this.renderer = null;
  }

  private syncSize(): void {
    const ratio = window.devicePixelRatio || 1;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const deviceWidth = Math.max(1, Math.round(width * ratio));
    const deviceHeight = Math.max(1, Math.round(height * ratio));
    if (this.canvas.width !== deviceWidth || this.canvas.height !== deviceHeight) {
      this.canvas.width = deviceWidth;
      this.canvas.height = deviceHeight;
      this.scheduler.markDirty(this);
    }
    this.view.setSize(width, height);
  }
}
