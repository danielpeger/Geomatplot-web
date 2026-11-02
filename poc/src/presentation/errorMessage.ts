/** Paints a renderer start-up error onto the canvas itself; this is a message, not a fallback renderer. */
export function showCanvasError(canvas: HTMLCanvasElement, title: string, detail: string): void {
  canvas.title = `${title}: ${detail}`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || canvas.width;
  const height = canvas.clientHeight || canvas.height;
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  ctx.fillStyle = '#fff4f4';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#d33';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  ctx.fillStyle = '#a11';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText(title, width / 2, height / 2 - 14);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#522';
  ctx.fillText(detail, width / 2, height / 2 + 12, width - 24);
}
