import { uint8ArrayToBase64 } from './codec';
import {
  ALL_OFFICIAL_EXTENSIONS,
  LEGACY_IMPORT_EXTENSIONS,
  getExtensionDefinition,
} from './extensions';
import {
  buildEpubBlobBytes,
  buildEpubExportPayload,
  buildHtmlExport,
  buildMarkdownExport,
  buildPlainTextExport,
} from './export';
import type {
  AssociationReport,
  BookProject,
  ExportFormatId,
  LanSessionInfo,
  OpenedFileResult,
  QuillvibeExtension,
} from './types';

const LOCAL_STORAGE_KEY = 'quillvibe.activeProject.v2';
const LEGACY_LOCAL_STORAGE_KEY = 'bookvibe.activeProject.v1';
const LIBRARY_STORAGE_KEY = 'quillvibe.library.v2';
const LEGACY_LIBRARY_STORAGE_KEY = 'bookvibe.library.v1';
const DEFAULT_EXPORT_KEY = 'quillvibe.defaultExport.v2';
const LEGACY_DEFAULT_EXPORT_KEY = 'bookvibe.defaultExport.v1';

const VALID_EXPORT_FORMATS = new Set<string>([
  '.quillvibe',
  '.qvibe',
  '.qvbook',
  '.qvbible',
  '.qvscene',
  '.qvstyle',
  '.epub',
  '.md',
  '.html',
  '.txt',
]);

export function loadDefaultExportFormat(): ExportFormatId {
  try {
    const val =
      window.localStorage.getItem(DEFAULT_EXPORT_KEY) ??
      window.localStorage.getItem(LEGACY_DEFAULT_EXPORT_KEY);
    if (val && VALID_EXPORT_FORMATS.has(val)) return val as ExportFormatId;
  } catch {
    // Fallback cleanly
  }
  return '.quillvibe';
}

export function saveDefaultExportFormat(fmt: ExportFormatId): void {
  try {
    window.localStorage.setItem(DEFAULT_EXPORT_KEY, fmt);
  } catch {
    // Ignore quota issues
  }
}

export function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean((window as unknown as Record<string, unknown>).__TAURI_INTERNALS__)
  );
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

function triggerBrowserDownload(filename: string, data: BlobPart, mimeType: string): void {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function sanitizeSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'quillvibe-manuscript';
}

export async function getStartupOpenedFile(): Promise<OpenedFileResult | null> {
  if (!isTauriRuntime()) return null;
  try {
    return await tauriInvoke<OpenedFileResult | null>('get_startup_opened_file');
  } catch {
    return null;
  }
}

