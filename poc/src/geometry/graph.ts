import {
  CircleElement,
  FreePoint,
  GeoElement,
  MidpointElement,
  PointElement,
  SegmentElement,
} from './elements.ts';
import type {
  DragPhase,
  ElementView,
  GeometryChange,
  GeometryListener,
  GeometryReader,
  Vec2,
} from './shapes.ts';

/**
 * One plot's geometry objects and their dependency graph.
 *
 * Ids are assigned in creation order and an element can only take inputs that
 * already exist, so ascending id order is a topological order that also keeps
 * the order in which the user wrote the construction.
 */
export class GeometryGraph implements GeometryReader {
  private readonly list: GeoElement[] = [];
  private readonly listeners = new Set<GeometryListener>();

  elements(): readonly ElementView[] {
    return this.list;
  }

  subscribe(listener: GeometryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  addPoint(x: number, y: number): FreePoint {
    return this.add(new FreePoint(this, this.list.length, x, y));
  }

  addMidpoint(p: PointElement, q: PointElement): MidpointElement {
    this.checkInputs(p, q);
    return this.add(new MidpointElement(this, this.list.length, p, q));
  }

  addSegment(p: PointElement, q: PointElement): SegmentElement {
    this.checkInputs(p, q);
    return this.add(new SegmentElement(this, this.list.length, p, q));
  }

  addCircle(center: PointElement, through: PointElement): CircleElement {
    this.checkInputs(center, through);
    return this.add(new CircleElement(this, this.list.length, center, through));
  }

  /**
   * Moves a draggable point and recomputes exactly its transitive dependents,
   * in topological order. Returns the changed ids in that order.
   */
  drag(point: ElementView, position: Vec2, phase: DragPhase): readonly number[] {
    const target = this.list[point.id];
    if (target !== point || !(target instanceof FreePoint)) {
      throw new Error('drag: the element is not a draggable point of this plot');
    }
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return [];

    target.moveTo(position.x, position.y);
    const order = this.dependentsOf(target);
    for (const element of order) element.recompute();

    const changed = [target.id, ...order.map((e) => e.id)];
    this.emit({ changed, phase });
    return changed;
  }

  private dependentsOf(root: GeoElement): GeoElement[] {
    const seen = new Set<GeoElement>();
    const stack = [...root.dependents];
    while (stack.length > 0) {
      const element = stack.pop()!;
      if (seen.has(element)) continue;
      seen.add(element);
      stack.push(...element.dependents);
    }
    return [...seen].sort((a, b) => a.id - b.id);
  }

  private add<T extends GeoElement>(element: T): T {
    this.list.push(element);
    for (const input of element.inputs) {
      if (!input.dependents.includes(element)) input.dependents.push(element);
    }
    this.emit({ changed: [element.id], phase: null });
    return element;
  }

  private checkInputs(...inputs: GeoElement[]): void {
    for (const input of inputs) {
      if (input.owner !== this) {
        throw new Error('An element cannot depend on an element of another plot');
      }
    }
  }

  private emit(change: GeometryChange): void {
    for (const listener of this.listeners) listener(change);
  }
}
