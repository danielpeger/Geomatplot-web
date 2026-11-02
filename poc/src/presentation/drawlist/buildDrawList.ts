import type { ElementView } from '../../geometry/shapes.ts';
import type { View } from '../view/view.ts';
import type { StyleLookup, StyleRecord } from './style.ts';
import type { DrawItem, DrawList, RGBA } from './types.ts';

export interface DrawListInput {
  readonly elements: readonly ElementView[];
  readonly style: StyleLookup;
  readonly highlight: { readonly hovered: number | null; readonly dragged: number | null };
  readonly view: View;
  readonly pixelRatio: number;
  readonly background?: RGBA;
  readonly grid?: boolean;
}

const WHITE: RGBA = [1, 1, 1, 1];
const GRID: RGBA = [0.9, 0.91, 0.93, 1];
const AXIS: RGBA = [0.62, 0.64, 0.68, 1];
const FALLBACK: StyleRecord = { color: [0.2, 0.2, 0.2, 1], width: 2, dash: null, size: 5, visible: true };

const HALO_ALPHA = 0.28;
const HALO_LINE_EXTRA = 8;
const HALO_POINT_EXTRA = 6;

/** Draw order: grid, circles, segments, computed points, draggable points. */
function rank(element: ElementView): number {
  switch (element.shape.kind) {
    case 'circle':
      return 0;
    case 'segment':
      return 1;
    case 'point':
      return element.draggable ? 3 : 2;
  }
}

/**
 * Merges computed shapes, style, highlight and the View into the draw list.
 * This is the single place where highlight appearance, draw order and
 * visibility are decided.
 */
export function buildDrawList(input: DrawListInput): DrawList {
  const { view } = input;
  const items: DrawItem[] = input.grid === false ? [] : gridItems(view);

  const ordered = input.elements
    .map((element) => ({ element, style: input.style(element.id) ?? FALLBACK }))
    .filter(({ style }) => style.visible)
    .sort((p, q) => rank(p.element) - rank(q.element) || p.element.id - q.element.id);

  for (const { element, style } of ordered) {
    const highlighted = element.id === input.highlight.hovered || element.id === input.highlight.dragged;
    const shape = element.shape;
    const halo = withAlpha(style.color, HALO_ALPHA);

    switch (shape.kind) {
      case 'point': {
        const center = view.toPixel(shape.x, shape.y);
        if (highlighted) {
          items.push({ kind: 'point', id: element.id, center, radius: style.size + HALO_POINT_EXTRA, fill: halo, stroke: halo, strokeWidth: 0, highlighted });
        }
        items.push({ kind: 'point', id: element.id, center, radius: style.size + (highlighted ? 1 : 0), fill: style.color, stroke: WHITE, strokeWidth: 1.5, highlighted });
        break;
      }
      case 'segment': {
        const a = view.toPixel(shape.a.x, shape.a.y);
        const b = view.toPixel(shape.b.x, shape.b.y);
        if (highlighted) {
          items.push({ kind: 'segment', id: element.id, a, b, color: halo, width: style.width + HALO_LINE_EXTRA, dash: null, highlighted });
        }
        items.push({ kind: 'segment', id: element.id, a, b, color: style.color, width: style.width, dash: style.dash, highlighted });
        break;
      }
      case 'circle': {
        const center = view.toPixel(shape.center.x, shape.center.y);
        const radius = shape.radius * view.pixelsPerUnit;
        if (highlighted) {
          items.push({ kind: 'circle', id: element.id, center, radius, color: halo, width: style.width + HALO_LINE_EXTRA, dash: null, highlighted });
        }
        items.push({ kind: 'circle', id: element.id, center, radius, color: style.color, width: style.width, dash: style.dash, highlighted });
        break;
      }
    }
  }

  return {
    width: view.width,
    height: view.height,
    pixelRatio: input.pixelRatio,
    background: input.background ?? WHITE,
    items,
  };
}

function withAlpha([r, g, b, a]: RGBA, alpha: number): RGBA {
  return [r, g, b, a * alpha];
}

function gridItems(view: View): DrawItem[] {
  if (view.width <= 0 || view.height <= 0) return [];
  const step = niceStep(80 / view.pixelsPerUnit);
  const [x0, x1] = view.xlim;
  const [y0, y1] = view.ylim;
  const items: DrawItem[] = [];
  const line = (a: readonly [number, number], b: readonly [number, number], axis: boolean): void => {
    items.push({ kind: 'segment', id: null, a, b, color: axis ? AXIS : GRID, width: 1, dash: null, highlighted: false });
  };

  for (let i = Math.ceil(x0 / step); i * step <= x1; i++) {
    if (i === 0) continue;
    const [px] = view.toPixel(i * step, 0);
    line([px, 0], [px, view.height], false);
  }
  for (let i = Math.ceil(y0 / step); i * step <= y1; i++) {
    if (i === 0) continue;
    const [, py] = view.toPixel(0, i * step);
    line([0, py], [view.width, py], false);
  }
  const [ox, oy] = view.toPixel(0, 0);
  if (x0 <= 0 && 0 <= x1) line([ox, 0], [ox, view.height], true);
  if (y0 <= 0 && 0 <= y1) line([0, oy], [view.width, oy], true);
  return items;
}

function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5]) if (m * power >= raw) return m * power;
  return 10 * power;
}
