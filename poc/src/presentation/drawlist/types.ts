/**
 * The draw list: plain data in CSS pixels (y down), built once per frame.
 * It is the only input a renderer receives.
 */

export type RGBA = readonly [r: number, g: number, b: number, a: number];
export type Pixel = readonly [x: number, y: number];
/** [on, off] lengths in CSS pixels. */
export type Dash = readonly [on: number, off: number];

export interface DrawSegment {
  readonly kind: 'segment';
  /** Element id, or null for plot decorations such as the grid. */
  readonly id: number | null;
  readonly a: Pixel;
  readonly b: Pixel;
  readonly color: RGBA;
  readonly width: number;
  readonly dash: Dash | null;
  readonly highlighted: boolean;
}

export interface DrawCircle {
  readonly kind: 'circle';
  readonly id: number | null;
  readonly center: Pixel;
  readonly radius: number;
  readonly color: RGBA;
  readonly width: number;
  readonly dash: Dash | null;
  readonly highlighted: boolean;
}

export interface DrawPoint {
  readonly kind: 'point';
  readonly id: number | null;
  readonly center: Pixel;
  readonly radius: number;
  readonly fill: RGBA;
  readonly stroke: RGBA;
  readonly strokeWidth: number;
  readonly highlighted: boolean;
}

export type DrawItem = DrawSegment | DrawCircle | DrawPoint;

export interface DrawList {
  /** Canvas size in CSS pixels. */
  readonly width: number;
  readonly height: number;
  /** Device pixels per CSS pixel. */
  readonly pixelRatio: number;
  readonly background: RGBA;
  /** In draw order: later items are painted over earlier ones. */
  readonly items: readonly DrawItem[];
}
