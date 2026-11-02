/** Plot-coordinate shapes: the only geometry the presentation layer sees. */

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface PointShape {
  readonly kind: 'point';
  readonly x: number;
  readonly y: number;
}

export interface SegmentShape {
  readonly kind: 'segment';
  readonly a: Vec2;
  readonly b: Vec2;
}

export interface CircleShape {
  readonly kind: 'circle';
  readonly center: Vec2;
  readonly radius: number;
}

export type Shape = PointShape | SegmentShape | CircleShape;

export type ShapeKind = Shape['kind'];

export type DragPhase = 'moving' | 'done';

/** Read-only view of one element: its identity, whether it is draggable, and its computed shape. */
export interface ElementView {
  readonly id: number;
  readonly draggable: boolean;
  readonly shape: Shape;
}

export interface GeometryChange {
  /** Ids of elements whose shape changed, in recomputation order. */
  readonly changed: readonly number[];
  readonly phase: DragPhase | null;
}

export type GeometryListener = (change: GeometryChange) => void;

/** Everything the presentation layer may use from the geometry layer. */
export interface GeometryReader {
  elements(): readonly ElementView[];
  subscribe(listener: GeometryListener): () => void;
  drag(point: ElementView, position: Vec2, phase: DragPhase): void;
}
