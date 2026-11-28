import type { AppActions } from '../core/app-context';
import type { AppThemeId } from '../core/types';
import { createMorphThemeIcon, el } from './dom';

const THEME_ORDER: AppThemeId[] = ['system', 'ivory', 'parchment', 'obsidian'];

/**
 * Reusable morphing Application Theme switcher button synced with AppState.
 */
export function createAppThemeButton(actions: AppActions, size = 16): HTMLButtonElement {
  const current = actions.getState().settings.appTheme;
  const btn = el('button', {
    className: 'bv-topbar-btn qv-global-theme-btn',
    tooltip: {
      title: 'Application Theme',
      short: 'Cycle studio theme: System, Ivory Light, Warm Parchment, or Obsidian Dark.',
    },
    attrs: {
      type: 'button',
      'aria-label': `Switch Application Theme (${current})`,
      title: `Switch Application Theme (${current})`,
    },
  });

  const syncIcon = (theme: AppThemeId) => {
    btn.replaceChildren(createMorphThemeIcon(theme, size));
    btn.setAttribute('aria-label', `Switch Application Theme (${theme})`);
    btn.setAttribute('title', `Switch Application Theme (${theme})`);
  };

  syncIcon(current);

  btn.addEventListener('click', () => {
    const now = actions.getState().settings.appTheme;
    const next = THEME_ORDER[(THEME_ORDER.indexOf(now) + 1) % THEME_ORDER.length];
    actions.updateSettings({ appTheme: next });
    syncIcon(next);
    actions.notify(`Theme: ${next}`);
  });

  return btn;
}
