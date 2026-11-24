import { el, icon, type IconName } from './dom';

export interface ContextMenuItem {
  id?: string;
  label: string;
  icon?: IconName;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  checked?: boolean;
  onSelect: () => void;
}

export interface ContextMenuGroup {
  heading?: string;
  items: ContextMenuItem[];
}

let activeMenuEl: HTMLDivElement | null = null;
let globalDismissBound = false;

export function hideContextMenu(): void {
  if (activeMenuEl) {
    activeMenuEl.remove();
    activeMenuEl = null;
  }
}

function bindGlobalDismiss(): void {
  if (globalDismissBound || typeof document === 'undefined') return;
  globalDismissBound = true;

  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!activeMenuEl) return;
      const target = e.target as Node | null;
      if (target && activeMenuEl.contains(target)) return;
      hideContextMenu();
    },
    true,
  );

  window.addEventListener(
    'keydown',
    (e) => {
      if (!activeMenuEl) return;
      const buttons = Array.from(
        activeMenuEl.querySelectorAll<HTMLButtonElement>('.qv-ctx-item:not(:disabled)'),
      );
      if (e.key === 'Escape') {
        e.preventDefault();
        hideContextMenu();
        return;
      }
      if (buttons.length === 0) return;
      const curIdx = buttons.findIndex((b) => b === document.activeElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        buttons[(curIdx + 1) % buttons.length].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        buttons[(curIdx - 1 + buttons.length) % buttons.length].focus();
      }
    },
    true,
  );

  window.addEventListener('blur', hideContextMenu);
  window.addEventListener('resize', hideContextMenu, { passive: true });
  window.addEventListener(
    'scroll',
    (e) => {
      if (!activeMenuEl) return;
      const target = e.target as Node | null;
      if (target && activeMenuEl.contains(target)) return;
      hideContextMenu();
    },
    { capture: true, passive: true },
  );
}

/**
 * Displays a custom right-click context menu clamped cleanly inside the viewport.
 */
export function showContextMenu(
  clientX: number,
  clientY: number,
  groups: ContextMenuGroup[],
): void {
  if (typeof document === 'undefined') return;
  hideContextMenu();
  bindGlobalDismiss();

  const nonEmptyGroups = groups.filter((g) => g.items.length > 0);
  if (nonEmptyGroups.length === 0) return;

  const menu = el('div', {
    className: 'qv-ctx-menu',
    attrs: { role: 'menu', 'aria-label': 'Workspace actions' },
    on: {
      contextmenu: (e) => {
        e.preventDefault();
        e.stopPropagation();
      },
    },
  });

  nonEmptyGroups.forEach((group, gIdx) => {
    if (gIdx > 0) {
      menu.appendChild(el('div', { className: 'qv-ctx-sep', attrs: { role: 'separator' } }));
    }
    if (group.heading) {
      menu.appendChild(el('div', { className: 'qv-ctx-heading', text: group.heading }));
    }
    for (const item of group.items) {
      const btn = el(
        'button',
        {
          className: `qv-ctx-item${item.danger ? ' is-danger' : ''}${item.checked ? ' is-checked' : ''}`,
          attrs: {
            type: 'button',
            role: 'menuitem',
            disabled: item.disabled ? true : undefined,
          },
          on: {
            click: (e) => {
              e.stopPropagation();
              if (item.disabled) return;
              hideContextMenu();
              item.onSelect();
            },
          },
        },
        el(
          'span',
          { className: 'qv-ctx-left' },
          item.icon
            ? el('span', { className: 'qv-ctx-icon' }, icon(item.icon, 13))
            : el('span', { className: 'qv-ctx-icon', text: item.checked ? '✓' : '' }),
          el('span', { className: 'qv-ctx-label', text: item.label }),
        ),
        item.shortcut
          ? el('kbd', { className: 'qv-ctx-shortcut', text: item.shortcut })
          : null,
      );
      menu.appendChild(btn);
    }
  });

  menu.style.left = '0px';
  menu.style.top = '0px';
  document.body.appendChild(menu);
  activeMenuEl = menu;

  const rect = menu.getBoundingClientRect();
  const pad = 8;
  const maxX = Math.max(pad, window.innerWidth - rect.width - pad);
  const maxY = Math.max(pad, window.innerHeight - rect.height - pad);
  const left = Math.max(pad, Math.min(maxX, clientX));
  const top = Math.max(pad, Math.min(maxY, clientY));
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;

  const firstItem = menu.querySelector<HTMLButtonElement>('.qv-ctx-item:not(:disabled)');
  firstItem?.focus({ preventScroll: true });
}

/**
 * Helper to attach a custom contextmenu handler while letting Shift+Right-Click fall back to native browser inspect/spellcheck.
 */
export function attachContextMenu(
  target: HTMLElement,
  buildGroups: (e: MouseEvent) => ContextMenuGroup[] | null,
): void {
  target.addEventListener('contextmenu', (e) => {
    if (e.shiftKey) return;
    const groups = buildGroups(e);
    if (!groups || groups.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, groups);
  });
}
