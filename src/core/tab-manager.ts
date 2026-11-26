import {
  COURSE_TAB_ID,
  EXTENSIONS_TAB_ID,
  HELP_TAB_ID,
  MANUAL_TAB_ID,
  SETTINGS_TAB_ID,
  isEmptyTabId,
  isNonBookTabId,
} from './window-sync';

export type TabKind = 'book' | 'empty' | 'course' | 'help' | 'settings' | 'manual' | 'extensions';

export interface TabRecord {
  id: string;
  kind: TabKind;
  projectId?: string;
  isPinned?: boolean;
}

export interface PersistedTabOrder {
  tabIds: string[];
  activeTabId?: string;
}

export const DESKTOP_TAB_ORDER_STORAGE_KEY = 'quillvibe.desktop.tabOrder.v1';

export function classifyTabKind(tabId: string): TabKind {
  if (tabId === COURSE_TAB_ID) return 'course';
  if (tabId === HELP_TAB_ID) return 'help';
  if (tabId === SETTINGS_TAB_ID) return 'settings';
  if (tabId === MANUAL_TAB_ID) return 'manual';
  if (tabId === EXTENSIONS_TAB_ID) return 'extensions';
  if (isEmptyTabId(tabId)) return 'empty';
  return 'book';
}

function makeTabRecord(tabId: string, existing?: TabRecord, isPinned?: boolean): TabRecord {
  const kind = classifyTabKind(tabId);
  return {
    id: tabId,
    kind,
    projectId: kind === 'book' ? tabId : undefined,
    isPinned: isPinned ?? existing?.isPinned ?? false,
  };
}

/**
 * Single source of truth for desktop tab identity, ordering, activation, and close fallbacks.
 */
export class TabManager {
  private records: TabRecord[] = [];
  private activeTabId = '';

  constructor(initialTabIds: string[] = [], activeTabId = '') {
    this.setOrder(initialTabIds, { persist: false });
    if (activeTabId && this.hasTab(activeTabId)) {
      this.activeTabId = activeTabId;
    } else {
      this.activeTabId = this.records[0]?.id ?? '';
    }
  }

  getTabs(): readonly TabRecord[] {
    return this.records.map((rec) => ({ ...rec }));
  }

  getTabIds(): string[] {
    return this.records.map((rec) => rec.id);
  }

  getActiveTabId(): string {
    return this.activeTabId;
  }

  hasTab(tabId: string): boolean {
    return this.records.some((rec) => rec.id === tabId);
  }

  setActiveTabId(tabId: string): void {
    this.activeTabId = tabId;
  }

  setOrder(
    nextIds: string[],
    options?: { persist?: boolean; windowLabel?: string },
  ): string[] {
    const existingById = new Map(this.records.map((rec) => [rec.id, rec]));
    const seen = new Set<string>();
    const nextRecords: TabRecord[] = [];
    for (const rawId of nextIds) {
      if (!rawId || seen.has(rawId)) continue;
      seen.add(rawId);
      nextRecords.push(makeTabRecord(rawId, existingById.get(rawId)));
    }
    this.records = nextRecords;
    if (this.records.length > 0 && !seen.has(this.activeTabId)) {
      this.activeTabId = this.records[0].id;
    }
    if (options?.persist !== false && options?.windowLabel) {
      this.savePersistedOrder(options.windowLabel);
    }
    return this.getTabIds();
  }

  reorderTab(sourceId: string, targetIndex: number): string[] {
    const curIndex = this.records.findIndex((rec) => rec.id === sourceId);
    if (curIndex === -1) return this.getTabIds();
    const clampedTarget = Math.max(0, Math.min(this.records.length - 1, targetIndex));
    if (clampedTarget === curIndex) return this.getTabIds();

    const next = [...this.records];
    const [moved] = next.splice(curIndex, 1);
    next.splice(clampedTarget, 0, moved);
    this.records = next;
    return this.getTabIds();
  }

