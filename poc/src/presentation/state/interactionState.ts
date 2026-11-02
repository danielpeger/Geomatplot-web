/** Per-plot hovered and dragged element ids. Written by the interaction handler, read by the draw list. */
export class InteractionState {
  private hoveredId: number | null = null;
  private draggedId: number | null = null;
  private readonly listeners = new Set<() => void>();

  get hovered(): number | null {
    return this.hoveredId;
  }

  get dragged(): number | null {
    return this.draggedId;
  }

  setHovered(id: number | null): void {
    console.log('setHovered', id);
    if (id === this.hoveredId) return;
    this.hoveredId = id;
    this.emit();
  }

  setDragged(id: number | null): void {
    if (id === this.draggedId) return;
    this.draggedId = id;
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
