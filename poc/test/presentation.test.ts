import { describe, expect, it, vi } from 'vitest';
import { GeometryGraph } from '../src/geometry/graph.ts';
import { hitTest } from '../src/presentation/interaction/hitTest.ts';
import { FrameScheduler } from '../src/presentation/scheduler/frameScheduler.ts';
import { InteractionState } from '../src/presentation/state/interactionState.ts';
import { View } from '../src/presentation/view/view.ts';

function view(): View {
  const v = new View(5);
  v.setSize(200, 100); // 10 px per unit
  return v;
}

describe('View', () => {
  it('round-trips pixel and plot coordinates', () => {
    const v = view();
    expect(v.toPixel(0, 0)).toEqual([100, 50]);
    expect(v.toPixel(1, 1)).toEqual([110, 40]);
    expect(v.toPlot(110, 40)).toEqual([1, 1]);
    expect(v.xlim).toEqual([-10, 10]);
    expect(v.ylim).toEqual([-5, 5]);
  });

  it('pans by pixels and zooms around a fixed point', () => {
    const v = view();
    v.panByPixels(10, 0);
    expect(v.toPixel(0, 0)).toEqual([110, 50]);

    const anchor = v.toPlot(30, 20);
    v.zoomAt(30, 20, 2);
    expect(v.pixelsPerUnit).toBe(20);
    const [px, py] = v.toPixel(anchor[0], anchor[1]);
    expect(px).toBeCloseTo(30);
    expect(py).toBeCloseTo(20);
  });

  it('notifies on change only', () => {
    const v = view();
    const listener = vi.fn();
    v.subscribe(listener);
    v.panByPixels(0, 0);
    v.setSize(200, 100);
    expect(listener).not.toHaveBeenCalled();
    v.zoomAt(0, 0, 1.1);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('hit test', () => {
  const g = new GeometryGraph();
  const A = g.addPoint(0, 0);
  const B = g.addPoint(4, 0);
  const M = g.addMidpoint(A, B);
  const s = g.addSegment(A, B);
  const c = g.addCircle(A, B);

  it('uses a pixel tolerance that does not depend on zoom', () => {
    const v = view();
    expect(hitTest(g.elements(), v, 105, 50, { tolerance: 6 })).toBe(A);
    expect(hitTest(g.elements(), v, 107, 50, { tolerance: 6 })).toBe(s);
    v.zoomAt(100, 50, 4);
    expect(hitTest(g.elements(), v, 105, 50, { tolerance: 6 })).toBe(A);
  });

  it('prefers draggable points, then computed points, then curves', () => {
    const v = view();
    expect(hitTest(g.elements(), v, 120, 50, { tolerance: 6 })).toBe(M);
    expect(hitTest(g.elements(), v, 140, 50, { tolerance: 6 })).toBe(B);
    expect(hitTest(g.elements(), v, 100, 10, { tolerance: 6 })).toBe(c);
    expect(hitTest(g.elements(), v, 160, 90, { tolerance: 6 })).toBeNull();
  });

  it('skips elements that are not hittable', () => {
    const v = view();
    expect(hitTest(g.elements(), v, 100, 50, { tolerance: 6, isHittable: (id) => id !== A.id })).toBe(s);
  });
});

describe('interaction state', () => {
  it('notifies only when the hovered or dragged element changes', () => {
    const state = new InteractionState();
    const listener = vi.fn();
    state.subscribe(listener);
    state.setHovered(1);
    state.setHovered(1);
    state.setDragged(1);
    state.setDragged(null);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});

describe('frame scheduler', () => {
  it('coalesces invalidations into one render per target per frame', () => {
    const frames: Array<() => void> = [];
    const scheduler = new FrameScheduler((cb) => frames.push(cb));
    const p1 = { renderFrame: vi.fn() };
    const p2 = { renderFrame: vi.fn() };

    scheduler.markDirty(p1);
    scheduler.markDirty(p1);
    scheduler.markDirty(p2);
    scheduler.markDirty(p1);
    expect(frames).toHaveLength(1);
    expect(p1.renderFrame).not.toHaveBeenCalled();

    frames.shift()!();
    expect(p1.renderFrame).toHaveBeenCalledTimes(1);
    expect(p2.renderFrame).toHaveBeenCalledTimes(1);

    scheduler.markDirty(p2);
    expect(frames).toHaveLength(1);
  });
});
