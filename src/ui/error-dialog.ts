import { el, icon } from './dom';

export interface QuillvibeErrorEntry {
  code: string;
  platform: 'both' | 'web' | 'desktop';
  category: 'File & Open' | 'Export & Print' | 'Sync & Windows' | 'Images & Cover' | 'Storage & Runtime';
  title: string;
  cause: string;
  fix: string;
}

export const QUILLVIBE_ERROR_CATALOG: readonly QuillvibeErrorEntry[] = [
  {
    code: 'QV-101',
    platform: 'both',
    category: 'File & Open',
    title: 'Unsupported or Legacy File Extension',
    cause: 'You attempted to open a file whose extension is not one of the four active Quillvibe formats (.qv, .qvbible, .qvscene, .qvstyle) or an older legacy archive (.quillvibe, .bookvibe, .bv*).',
    fix: 'Use Settings -> Publishing & Archive -> Import Legacy Archive to upgrade older files into .qv, or use Import .docx / .html / .md for external manuscripts.',
  },
  {
    code: 'QV-102',
    platform: 'both',
    category: 'File & Open',
    title: 'Incorrect Password or Damaged Protected File',
    cause: 'The password entered for a password-locked .qv archive did not match, or the encrypted file was altered outside Quillvibe.',
    fix: 'Check Caps Lock and re-enter the exact password used during export. If the file was edited in another text editor, restore a clean .qv backup.',
  },
  {
    code: 'QV-103',
    platform: 'both',
    category: 'File & Open',
    title: 'Integrity Seal or Safety Check Failed',
    cause: 'Quillvibe detected tampered binary headers, a mismatched Author Key seal, or unsafe active script content inside an imported file.',
    fix: 'Do not trust modified archives from unknown sources. Ask the original author to re-export a fresh .qv package directly from Quillvibe.',
  },
  {
    code: 'QV-104',
    platform: 'both',
    category: 'File & Open',
    title: 'Could Not Load Selected File',
    cause: 'The file could not be read from disk or parsed into the active workspace (for example, a zero-byte file, missing scene payload, or OS permission lock).',
    fix: 'Confirm the file exists, is under 50 MB, and is not locked by another program, then try opening it again via File Open (Ctrl+O).',
  },
  {
    code: 'QV-201',
    platform: 'both',
    category: 'Export & Print',
    title: 'Book Export or Print PDF Failed',
    cause: 'Exporting a .qv, .pdf, .epub, .md, or migration archive failed due to restricted collaborator permissions, a canceled save dialog, or invalid cover artwork.',
    fix: 'Verify your active role allows exports (Collaborate -> Permissions), ensure your disk has free space, and retry the export.',
  },
  {
    code: 'QV-202',
    platform: 'both',
    category: 'Images & Cover',
    title: 'Image Upload or Background Removal Failed',
    cause: 'An unsupported image format, corrupted image bytes, or an oversized bitmap prevented canvas decoding or background removal.',
    fix: 'Use standard PNG, JPEG, or WebP images under 12 MB. If background removal appears uneven, adjust the tolerance slider or click Restore Original.',
  },
  {
    code: 'QV-301',
    platform: 'desktop',
    category: 'Sync & Windows',
    title: 'Desktop Window or Tab Action Failed',
    cause: 'The operating system window manager rejected creating, focusing, or moving a native desktop window.',
    fix: 'Wait a moment and retry Ctrl+Shift+N or click Tabs Menu -> Combine All Windows Here. Restart Quillvibe if the OS desktop compositor stalled.',
  },
  {
    code: 'QV-302',
    platform: 'both',
    category: 'Sync & Windows',
    title: 'LAN Wi-Fi, Bluetooth, or Website Sync Error',
    cause: 'The peer IP address or 6-digit PIN did not match, a firewall blocked the local port, or the self-hosted HTTPS server rejected the request.',
    fix: 'Confirm both devices are on the same local Wi-Fi network, verify the 6-digit PIN, and ensure self-hosted sync URLs use valid HTTPS.',
  },
  {
    code: 'QV-303',
    platform: 'desktop',
    category: 'Sync & Windows',
    title: 'Desktop Tab Tear-Off or Window Merge Interrupted',
    cause: 'Moving a detached tab window or merging a torn-off tab back into an existing Quillvibe window failed because the target window closed mid-drag.',
    fix: 'Open Tabs Menu -> Combine All Windows Here to consolidate open book tabs safely into one window.',
  },
  {
    code: 'QV-401',
    platform: 'both',
    category: 'Images & Cover',
    title: 'Book Cover Studio Render Issue',
    cause: 'A custom font or uploaded cover asset failed to load while rendering the high-resolution cover canvas.',
    fix: 'Re-select a built-in or installed local font in Settings -> Typefaces & Fonts, or re-upload the cover image.',
  },
  {
    code: 'QV-402',
    platform: 'both',
    category: 'Images & Cover',
    title: 'Book Cover Export Failed (PNG / JPEG / Vector SVG)',
    cause: 'A cover image or embedded graphic layer failed canvas serialization when exporting 1x/2x/3x PNG, transparent PNG, JPEG, or SVG.',
    fix: 'Inspect the failing layer in the Layers tab, toggle visibility to test, or re-upload the image file.',
  },
  {
    code: 'QV-403',
    platform: 'both',
    category: 'File & Open',
    title: 'Story Graph Canvas Import / Export Failed',
    cause: 'An imported .canvas JSON file was malformed or contained invalid node/edge references.',
    fix: 'Confirm the .canvas file contains valid JSON arrays for nodes and edges, then retry importing.',
  },
  {
    code: 'QV-501',
    platform: 'web',
    category: 'Storage & Runtime',
    title: 'Browser Storage Quota Reached',
    cause: 'Your browser ran out of local storage space—commonly caused by placing many large uncompressed images inside manuscripts in browser mode.',
    fix: 'Click Save to download a .qv backup immediately, remove unused high-resolution images, or switch to the desktop installer which saves directly to disk.',
  },
  {
    code: 'QV-502',
    platform: 'both',
    category: 'Storage & Runtime',
    title: 'Unexpected Application Error',
    cause: 'An unhandled runtime error occurred during rendering or interaction.',
    fix: 'Copy the error report below and email quillvibe@jhonrey.com with what you clicked right before it happened. Your saved .qv data remains safe.',
  },
  {
    code: 'QV-503',
    platform: 'both',
    category: 'Storage & Runtime',
    title: 'Unexpected Background Task Error',
    cause: 'An asynchronous operation (such as saving, decoding, or syncing) failed unexpectedly.',
    fix: 'Retry your last action. If it repeats, copy the report below and send it to quillvibe@jhonrey.com.',
  },
  {
    code: 'QV-504',
    platform: 'desktop',
    category: 'Storage & Runtime',
    title: 'Operating System Installer Warning Prompt',
    cause: 'Windows, macOS, or Linux displayed an unrecognized publisher prompt when launching the installer because Quillvibe is a new open-source app without a paid commercial app-store certificate.',
    fix: 'Choose More Info -> Run Anyway (Windows) or Open Anyway in Privacy & Security (macOS), or use the web version at https://quillvibe.jhonrey.com/ with no installation.',
  },
];

