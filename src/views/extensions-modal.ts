import type { AppActions } from '../core/app-context';
import { getOsExtensionStatus, registerOsExtensions } from '../core/bridge';
import { BOOKVIBE_EXTENSIONS } from '../core/extensions';
import type { AssociationReport } from '../core/types';
import { el, icon } from '../ui/dom';

export async function showExtensionsModal(actions: AppActions): Promise<void> {
  const existing = document.getElementById('bv-extensions-modal');
  if (existing) existing.remove();

  let report: AssociationReport = await getOsExtensionStatus();

  const statusBanner = el('div', {
    className: 'bv-list-card',
    style: { background: 'var(--bg-bar)' },
  });

  const tableBody = el('tbody');

  const refreshView = (nextReport: AssociationReport) => {
    report = nextReport;
    statusBanner.replaceChildren(
      el(
        'div',
        {},
        el('div', {
          text: report.allRegistered
            ? 'All 6 Bookvibe extensions are active in your OS file shell'
            : `Platform: ${report.platform} · Scope: ${report.scope}`,
          style: { fontWeight: '600' },
        }),
        el('div', { className: 'bv-label', text: report.executablePath }),
      ),
      el(
        'button',
        {
          className: 'bv-btn bv-btn-primary',
          attrs: { type: 'button' },
          on: {
            click: async () => {
              const updated = await registerOsExtensions();
              refreshView(updated);
              actions.notify(
                updated.allRegistered
                  ? 'Registered all 6 Bookvibe extensions in OS shell.'
                  : 'Extension registration requires launching the compiled desktop executable.',
              );
            },
          },
        },
        icon('check', 14),
        'Register in OS Shell',
      ),
    );

    tableBody.replaceChildren();
    for (const spec of BOOKVIBE_EXTENSIONS) {
      const liveItem = report.items.find((i) => i.extension === spec.extension);
      const isOk = Boolean(liveItem?.registered);
      tableBody.appendChild(
        el(
          'tr',
          {},
          el('td', { className: 'bv-mono-tag', text: spec.extension, style: { color: 'var(--accent-ivory)', fontWeight: '600', whiteSpace: 'nowrap' } }),
          el('td', { className: 'bv-ext-desc-col' }, el('div', { text: spec.name, style: { fontWeight: '500', color: 'var(--text-primary)' } }), el('div', { className: 'bv-label', text: spec.purpose })),
          el('td', { className: 'bv-mono-tag', text: spec.mimeType }),
          el('td', { className: 'bv-mono-tag', text: spec.uti, style: { whiteSpace: 'nowrap' } }),
          el(
            'td',
            { style: { whiteSpace: 'nowrap' } },
            el('span', {
              className: 'bv-mono-tag',
              text: isOk ? 'Registered' : 'Spec Ready',
              style: { color: isOk ? 'var(--accent-emerald)' : 'var(--accent-amber)' },
            }),
          ),
          el(
            'td',
            {},
            el('button', {
              className: 'bv-mini-btn',
              text: 'Save',
              attrs: { type: 'button', title: `Export current project as ${spec.extension}` },
              on: { click: () => void actions.exportAsExtension(spec.extension) },
            }),
          ),
        ),
      );
    }
  };

  refreshView(report);

  const table = el(
    'table',
    { className: 'bv-table bv-ext-table' },
    el(
      'thead',
      {},
      el(
        'tr',
        {},
        el('th', { text: 'Ext' }),
        el('th', { text: 'Format' }),
        el('th', { text: 'Official IANA MIME' }),
        el('th', { text: 'Apple UTI' }),
        el('th', { text: 'OS Status' }),
        el('th', { text: 'Action' }),
      ),
    ),
    tableBody,
  );

  const closeModal = () => backdrop.remove();

  const modal = el(
    'div',
    { className: 'bv-modal', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Official Bookvibe File Extensions' } },
    el(
      'div',
      { className: 'bv-panel-head' },
      el('span', { className: 'bv-panel-title', text: 'Official Bookvibe File Extensions & OS Registration' }),
      el('button', {
        className: 'bv-mini-btn',
        text: 'Close',
        attrs: { type: 'button' },
        on: { click: closeModal },
      }),
    ),
    el(
      'div',
      { className: 'bv-modal-body' },
      statusBanner,
      el('div', { className: 'bv-table-wrap' }, table),
      el('p', {
        className: 'bv-label',
        text: 'Double-clicking any .bookvibe, .bvibe, .bvbook, .bvbible, .bvscene, or .bvstyle file in Windows Explorer, macOS Finder, or Linux Files launches Bookvibe directly into that file. Formal IANA RFC 6838 MIME templates and FreeDesktop shared-mime-info XML are included in docs/ and packaging/.',
      }),
    ),
  );

  const backdrop = el(
    'div',
    {
      className: 'bv-modal-backdrop',
      id: 'bv-extensions-modal',
      on: {
        click: (e) => {
          if (e.target === backdrop) closeModal();
        },
      },
    },
    modal,
  );

  document.body.appendChild(backdrop);
}
