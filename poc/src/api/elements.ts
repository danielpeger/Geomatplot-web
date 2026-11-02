import type { CircleElement, GeoElement, PointElement, SegmentElement } from '../geometry/elements.ts';

/** Handle returned by the public API; it reads the computed shape but carries no geometry logic. */
abstract class PlotElement<E extends GeoElement> {
  /** @internal */
  readonly element: E;

  constructor(element: E) {
    this.element = element;
  }
}

abstract class PointBase extends PlotElement<PointElement> {
  get x(): number {
    return this.element.position.x;
  }

  get y(): number {
    return this.element.position.y;
  }

  get position(): [number, number] {
    return [this.x, this.y];
  }
}

/** Draggable point. */
export class Point extends PointBase {}

/** Computed point halfway between two points. */
export class Midpoint extends PointBase {}

export type PointLike = Point | Midpoint;

export class Segment extends PlotElement<SegmentElement> {
  get endpoints(): [[number, number], [number, number]] {
    const { a, b } = this.element.shape;
    return [
      [a.x, a.y],
      [b.x, b.y],
    ];
  }
}

export class Circle extends PlotElement<CircleElement> {
  get center(): [number, number] {
    const { center } = this.element.shape;
    return [center.x, center.y];
  }

  get radius(): number {
    return this.element.shape.radius;
  }
}
