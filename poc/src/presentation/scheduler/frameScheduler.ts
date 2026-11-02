export interface FrameTarget {
  renderFrame(): void;
}

export type RequestFrame = (callback: () => void) => unknown;

/**
 * Collects dirty plots and renders each at most once per animation frame.
 * Lives outside the renderers, so swapping the renderer does not affect timing.
 */
export class FrameScheduler {
  private readonly dirty = new Set<FrameTarget>();
  private pending = false;

  constructor(private readonly requestFrame: RequestFrame) {}

  markDirty(target: FrameTarget): void {
    this.dirty.add(target);
    if (this.pending) return;
    this.pending = true;
    this.requestFrame(() => this.flush());
  }

  private flush(): void {
    this.pending = false;
    const targets = [...this.dirty];
    this.dirty.clear();
    for (const target of targets) target.renderFrame();
  }
}

let shared: FrameScheduler | null = null;

/** The page-wide scheduler, driven by `requestAnimationFrame`. */
export function pageScheduler(): FrameScheduler {
  shared ??= new FrameScheduler((callback) => requestAnimationFrame(callback));
  return shared;
}
