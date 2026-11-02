import { describe, expect, it } from 'vitest';
import type { ElementView } from '../src/geometry/shapes.ts';
import { buildDrawList } from '../src/presentation/drawlist/buildDrawList.ts';
import type { StyleRecord } from '../src/presentation/drawlist/style.ts';
import { View } from '../src/presentation/view/view.ts';

const RED = [1, 0, 0, 1] as const;
const BLUE = [0, 0, 1, 1] as const;

function style(overrides: Partial<StyleRecord> = {}): StyleRecord {
  return { color: BLUE, width: 2, dash: null, size: 5, visible: true, ...overrides };
}

/** 200x100 CSS px, 10 px per unit, origin in the centre. */
function view(): View {
  const v = new View(5);
  v.setSize(200, 100);
  return v;
}

// Hand-written shapes, no geometry graph involved.
const elements: ElementView[] = [
  { id: 0, draggable: true, shape: { kind: 'point', x: 0, y: 0 } },
  { id: 1, draggable: true, shape: { kind: 'point', x: 2, y: 1 } },
  { id: 2, draggable: false, shape: { kind: 'segment', a: { x: 0, y: 0 }, b: { x: 2, y: 1 } } },
  { id: 3, draggable: false, shape: { kind: 'point', x: 1, y: 0.5 } },
  { id: 4, draggable: false, shape: { kind: 'circle', center: { x: 0, y: 0 }, radius: 3 } },
  { id: 5, draggable: true, shape: { kind: 'point', x: -4, y: 4 } },
];

describe('draw list', () => {
  const styles = new Map<number, StyleRecord>([
    [0, style()],
    [1, style({ color: RED, size: 7 })],
    [2, style({ width: 3, dash: [6, 4] })],
    [3, style()],
    [4, style({ color: RED })],
    [5, style({ visible: false })],
  ]);

  const list = buildDrawList({
    elements,
    style: (id) => styles.get(id),
    highlight: { hovered: 1, dragged: null },
    view: view(),
    pixelRatio: 2,
    grid: false,
  });

  it('orders circles, segments, computed points, then draggable points, and skips hidden ones', () => {
    expect(list.items.map((i) => i.id)).toEqual([4, 2, 3, 0, 1, 1]);
  });

  it('transforms plot coordinates to CSS pixels through the View', () => {
    const circle = list.items[0]!;
    expect(circle).toMatchObject({ kind: 'circle', center: [100, 50], radius: 30, color: RED });
    const segment = list.items[1]!;
    expect(segment).toMatchObject({ kind: 'segment', a: [100, 50], b: [120, 40], width: 3, dash: [6, 4] });
  });

  it('adds a translucent halo under the highlighted element', () => {
    const [halo, point] = list.items.slice(-2);
    expect(halo).toMatchObject({ kind: 'point', id: 1, highlighted: true, center: [120, 40] });
    expect(point).toMatchObject({ kind: 'point', id: 1, highlighted: true, fill: RED });
    if (halo?.kind !== 'point' || point?.kind !== 'point') throw new Error('expected points');
    expect(halo.radius).toBeGreaterThan(point.radius);
    expect(halo.fill[3]).toBeLessThan(1);
    expect(list.items.filter((i) => i.highlighted).every((i) => i.id === 1)).toBe(true);
  });

  it('carries canvas size and pixel ratio', () => {
    expect(list).toMatchObject({ width: 200, height: 100, pixelRatio: 2 });
  });

  it('adds grid lines without element ids before the elements', () => {
    const withGrid = buildDrawList({
      elements,
      style: (id) => styles.get(id),
      highlight: { hovered: null, dragged: null },
      view: view(),
      pixelRatio: 1,
    });
    const firstElement = withGrid.items.findIndex((i) => i.id !== null);
    expect(firstElement).toBeGreaterThan(0);
    expect(withGrid.items.slice(firstElement).every((i) => i.id !== null)).toBe(true);
  });
});
