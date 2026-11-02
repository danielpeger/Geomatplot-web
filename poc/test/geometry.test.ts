import { describe, expect, it, vi } from 'vitest';
import { GeometryGraph } from '../src/geometry/graph.ts';
import type { GeometryChange } from '../src/geometry/shapes.ts';

describe('geometry layer', () => {
  it('computes Midpoint and Circle shapes', () => {
    const g = new GeometryGraph();
    const A = g.addPoint(0, 0);
    const B = g.addPoint(3, 4);
    const M = g.addMidpoint(A, B);
    const c = g.addCircle(A, B);
    const s = g.addSegment(A, B);

    expect(M.shape).toEqual({ kind: 'point', x: 1.5, y: 2 });
    expect(M.draggable).toBe(false);
    expect(c.shape).toEqual({ kind: 'circle', center: { kind: 'point', x: 0, y: 0 }, radius: 5 });
    expect(s.shape.a).toMatchObject({ x: 0, y: 0 });
    expect(s.shape.b).toMatchObject({ x: 3, y: 4 });
  });

  it('exposes read-only shapes', () => {
    const g = new GeometryGraph();
    const A = g.addPoint(1, 2);
    expect(Object.isFrozen(A.shape)).toBe(true);
    expect(() => {
      (A.shape as { x: number }).x = 10;
    }).toThrow(TypeError);
  });

  it('propagates a drag to all transitive dependents', () => {
    const g = new GeometryGraph();
    const A = g.addPoint(0, 0);
    const B = g.addPoint(2, 0);
    const M = g.addMidpoint(A, B);
    const c = g.addCircle(M, B);
    const s = g.addSegment(M, A);

    g.drag(A, { x: -2, y: 4 }, 'moving');

    expect(A.shape).toMatchObject({ x: -2, y: 4 });
    expect(M.shape).toMatchObject({ x: 0, y: 2 });
    expect(c.shape.center).toMatchObject({ x: 0, y: 2 });
    expect(c.shape.radius).toBeCloseTo(Math.hypot(2, 2));
    expect(s.shape.a).toMatchObject({ x: 0, y: 2 });
    expect(s.shape.b).toMatchObject({ x: -2, y: 4 });
  });

  it('recomputes in topological (creation) order, each element once', () => {
    const g = new GeometryGraph();
    const A = g.addPoint(0, 0);
    const B = g.addPoint(4, 0);
    const M = g.addMidpoint(A, B);
    const N = g.addMidpoint(M, B);
    // s is reached from A both directly and through M -> N; c through M and N.
    const s = g.addSegment(A, N);
    const c = g.addCircle(M, N);

    const order = g.drag(A, { x: 2, y: 2 }, 'done');
    expect(order).toEqual([A.id, M.id, N.id, s.id, c.id]);
    expect(new Set(order).size).toBe(order.length);
    expect(N.shape).toMatchObject({ x: 3.5, y: 0.5 });
  });

  it('recomputes only the dependents of the dragged point', () => {
    const g = new GeometryGraph();
    const A = g.addPoint(0, 0);
    const B = g.addPoint(1, 0);
    const C = g.addPoint(5, 5);
    const D = g.addPoint(6, 5);
    const mAB = g.addMidpoint(A, B);
    const mCD = g.addMidpoint(C, D);
    const sCD = g.addSegment(C, D);
    const cBC = g.addCircle(B, C);

    const recompute = vi.spyOn(mCD, 'recompute');
    const recomputeSegment = vi.spyOn(sCD, 'recompute');
    const recomputeMidpoint = vi.spyOn(mAB, 'recompute');
    const recomputeCircle = vi.spyOn(cBC, 'recompute');

    const changed = g.drag(A, { x: -1, y: 0 }, 'moving');

    expect(changed).toEqual([A.id, mAB.id]);
    expect(recomputeMidpoint).toHaveBeenCalledTimes(1);
    expect(recompute).not.toHaveBeenCalled();
    expect(recomputeSegment).not.toHaveBeenCalled();
    expect(recomputeCircle).not.toHaveBeenCalled();
  });

  it('notifies subscribers with the changed ids and the drag phase', () => {
    const g = new GeometryGraph();
    const A = g.addPoint(0, 0);
    const B = g.addPoint(2, 2);
    const M = g.addMidpoint(A, B);
    const changes: GeometryChange[] = [];
    const off = g.subscribe((change) => changes.push(change));

    g.drag(B, { x: 4, y: 4 }, 'moving');
    g.drag(B, { x: 6, y: 6 }, 'done');
    off();
    g.drag(B, { x: 0, y: 0 }, 'done');

    expect(changes).toEqual([
      { changed: [B.id, M.id], phase: 'moving' },
      { changed: [B.id, M.id], phase: 'done' },
    ]);
  });

  it('notifies subscribers when an element is created', () => {
    const g = new GeometryGraph();
    const listener = vi.fn();
    g.subscribe(listener);
    const A = g.addPoint(0, 0);
    expect(listener).toHaveBeenCalledWith({ changed: [A.id], phase: null });
  });

  it('rejects dragging computed elements and elements of another plot', () => {
    const g = new GeometryGraph();
    const other = new GeometryGraph();
    const A = g.addPoint(0, 0);
    const B = g.addPoint(1, 1);
    const M = g.addMidpoint(A, B);
    const X = other.addPoint(0, 0);

    expect(() => g.drag(M, { x: 1, y: 1 }, 'done')).toThrow();
    expect(() => g.drag(X, { x: 1, y: 1 }, 'done')).toThrow();
  });

  it('rejects dependencies across plots', () => {
    const g1 = new GeometryGraph();
    const g2 = new GeometryGraph();
    const A = g1.addPoint(0, 0);
    const B = g2.addPoint(1, 1);
    expect(() => g1.addSegment(A, B)).toThrow(/another plot/);
    expect(() => g2.addCircle(A, B)).toThrow(/another plot/);
    expect(g1.elements()).toHaveLength(1);
    expect(g2.elements()).toHaveLength(1);
  });

  it('ignores non-finite drag positions', () => {
    const g = new GeometryGraph();
    const A = g.addPoint(1, 1);
    expect(g.drag(A, { x: NaN, y: 0 }, 'moving')).toEqual([]);
    expect(A.shape).toMatchObject({ x: 1, y: 1 });
  });
});
