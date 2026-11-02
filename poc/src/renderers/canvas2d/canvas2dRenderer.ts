import type { DrawList, RGBA } from '../../presentation/drawlist/types.ts';
import { RendererUnavailableError, type Renderer } from '../renderer.ts';

/** Minimal Canvas 2D renderer: paints the draw list item by item. */
export class Canvas2DRenderer implements Renderer {
  static readonly rendererName = 'Canvas 2D';

  static async create(canvas: HTMLCanvasElement): Promise<Canvas2DRenderer> {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new RendererUnavailableError('Could not get a 2D context for this canvas.');
    return new Canvas2DRenderer(ctx);
  }

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  render(list: DrawList): void {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = css(list.background);
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(list.pixelRatio, 0, 0, list.pixelRatio, 0, 0);

    for (const item of list.items) {
      ctx.beginPath();
      switch (item.kind) {
        case 'segment':
          ctx.moveTo(item.a[0], item.a[1]);
          ctx.lineTo(item.b[0], item.b[1]);
          this.stroke(item.color, item.width, item.dash);
          break;
        case 'circle':
          ctx.arc(item.center[0], item.center[1], item.radius, 0, 2 * Math.PI);
          this.stroke(item.color, item.width, item.dash);
          break;
        case 'point':
          ctx.arc(item.center[0], item.center[1], item.radius, 0, 2 * Math.PI);
          ctx.fillStyle = css(item.fill);
          ctx.fill();
          if (item.strokeWidth > 0) {
            ctx.beginPath();
            ctx.arc(item.center[0], item.center[1], item.radius - item.strokeWidth / 2, 0, 2 * Math.PI);
            this.stroke(item.stroke, item.strokeWidth, null);
          }
          break;
      }
    }
  }

  destroy(): void {}

  private stroke(color: RGBA, width: number, dash: readonly number[] | null): void {
    this.ctx.strokeStyle = css(color);
    this.ctx.lineWidth = width;
    this.ctx.setLineDash(dash ? [...dash] : []);
    // Butt caps keep dash lengths identical to the WebGPU renderer.
    this.ctx.lineCap = dash ? 'butt' : 'round';
    this.ctx.stroke();
  }
}

function css([r, g, b, a]: RGBA): string {
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
}
