import type { CircleShape, ElementView, PointShape, SegmentShape, Shape, Vec2 } from './shapes.ts';

/**
 * Base of all geometry objects. `dependents` is the list-based dependency
 * graph: every element lists the elements computed directly from it.
 */
export abstract class GeoElement implements ElementView {
  readonly dependents: GeoElement[] = [];
  abstract readonly draggable: boolean;
  abstract get shape(): Shape;

  constructor(
    readonly owner: object,
    readonly id: number,
    readonly inputs: readonly GeoElement[],
  ) {}

  abstract recompute(): void;
}

export abstract class PointElement extends GeoElement {
  protected current: PointShape = freezePoint(0, 0);

  get shape(): PointShape {
    return this.current;
  }

  get position(): Vec2 {
    return this.current;
  }
}

export class FreePoint extends PointElement {
  readonly draggable = true;

  constructor(owner: object, id: number, x: number, y: number) {
    super(owner, id, []);
    this.current = freezePoint(x, y);
  }

  moveTo(x: number, y: number): void {
    this.current = freezePoint(x, y);
  }

  recompute(): void {}
}

export class MidpointElement extends PointElement {
  readonly draggable = false;

  constructor(owner: object, id: number, readonly p: PointElement, readonly q: PointElement) {
    super(owner, id, [p, q]);
    this.recompute();
  }

  recompute(): void {
    const a = this.p.position;
    const b = this.q.position;
    this.current = freezePoint((a.x + b.x) / 2, (a.y + b.y) / 2);
  }
}

export class SegmentElement extends GeoElement {
  readonly draggable = false;
  private current!: SegmentShape;

  constructor(owner: object, id: number, readonly p: PointElement, readonly q: PointElement) {
    super(owner, id, [p, q]);
    this.recompute();
  }

  get shape(): SegmentShape {
    return this.current;
  }

  recompute(): void {
    this.current = Object.freeze({ kind: 'segment', a: this.p.position, b: this.q.position });
  }
}

/** Circle given by its centre and a point on its boundary; the radius is derived. */
export class CircleElement extends GeoElement {
  readonly draggable = false;
  private current!: CircleShape;

  constructor(owner: object, id: number, readonly center: PointElement, readonly through: PointElement) {
    super(owner, id, [center, through]);
    this.recompute();
  }

  get shape(): CircleShape {
    return this.current;
  }

  recompute(): void {
    const c = this.center.position;
    const t = this.through.position;
    this.current = Object.freeze({ kind: 'circle', center: c, radius: Math.hypot(t.x - c.x, t.y - c.y) });
  }
}

function freezePoint(x: number, y: number): PointShape {
  return Object.freeze({ kind: 'point', x, y });
}
