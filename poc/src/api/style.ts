import { converter, modeHsl, modeHwb, modeLab, modeOklch, modeP3, modeRgb, parse, useMode } from 'culori/fn';
import type { StyleRecord } from '../presentation/drawlist/style.ts';
import type { Dash, RGBA } from '../presentation/drawlist/types.ts';

// Only the registered modes can be parsed; every one converts straight to rgb.
// Registration must run before DEFAULTS below parses its colours.
useMode(modeRgb);
useMode(modeHsl);
useMode(modeHwb);
useMode(modeLab);
useMode(modeOklch);
useMode(modeP3);

const toRgb = converter('rgb');

/** The public style object: an optional last argument of every primitive. */
export interface Style {
  /** Any CSS colour, e.g. 'red', '#0072bd' or 'oklch(0.6 0.15 250)'. */
  color?: string;
  /** Line width in CSS pixels. */
  width?: number;
  /** Dash pattern [on, off] in CSS pixels, or true for a default dash. */
  dash?: readonly number[] | boolean;
  /** Point marker radius in CSS pixels. */
  size?: number;
  /** Hidden elements are neither drawn nor hit. */
  visible?: boolean;
}

export type ElementType = 'Point' | 'Midpoint' | 'Segment' | 'Circle';

const DEFAULTS: Record<ElementType, StyleRecord> = {
  Point: { color: parseColor('#0072bd'), width: 2, dash: null, size: 6, visible: true },
  Midpoint: { color: parseColor('#333333'), width: 2, dash: null, size: 4.5, visible: true },
  Segment: { color: parseColor('#444444'), width: 2, dash: null, size: 5, visible: true },
  Circle: { color: parseColor('#444444'), width: 2, dash: null, size: 5, visible: true },
};

export function resolveStyle(type: ElementType, style: Style | undefined): StyleRecord {
  const base = DEFAULTS[type];
  if (!style) return base;
  return {
    color: style.color !== undefined ? parseColor(style.color) : base.color,
    width: style.width ?? base.width,
    dash: resolveDash(style.dash, base.dash),
    size: style.size ?? base.size,
    visible: style.visible ?? base.visible,
  };
}

/**
 * Parses a CSS colour (names, hex, rgb(), hsl(), hwb(), lab(), oklch(),
 * color(display-p3 ...), transparent) into sRGB with alpha, each 0..1.
 * Out-of-gamut colours are clamped to sRGB.
 */
export function parseColor(input: string): RGBA {
  const parsed = parse(input.trim());
  const rgb = parsed && toRgb(parsed);
  if (!rgb) throw new Error(`Unknown colour: "${input}"`);
  return [clamp(rgb.r), clamp(rgb.g), clamp(rgb.b), clamp(rgb.alpha ?? 1)];
}

function clamp(value: number): number {
  return Number.isNaN(value) ? 0 : Math.min(1, Math.max(0, value));
}

function resolveDash(dash: Style['dash'], fallback: Dash | null): Dash | null {
  if (dash === undefined) return fallback;
  if (dash === false) return null;
  if (dash === true) return [8, 6];
  const [on = 0, off = on] = dash;
  return on > 0 && off > 0 ? [on, off] : null;
}