export interface ShowErrorDialogOptions {
  code: string;
  title?: string;
  message: string;
  details?: string;
  onOpenHelp?: (query: string) => void;
}

let activeErrorDialogOpen = false;
let globalHandlersInstalled = false;

export function showErrorDialog(options: ShowErrorDialogOptions): void {
  if (typeof document === 'undefined') return;
  const catalogMatch = QUILLVIBE_ERROR_CATALOG.find((e) => e.code === options.code);
  const title = options.title || catalogMatch?.title || 'Something Went Wrong';
  const fixHint =
    catalogMatch?.fix ||
    'Try the action again. If the issue keeps happening, copy the report below and email quillvibe@jhonrey.com.';

  document.getElementById('qv-error-dialog-backdrop')?.remove();
  activeErrorDialogOpen = true;

  const close = () => {
    activeErrorDialogOpen = false;
    backdrop.remove();
  };

  const reportPayload = [
    `Quillvibe Error Report`,
    `Error Code: ${options.code}`,
    `Title: ${title}`,
    `Message: ${options.message}`,
    `Platform: ${typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window ? 'Desktop App' : 'Web Browser'}`,
    `URL: ${typeof window !== 'undefined' ? window.location.href : 'n/a'}`,
    `Viewport: ${typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'n/a'}`,
    `Time: ${new Date().toISOString()}`,
    options.details ? `Details:\n${options.details}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const copyBtn = el(
    'button',
    {
      className: 'bv-btn',
      attrs: { type: 'button' },
      on: {
        click: () => {
          void navigator.clipboard?.writeText(reportPayload);
          copyBtn.textContent = 'Copied Report';
          window.setTimeout(() => {
            copyBtn.textContent = 'Copy Error Report';
          }, 2200);
        },
      },
    },
    'Copy Error Report',
  );

  const detailsBox = options.details
    ? el(
        'details',
        { className: 'qv-error-details' },
        el('summary', { text: 'Technical details (helpful when reporting)' }),
        el('pre', { text: options.details }),
      )
    : null;

  const backdrop = el(
    'div',
    {
      className: 'bv-modal-backdrop',
      id: 'qv-error-dialog-backdrop',
      on: {
        click: (e) => {
          if (e.target === backdrop) close();
        },
      },
    },
    el(
      'div',
      {
        className: 'bv-modal qv-error-modal',
        style: { maxWidth: '520px' },
        attrs: { role: 'alertdialog', 'aria-modal': 'true', 'aria-label': `Error ${options.code}: ${title}` },
      },
      el(
        'div',
        { className: 'bv-panel-head' },
        el(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          el('span', { className: 'qv-error-code-pill', text: options.code }),
          el('span', { className: 'bv-panel-title', text: title }),
        ),
        el('button', {
          className: 'bv-mini-btn',
          text: 'Close',
          attrs: { type: 'button' },
          on: { click: close },
        }),
      ),
      el(
        'div',
        { className: 'bv-modal-body', style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        el('p', {
          text: options.message,
          style: { margin: '0', fontSize: '13.5px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: '1.5' },
        }),
        el(
          'div',
          { className: 'qv-error-fix-box' },
          el('strong', { text: 'Suggested Fix: ' }),
          el('span', { text: fixHint }),
        ),
        detailsBox,
        el('p', {
          className: 'bv-label',
          text: 'Need help or want to report this issue? Copy the report and email quillvibe@jhonrey.com.',
          style: { margin: '0' },
        }),
        el(
          'div',
          { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' } },
          options.onOpenHelp
            ? el(
                'button',
                {
                  className: 'bv-btn',
                  attrs: { type: 'button' },
                  on: {
                    click: () => {
                      close();
                      options.onOpenHelp?.(options.code);
                    },
                  },
                },
                icon('help', 13),
                'View in Help & FAQ',
              )
            : null,
          copyBtn,
          el('button', {
            className: 'bv-btn bv-btn-primary',
            text: 'Dismiss',
            attrs: { type: 'button' },
            on: { click: close },
          }),
        ),
      ),
    ),
  );

  document.body.appendChild(backdrop);
}

export function installGlobalErrorHandlers(onOpenHelp?: (query: string) => void): void {
  if (typeof window === 'undefined' || globalHandlersInstalled) return;
  globalHandlersInstalled = true;

  window.addEventListener('error', (ev) => {
    if (activeErrorDialogOpen) return;
    const msg = ev.message || 'An unexpected error occurred in Quillvibe.';
    if (msg.includes('ResizeObserver loop')) return;
    const isQuota = /quota|storage/i.test(msg);
    const details = ev.error instanceof Error ? ev.error.stack || ev.error.message : `${ev.filename || ''}:${ev.lineno || 0}`;
    showErrorDialog({
      code: isQuota ? 'QV-501' : 'QV-502',
      message: msg,
      details,
      onOpenHelp,
    });
  });

  window.addEventListener('unhandledrejection', (ev) => {
    if (activeErrorDialogOpen) return;
    const reason = ev.reason;
    const msg =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
          ? reason
          : 'An unexpected background operation failed.';
    if (/AbortError|ResizeObserver/i.test(msg)) return;
    const isQuota = /quota|storage/i.test(msg);
    const details = reason instanceof Error ? reason.stack || reason.message : String(reason ?? '');
    showErrorDialog({
      code: isQuota ? 'QV-501' : 'QV-503',
      message: msg,
      details,
      onOpenHelp,
    });
  });
}
