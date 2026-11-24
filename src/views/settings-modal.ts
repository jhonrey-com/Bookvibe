import type { AppActions } from '../core/app-context';
import { ALARM_RINGTONES, playRingtonePreview } from '../core/alarm';
import { isTauriRuntime } from '../core/bridge';
import { EXPORT_FORMAT_OPTIONS } from '../core/export';
import {
  getAllAvailableFontChoices,
  installDeviceFontFile,
  loadCustomFonts,
  pickLocalSystemFont,
  removeCustomFont,
} from '../core/fonts';
import { normalizeProjectDefaults } from '../core/library';
import { getAllScenes } from '../core/manuscript';
import { buildEditorialHandoffReport, importAnyExternalDocumentFile } from '../core/migrate';
import { loadExtensionAuditLog } from '../core/plugins';
import { getPublisherProvenance, verifyPublisherProvenance } from '../core/provenance';
import { DEFAULT_SETTINGS, formatAppWindowTitle } from '../core/settings';
import type {
  AlarmRingtoneId,
  AppThemeId,
  EditorialStage,
  ExportFormatId,
  ToolbarDisplayMode,
  ToolTier,
  WindowTitleMode,
} from '../core/types';
import { el, icon } from '../ui/dom';

export type SettingsTab = 'fonts' | 'editor' | 'publishing' | 'developer';

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'fonts', label: 'Typefaces & Fonts' },
  { id: 'editor', label: 'Workspace & Editor' },
  { id: 'publishing', label: 'Publishing & Archive' },
  { id: 'developer', label: 'Developer Tools' },
];

const EDITORIAL_STAGES: Array<{ id: EditorialStage; label: string }> = [
  { id: 'acquisition', label: 'Acquisition / Proposal' },
  { id: 'developmental', label: 'Developmental Edit' },
  { id: 'line-edit', label: 'Line Edit' },
  { id: 'copyedit', label: 'Copyedit' },
  { id: 'proofread', label: 'Final Proofread' },
  { id: 'print-ready', label: 'Print & Press Ready' },
];

