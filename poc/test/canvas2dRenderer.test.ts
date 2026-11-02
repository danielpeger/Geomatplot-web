import { describe, expect, it } from 'vitest';
import type { DrawList } from '../src/presentation/drawlist/types.ts';
import { Canvas2DRenderer } from '../src/renderers/canvas2d/canvas2dRenderer.ts';

/** Records the calls a renderer makes, in order. */
function recordingContext() {
  const calls: string[] = [];
  const state: Record<string, unknown> = {};
  const record =
    (name: string) =>
    (...args: unknown[]): void => {
      calls.push(`${name}(${args.map((a) => (Array.isArray(a) ? `[${a.join(',')}]` : String(a))).join(',')})`);
    };
  const ctx = new Proxy(
    { canvas: { width: 400, height: 200 } },
    {
      get: (target, key: string) => (key === 'canvas' ? target.canvas : key in state ? state[key] : record(key)),
      set: (_target, key: string, value) => {
        state[key] = value;
        calls.push(`${key}=${value}`);
        return true;
      },
    },
  );
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

// A hand-written draw list: the renderer is tested without any geometry.
const list: DrawList = {
  width: 200,
  height: 100,
  pixelRatio: 2,
  background: [1, 1, 1, 1],
  items: [
    { kind: 'circle', id: 2, center: [100, 50], radius: 30, color: [1, 0, 0, 1], width: 2, dash: [6, 4], highlighted: false },
    { kind: 'segment', id: 1, a: [10, 20], b: [30, 40], color: [0, 0, 1, 1], width: 3, dash: null, highlighted: false },
    { kind: 'point', id: 0, center: [10, 20], radius: 5, fill: [0, 0, 1, 1], stroke: [1, 1, 1, 1], strokeWidth: 1, highlighted: true },
  ],
};

describe('Canvas 2D renderer', () => {
  it('paints the draw list in order, scaled to device pixels', () => {
    const { ctx, calls } = recordingContext();
    new Canvas2DRenderer(ctx).render(list);

    expect(calls.slice(0, 4)).toEqual([
      'setTransform(1,0,0,1,0,0)',
      'fillStyle=rgba(255, 255, 255, 1)',
      'fillRect(0,0,400,200)',
      'setTransform(2,0,0,2,0,0)',
    ]);
    const drawing = calls.filter((c) => /^(arc|moveTo|lineTo|setLineDash|fill\(|stroke\()/.test(c));
    expect(drawing).toEqual([
      'arc(100,50,30,0,6.283185307179586)',
      'setLineDash([6,4])',
      'stroke()',
      'moveTo(10,20)',
      'lineTo(30,40)',
      'setLineDash([])',
      'stroke()',
      'arc(10,20,5,0,6.283185307179586)',
      'fill()',
      'arc(10,20,4.5,0,6.283185307179586)',
      'setLineDash([])',
      'stroke()',
    ]);
  });
});
