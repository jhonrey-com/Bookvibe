import { safeJsonParse } from './extensions';
import type { BookProject } from './types';

const CHANNEL_NAME = 'quillvibe-workspace-sync';
const PRESENCE_KEY = 'quillvibe.windowPresence.v1';
const PRESENCE_TTL_MS = 12_000;

export const EMPTY_TAB_PREFIX = '__qv_new_tab__';
export const COURSE_TAB_ID = '__qv_course_tab__';
export const HELP_TAB_ID = '__qv_help_tab__';
export const DEVELOPER_TAB_ID = '__qv_developer_tab__';

export function isEmptyTabId(tabId: string | null | undefined): boolean {
  return Boolean(tabId && tabId.startsWith(EMPTY_TAB_PREFIX));
}

export function isSpecialPageTabId(tabId: string | null | undefined): boolean {
  return tabId === COURSE_TAB_ID || tabId === HELP_TAB_ID || tabId === DEVELOPER_TAB_ID;
}

export function isNonBookTabId(tabId: string | null | undefined): boolean {
  return isEmptyTabId(tabId) || isSpecialPageTabId(tabId);
}

export function createEmptyTabId(): string {
  return `${EMPTY_TAB_PREFIX}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface WindowPresenceRecord {
  windowId: string;
  openBookIds: string[];
  activeBookId: string;
  updatedAt: number;
}

export type SyncMessage =
  | {
      type: 'book-updated';
      sourceWindowId: string;
      bookId: string;
      rev: number;
      project: BookProject;
    }
  | {
      type: 'tab-transferred';
      fromWindowId: string;
      toWindowId: string;
      bookId: string;
    }
  | {
      type: 'tab-drop-into';
      targetWindowLabel: string;
      fromWindowId: string;
      bookId: string;
      insertionIndex?: number;
    }
  | {
      type: 'merge-all-into';
      targetWindowId: string;
    }
  | {
      type: 'merge-offer';
      fromWindowId: string;
      targetWindowId: string;
      bookIds: string[];
    }
  | {
      type: 'merge-ack';
      fromWindowId: string;
      targetWindowId: string;
    };

export interface WindowSyncCallbacks {
  getWindowLabel(): string;
  getOpenBookIds(): string[];
  getActiveBookId(): string;
  onRemoteBookUpdated(bookId: string, project: BookProject, rev: number): void;
  onTabTransferredAway(bookId: string): void;
  onTabDroppedIntoMe(fromWindowId: string, bookId: string, insertionIndex?: number): void;
  onMergeRequested(targetWindowId: string): void;
  onMergeOfferReceived(fromWindowId: string, bookIds: string[]): void;
  onMergeAcknowledged(): void;
}

export class WorkspaceWindowSync {
  readonly windowId: string;
  private channel: BroadcastChannel | null = null;
  private callbacks: WindowSyncCallbacks;
  private heartbeatTimer: number | null = null;
  private revByBook = new Map<string, number>();
  private revSeq = 0;

  constructor(callbacks: WindowSyncCallbacks) {
    this.windowId = `win-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.callbacks = callbacks;

    if (typeof window !== 'undefined') {
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          this.channel = new BroadcastChannel(CHANNEL_NAME);
          this.channel.onmessage = (ev: MessageEvent<SyncMessage>) => {
            this.handleMessage(ev.data);
          };
        } catch {
          this.channel = null;
        }
      }

      this.publishPresence();
      this.heartbeatTimer = window.setInterval(() => this.publishPresence(), 4000);
      window.addEventListener('beforeunload', this.handleUnload);
    }
  }

  private handleUnload = (): void => {
    this.removePresence();
  };

  destroy(): void {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.handleUnload);
    }
    this.removePresence();
    this.channel?.close();
    this.channel = null;
  }

  private readPresenceMap(): Record<string, WindowPresenceRecord> {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    try {
      const raw = window.localStorage.getItem(PRESENCE_KEY);
      if (!raw) return {};
      const parsed = safeJsonParse<Record<string, WindowPresenceRecord>>(raw);
      const now = Date.now();
      const fresh: Record<string, WindowPresenceRecord> = {};
      for (const [k, rec] of Object.entries(parsed)) {
        if (rec && typeof rec.updatedAt === 'number' && now - rec.updatedAt < PRESENCE_TTL_MS) {
          fresh[k] = rec;
        }
      }
      return fresh;
    } catch {
      return {};
    }
  }

  publishPresence(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const map = this.readPresenceMap();
      map[this.windowId] = {
        windowId: this.windowId,
        openBookIds: this.callbacks.getOpenBookIds().filter((id) => !isNonBookTabId(id)),
        activeBookId: isNonBookTabId(this.callbacks.getActiveBookId()) ? '' : this.callbacks.getActiveBookId(),
        updatedAt: Date.now(),
      };
      window.localStorage.setItem(PRESENCE_KEY, JSON.stringify(map));
    } catch {
      // Ignore storage quota errors
    }
  }

  private removePresence(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const map = this.readPresenceMap();
      delete map[this.windowId];
      window.localStorage.setItem(PRESENCE_KEY, JSON.stringify(map));
    } catch {
      // Ignore storage errors
    }
  }

  getOtherWindowsWithBook(bookId: string): WindowPresenceRecord[] {
    if (!bookId || isEmptyTabId(bookId)) return [];
    const map = this.readPresenceMap();
    return Object.values(map).filter(
      (rec) => rec.windowId !== this.windowId && rec.openBookIds.includes(bookId),
    );
  }

  getOtherOpenWindowCount(): number {
    const map = this.readPresenceMap();
    return Object.values(map).filter((rec) => rec.windowId !== this.windowId).length;
  }

  nextRevisionFor(bookId: string): number {
    this.revSeq = (this.revSeq + 1) % 1000;
    const candidate = Date.now() * 1000 + this.revSeq;
    const prev = this.revByBook.get(bookId) ?? 0;
    const next = Math.max(candidate, prev + 1);
    this.revByBook.set(bookId, next);
    return next;
  }

  isRevisionNewer(bookId: string, rev: number): boolean {
    const prev = this.revByBook.get(bookId) ?? 0;
    return rev > prev;
  }

  markRevision(bookId: string, rev: number): void {
    const prev = this.revByBook.get(bookId) ?? 0;
    if (rev > prev) this.revByBook.set(bookId, rev);
  }

  broadcastBookUpdated(bookId: string, project: BookProject): number {
    const rev = this.nextRevisionFor(bookId);
    this.post({
      type: 'book-updated',
      sourceWindowId: this.windowId,
      bookId,
      rev,
      project,
    });
    return rev;
  }

  notifyTabTransferred(fromWindowId: string, bookId: string): void {
    this.post({
      type: 'tab-transferred',
      fromWindowId,
      toWindowId: this.windowId,
      bookId,
    });
  }

  sendTabDropIntoWindow(targetWindowLabel: string, bookId: string, insertionIndex?: number): void {
    this.post({
      type: 'tab-drop-into',
      targetWindowLabel,
      fromWindowId: this.windowId,
      bookId,
      insertionIndex,
    });
  }

  requestMergeAllWindowsHere(): void {
    this.post({
      type: 'merge-all-into',
      targetWindowId: this.windowId,
    });
  }

  sendMergeOffer(targetWindowId: string, bookIds: string[]): void {
    this.post({
      type: 'merge-offer',
      fromWindowId: this.windowId,
      targetWindowId,
      bookIds,
    });
  }

  sendMergeAck(fromWindowId: string): void {
    this.post({
      type: 'merge-ack',
      fromWindowId,
      targetWindowId: this.windowId,
    });
  }

  private post(msg: SyncMessage): void {
    try {
      this.channel?.postMessage(msg);
    } catch {
      // Ignore closed channel errors
    }
  }

  private handleMessage(msg: SyncMessage | null | undefined): void {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'book-updated') {
      if (msg.sourceWindowId === this.windowId) return;
      if (!this.isRevisionNewer(msg.bookId, msg.rev)) return;
      this.markRevision(msg.bookId, msg.rev);
      this.callbacks.onRemoteBookUpdated(msg.bookId, msg.project, msg.rev);
    } else if (msg.type === 'tab-transferred') {
      if (msg.fromWindowId === this.windowId && msg.toWindowId !== this.windowId) {
        this.callbacks.onTabTransferredAway(msg.bookId);
      }
    } else if (msg.type === 'tab-drop-into') {
      if (
        msg.fromWindowId !== this.windowId &&
        msg.targetWindowLabel === this.callbacks.getWindowLabel()
      ) {
        this.callbacks.onTabDroppedIntoMe(msg.fromWindowId, msg.bookId, msg.insertionIndex);
      }
    } else if (msg.type === 'merge-all-into') {
      if (msg.targetWindowId !== this.windowId) {
        this.callbacks.onMergeRequested(msg.targetWindowId);
      }
    } else if (msg.type === 'merge-offer') {
      if (msg.targetWindowId === this.windowId && msg.fromWindowId !== this.windowId) {
        this.callbacks.onMergeOfferReceived(msg.fromWindowId, msg.bookIds);
      }
    } else if (msg.type === 'merge-ack') {
      if (msg.fromWindowId === this.windowId) {
        this.callbacks.onMergeAcknowledged();
      }
    }
  }
}
