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

  const syncHudContents = () => {
    const state = actions.getState();
    const { settings, immersiveMode, project } = state;
    hudEl.classList.toggle('is-visible', immersiveMode);
    if (!immersiveMode) return;

    hudEl.replaceChildren();
    wallClockEl.textContent = formatWallClock();

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
            className: 'bv-mini-btn is-active',
            attrs: { type: 'button', 'aria-label': 'Exit Immersive Mode (F11)' },
            on: { click: () => void actions.toggleImmersiveMode(false) },
          },
          icon('fullscreen-exit', 13),
          'Exit Fullscreen',
        ),
      ),
    );
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
      unsub();
      hudEl.remove();
    },
  };
}