export function showSettingsModal(actions: AppActions, initialTab: SettingsTab = 'fonts'): void {
  const existing = document.getElementById('bv-settings-modal');
  if (existing) existing.remove();

  let activeTab: SettingsTab = initialTab;
  const tabBar = el('div', { className: 'bv-modal-tab-strip', attrs: { role: 'tablist' } });
  const bodyWrap = el('div', { className: 'bv-modal-scroll-area' });

  const closeModal = () => {
    backdrop.remove();
  };

  const renderTabs = () => {
    tabBar.textContent = '';
    for (const tab of SETTINGS_TABS) {
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
    const project = normalizeProjectDefaults(state.project);
    const settings = state.settings;

    if (activeTab === 'fonts') {
      const fontInput = el('input', {
        attrs: {
          type: 'file',
          accept: '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2',
        },
        style: { display: 'none' },
        on: {
          change: async () => {
            const file = fontInput.files?.[0];
            fontInput.value = '';
            if (!file) return;
            try {
              const installed = await installDeviceFontFile(file);
              actions.notify(`Installed font “${installed.family}”`);
              renderBody();
            } catch (err) {
              actions.notify(err instanceof Error ? err.message : 'Unable to install font file.');
            }
          },
        },
      });

      const dropZone = el(
        'div',
        {
          className: 'bv-font-dropzone',
          on: {
            dragover: (e) => {
              e.preventDefault();
              dropZone.classList.add('is-dragover');
            },
            dragleave: () => dropZone.classList.remove('is-dragover'),
            drop: async (e) => {
              e.preventDefault();
              dropZone.classList.remove('is-dragover');
              const file = e.dataTransfer?.files?.[0];
              if (!file) return;
              try {
                const installed = await installDeviceFontFile(file);
                actions.notify(`Installed font “${installed.family}”`);
                renderBody();
              } catch (err) {
                actions.notify(err instanceof Error ? err.message : 'Unable to load font.');
              }
            },
          },
        },
        el('div', {
          text: 'Drop .ttf, .otf, .woff, or .woff2 font files here',
          style: { fontWeight: '600', fontSize: '12.5px' },
        }),
        el('div', {
          className: 'bv-label',
          text: 'Magic-byte checked on arrival. Fonts stay stored locally on your device for Draft sheets, Typeset previews, and Covers.',
        }),
        el(
          'div',
          { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' } },
          el(
            'button',
            {
              className: 'bv-btn bv-btn-primary',
              attrs: { type: 'button' },
              on: { click: () => fontInput.click() },
            },
            icon('folder', 14),
            'Choose Device Font…',
          ),
          el(
            'button',
            {
              className: 'bv-btn',
              attrs: { type: 'button' },
              on: {
                click: async () => {
                  try {
                    const picked = await pickLocalSystemFont();
                    if (!picked) {
                      actions.notify('Local system font picker requires Chromium permission or HTTPS/desktop context. Use "Choose Device Font…" instead.');
                      return;
                    }
                    actions.notify(`Added system font “${picked.family}”`);
                    renderBody();
                  } catch (err) {
                    actions.notify(err instanceof Error ? err.message : 'Unable to read system fonts.');
                  }
                },
              },
            },
            'Pick Installed OS Font…',
          ),
          el(
            'button',
            {
              className: 'bv-btn',
              attrs: { type: 'button' },
              on: {
                click: () => {
                  closeModal();
                  actions.openExtensionsModal('integrated');
                },
              },
            },
            icon('extensions', 14),
            'Browse Extension Font Packs',
          ),
          fontInput,
        ),
      );

      const choices = getAllAvailableFontChoices();
      const customRecords = loadCustomFonts();
      const fontCards = el('div', { className: 'bv-snap-list' });

      for (const opt of choices) {
        const isDraftActive = settings.editorFontFamily === opt.cssStack || (!settings.editorFontFamily && opt.builtInKey === 'garamond');
        const isTypesetActive = project.typography.customFontFamily
          ? project.typography.customFontFamily === opt.id
          : Boolean(opt.builtInKey && project.typography.fontFamily === opt.builtInKey);
        const customEntry = customRecords.find((c) => c.family.toLowerCase() === opt.id.toLowerCase());

        fontCards.appendChild(
          el(
            'div',
            { className: 'bv-list-card', style: { flexDirection: 'column', alignItems: 'stretch', gap: '8px' } },
            el(
              'div',
              { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
              el(
                'div',
                {},
                el('strong', { text: opt.label, style: { fontSize: '13px' } }),
                el('div', {
                  className: 'bv-mono-tag',
                  text: `Source: ${opt.source}`,
                  style: { marginTop: '2px' },
                }),
              ),
              el(
                'div',
                { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
                el('button', {
                  className: `bv-mini-btn${isDraftActive ? ' is-active' : ''}`,
                  text: isDraftActive ? 'Active in Draft' : 'Use in Draft',
                  attrs: { type: 'button' },
                  on: {
                    click: () => {
                      actions.updateSettings({ editorFontFamily: opt.cssStack });
                      actions.notify(`Draft font set to ${opt.label}`);
                      renderBody();
                    },
                  },
                }),
                el('button', {
                  className: `bv-mini-btn${isTypesetActive ? ' is-active' : ''}`,
                  text: isTypesetActive ? 'Active in Typeset' : 'Use in Book Typeset',
                  attrs: { type: 'button' },
                  on: {
                    click: () => {
                      actions.mutateProject((prev) => ({
                        ...prev,
                        typography: opt.builtInKey
                          ? { ...prev.typography, fontFamily: opt.builtInKey, customFontFamily: '' }
                          : { ...prev.typography, customFontFamily: opt.id },
                      }));
                      actions.notify(`Interior book typeface set to ${opt.label}`);
                      renderBody();
                    },
                  },
                }),
                customEntry
                  ? el(
                      'button',
                      {
                        className: 'bv-mini-btn',
                        attrs: { type: 'button', 'aria-label': `Remove ${opt.label}` },
                        on: {
                          click: () => {
                            removeCustomFont(customEntry.id);
                            renderBody();
                          },
                        },
                      },
                      icon('trash', 12),
                    )
                  : null,
              ),
            ),
            el('div', {
              text: 'Chapter One — The sea kept quiet counsel beneath the winter pier. “0123456789”',
              style: {
                fontFamily: opt.cssStack,
                fontSize: '15px',
                color: 'var(--accent-ivory)',
                padding: '6px 8px',
                background: 'var(--bg-canvas)',
                borderRadius: '4px',
                border: '1px solid var(--border-subtle)',
              },
            }),
          ),
        );
      }

      bodyWrap.append(dropZone, el('span', { className: 'bv-panel-title', text: 'Installed Typefaces' }), fontCards);
      return;
    }

    if (activeTab === 'editor') {
      const themeSel = el(
        'select',
        {
          className: 'bv-input',
          id: 'bv-set-theme',
          on: {
            change: () => {
              const appTheme = themeSel.value as AppThemeId;
              actions.updateSettings({ appTheme });
              actions.setState({}, true);
            },
          },
        },
        el('option', { text: 'Ivory Light (Default Writing Studio)', attrs: { value: 'ivory', selected: settings.appTheme === 'ivory' } }),
        el('option', { text: 'Warm Parchment Paper', attrs: { value: 'parchment', selected: settings.appTheme === 'parchment' } }),
        el('option', { text: 'Obsidian Dark Studio', attrs: { value: 'obsidian', selected: settings.appTheme === 'obsidian' } }),
      );

      const tierOptions: Array<{ id: ToolTier; title: string; desc: string }> = [
        { id: 'basic', title: 'Basic', desc: 'Manuscript sheet & notes only.' },
        { id: 'intermediate', title: 'Intermediate', desc: 'Adds Corkboard, Outline, Proofread, Typeset.' },
        { id: 'advanced', title: 'Advanced', desc: 'Adds Story Bible, Graph, Pro Cover, Permissions.' },
      ];
      const tierCardsGrid = el(
        'div',
        { className: 'qv-tier-card-grid', id: 'bv-set-tier' },
        ...tierOptions.map((opt) =>
          el(
            'button',
            {
              className: `qv-tier-card${settings.toolTier === opt.id ? ' is-active' : ''}`,
              attrs: { type: 'button', 'aria-pressed': String(settings.toolTier === opt.id) },
              on: {
                click: () => {
                  actions.updateSettings({ toolTier: opt.id });
                  actions.setState({}, true);
                  actions.notify(`Switched workspace level to ${opt.title}`);
                  renderBody();
                },
              },
            },
            el('strong', { text: opt.title, style: { fontSize: '12.5px' } }),
            el('span', { className: 'bv-label', text: opt.desc }),
          ),
        ),
      );

      const toolbarModeSel = el(
        'select',
        {
          className: 'bv-input',
          id: 'bv-set-toolbar-mode',
          on: {
            change: () => {
              actions.updateSettings({ toolbarDisplayMode: toolbarModeSel.value as ToolbarDisplayMode });
              actions.setState({}, true);
            },
          },
        },
        el('option', { text: 'Icons Only (Minimal Chrome)', attrs: { value: 'icons', selected: settings.toolbarDisplayMode === 'icons' } }),
        el('option', { text: 'Balanced (Icons + Key Labels)', attrs: { value: 'balanced', selected: settings.toolbarDisplayMode === 'balanced' } }),
        el('option', { text: 'Full Details (Icons + Full Descriptions)', attrs: { value: 'detailed', selected: settings.toolbarDisplayMode === 'detailed' } }),
      );

      const densitySel = el(
        'select',
        {
          className: 'bv-input',
          id: 'bv-set-density',
          on: { change: () => actions.updateSettings({ uiDensity: densitySel.value as 'comfortable' | 'compact' }) },
        },
        el('option', { text: 'Comfortable (Standard Spacing)', attrs: { value: 'comfortable', selected: settings.uiDensity === 'comfortable' } }),
        el('option', { text: 'Compact (Dense Editorial View)', attrs: { value: 'compact', selected: settings.uiDensity === 'compact' } }),
      );

      const motionSel = el(
        'select',
        {
          className: 'bv-input',
          id: 'bv-set-motion',
          on: { change: () => actions.updateSettings({ reducedMotionOverride: motionSel.value as 'system' | 'reduce' }) },
        },
        el('option', { text: 'Follow System Preference', attrs: { value: 'system', selected: settings.reducedMotionOverride === 'system' } }),
        el('option', { text: 'Reduced Motion', attrs: { value: 'reduce', selected: settings.reducedMotionOverride === 'reduce' } }),
      );

      const defaultFmtSel = el(
        'select',
        {
          className: 'bv-input',
          id: 'bv-set-default-fmt',
          on: { change: () => actions.setDefaultExportFormat(defaultFmtSel.value as ExportFormatId) },
        },
        ...EXPORT_FORMAT_OPTIONS.map((opt) =>
          el('option', { text: opt.label, attrs: { value: opt.id, selected: state.defaultExportFormat === opt.id } }),
        ),
      );

      const fontSizeLabel = el('label', {
        className: 'bv-label',
        attrs: { for: 'bv-set-fontsize' },
        text: `Editor Font Size (${settings.editorFontSizePx} px)`,
      });
      const syncFontSize = () => {
        const val = Number(fontSizeSlider.value);
        fontSizeLabel.textContent = `Editor Font Size (${val} px)`;
        actions.updateSettings({ editorFontSizePx: val });
      };
      const fontSizeSlider = el('input', {
        id: 'bv-set-fontsize',
        attrs: { type: 'range', min: 13, max: 28, step: 1, value: settings.editorFontSizePx },
        on: { input: syncFontSize, change: syncFontSize },
      });

      const lhLabel = el('label', {
        className: 'bv-label',
        attrs: { for: 'bv-set-lineheight' },
        text: `Line Height (${settings.editorLineHeight})`,
      });
      const syncLineHeight = () => {
        const val = Number(lhSlider.value);
        lhLabel.textContent = `Line Height (${val})`;
        actions.updateSettings({ editorLineHeight: val });
      };
      const lhSlider = el('input', {
        id: 'bv-set-lineheight',
        attrs: { type: 'range', min: 1.3, max: 2.2, step: 0.05, value: settings.editorLineHeight },
        on: { input: syncLineHeight, change: syncLineHeight },
      });

      const widthLabel = el('label', {
        className: 'bv-label',
        attrs: { for: 'bv-set-sheetwidth' },
        text: `Paper Sheet Width (${settings.editorSheetMaxWidthPx} px)`,
      });
      const syncSheetWidth = () => {
        const val = Number(widthSlider.value);
        widthLabel.textContent = `Paper Sheet Width (${val} px)`;
        actions.updateSettings({ editorSheetMaxWidthPx: val });
      };
      const widthSlider = el('input', {
        id: 'bv-set-sheetwidth',
        attrs: { type: 'range', min: 540, max: 1080, step: 20, value: settings.editorSheetMaxWidthPx },
        on: { input: syncSheetWidth, change: syncSheetWidth },
      });

      const saveDelayLabel = el('label', {
        className: 'bv-label',
        attrs: { for: 'bv-set-savedelay' },
        text: `Auto-Save Interval (${settings.autoSaveDelayMs} ms)`,
      });
      const syncSaveDelay = () => {
        const val = Number(saveDelaySlider.value);
        saveDelayLabel.textContent = `Auto-Save Interval (${val} ms)`;
        actions.updateSettings({ autoSaveDelayMs: val });
      };
      const saveDelaySlider = el('input', {
        id: 'bv-set-savedelay',
        attrs: { type: 'range', min: 150, max: 2000, step: 50, value: settings.autoSaveDelayMs },
        on: { input: syncSaveDelay, change: syncSaveDelay },
      });

      const tourChk = el('input', {
        className: 'bv-lever',
        id: 'bv-set-tours',
        attrs: { type: 'checkbox', role: 'switch', checked: settings.showOnboardingHints },
        on: { change: () => actions.updateSettings({ showOnboardingHints: tourChk.checked }) },
      });

      const titlePreviewEl = el('div', {
        className: 'bv-mono-tag',
        text: `Preview: ${formatAppWindowTitle(settings, project, state.activeView, state.typesetSubTab, isTauriRuntime())}`,
      });

      const titleCustomIn = el('input', {
        className: 'bv-input',
        id: 'qv-set-title-custom',
        attrs: {
          type: 'text',
          value: settings.windowTitleCustom,
          placeholder: 'e.g. Quillvibe · {book} ({section})',
        },
        style: { display: settings.windowTitleMode === 'custom' ? '' : 'none' },
        on: {
          input: () => {
            actions.updateSettings({ windowTitleCustom: titleCustomIn.value });
            titlePreviewEl.textContent = `Preview: ${formatAppWindowTitle(
              actions.getState().settings,
              project,
              actions.getState().activeView,
              actions.getState().typesetSubTab,
              isTauriRuntime(),
            )}`;
          },
        },
      });

      const titleModeSel = el(
        'select',
        {
          className: 'bv-input',
          id: 'qv-set-title-mode',
          on: {
            change: () => {
              const mode = titleModeSel.value as WindowTitleMode;
              titleCustomIn.style.display = mode === 'custom' ? '' : 'none';
              actions.updateSettings({ windowTitleMode: mode });
              titlePreviewEl.textContent = `Preview: ${formatAppWindowTitle(
                actions.getState().settings,
                project,
                actions.getState().activeView,
                actions.getState().typesetSubTab,
                isTauriRuntime(),
              )}`;
            },
          },
        },
        el('option', { text: 'Quillvibe - <Book Name> (Recommended)', attrs: { value: 'book', selected: settings.windowTitleMode === 'book' } }),
        el('option', { text: 'Quillvibe - <Author / Pen Name>', attrs: { value: 'author', selected: settings.windowTitleMode === 'author' } }),
        el('option', { text: 'Quillvibe - <Current Section>', attrs: { value: 'section', selected: settings.windowTitleMode === 'section' } }),
        el('option', { text: 'Quillvibe Only', attrs: { value: 'brand', selected: settings.windowTitleMode === 'brand' } }),
        el('option', { text: 'Custom Title Template…', attrs: { value: 'custom', selected: settings.windowTitleMode === 'custom' } }),
      );

      const immClockChk = el('input', {
        className: 'bv-lever',
        attrs: { type: 'checkbox', role: 'switch', checked: settings.immersiveShowClock },
        on: { change: () => actions.updateSettings({ immersiveShowClock: immClockChk.checked }) },
      });
      const immTimerChk = el('input', {
        className: 'bv-lever',
        attrs: { type: 'checkbox', role: 'switch', checked: settings.immersiveShowTimer },
        on: { change: () => actions.updateSettings({ immersiveShowTimer: immTimerChk.checked }) },
      });
      const immWordsChk = el('input', {
        className: 'bv-lever',
        attrs: { type: 'checkbox', role: 'switch', checked: settings.immersiveShowWords },
        on: { change: () => actions.updateSettings({ immersiveShowWords: immWordsChk.checked }) },
      });
      const immAlarmChk = el('input', {
        className: 'bv-lever',
        attrs: { type: 'checkbox', role: 'switch', checked: settings.immersiveShowAlarm },
        on: { change: () => actions.updateSettings({ immersiveShowAlarm: immAlarmChk.checked }) },
      });

      const ringtoneSel = el(
        'select',
        {
          className: 'bv-input',
          id: 'qv-set-ringtone',
          on: {
            change: () => {
              const id = ringtoneSel.value as AlarmRingtoneId;
              actions.updateSettings({ alarmRingtone: id });
              playRingtonePreview(id, actions.getState().settings.alarmVolume);
            },
          },
        },
        ...ALARM_RINGTONES.map((rt) =>
          el('option', {
            text: rt.label,
            attrs: { value: rt.id, selected: settings.alarmRingtone === rt.id },
          }),
        ),
      );

      const volLabel = el('label', {
        className: 'bv-label',
        attrs: { for: 'qv-set-alarm-vol' },
        text: `Alarm Volume (${Math.round(settings.alarmVolume * 100)}%)`,
      });
      const volSlider = el('input', {
        id: 'qv-set-alarm-vol',
        attrs: { type: 'range', min: 10, max: 100, step: 5, value: Math.round(settings.alarmVolume * 100) },
        on: {
          input: () => {
            const pct = Number(volSlider.value) || 65;
            volLabel.textContent = `Alarm Volume (${pct}%)`;
            actions.updateSettings({ alarmVolume: pct / 100 });
          },
        },
      });

      bodyWrap.append(
        el(
          'div',
          { className: 'bv-two-col' },
          el(
            'section',
            { className: 'bv-cork-card' },
            el('span', { className: 'bv-panel-title', text: 'Theme & Workspace Level' }),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', attrs: { for: 'bv-set-theme' }, text: 'Application Theme' }), themeSel),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Workspace Level (Moves Section Bar Cleanly)' }), tierCardsGrid),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', attrs: { for: 'bv-set-toolbar-mode' }, text: 'Toolbar Detail Mode' }), toolbarModeSel),
            el('div', { className: 'bv-field' }, fontSizeLabel, fontSizeSlider),
            el('div', { className: 'bv-field' }, lhLabel, lhSlider),
            el('div', { className: 'bv-field' }, widthLabel, widthSlider),
          ),
          el(
            'section',
            { className: 'bv-cork-card' },
            el('span', { className: 'bv-panel-title', text: 'Interface, Split Panes & Save' }),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', attrs: { for: 'bv-set-density' }, text: 'Workspace Density' }), densitySel),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', attrs: { for: 'bv-set-motion' }, text: 'Motion' }), motionSel),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', attrs: { for: 'bv-set-default-fmt' }, text: 'Default Save / Export Extension' }), defaultFmtSel),
            el('div', { className: 'bv-field' }, saveDelayLabel, saveDelaySlider),
            el('label', { className: 'bv-check-row', attrs: { for: 'bv-set-tours' } }, tourChk, el('span', { text: 'Show interactive hints & course tips' })),
            el(
              'button',
              {
                className: 'bv-mini-btn',
                text: 'Reset Resizable Panel Widths',
                attrs: { type: 'button' },
                on: {
                  click: () => {
                    actions.updateSettings({
                      binderWidthPx: DEFAULT_SETTINGS.binderWidthPx,
                      inspectorWidthPx: DEFAULT_SETTINGS.inspectorWidthPx,
                      studioLeftWidthPx: DEFAULT_SETTINGS.studioLeftWidthPx,
                      studioRightWidthPx: DEFAULT_SETTINGS.studioRightWidthPx,
                    });
                    actions.notify('Panel split widths restored to defaults');
                  },
                },
              },
            ),
          ),
        ),
        el(
          'div',
          { className: 'bv-two-col', style: { marginTop: '12px' } },
          el(
            'section',
            { className: 'bv-cork-card' },
            el('span', { className: 'bv-panel-title', text: 'Window & Taskbar Title' }),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', attrs: { for: 'qv-set-title-mode' }, text: 'Display Format (Website Tab & Desktop Window Hover)' }), titleModeSel),
            titleCustomIn,
            el('p', { className: 'bv-label', text: 'Custom placeholders: {book}, {author}, and {section}.' }),
            titlePreviewEl,
          ),
          el(
            'section',
            { className: 'bv-cork-card' },
            el('span', {
              className: 'bv-panel-title',
              text: isTauriRuntime() ? 'Immersive Fullscreen & Alarm Ringtones' : 'Writing Sprint & Alarm Ringtones',
            }),
            ...(isTauriRuntime()
              ? [
                  el('label', { className: 'bv-check-row' }, immClockChk, el('span', { text: 'Show live wall clock in Immersive Mode' })),
                  el('label', { className: 'bv-check-row' }, immTimerChk, el('span', { text: 'Show writing sprint timer in Immersive Mode' })),
                  el('label', { className: 'bv-check-row' }, immWordsChk, el('span', { text: 'Show word count progress in Immersive Mode' })),
                  el('label', { className: 'bv-check-row' }, immAlarmChk, el('span', { text: 'Show alarm clock pill in Immersive Mode' })),
                ]
              : []),
            el(
              'div',
              { className: 'bv-field' },
              el('label', { className: 'bv-label', attrs: { for: 'qv-set-ringtone' }, text: 'Alarm Clock Ringtone' }),
              el(
                'div',
                { style: { display: 'flex', gap: '6px' } },
                ringtoneSel,
                el(
                  'button',
                  {
                    className: 'bv-mini-btn',
                    text: 'Preview',
                    attrs: { type: 'button' },
                    on: {
                      click: () => {
                        const s = actions.getState().settings;
                        playRingtonePreview(s.alarmRingtone, s.alarmVolume);
                      },
                    },
                  },
                ),
              ),
            ),
            el('div', { className: 'bv-field' }, volLabel, volSlider),
          ),
        ),
      );
      return;
    }

    if (activeTab === 'publishing') {
      const pub = project.publishing ?? {
        imprintName: settings.defaultImprint,
        isbn: '',
        editionNumber: '1st Edition',
        editorialStage: 'developmental' as EditorialStage,
      };

      const imprintIn = el('input', {
        className: 'bv-input',
        attrs: { type: 'text', value: pub.imprintName, placeholder: 'Imprint / Publishing House' },
        on: {
          change: () => {
            actions.updateSettings({ defaultImprint: imprintIn.value.trim() || 'Independent Press' });
            actions.mutateProject((p) => ({
              ...p,
              publishing: { ...(p.publishing ?? pub), imprintName: imprintIn.value.trim() },
            }));
          },
        },
      });
      const isbnIn = el('input', {
        className: 'bv-input',
        attrs: { type: 'text', value: pub.isbn, placeholder: '978-0-000-00000-0 (Optional)' },
        on: {
          change: () =>
            actions.mutateProject((p) => ({
              ...p,
              publishing: { ...(p.publishing ?? pub), isbn: isbnIn.value.trim() },
            })),
        },
      });
      const editionIn = el('input', {
        className: 'bv-input',
        attrs: { type: 'text', value: pub.editionNumber, placeholder: '1st Edition' },
        on: {
          change: () =>
            actions.mutateProject((p) => ({
              ...p,
              publishing: { ...(p.publishing ?? pub), editionNumber: editionIn.value.trim() || '1st Edition' },
            })),
        },
      });
      const stageSel = el(
        'select',
        {
          className: 'bv-input',
          on: {
            change: () =>
              actions.mutateProject((p) => ({
                ...p,
                publishing: { ...(p.publishing ?? pub), editorialStage: stageSel.value as EditorialStage },
              })),
          },
        },
        ...EDITORIAL_STAGES.map((st) =>
          el('option', { text: st.label, attrs: { value: st.id, selected: pub.editorialStage === st.id } }),
        ),
      );

      const publisherCompanyIn = el('input', {
        className: 'bv-input',
        attrs: { type: 'text', value: pub.publisherCompany ?? '', placeholder: 'Publishing Company / Studio Legal Name' },
        on: {
          change: () =>
            actions.mutateProject((p) => ({
              ...p,
              publishing: { ...(p.publishing ?? pub), publisherCompany: publisherCompanyIn.value.trim() },
            })),
        },
      });
      const ebookIsbnIn = el('input', {
        className: 'bv-input',
        attrs: { type: 'text', value: pub.ebookIsbn ?? '', placeholder: 'eBook ISBN (978-...)' },
        on: {
          change: () =>
            actions.mutateProject((p) => ({
              ...p,
              publishing: { ...(p.publishing ?? pub), ebookIsbn: ebookIsbnIn.value.trim() },
            })),
        },
      });
      const rightsTerritoryIn = el('input', {
        className: 'bv-input',
        attrs: { type: 'text', value: pub.rightsTerritory ?? '', placeholder: 'e.g. World All Languages' },
        on: {
          change: () =>
            actions.mutateProject((p) => ({
              ...p,
              publishing: { ...(p.publishing ?? pub), rightsTerritory: rightsTerritoryIn.value.trim() },
            })),
        },
      });
      const commercialLicenseSel = el(
        'select',
        {
          className: 'bv-input',
          on: {
            change: () =>
              actions.mutateProject((p) => ({
                ...p,
                publishing: { ...(p.publishing ?? pub), commercialLicense: commercialLicenseSel.value },
              })),
          },
        },
        ...[
          'All Rights Reserved',
          'Commercial Print & Digital License',
          'Publishing House Exclusive',
          'Creative Commons BY-NC-ND',
        ].map((lic) =>
          el('option', {
            text: lic,
            attrs: { value: lic, selected: (pub.commercialLicense || 'All Rights Reserved') === lic },
          }),
        ),
      );
      const bisacIn = el('input', {
        className: 'bv-input',
        attrs: { type: 'text', value: pub.bisacCategory ?? '', placeholder: 'BISAC Code / Category (e.g. FIC009000)' },
        on: {
          change: () =>
            actions.mutateProject((p) => ({
              ...p,
              publishing: { ...(p.publishing ?? pub), bisacCategory: bisacIn.value.trim() },
            })),
        },
      });
      const embargoIn = el('input', {
        className: 'bv-input',
        attrs: { type: 'date', value: pub.embargoDate ?? '' },
        on: {
          change: () =>
            actions.mutateProject((p) => ({
              ...p,
              publishing: { ...(p.publishing ?? pub), embargoDate: embargoIn.value },
            })),
        },
      });
      const arcWatermarkIn = el('input', {
        className: 'bv-input',
        attrs: { type: 'text', value: pub.arcWatermarkText ?? '', placeholder: 'Advance Review Copy / Reviewer Watermark' },
        on: {
          change: () =>
            actions.mutateProject((p) => ({
              ...p,
              publishing: { ...(p.publishing ?? pub), arcWatermarkText: arcWatermarkIn.value.trim() },
            })),
        },
      });
      const reqSignedSyncChk = el('input', {
        className: 'bv-lever',
        attrs: { type: 'checkbox', role: 'switch', checked: Boolean(pub.enterpriseRequireSignedSync) },
        on: {
          change: () =>
            actions.mutateProject((p) => ({
              ...p,
              publishing: { ...(p.publishing ?? pub), enterpriseRequireSignedSync: reqSignedSyncChk.checked },
            })),
        },
      });
      const reqPasswordExportChk = el('input', {
        className: 'bv-lever',
        attrs: { type: 'checkbox', role: 'switch', checked: Boolean(pub.enterpriseRequirePasswordExport) },
        on: {
          change: () =>
            actions.mutateProject((p) => ({
              ...p,
              publishing: { ...(p.publishing ?? pub), enterpriseRequirePasswordExport: reqPasswordExportChk.checked },
            })),
        },
      });

      const migrateInput = el('input', {
        attrs: { type: 'file', accept: '.docx,.html,.htm,.rtf,.md,.markdown,.txt' },
        style: { display: 'none' },
        on: {
          change: async () => {
            const file = migrateInput.files?.[0];
            migrateInput.value = '';
            if (!file) return;
            try {
              const imported = await importAnyExternalDocumentFile(file);
              const nextLib = {
                activeBookId: imported.id,
                books: [...actions.getState().library.books, imported],
              };
              actions.replaceLibrary(nextLib);
              actions.notify(`Imported “${imported.title}” (${imported.parts[0]?.chapters.length ?? 0} chapter(s))`);
              closeModal();
            } catch (err) {
              actions.notify(err instanceof Error ? err.message : 'Unable to import external manuscript.');
            }
          },
        },
      });

      bodyWrap.append(
        el(
          'div',
          { className: 'bv-two-col' },
          el(
            'section',
            { className: 'bv-cork-card' },
            el('span', { className: 'bv-panel-title', text: 'Imprint, ISBN & Editorial Stage' }),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Imprint / Press Name' }), imprintIn),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Print ISBN or Catalog ID' }), isbnIn),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'eBook ISBN' }), ebookIsbnIn),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Edition Label' }), editionIn),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Editorial Pipeline Stage' }), stageSel),
            el(
              'button',
              {
                className: 'bv-btn',
                attrs: { type: 'button' },
                style: { marginTop: '6px' },
                on: {
                  click: () => {
                    const report = buildEditorialHandoffReport(actions.getState().project);
                    const blob = new Blob([report], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-handoff.md`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 2500);
                    actions.notify('Exported Editorial Handoff Sheet (.md)');
                  },
                },
              },
              icon('download', 14),
              'Export Editorial Handoff Sheet',
            ),
          ),
          el(
            'section',
            { className: 'bv-cork-card' },
            el('span', { className: 'bv-panel-title', text: 'Commercial & Enterprise Publishing Options' }),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Publisher / Company Legal Entity' }), publisherCompanyIn),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Rights & Distribution Territory' }), rightsTerritoryIn),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Commercial Rights License' }), commercialLicenseSel),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'BISAC Category Code' }), bisacIn),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Press Embargo / Street Date' }), embargoIn),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Printable ARC / Proof Watermark' }), arcWatermarkIn),
            el('label', { className: 'bv-check-row' }, reqSignedSyncChk, el('span', { text: 'Require valid Author Key signature on team sync' })),
            el('label', { className: 'bv-check-row' }, reqPasswordExportChk, el('span', { text: 'Require password on every QVBX file export' })),
          ),
        ),
        el(
          'section',
          { className: 'bv-cork-card', style: { marginTop: '12px' } },
          el('span', { className: 'bv-panel-title', text: 'Import Manuscripts & Legacy Bookvibe Archives' }),
          el('p', {
            className: 'bv-label',
            text: 'Import manuscripts from Word (.docx), Google Docs (.html), Rich Text (.rtf), Markdown (.md), Plain Text (.txt), or upgrade older .bookvibe / .bv* files into Quillvibe.',
          }),
          el(
            'div',
            { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' } },
            el(
              'button',
              {
                className: 'bv-btn bv-btn-primary',
                attrs: { type: 'button' },
                on: { click: () => migrateInput.click() },
              },
              icon('folder', 14),
              'Import .docx / .html / .rtf / .md / .txt…',
            ),
            el(
              'button',
              {
                className: 'bv-btn',
                attrs: { type: 'button' },
                on: {
                  click: () => {
                    closeModal();
                    void actions.importLegacyBookFile();
                  },
                },
              },
              icon('folder', 14),
              'Import Legacy .bookvibe / .bv* Archive…',
            ),
            migrateInput,
          ),
        ),
      );
      return;
    }

    // Developer Tab
    const devChk = el('input', {
      className: 'bv-lever',
      attrs: { type: 'checkbox', role: 'switch', checked: settings.developerMode },
      on: {
        change: () => {
          actions.updateSettings({ developerMode: devChk.checked });
          renderBody();
        },
      },
    });
    const prov = getPublisherProvenance(project.id);
    const verified = verifyPublisherProvenance(prov.publisher, prov.mark, project.id);
    const scenesCount = getAllScenes(project).length;
    const auditEntries = loadExtensionAuditLog().length;
    const fontsCount = loadCustomFonts().length;

    bodyWrap.append(
      el(
        'section',
        { className: 'bv-cork-card' },
        el('span', { className: 'bv-panel-title', text: 'Developer Mode & Build Provenance' }),
        el('label', { className: 'bv-check-row' }, devChk, el('span', { text: 'Enable developer diagnostics and extension tools' })),
        el('div', {
          className: 'bv-list-card',
          style: { marginTop: '8px' },
        },
          el('div', {},
            el('div', { text: `Publisher Origin: ${prov.publisher}`, style: { fontWeight: '600', fontSize: '12.5px' } }),
            el('div', { className: 'bv-mono-tag', text: `Build Mark: ${prov.mark} · Verified: ${verified ? 'Valid' : 'Mismatch'}` }),
          ),
          el('span', { className: 'bv-mono-tag', text: 'v2.1.0', style: { color: 'var(--accent-emerald)' } }),
        ),
      ),
      el(
        'section',
        { className: 'bv-cork-card' },
        el('span', { className: 'bv-panel-title', text: 'Workspace Telemetry Summary (Local Only)' }),
        el('div', { className: 'bv-mono-tag', text: `Book ID: ${project.id} · Scenes: ${scenesCount} · Custom Fonts: ${fontsCount} · Audit Events: ${auditEntries}` }),
        el(
          'div',
          { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' } },
          el(
            'button',
            {
              className: 'bv-btn',
              attrs: { type: 'button' },
              on: {
                click: () => {
                  const snapshot = {
                    version: '2.1.0',
                    publisher: prov.publisher,
                    mark: prov.mark,
                    bookId: project.id,
                    scenes: scenesCount,
                    customFonts: fontsCount,
                    auditLogCount: auditEntries,
                    viewport: `${window.innerWidth}x${window.innerHeight}`,
                  };
                  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'quillvibe-diagnostics.json';
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 2500);
                  actions.notify('Downloaded local diagnostics JSON');
                },
              },
            },
            icon('download', 14),
            'Export Local Diagnostics JSON',
          ),
          el(
            'button',
            {
              className: 'bv-btn',
              attrs: { type: 'button' },
              on: {
                click: () => {
                  closeModal();
                  actions.openExtensionsModal('external');
                },
              },
            },
            icon('shield', 14),
            'Open Extension Audit & Sandbox',
          ),
        ),
      ),
    );
  };

  const modal = el(
    'div',
    {
      className: 'bv-modal',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Quillvibe Settings and Preferences' },
    },
    el(
      'div',
      { className: 'bv-panel-head' },
      el('span', { className: 'bv-panel-title', text: 'Settings, Custom Fonts & Publishing Setup' }),
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
      id: 'bv-settings-modal',
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
