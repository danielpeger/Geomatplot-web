import type { ElementView, GeometryReader } from '../../geometry/shapes.ts';
import type { InteractionState } from '../state/interactionState.ts';
import type { View } from '../view/view.ts';
import { hitTest } from './hitTest.ts';

export interface InteractionOptions {
  readonly tolerance?: number;
  readonly isHittable?: (id: number) => boolean;
}

type Gesture =
  | { readonly type: 'idle' }
  | { readonly type: 'drag'; readonly pointerId: number; readonly point: ElementView; readonly offsetX: number; readonly offsetY: number }
  | { readonly type: 'pan'; readonly pointerId: number; lastX: number; lastY: number };

/**
 * Turns pointer events on one canvas into drags (sent to the geometry),
 * pan/zoom (written to the View) and hover/drag highlight (written to the
 * interaction state). Shared by every renderer.
 */
export class InteractionHandler {
  private gesture: Gesture = { type: 'idle' };
  private readonly tolerance: number;
  private readonly isHittable: ((id: number) => boolean) | undefined;
  private readonly abort = new AbortController();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly view: View,
    private readonly state: InteractionState,
    private readonly geometry: GeometryReader,
    options: InteractionOptions = {},
  ) {
    this.tolerance = options.tolerance ?? 8;
    this.isHittable = options.isHittable;

    const signal = this.abort.signal;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => this.onDown(e), { signal });
    canvas.addEventListener('pointermove', (e) => this.onMove(e), { signal });
    canvas.addEventListener('pointerup', (e) => this.onUp(e), { signal });
    canvas.addEventListener('pointercancel', (e) => this.onUp(e), { signal });
    canvas.addEventListener('pointerleave', () => this.onLeave(), { signal });
    // Non-passive so the page does not scroll while zooming the plot.
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { signal, passive: false });
  }

  destroy(): void {
    this.abort.abort();
  }

  private local(e: PointerEvent | WheelEvent): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  private pick(px: number, py: number): ElementView | null {
    return hitTest(this.geometry.elements(), this.view, px, py, {
      tolerance: this.tolerance,
      ...(this.isHittable ? { isHittable: this.isHittable } : {}),
    });
  }

  private onDown(e: PointerEvent): void {
    if (e.button !== 0 || this.gesture.type !== 'idle') return;
    const [px, py] = this.local(e);
    const hit = this.pick(px, py);
    this.canvas.setPointerCapture(e.pointerId);

    if (hit && hit.draggable && hit.shape.kind === 'point') {
      const [x, y] = this.view.toPlot(px, py);
      this.gesture = { type: 'drag', pointerId: e.pointerId, point: hit, offsetX: hit.shape.x - x, offsetY: hit.shape.y - y };
      this.state.setHovered(hit.id);
      this.state.setDragged(hit.id);
      this.canvas.style.cursor = 'grabbing';
    } else {
      this.gesture = { type: 'pan', pointerId: e.pointerId, lastX: px, lastY: py };
      this.canvas.style.cursor = 'move';
    }
    e.preventDefault();
  }

  private onMove(e: PointerEvent): void {
    const [px, py] = this.local(e);
    const g = this.gesture;
    if (g.type === 'drag' && g.pointerId === e.pointerId) {
      this.dragTo(g, px, py, 'moving');
    } else if (g.type === 'pan' && g.pointerId === e.pointerId) {
      this.view.panByPixels(px - g.lastX, py - g.lastY);
      g.lastX = px;
      g.lastY = py;
    } else if (g.type === 'idle') {
      const hit = this.pick(px, py);
      this.state.setHovered(hit ? hit.id : null);
      this.canvas.style.cursor = hit?.draggable ? 'grab' : hit ? 'pointer' : 'default';
    }
  }

  private onUp(e: PointerEvent): void {
    const g = this.gesture;
    if (g.type === 'idle' || g.pointerId !== e.pointerId) return;
    if (g.type === 'drag') {
      const [px, py] = this.local(e);
      this.dragTo(g, px, py, 'done');
      this.state.setDragged(null);
    }
    this.gesture = { type: 'idle' };
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    this.canvas.style.cursor = g.type === 'drag' ? 'grab' : 'default';
  }

  private onLeave(): void {
    if (this.gesture.type === 'idle') this.state.setHovered(null);
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const [px, py] = this.local(e);
    const lines = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 400 : 1;
    this.view.zoomAt(px, py, Math.exp(-e.deltaY * lines * 0.0015));
  }

  private dragTo(g: Extract<Gesture, { type: 'drag' }>, px: number, py: number, phase: 'moving' | 'done'): void {
    const [x, y] = this.view.toPlot(px, py);
    this.geometry.drag(g.point, { x: x + g.offsetX, y: y + g.offsetY }, phase);
  }
}
