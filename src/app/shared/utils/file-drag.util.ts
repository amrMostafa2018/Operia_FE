import { WritableSignal } from '@angular/core';

export function preventDragDefaults(event: DragEvent): void {
  event.preventDefault();
  event.stopPropagation();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }
}

export class SingleFileDragState {
  private counter = 0;

  constructor(private readonly isDragOver: WritableSignal<boolean>) {}

  onEnter(event: DragEvent): void {
    preventDragDefaults(event);
    this.counter++;
    this.isDragOver.set(true);
  }

  onOver(event: DragEvent): void {
    preventDragDefaults(event);
  }

  onLeave(event: DragEvent): void {
    preventDragDefaults(event);
    this.counter--;
    if (this.counter <= 0) {
      this.counter = 0;
      this.isDragOver.set(false);
    }
  }

  onDrop(event: DragEvent): File | null {
    preventDragDefaults(event);
    this.counter = 0;
    this.isDragOver.set(false);
    return event.dataTransfer?.files?.[0] ?? null;
  }
}

export class MultiFileDragState {
  private readonly counters = new Map<string, number>();

  constructor(private readonly activeId: WritableSignal<string | null>) {}

  onEnter(event: DragEvent, id: string): void {
    preventDragDefaults(event);
    const count = (this.counters.get(id) ?? 0) + 1;
    this.counters.set(id, count);
    this.activeId.set(id);
  }

  onOver(event: DragEvent): void {
    preventDragDefaults(event);
  }

  onLeave(event: DragEvent, id: string): void {
    preventDragDefaults(event);
    const count = (this.counters.get(id) ?? 1) - 1;
    if (count <= 0) {
      this.counters.delete(id);
      if (this.activeId() === id) {
        this.activeId.set(null);
      }
    } else {
      this.counters.set(id, count);
    }
  }

  onDrop(event: DragEvent, id: string): File | null {
    preventDragDefaults(event);
    this.counters.delete(id);
    this.activeId.set(null);
    return event.dataTransfer?.files?.[0] ?? null;
  }

  isOver(id: string): boolean {
    return this.activeId() === id;
  }
}