export async function loadPersistedProject(): Promise<string | null> {
  if (isTauriRuntime()) {
    try {
      const nativeData = await tauriInvoke<string | null>('load_default_project');
      if (nativeData) return nativeData;
    } catch {
      // Fallback safely to local storage
    }
  }
  try {
    return (
      window.localStorage.getItem(LOCAL_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export async function persistProject(serializedJson: string): Promise<void> {
  if (isTauriRuntime()) {
    try {
      await tauriInvoke('save_default_project', { payload: serializedJson });
    } catch {
      // Keep local backup below
    }
  }
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, serializedJson);
  } catch {
    // Storage quota exceeded or unavailable
  }
}

export async function loadPersistedLibrary(): Promise<string | null> {
  if (isTauriRuntime()) {
    try {
      const data = await tauriInvoke<string | null>('load_book_library');
      if (data) return data;
    } catch {
      // Fallback safely
    }
  }
  try {
    return (
      window.localStorage.getItem(LIBRARY_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_LIBRARY_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export async function persistLibrary(serializedLibraryJson: string): Promise<void> {
  if (isTauriRuntime()) {
    try {
      await tauriInvoke('save_book_library', { payload: serializedLibraryJson });
    } catch {
      // Keep local storage mirror
    }
  }
  try {
    window.localStorage.setItem(LIBRARY_STORAGE_KEY, serializedLibraryJson);
  } catch {
    // Storage quota exceeded or unavailable
  }
}

async function readPickedBrowserFile(file: File): Promise<OpenedFileResult> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const dotIdx = file.name.lastIndexOf('.');
  const ext = dotIdx >= 0 ? file.name.slice(dotIdx).toLowerCase() : '.quillvibe';
  const isBinary =
    bytes.length >= 4 &&
    bytes[0] === 0x51 &&
    bytes[1] === 0x56 &&
    bytes[2] === 0x42 &&
    bytes[3] === 0x58;

  return {
    path: file.name,
    filename: file.name,
    extension: ext,
    content: isBinary ? '' : new TextDecoder().decode(bytes),
    bytes,
    isBinary,
  };
}

export async function openQuillvibeFile(): Promise<OpenedFileResult | null> {
  if (isTauriRuntime()) {
    return tauriInvoke<OpenedFileResult | null>('open_quillvibe_file_dialog');
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = [...ALL_OFFICIAL_EXTENSIONS.map((item) => item.extension), '.qvext', '.bvext'].join(',');
    input.addEventListener(
      'change',
      async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        resolve(await readPickedBrowserFile(file));
      },
      { once: true },
    );
    input.click();
  });
}

export async function importLegacyBookFile(): Promise<OpenedFileResult | null> {
  if (isTauriRuntime()) {
    return tauriInvoke<OpenedFileResult | null>('import_legacy_book_dialog');
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = LEGACY_IMPORT_EXTENSIONS.map((item) => item.extension).join(',');
    input.addEventListener(
      'change',
      async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        resolve(await readPickedBrowserFile(file));
      },
      { once: true },
    );
    input.click();
  });
}

export async function saveQuillvibeExtensionFile(
  extension: QuillvibeExtension,
  binaryPayload: Uint8Array,
  suggestedBaseName: string,
): Promise<string | null> {
  const def = getExtensionDefinition(extension);
  const base = sanitizeSlug(suggestedBaseName);
  const fullName = `${base}${extension}`;

  if (isTauriRuntime()) {
    return tauriInvoke<string | null>('save_quillvibe_file_dialog', {
      payload: null,
      payloadBase64: uint8ArrayToBase64(binaryPayload),
      suggestedName: base,
      extension,
      description: def?.name ?? 'Quillvibe File',
    });
  }

  const copy = new Uint8Array(binaryPayload.byteLength);
  copy.set(binaryPayload);
  triggerBrowserDownload(fullName, copy.buffer, def?.mimeType ?? 'application/octet-stream');
  return fullName;
}

export async function exportBookAsEpub(
  project: BookProject,
  coverPngDataUrl?: string,
): Promise<string | null> {
  const base = sanitizeSlug(project.title);
  if (isTauriRuntime()) {
    const payload = buildEpubExportPayload(project, coverPngDataUrl);
    return tauriInvoke<string | null>('export_epub_file', {
      payload,
      suggestedName: base,
    });
  }

  const bytes = buildEpubBlobBytes(project, coverPngDataUrl);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  triggerBrowserDownload(`${base}.epub`, copy.buffer, 'application/epub+zip');
  return `${base}.epub`;
}

export async function exportBookAsMarkdown(project: BookProject): Promise<string | null> {
  const base = sanitizeSlug(project.title);
  const md = buildMarkdownExport(project);
  if (isTauriRuntime()) {
    return tauriInvoke<string | null>('export_markdown_file', {
      content: md,
      suggestedName: base,
    });
  }

  triggerBrowserDownload(`${base}.md`, md, 'text/markdown;charset=utf-8');
  return `${base}.md`;
}

export async function exportBookAsHtml(project: BookProject): Promise<string | null> {
  const base = sanitizeSlug(project.title);
  const html = buildHtmlExport(project);
  triggerBrowserDownload(`${base}.html`, html, 'text/html;charset=utf-8');
  return `${base}.html`;
}

export async function exportBookAsPlainText(project: BookProject): Promise<string | null> {
  const base = sanitizeSlug(project.title);
  const txt = buildPlainTextExport(project);
  triggerBrowserDownload(`${base}.txt`, txt, 'text/plain;charset=utf-8');
  return `${base}.txt`;
}

export function exportCoverPngDownload(pngDataUrl: string, bookTitle: string): void {
  const base = sanitizeSlug(bookTitle);
  const b64 = pngDataUrl.replace(/^data:image\/png;base64,/, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  triggerBrowserDownload(`${base}-cover.png`, bytes.buffer, 'image/png');
}

export async function registerOsExtensions(): Promise<AssociationReport> {
  if (isTauriRuntime()) {
    return tauriInvoke<AssociationReport>('register_file_associations');
  }
  return getOsExtensionStatus();
}

export async function getOsExtensionStatus(): Promise<AssociationReport> {
  if (isTauriRuntime()) {
    return tauriInvoke<AssociationReport>('get_file_association_status');
  }
  return {
    platform: 'browser-preview',
    executablePath: 'Launch native Quillvibe binary to write OS shell registry',
    scope: 'Requires Desktop Binary (quillvibe.exe / Quillvibe.app / AppImage)',
    allRegistered: false,
    items: ALL_OFFICIAL_EXTENSIONS.map((item) => ({
      extension: item.extension,
      name: item.name,
      mimeType: item.mimeType,
      uti: item.uti,
      progId: item.progId,
      registered: false,
      detail: 'Desktop app registers OS double-click handlers automatically.',
    })),
  };
}

// --- Offline Desktop-to-Desktop Collaboration (Same Wi-Fi LAN & Bluetooth / Nearby Share) ---

export interface BluetoothShareOptions {
  filePath?: string;
  mode?: 'send' | 'receive';
  filename?: string;
  payloadBytes?: Uint8Array;
  title?: string;
}

export async function startLanSyncHost(
  bookJson: string,
  hostName: string,
  port?: number,
): Promise<LanSessionInfo> {
  if (!isTauriRuntime()) {
    throw new Error('Direct Wi-Fi LAN hosting requires the native desktop executable.');
  }
  return tauriInvoke<LanSessionInfo>('start_lan_sync_host_cmd', {
    bookJson,
    hostName,
    port: port ?? null,
  });
}

export async function updateLanSyncHostBook(bookJson: string): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return tauriInvoke<boolean>('update_lan_sync_host_book_cmd', { bookJson });
}

export async function stopLanSyncHost(): Promise<void> {
  if (!isTauriRuntime()) return;
  await tauriInvoke('stop_lan_sync_host_cmd');
}

export async function getLanSyncStatus(): Promise<LanSessionInfo | null> {
  if (!isTauriRuntime()) return null;
  try {
    return await tauriInvoke<LanSessionInfo | null>('get_lan_sync_status_cmd');
  } catch {
    return null;
  }
}

export async function pollLanIncomingSync(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return tauriInvoke<string | null>('poll_lan_incoming_sync_cmd');
}

export async function pullFromLanPeer(peerAddr: string, pin: string): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error('LAN peer sync requires the native desktop executable.');
  }
  return tauriInvoke<string>('pull_book_from_lan_peer_cmd', { peerAddr: peerAddr.trim(), pin: pin.trim() });
}

