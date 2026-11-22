import type { AppActions } from '../core/app-context';
import { BOOKVIBE_EXTENSIONS } from '../core/extensions';
import { el, icon } from '../ui/dom';
import { ICON_DIRECTORY, type IconDirectoryEntry } from '../ui/icon-directory';

export type HelpTab = 'tour' | 'icons' | 'guides' | 'reference';

const HELP_TABS: Array<{ id: HelpTab; label: string }> = [
  { id: 'tour', label: 'Guided Walkthrough' },
  { id: 'icons', label: 'Icon Legend' },
  { id: 'guides', label: 'Basic to Pro Guides' },
  { id: 'reference', label: 'Formats & Shortcuts' },
];

const SHORTCUT_LIST: Array<{ keys: string; action: string }> = [
  { keys: 'Ctrl / Cmd + S', action: 'Capture a Revision Snapshot in Manuscript view, or export default file elsewhere' },
  { keys: 'Ctrl / Cmd + O', action: 'Open any .bookvibe, .bvibe, .bvbook, .bvbible, .bvscene, .bvstyle, or .bvext file' },
  { keys: 'Ctrl / Cmd + B / I', action: 'Wrap selected draft prose in **bold** or *italic* Markdown' },
  { keys: 'Ctrl / Cmd + Shift + F', action: 'Toggle Zen Focus Mode (hides binder and inspector sidebars)' },
  { keys: 'F1', action: 'Open or focus the Bookvibe Help manual' },
  { keys: 'Esc', action: 'Close open dialogs, exit active walkthrough, or leave Zen Focus Mode' },
  { keys: 'Mouse Wheel (Story Graph)', action: 'Zoom smoothly toward or away from graph nodes around cursor' },
  { keys: 'Drag Node Port ● (Graph)', action: 'Draw a live relationship line directly onto another graph card' },
];

