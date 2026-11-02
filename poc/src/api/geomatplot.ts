import { GeometryGraph } from '../geometry/graph.ts';
import type { StyleRecord } from '../presentation/drawlist/style.ts';
import { PlotPresentation } from '../presentation/plotPresentation.ts';
import { pageScheduler } from '../presentation/scheduler/frameScheduler.ts';
import type { Range } from '../presentation/view/view.ts';
import type { RendererClass } from '../renderers/renderer.ts';
import { Circle, Midpoint, Point, Segment, type PointLike } from './elements.ts';
import { resolveStyle, type ElementType, type Style } from './style.ts';

/**
 * One plot (the MATLAB axes counterpart) on one canvas, with its own
 * dependency graph and View. The public API is provisional.
 */
export class Geomatplot {
  private static rendererClass: RendererClass | null = null;
  private static plots = 0;

  /** Selects the renderer for every plot on the page. Call once, before creating plots. */
  static use(renderer: RendererClass): void {
    if (Geomatplot.plots > 0 && renderer !== Geomatplot.rendererClass) {
      throw new Error('Geomatplot.use() must be called before the first plot is created');
    }
    Geomatplot.rendererClass = renderer;
  }

  /** Name of the selected renderer, or null if none is selected yet. */
  static get rendererName(): string | null {
    return Geomatplot.rendererClass?.rendererName ?? null;
  }

  private readonly graph = new GeometryGraph();
  private readonly styles = new Map<number, StyleRecord>();
  private readonly presentation: PlotPresentation;

  constructor(readonly canvas: HTMLCanvasElement) {
    const rendererClass = Geomatplot.rendererClass;
    if (!rendererClass) {
      throw new Error('No renderer selected: call Geomatplot.use(WebGPURenderer) or Geomatplot.use(Canvas2DRenderer) first');
    }
    Geomatplot.plots++;
    this.presentation = new PlotPresentation(canvas, this.graph, (id) => this.styles.get(id), rendererClass, pageScheduler());
  }

  Point(position: readonly [number, number], style?: Style): Point {
    return this.styled('Point', style, () => new Point(this.graph.addPoint(position[0], position[1])));
  }

  Segment(p: PointLike, q: PointLike, style?: Style): Segment {
    return this.styled('Segment', style, () => new Segment(this.graph.addSegment(p.element, q.element)));
  }

  Midpoint(p: PointLike, q: PointLike, style?: Style): Midpoint {
    return this.styled('Midpoint', style, () => new Midpoint(this.graph.addMidpoint(p.element, q.element)));
  }

  /** Circle through `through` with centre `center`. */
  Circle(center: PointLike, through: PointLike, style?: Style): Circle {
    return this.styled('Circle', style, () => new Circle(this.graph.addCircle(center.element, through.element)));
  }

  get xlim(): Range {
    return this.presentation.view.xlim;
  }

  get ylim(): Range {
    return this.presentation.view.ylim;
  }

  destroy(): void {
    this.presentation.destroy();
  }

  private styled<T extends { element: { id: number } }>(type: ElementType, style: Style | undefined, create: () => T): T {
    const record = resolveStyle(type, style);
    const handle = create();
    this.styles.set(handle.element.id, record);
    return handle;
  }
}
