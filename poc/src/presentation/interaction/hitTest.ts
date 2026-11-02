import type { ElementView } from '../../geometry/shapes.ts';
import type { View } from '../view/view.ts';

export interface HitOptions {
  /** Pick tolerance in CSS pixels, independent of zoom. */
  readonly tolerance: number;
  readonly isHittable?: (id: number) => boolean;
}

/**
 * CPU hit test in pixel space. Draggable points win over computed points,
 * points win over curves; within a class the nearest element wins.
 */
export function hitTest(
  elements: readonly ElementView[],
  view: View,
  px: number,
  py: number,
  { tolerance, isHittable }: HitOptions,
): ElementView | null {
  let best: ElementView | null = null;
  let bestRank = Infinity;
  let bestDistance = Infinity;

  for (const element of elements) {
    if (isHittable && !isHittable(element.id)) continue;
    const distance = pixelDistance(element, view, px, py);
    if (distance > tolerance) continue;
    const rank = element.shape.kind === 'point' ? (element.draggable ? 0 : 1) : 2;
    if (rank < bestRank || (rank === bestRank && distance <= bestDistance)) {
      best = element;
      bestRank = rank;
      bestDistance = distance;
    }
  }
  return best;
}

export function pixelDistance(element: ElementView, view: View, px: number, py: number): number {
  const shape = element.shape;
  switch (shape.kind) {
    case 'point': {
      const [x, y] = view.toPixel(shape.x, shape.y);
      return Math.hypot(px - x, py - y);
    }
    case 'segment': {
      const [ax, ay] = view.toPixel(shape.a.x, shape.a.y);
      const [bx, by] = view.toPixel(shape.b.x, shape.b.y);
      return distanceToSegment(px, py, ax, ay, bx, by);
    }
    case 'circle': {
      const [cx, cy] = view.toPixel(shape.center.x, shape.center.y);
      return Math.abs(Math.hypot(px - cx, py - cy) - shape.radius * view.pixelsPerUnit);
    }
  }
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
