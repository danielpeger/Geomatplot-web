import type { Dash, RGBA } from './types.ts';

/** Internal style record the public style object resolves to. */
export interface StyleRecord {
  readonly color: RGBA;
  /** Line width in CSS pixels (segments, circles). */
  readonly width: number;
  readonly dash: Dash | null;
  /** Marker radius in CSS pixels (points). */
  readonly size: number;
  readonly visible: boolean;
}

export type StyleLookup = (id: number) => StyleRecord | undefined;
