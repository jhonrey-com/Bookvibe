export interface HistoryEntry<T> {
  label: string;
  state: T;
  timestamp: number;
}

/**
 * Fixed-capacity undo/redo stack for project-level edits across all writing & planning studios.
 */
export class ProjectHistoryStack<T> {
  private undoStack: HistoryEntry<T>[] = [];
  private redoStack: HistoryEntry<T>[] = [];
  private readonly maxEntries: number;
  private lastPushAt = 0;

  constructor(maxEntries = 45) {
    this.maxEntries = maxEntries;
  }

  pushSnapshot(previousState: T, label: string, coalesceMs = 0): void {
    const now = Date.now();
    if (
      coalesceMs > 0 &&
      this.undoStack.length > 0 &&
      now - this.lastPushAt < coalesceMs &&
      this.undoStack[this.undoStack.length - 1].label === label
    ) {
      // Preserve earliest state in the coalesced burst so Ctrl+Z reverts the burst cleanly
      this.lastPushAt = now;
      this.redoStack = [];
      return;
    }

    this.undoStack.push({
      label,
      state: structuredClone(previousState),
      timestamp: now,
    });
    if (this.undoStack.length > this.maxEntries) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.lastPushAt = now;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(currentState: T): HistoryEntry<T> | null {
    const prev = this.undoStack.pop();
    if (!prev) return null;
    this.redoStack.push({
      label: prev.label,
      state: structuredClone(currentState),
      timestamp: Date.now(),
    });
    return {
      label: prev.label,
      state: structuredClone(prev.state),
      timestamp: prev.timestamp,
    };
  }

  redo(currentState: T): HistoryEntry<T> | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push({
      label: next.label,
      state: structuredClone(currentState),
      timestamp: Date.now(),
    });
    return {
      label: next.label,
      state: structuredClone(next.state),
      timestamp: next.timestamp,
    };
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.lastPushAt = 0;
  }
}
