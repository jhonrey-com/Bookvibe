import {
  ALARM_RINGTONES,
  AlarmController,
  formatRemainingClock,
  playRingtonePreview,
} from '../core/alarm';
import type { AppActions } from '../core/app-context';
import { getProjectWordCount } from '../core/manuscript';
import type { AlarmRingtoneId } from '../core/types';
import { el, icon } from './dom';

export interface ImmersiveHudHandle {
  sync(): void;
  openAlarmPopover(): void;
  showRingingModal(label: string): void;
  destroy(): void;
}

function formatWallClock(): string {
  const now = new Date();
  return now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function mountImmersiveHud(
  actions: AppActions,
  alarm: AlarmController,
  sprintControls: { toggleSprint(): void; resetSprint(): void },
): ImmersiveHudHandle {
  const hudEl = el('aside', {
    className: 'qv-immersive-hud',
    attrs: { role: 'region', 'aria-label': 'Immersive Focus Controls' },
  });
  document.body.appendChild(hudEl);

  // Top-edge mouse hover dropdown bar (Windows Virtual Desktop style)
  let topDropPinned = false;
  let hudHiddenByUser = false;
  const topStripHoverZone = el('div', {
    className: 'qv-imm-top-sensor',
    attrs: { 'aria-hidden': 'true' },
  });
  const topStripDrawer = el('div', {
    className: 'qv-imm-top-dropdown',
    attrs: { role: 'toolbar', 'aria-label': 'Immersive Screen Top Controls' },
  });
  document.body.append(topStripHoverZone, topStripDrawer);

  const showTopDropdown = () => {
    if (!actions.getState().immersiveMode) return;
    topStripDrawer.classList.add('is-open');
  };
  let topHideTimer: number | null = null;
  const scheduleHideTopDropdown = () => {
    if (topDropPinned) return;
    if (topHideTimer) window.clearTimeout(topHideTimer);
    topHideTimer = window.setTimeout(() => {
      if (!topStripDrawer.matches(':hover') && !topStripHoverZone.matches(':hover')) {
        topStripDrawer.classList.remove('is-open');
      }
    }, 240);
  };
  topStripHoverZone.addEventListener('mouseenter', showTopDropdown);
  topStripDrawer.addEventListener('mouseenter', () => {
    if (topHideTimer) window.clearTimeout(topHideTimer);
    showTopDropdown();
  });
  topStripHoverZone.addEventListener('mouseleave', scheduleHideTopDropdown);
  topStripDrawer.addEventListener('mouseleave', scheduleHideTopDropdown);

  const onWindowMouseMove = (e: MouseEvent) => {
    if (!actions.getState().immersiveMode) return;
    if (e.clientY <= 12) {
      if (topHideTimer) window.clearTimeout(topHideTimer);
      showTopDropdown();
    }
  };
  window.addEventListener('mousemove', onWindowMouseMove, { passive: true });

  const applyHudPosition = () => {
    const s = actions.getState().settings;
    if (s.immersiveHudX >= 0) {
      const maxX = Math.max(8, window.innerWidth - Math.max(180, hudEl.offsetWidth) - 8);
      const maxY = Math.max(8, window.innerHeight - Math.max(48, hudEl.offsetHeight) - 8);
      hudEl.style.left = `${Math.min(maxX, Math.max(8, s.immersiveHudX))}px`;
      hudEl.style.top = `${Math.min(maxY, Math.max(8, s.immersiveHudY))}px`;
      hudEl.style.transform = 'none';
    } else {
      hudEl.style.left = '50%';
      hudEl.style.top = `${Math.max(10, Math.min(200, s.immersiveHudY || 12))}px`;
      hudEl.style.transform = 'translateX(-50%)';
    }
  };

  let draggingHud = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  const startHudDrag = (e: PointerEvent) => {
    if (e.button !== 0) return;
    draggingHud = true;
    const rect = hudEl.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    hudEl.classList.add('is-dragging');
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  window.addEventListener('pointermove', (e) => {
    if (!draggingHud) return;
    const maxX = Math.max(8, window.innerWidth - Math.max(160, hudEl.offsetWidth) - 8);
    const maxY = Math.max(8, window.innerHeight - Math.max(40, hudEl.offsetHeight) - 8);
    const nextX = Math.round(Math.min(maxX, Math.max(8, e.clientX - dragOffsetX)));
    const nextY = Math.round(Math.min(maxY, Math.max(8, e.clientY - dragOffsetY)));
    hudEl.style.left = `${nextX}px`;
    hudEl.style.top = `${nextY}px`;
    hudEl.style.transform = 'none';
  });
  window.addEventListener('pointerup', () => {
    if (!draggingHud) return;
    draggingHud = false;
    hudEl.classList.remove('is-dragging');
    const rect = hudEl.getBoundingClientRect();
    actions.updateSettings({
      immersiveHudX: Math.round(rect.left),
      immersiveHudY: Math.round(rect.top),
    });
  });

  const wallClockEl = el('span', { className: 'qv-imm-clock', text: formatWallClock() });
  const sprintTextEl = el('span', { className: 'qv-imm-metric', text: '' });
  const sprintBtnEl = el('button', {
    className: 'bv-mini-btn',
    text: 'Start',
    attrs: { type: 'button' },
    on: { click: () => sprintControls.toggleSprint() },
  });
  const wordsEl = el('span', { className: 'qv-imm-metric', text: '' });
  const alarmBtnLabel = el('span', { text: 'Alarm' });
  const alarmBtn = el(
    'button',
    {
      className: 'bv-mini-btn qv-imm-alarm-btn',
      attrs: { type: 'button', 'aria-label': 'Configure writing alarm clock' },
      on: { click: () => openAlarmPopover() },
    },
    icon('alarm', 13),
    alarmBtnLabel,
  );

  const renderTopStripControls = () => {
    const state = actions.getState();
    topStripDrawer.replaceChildren(
      el('span', { className: 'qv-imm-top-label', text: state.project.title || 'Quillvibe Immersive' }),
      el('button', {
        className: `bv-mini-btn${!hudHiddenByUser ? ' is-active' : ''}`,
        text: hudHiddenByUser ? 'Show Focus Bar' : 'Hide Focus Bar',
        attrs: { type: 'button' },
        on: {
          click: () => {
            hudHiddenByUser = !hudHiddenByUser;
            syncHudContents();
          },
        },
      }),
      el('button', {
        className: 'bv-mini-btn',
        text: state.settings.immersiveHudCollapsed ? 'Expand Bar' : 'Collapse Bar',
        attrs: { type: 'button' },
        on: {
          click: () => {
            actions.updateSettings({ immersiveHudCollapsed: !state.settings.immersiveHudCollapsed });
            syncHudContents();
          },
        },
      }),
      el('button', {
        className: 'bv-mini-btn',
        text: 'Center Bar',
        attrs: { type: 'button' },
        on: {
          click: () => {
            hudHiddenByUser = false;
            actions.updateSettings({ immersiveHudX: -1, immersiveHudY: 12 });
            syncHudContents();
          },
        },
      }),
      el('button', {
        className: 'bv-mini-btn',
        text: 'Alarm',
        attrs: { type: 'button' },
        on: { click: () => openAlarmPopover() },
      }),
      el('button', {
        className: 'bv-mini-btn is-active',
        text: 'Exit Fullscreen (F11)',
        attrs: { type: 'button' },
        on: { click: () => void actions.toggleImmersiveMode(false) },
      }),
    );
  };

  const syncHudContents = () => {
    const state = actions.getState();
    const { settings, immersiveMode, project } = state;
    topStripHoverZone.classList.toggle('is-visible', immersiveMode);
    if (!immersiveMode) {
      topStripDrawer.classList.remove('is-open');
      hudEl.classList.remove('is-visible');
      return;
    }

    renderTopStripControls();
    hudEl.classList.toggle('is-visible', !hudHiddenByUser);
    hudEl.classList.toggle('is-collapsed', settings.immersiveHudCollapsed);
    if (hudHiddenByUser) return;

    hudEl.replaceChildren();
    wallClockEl.textContent = formatWallClock();

    const dragHandle = el(
      'div',
      {
        className: 'qv-imm-drag-handle',
        attrs: { title: 'Drag to move Immersive Bar' },
        on: { pointerdown: startHudDrag },
      },
      el('span', { text: '⋮⋮', style: { fontSize: '12px', fontWeight: '700', lineHeight: '1' } }),
    );

    const collapseBtn = el('button', {
      className: 'bv-mini-btn',
      text: settings.immersiveHudCollapsed ? '+' : '−',
      attrs: { type: 'button', 'aria-label': settings.immersiveHudCollapsed ? 'Expand focus bar' : 'Collapse focus bar', title: settings.immersiveHudCollapsed ? 'Expand Bar' : 'Collapse Bar' },
      on: {
        click: () => {
          actions.updateSettings({ immersiveHudCollapsed: !settings.immersiveHudCollapsed });
          syncHudContents();
        },
      },
    });

    hudEl.appendChild(dragHandle);

    if (settings.immersiveHudCollapsed) {
      hudEl.append(
        el('div', { className: 'qv-imm-item' }, icon('clock', 13), wallClockEl),
        collapseBtn,
        el('button', {
          className: 'bv-mini-btn is-active',
          attrs: { type: 'button', 'aria-label': 'Exit Immersive Mode (F11)' },
          on: { click: () => void actions.toggleImmersiveMode(false) },
        }, icon('fullscreen-exit', 13)),
      );
      requestAnimationFrame(applyHudPosition);
      return;
    }

    if (settings.immersiveShowClock) {
      hudEl.appendChild(
        el('div', { className: 'qv-imm-item' }, icon('clock', 13), wallClockEl),
      );
    }

    if (settings.immersiveShowTimer) {
      const total = getProjectWordCount(project);
      const delta = total - state.sprintStartWords;
      const sign = delta >= 0 ? `+${delta}w` : `${delta}w`;
      sprintTextEl.textContent = `Sprint ${formatRemainingClock(state.sprintRemainingSec)} · ${sign}`;
      sprintBtnEl.textContent = state.sprintRunning ? 'Pause' : 'Start';
      hudEl.appendChild(
        el(
          'div',
          { className: 'qv-imm-item' },
          sprintTextEl,
          sprintBtnEl,
          el('button', {
            className: 'bv-mini-btn',
            text: 'Reset',
            attrs: { type: 'button' },
            on: { click: () => sprintControls.resetSprint() },
          }),
        ),
      );
    }

    if (settings.immersiveShowWords) {
      const total = getProjectWordCount(project);
      wordsEl.textContent = `${total.toLocaleString()} / ${project.wordTarget.toLocaleString()} words`;
      hudEl.appendChild(
        el('div', { className: 'qv-imm-item' }, icon('quill', 13), wordsEl),
      );
    }

    if (settings.immersiveShowAlarm) {
      const snap = alarm.getSnapshot();
      alarmBtnLabel.textContent = snap.armed
        ? `Alarm ${formatRemainingClock(snap.remainingSeconds)}`
        : 'Alarm';
      alarmBtn.classList.toggle('is-active', snap.armed || snap.ringing);
      hudEl.appendChild(el('div', { className: 'qv-imm-item' }, alarmBtn));
    }

    hudEl.appendChild(
      el(
        'div',
        { className: 'qv-imm-item' },
        el(
          'button',
          {
            className: 'bv-mini-btn',
            attrs: { type: 'button', 'aria-label': 'Configure immersive widgets' },
            on: { click: () => actions.openSettingsModal('editor') },
          },
          icon('settings', 13),
          'Customize',
        ),
        el(
          'button',
          {
            className: 'bv-mini-btn',
            text: 'Hide',
            attrs: { type: 'button', title: 'Hide bar (move mouse to top edge of screen to restore)' },
            on: {
              click: () => {
                hudHiddenByUser = true;
                syncHudContents();
              },
            },
          },
        ),
        collapseBtn,
        el(
          'button',
          {
            className: 'bv-mini-btn is-active',
            attrs: { type: 'button', 'aria-label': 'Exit Immersive Mode (F11)' },
            on: { click: () => void actions.toggleImmersiveMode(false) },
          },
          icon('fullscreen-exit', 13),
          'Exit',
        ),
      ),
    );
    requestAnimationFrame(applyHudPosition);
  };

  const clockInterval = window.setInterval(() => {
    if (actions.getState().immersiveMode) {
      wallClockEl.textContent = formatWallClock();
      if (actions.getState().settings.immersiveShowTimer) {
        const s = actions.getState();
        const delta = getProjectWordCount(s.project) - s.sprintStartWords;
        sprintTextEl.textContent = `Sprint ${formatRemainingClock(s.sprintRemainingSec)} · ${delta >= 0 ? '+' : ''}${delta}w`;
      }
    }
  }, 1000);

  const openAlarmPopover = () => {
    const existing = document.getElementById('qv-alarm-popover-modal');
    if (existing) {
      existing.remove();
      return;
    }

    const state = actions.getState();
    const snap = alarm.getSnapshot();
    const defaultTime = new Date(Date.now() + 30 * 60 * 1000);
    const defaultHHMM = `${String(defaultTime.getHours()).padStart(2, '0')}:${String(defaultTime.getMinutes()).padStart(2, '0')}`;

    const labelIn = el('input', {
      className: 'bv-input',
      attrs: {
        type: 'text',
        value: snap.armed ? snap.label : 'Chapter Break',
        placeholder: 'Alarm note…',
      },
    });
    const timeIn = el('input', {
      className: 'bv-input',
      attrs: { type: 'time', value: defaultHHMM },
    });
    const minsIn = el('input', {
      className: 'bv-input',
      attrs: { type: 'number', min: 1, max: 720, value: 25 },
    });
    const toneSel = el(
      'select',
      {
        className: 'bv-input',
        on: {
          change: () => {
            const id = toneSel.value as AlarmRingtoneId;
            actions.updateSettings({ alarmRingtone: id });
            playRingtonePreview(id, actions.getState().settings.alarmVolume);
          },
        },
      },
      ...ALARM_RINGTONES.map((rt) =>
        el('option', {
          text: rt.label,
          attrs: { value: rt.id, selected: state.settings.alarmRingtone === rt.id },
        }),
      ),
    );

    const closePop = () => backdrop.remove();
    const backdrop = el(
      'div',
      {
        className: 'bv-modal-backdrop',
        id: 'qv-alarm-popover-modal',
        on: {
          click: (e) => {
            if (e.target === backdrop) closePop();
          },
        },
      },
      el(
        'div',
        {
          className: 'bv-modal qv-alarm-modal',
          attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Writing Alarm Clock' },
        },
        el(
          'div',
          { className: 'bv-panel-head' },
          el('span', { className: 'bv-panel-title', text: 'Writing Alarm Clock & Ringtones' }),
          el('button', {
            className: 'bv-mini-btn',
            text: 'Close',
            attrs: { type: 'button' },
            on: { click: closePop },
          }),
        ),
        el(
          'div',
          { className: 'bv-modal-body', style: { gap: '10px' } },
          el(
            'div',
            { className: 'bv-field' },
            el('label', { className: 'bv-label', text: 'Alarm Label' }),
            labelIn,
          ),
          el(
            'div',
            { className: 'bv-two-col' },
            el(
              'section',
              { className: 'bv-cork-card' },
              el('span', { className: 'bv-panel-title', text: 'Quick Countdown (Minutes)' }),
              el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
                ...[15, 25, 45, 60].map((m) =>
                  el('button', {
                    className: 'bv-mini-btn',
                    text: `${m}m`,
                    attrs: { type: 'button' },
                    on: {
                      click: () => {
                        alarm.setCountdownAlarm(m, labelIn.value);
                        actions.notify(`Alarm set for ${m} minutes`);
                        closePop();
                      },
                    },
                  }),
                ),
              ),
              el(
                'div',
                { style: { display: 'flex', gap: '6px', marginTop: '6px' } },
                minsIn,
                el('button', {
                  className: 'bv-btn bv-btn-primary',
                  text: 'Start Countdown',
                  attrs: { type: 'button' },
                  on: {
                    click: () => {
                      const mins = Number(minsIn.value) || 25;
                      alarm.setCountdownAlarm(mins, labelIn.value);
                      actions.notify(`Alarm set for ${mins} minutes`);
                      closePop();
                    },
                  },
                }),
              ),
            ),
            el(
              'section',
              { className: 'bv-cork-card' },
              el('span', { className: 'bv-panel-title', text: 'Wall-Clock Time' }),
              timeIn,
              el('button', {
                className: 'bv-btn bv-btn-primary',
                text: 'Set Clock Alarm',
                attrs: { type: 'button' },
                on: {
                  click: () => {
                    if (alarm.setClockAlarm(timeIn.value, labelIn.value)) {
                      actions.notify(`Alarm armed for ${timeIn.value}`);
                      closePop();
                    } else {
                      actions.notify('Enter a valid HH:MM time.');
                    }
                  },
                },
              }),
            ),
          ),
          el(
            'section',
            { className: 'bv-cork-card' },
            el('span', { className: 'bv-panel-title', text: 'Ringtone Sound' }),
            el(
              'div',
              { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
              toneSel,
              el('button', {
                className: 'bv-btn',
                text: 'Preview Ringtone',
                attrs: { type: 'button' },
                on: {
                  click: () => {
                    const s = actions.getState().settings;
                    playRingtonePreview(s.alarmRingtone, s.alarmVolume);
                  },
                },
              }),
              snap.armed
                ? el('button', {
                    className: 'bv-btn',
                    text: 'Cancel Active Alarm',
                    attrs: { type: 'button' },
                    on: {
                      click: () => {
                        alarm.dismiss();
                        actions.notify('Active alarm cancelled.');
                        closePop();
                      },
                    },
                  })
                : null,
            ),
          ),
        ),
      ),
    );
    document.body.appendChild(backdrop);
  };

  const showRingingModal = (label: string) => {
    const existing = document.getElementById('qv-alarm-ring-modal');
    if (existing) existing.remove();

    const closeRing = () => backdrop.remove();
    const backdrop = el(
      'div',
      {
        className: 'bv-modal-backdrop',
        id: 'qv-alarm-ring-modal',
      },
      el(
        'div',
        {
          className: 'bv-modal qv-alarm-ring-modal',
          attrs: { role: 'alertdialog', 'aria-modal': 'true', 'aria-label': 'Writing Alarm Ringing' },
        },
        el(
          'div',
          { className: 'qv-alarm-ring-body' },
          el('div', { className: 'qv-alarm-ring-icon' }, icon('bell', 28)),
          el('h3', { text: label || 'Writing Alarm' }),
          el('p', { className: 'bv-label', text: `Local time: ${formatWallClock()}` }),
          el(
            'div',
            { style: { display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '8px' } },
            el('button', {
              className: 'bv-btn',
              text: 'Snooze 5 min',
              attrs: { type: 'button' },
              on: {
                click: () => {
                  alarm.snooze(5);
                  closeRing();
                  actions.notify('Alarm snoozed for 5 minutes');
                },
              },
            }),
            el('button', {
              className: 'bv-btn bv-btn-primary',
              text: 'Dismiss Alarm',
              attrs: { type: 'button' },
              on: {
                click: () => {
                  alarm.dismiss();
                  closeRing();
                },
              },
            }),
          ),
        ),
      ),
    );
    document.body.appendChild(backdrop);
  };

  const unsub = alarm.subscribe(() => syncHudContents());

  return {
    sync: syncHudContents,
    openAlarmPopover,
    showRingingModal,
    destroy: () => {
      window.clearInterval(clockInterval);
      window.removeEventListener('mousemove', onWindowMouseMove);
      unsub();
      hudEl.remove();
      topStripHoverZone.remove();
      topStripDrawer.remove();
    },
  };
}