  openTab(
    tabId: string,
    options?: { activate?: boolean; insertAt?: number; isPinned?: boolean },
  ): string[] {
    if (!tabId) return this.getTabIds();
    const existingIdx = this.records.findIndex((rec) => rec.id === tabId);
    if (existingIdx !== -1) {
      if (typeof options?.insertAt === 'number') {
        const clamped = Math.max(0, Math.min(this.records.length - 1, options.insertAt));
        this.reorderTab(tabId, clamped);
      }
      if (options?.activate !== false) {
        this.activeTabId = tabId;
      }
      return this.getTabIds();
    }

    const rec = makeTabRecord(tabId, undefined, options?.isPinned);
    const next = [...this.records];
    if (typeof options?.insertAt === 'number') {
      const clamped = Math.max(0, Math.min(next.length, options.insertAt));
      next.splice(clamped, 0, rec);
    } else {
      next.push(rec);
    }
    this.records = next;
    if (options?.activate !== false) {
      this.activeTabId = tabId;
    }
    return this.getTabIds();
  }

  replaceTab(
    oldId: string,
    newId: string,
    options?: { activate?: boolean },
  ): string[] {
    if (!newId) return this.getTabIds();
    const oldIdx = this.records.findIndex((rec) => rec.id === oldId);
    if (oldIdx === -1) {
      return this.openTab(newId, { activate: options?.activate });
    }
    if (this.hasTab(newId) && newId !== oldId) {
      this.records = this.records.filter((rec) => rec.id !== oldId);
    } else {
      const next = [...this.records];
      next[oldIdx] = makeTabRecord(newId);
      this.records = next;
    }
    if (options?.activate !== false || this.activeTabId === oldId) {
      this.activeTabId = newId;
    }
    return this.getTabIds();
  }

  closeTab(tabId: string): {
    closed: boolean;
    nextActiveId: string;
    closedIndex: number;
    tabIds: string[];
  } {
    if (this.records.length <= 1) {
      return {
        closed: false,
        nextActiveId: this.activeTabId,
        closedIndex: -1,
        tabIds: this.getTabIds(),
      };
    }
    const idx = this.records.findIndex((rec) => rec.id === tabId);
    if (idx === -1) {
      return {
        closed: false,
        nextActiveId: this.activeTabId,
        closedIndex: -1,
        tabIds: this.getTabIds(),
      };
    }

    const nextRecords = this.records.filter((rec) => rec.id !== tabId);
    const nextActiveId =
      this.activeTabId === tabId
        ? nextRecords[Math.max(0, idx - 1)]?.id ?? nextRecords[0]?.id ?? ''
        : this.activeTabId;

    this.records = nextRecords;
    this.activeTabId = nextActiveId;
    return {
      closed: true,
      nextActiveId,
      closedIndex: idx,
      tabIds: this.getTabIds(),
    };
  }

  prune(isValid: (tabId: string) => boolean, fallbackId: string): string[] {
    const filtered = this.records.filter(
      (rec) => isNonBookTabId(rec.id) || isValid(rec.id),
    );
    if (filtered.length === 0 && fallbackId) {
      filtered.push(makeTabRecord(fallbackId));
    }
    this.records = filtered;
    if (this.records.length > 0 && !this.hasTab(this.activeTabId)) {
      this.activeTabId = this.records[0].id;
    }
    return this.getTabIds();
  }

  loadPersistedOrder(windowLabel: string): PersistedTabOrder | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const raw = window.localStorage.getItem(DESKTOP_TAB_ORDER_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, PersistedTabOrder>;
      const entry = parsed?.[windowLabel];
      if (!entry || !Array.isArray(entry.tabIds)) return null;
      const cleanIds = entry.tabIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
      if (cleanIds.length === 0) return null;
      return {
        tabIds: cleanIds,
        activeTabId: typeof entry.activeTabId === 'string' ? entry.activeTabId : undefined,
      };
    } catch {
      return null;
    }
  }

  savePersistedOrder(windowLabel: string): void {
    if (!windowLabel || typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = window.localStorage.getItem(DESKTOP_TAB_ORDER_STORAGE_KEY);
      const map: Record<string, PersistedTabOrder> = raw ? (JSON.parse(raw) as Record<string, PersistedTabOrder>) : {};
      map[windowLabel] = {
        tabIds: this.getTabIds(),
        activeTabId: this.activeTabId,
      };
      window.localStorage.setItem(DESKTOP_TAB_ORDER_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // Ignore storage quota errors
    }
  }
}