export async function pushToLanPeer(
  peerAddr: string,
  pin: string,
  bookJson: string,
): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error('LAN peer sync requires the native desktop executable.');
  }
  return tauriInvoke<string>('push_book_to_lan_peer_cmd', {
    peerAddr: peerAddr.trim(),
    pin: pin.trim(),
    bookJson,
  });
}

export async function launchBluetoothShare(options?: BluetoothShareOptions): Promise<string> {
  const mode = options?.mode ?? 'send';
  if (isTauriRuntime()) {
    return tauriInvoke<string>('launch_os_bluetooth_share_cmd', {
      filePath: options?.filePath ?? null,
      mode,
    });
  }

  if (mode === 'receive') {
    return 'Receive the .quillvibe file via device Bluetooth or Nearby Share, then pick it with Open File.';
  }

  if (options?.payloadBytes && options?.filename) {
    const copy = new Uint8Array(options.payloadBytes.byteLength);
    copy.set(options.payloadBytes);
    triggerBrowserDownload(options.filename, copy.buffer, 'application/octet-stream');
    return 'Downloaded .quillvibe package.';
  }

  return 'Save the .quillvibe package and share it via Bluetooth, AirDrop, or Nearby Share.';
}

export async function minimizeDesktopWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().minimize();
}

export async function toggleMaximizeDesktopWindow(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const win = getCurrentWindow();
  await win.toggleMaximize();
  return win.isMaximized();
}

export async function isDesktopWindowMaximized(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return getCurrentWindow().isMaximized();
}

export async function closeDesktopWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().close();
}

export async function startDesktopWindowDrag(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().startDragging();
}

export async function setDesktopWindowTitle(title: string): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().setTitle(title || 'Quillvibe');
  } catch {
    // Ignore window title errors on unsupported shells
  }
}

export async function setDesktopFullscreen(fullscreen: boolean): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    await win.setFullscreen(fullscreen);
    return await win.isFullscreen();
  } catch {
    return fullscreen;
  }
}

export async function isDesktopFullscreen(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    return await getCurrentWindow().isFullscreen();
  } catch {
    return false;
  }
}

export async function openBookInNewDesktopWindow(
  bookId?: string,
  title?: string,
): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    await tauriInvoke<string>('open_book_in_new_window', {
      bookId: bookId ?? null,
      title: title ?? 'Quillvibe',
    });
    return true;
  } catch {
    return false;
  }
}