export function showHelpModal(actions: AppActions, initialTab: HelpTab = 'tour'): void {
  const existing = document.getElementById('bv-help-modal');
  if (existing) existing.remove();

  let activeTab: HelpTab = initialTab;
  let iconSearch = '';
  let locationFilter: 'All' | IconDirectoryEntry['location'] = 'All';

  const tabBar = el('div', { className: 'bv-modal-tab-strip', attrs: { role: 'tablist' } });
  const bodyWrap = el('div', { className: 'bv-modal-scroll-area' });

  const closeModal = () => {
    backdrop.remove();
  };

  const renderTabs = () => {
    tabBar.textContent = '';
    for (const tab of HELP_TABS) {
      tabBar.appendChild(
        el('button', {
          className: `bv-fmt-btn${activeTab === tab.id ? ' is-active' : ''}`,
          text: tab.label,
          attrs: { type: 'button', role: 'tab', 'aria-selected': String(activeTab === tab.id) },
          on: {
            click: () => {
              activeTab = tab.id;
              renderTabs();
              renderBody();
            },
          },
        }),
      );
    }
  };

  const renderBody = () => {
    bodyWrap.textContent = '';
    const state = actions.getState();

    if (activeTab === 'tour') {
      const tourChk = el('input', {
        attrs: { type: 'checkbox', checked: state.settings.showOnboardingHints },
        on: {
          change: () => actions.updateSettings({ showOnboardingHints: tourChk.checked }),
        },
      });

      bodyWrap.append(
        el(
          'section',
          { className: 'bv-cork-card' },
          el('span', { className: 'bv-panel-title', text: 'Bookvibe First-Visit Walkthroughs' }),
          el('p', {
            className: 'bv-label',
            text: 'Each workspace opens with a short animated pointer guide on your first visit. You can replay every guide from the beginning or pause hints at any time.',
          }),
          el(
            'div',
            { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginTop: '6px' } },
            el(
              'label',
              { className: 'bv-check-row' },
              tourChk,
              el('span', { text: 'Show animated tour on first entry to each section' }),
            ),
            el(
              'button',
              {
                className: 'bv-btn bv-btn-primary',
                attrs: { type: 'button' },
                on: {
                  click: () => {
                    closeModal();
                    actions.replayWalkthrough();
                  },
                },
              },
              icon('help', 14),
              'Replay Section Walkthrough',
            ),
          ),
        ),
        el(
          'div',
          { className: 'bv-two-col' },
          el(
            'section',
            { className: 'bv-cork-card' },
            el('span', { className: 'bv-panel-title', text: 'Quick Jump Across Studio Views' }),
            el(
              'div',
              { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' } },
              ...[
                { view: 'editor' as const, label: 'Manuscript', ic: 'quill' as const },
                { view: 'corkboard' as const, label: 'Corkboard', ic: 'corkboard' as const },
                { view: 'outline' as const, label: 'Outline', ic: 'outline' as const },
                { view: 'bible' as const, label: 'Story Bible', ic: 'bible' as const },
                { view: 'graph' as const, label: 'Story Graph', ic: 'graph' as const },
                { view: 'typeset' as const, label: 'Typeset & Cover', ic: 'typeset' as const },
              ].map((item) =>
                el(
                  'button',
                  {
                    className: 'bv-btn',
                    style: { justifyContent: 'flex-start' },
                    attrs: { type: 'button' },
                    on: {
                      click: () => {
                        closeModal();
                        actions.setState({ activeView: item.view }, true);
                      },
                    },
                  },
                  icon(item.ic, 14),
                  item.label,
                ),
              ),
            ),
          ),
          el(
            'section',
            { className: 'bv-cork-card' },
            el('span', { className: 'bv-panel-title', text: 'One Application, Offline First' }),
            el('p', {
              className: 'bv-label',
              text: 'Everything in Bookvibe runs locally without accounts or cloud dependencies. Projects stay on disk as plain UTF-8 Bookvibe documents, and co-authors sync directly over local Wi-Fi or Bluetooth.',
            }),
            el(
              'div',
              { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' } },
              el(
                'button',
                {
                  className: 'bv-btn',
                  attrs: { type: 'button' },
                  on: {
                    click: () => {
                      closeModal();
                      actions.openSettingsModal('fonts');
                    },
                  },
                },
                icon('settings', 14),
                'Open Settings & Fonts',
              ),
              el(
                'button',
                {
                  className: 'bv-btn',
                  attrs: { type: 'button' },
                  on: {
                    click: () => {
                      closeModal();
                      actions.openSettingsModal('publishing');
                    },
                  },
                },
                icon('folder', 14),
                'Import Word / Docs',
              ),
            ),
          ),
        ),
      );
      return;
    }

    if (activeTab === 'icons') {
      const searchIn = el('input', {
        className: 'bv-input',
        attrs: { type: 'search', placeholder: 'Filter icons by name or purpose…', value: iconSearch },
        style: { maxWidth: '280px' },
        on: {
          input: () => {
            iconSearch = searchIn.value.toLowerCase();
            renderIconGrid();
          },
        },
      });

      const locRow = el('div', { style: { display: 'flex', gap: '5px', flexWrap: 'wrap' } });
      const locations: Array<'All' | IconDirectoryEntry['location']> = [
        'All',
        'Topbar',
        'Workspace Switcher',
        'Editor Modes',
        'Editor Tools',
        'Publishing & Sync',
      ];
      const grid = el('div', { className: 'bv-help-icon-grid' });

      const renderLocPills = () => {
        locRow.textContent = '';
        for (const loc of locations) {
          locRow.appendChild(
            el('button', {
              className: `bv-mini-btn${locationFilter === loc ? ' is-active' : ''}`,
              text: loc,
              attrs: { type: 'button' },
              on: {
                click: () => {
                  locationFilter = loc;
                  renderLocPills();
                  renderIconGrid();
                },
              },
            }),
          );
        }
      };

      const renderIconGrid = () => {
        grid.textContent = '';
        const filtered = ICON_DIRECTORY.filter((entry) => {
          if (locationFilter !== 'All' && entry.location !== locationFilter) return false;
          if (!iconSearch.trim()) return true;
          return (
            entry.name.toLowerCase().includes(iconSearch) ||
            entry.meaning.toLowerCase().includes(iconSearch) ||
            entry.icon.toLowerCase().includes(iconSearch)
          );
        });

        for (const entry of filtered) {
          grid.appendChild(
            el(
              'div',
              { className: 'bv-help-icon-card' },
              el('div', { className: 'bv-help-icon-badge' }, icon(entry.icon, 18)),
              el(
                'div',
                { style: { minWidth: '0', flex: '1' } },
                el(
                  'div',
                  { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' } },
                  el('strong', { text: entry.name, style: { fontSize: '12.5px' } }),
                  el('span', { className: 'bv-mono-tag', text: entry.location }),
                ),
                el('p', {
                  className: 'bv-label',
                  text: entry.meaning,
                  style: { margin: '4px 0 0', lineHeight: '1.45' },
                }),
                entry.shortcut
                  ? el('div', {
                      className: 'bv-mono-tag',
                      text: `Shortcut: ${entry.shortcut}`,
                      style: { marginTop: '4px', color: 'var(--accent-amber)' },
                    })
                  : null,
              ),
            ),
          );
        }
      };

      renderLocPills();
      renderIconGrid();

      bodyWrap.append(
        el(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' } },
          locRow,
          searchIn,
        ),
        grid,
      );
      return;
    }

    if (activeTab === 'guides') {
      const guides = [
        {
          tier: 'Basic Workflow',
          title: 'Notes, Single Scenes & Markdown Builder',
          steps: [
            'Write fast notes or standalone chapters in Manuscript Draft mode on Obsidian, Parchment, or Ivory paper.',
            'Press Ctrl+B, Ctrl+I, H2, blockquote, or * * * scene-break buttons to write standard Markdown inline.',
            'Choose .md or .bvscene in the top-right Save format dropdown so one click writes a plain Markdown file or portable scene bundle.',
            'Drag any .bookvibe, .bvbook, .bvbible, .bvscene, .md, or .txt file into the window to inspect or load it.',
          ],
        },
        {
          tier: 'Intermediate Workflow',
          title: 'Story Bible, Proofread Markup & Live Story Graph',
          steps: [
            'Build structured character, place, and lore cards in Story Bible. Add custom tabs (e.g. Magic Systems or Factions), drag-and-drop portraits, and add arbitrary key/value traits.',
            'Switch Editor mode to Proofread to apply the 15 copyediting marks (delete strikethrough, caret insert, substitute, transpose, stet, inline margin comments). Toggle Clean Preview to read accepted changes without altering prose until accepted.',
            'Open Story Graph to map character bonds and plot threads. Drag any card to see lines follow in real time, drag any edge port ● onto another node to wire a link, and toggle Detailed / Standard / Compact density.',
          ],
        },
        {
          tier: 'Professional Publishing',
          title: 'Typography, Full Cover Wrap, Collaboration & Signing',
          steps: [
            'Install personal .ttf, .otf, .woff, or .woff2 fonts in Settings > Typefaces, then apply them to the Draft paper sheet, book Interior Typeset preview, and Cover Studio.',
            'Design Front Cover, Back Cover (headline, blurb, author bio, barcode), Spine, and Dust Jacket Flaps in Cover Studio. Drop Canva SVGs or transparent PNG/WEBP emblems onto any face.',
            'Configure Imprint, ISBN, and Editorial Stage in Settings > Publishing & Migration, import existing .docx or Google Docs .html manuscripts, and sign your final build with an ECDSA Author Key.',
            'Review or sync revisions across laptops offline in Collaborate using a same-Wi-Fi PIN or Bluetooth / Nearby Share.',
          ],
        },
      ];

      for (const g of guides) {
        const list = el('ol', { style: { margin: '8px 0 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' } });
        for (const step of g.steps) {
          list.appendChild(el('li', { text: step, style: { color: 'var(--text-secondary)', fontSize: '12.5px', lineHeight: '1.5' } }));
        }
        bodyWrap.appendChild(
          el(
            'section',
            { className: 'bv-cork-card' },
            el('div', { className: 'bv-mono-tag', text: g.tier, style: { color: 'var(--accent-amber)' } }),
            el('strong', { text: g.title, style: { fontSize: '14px' } }),
            list,
          ),
        );
      }
      return;
    }

    // Reference tab
    const fmtGrid = el('div', { className: 'bv-two-col' });
    for (const item of BOOKVIBE_EXTENSIONS) {
      fmtGrid.appendChild(
        el(
          'div',
          { className: 'bv-list-card', style: { flexDirection: 'column', alignItems: 'flex-start', gap: '4px' } },
          el(
            'div',
            { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' } },
            el('strong', { text: item.extension, style: { fontFamily: 'var(--font-mono)', color: 'var(--accent-ivory)' } }),
            el('span', { className: 'bv-mono-tag', text: item.mimeType }),
          ),
          el('div', { text: item.name, style: { fontWeight: '600', fontSize: '12.5px' } }),
          el('div', { className: 'bv-label', text: item.purpose }),
        ),
      );
    }

    const kbdWrap = el('div', { className: 'bv-snap-list' });
    for (const row of SHORTCUT_LIST) {
      kbdWrap.appendChild(
        el(
          'div',
          { className: 'bv-list-card' },
          el('span', { text: row.action, style: { fontSize: '12.5px' } }),
          el('span', { className: 'bv-kbd-chip', text: row.keys }),
        ),
      );
    }

    bodyWrap.append(
      el('section', { className: 'bv-cork-card' }, el('span', { className: 'bv-panel-title', text: 'Bookvibe File Extensions' }), fmtGrid),
      el('section', { className: 'bv-cork-card' }, el('span', { className: 'bv-panel-title', text: 'Keyboard & Canvas Shortcuts' }), kbdWrap),
    );
  };

  const modal = el(
    'div',
    {
      className: 'bv-modal',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Bookvibe Help and Icon Directory' },
    },
    el(
      'div',
      { className: 'bv-panel-head' },
      el('span', { className: 'bv-panel-title', text: 'Bookvibe Manual, Icon Directory & Guides' }),
      el('button', {
        className: 'bv-mini-btn',
        text: 'Close',
        attrs: { type: 'button' },
        on: { click: closeModal },
      }),
    ),
    el('div', { className: 'bv-modal-body' }, tabBar, bodyWrap),
  );

  const backdrop = el(
    'div',
    {
      className: 'bv-modal-backdrop',
      id: 'bv-help-modal',
      on: {
        click: (e) => {
          if (e.target === backdrop) closeModal();
        },
      },
    },
    modal,
  );

  document.body.appendChild(backdrop);
  renderTabs();
  renderBody();
}
