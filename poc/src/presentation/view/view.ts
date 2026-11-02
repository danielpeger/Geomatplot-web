export type Range = readonly [number, number];

/**
 * Per-plot visible region and the pixel <-> plot transform (CSS pixels, y up
 * in plot space). Written by the interaction handler, read by the draw list.
 * Both axes share one scale, so circles stay circles.
 */
export class View {
  private w = 0;
  private h = 0;
  private cx: number;
  private cy: number;
  private scale = 1;
  private sized = false;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly initialHalfExtent = 5, center: Range = [0, 0]) {
    this.cx = center[0];
    this.cy = center[1];
  }

  get width(): number {
    return this.w;
  }

  get height(): number {
    return this.h;
  }

  /** Pixels per plot unit. */
  get pixelsPerUnit(): number {
    return this.scale;
  }

  get xlim(): Range {
    const half = this.w / 2 / this.scale;
    return [this.cx - half, this.cx + half];
  }

  get ylim(): Range {
    const half = this.h / 2 / this.scale;
    return [this.cy - half, this.cy + half];
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setSize(width: number, height: number): void {
    if (width === this.w && height === this.h) return;
    this.w = width;
    this.h = height;
    if (!this.sized && width > 0 && height > 0) {
      this.scale = Math.min(width, height) / (2 * this.initialHalfExtent);
      this.sized = true;
    }
    this.emit();
  }

  toPixel(x: number, y: number): [number, number] {
    return [(x - this.cx) * this.scale + this.w / 2, this.h / 2 - (y - this.cy) * this.scale];
  }

  toPlot(px: number, py: number): [number, number] {
    return [(px - this.w / 2) / this.scale + this.cx, (this.h / 2 - py) / this.scale + this.cy];
  }

  panByPixels(dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;
    this.cx -= dx / this.scale;
    this.cy += dy / this.scale;
    this.emit();
  }

  /** Zooms by `factor` (>1 zooms in) keeping the plot point under (px, py) fixed. */
  zoomAt(px: number, py: number, factor: number): void {
    if (!(factor > 0) || factor === 1) return;
    const [x, y] = this.toPlot(px, py);
    this.scale = Math.min(1e6, Math.max(1e-3, this.scale * factor));
    this.cx = x - (px - this.w / 2) / this.scale;
    this.cy = y - (this.h / 2 - py) / this.scale;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
