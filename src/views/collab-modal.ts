import type { AppActions } from '../core/app-context';
import {
  getLanSyncStatus,
  launchBluetoothShare,
  openBookvibeFile,
  pollLanIncomingSync,
  pullFromLanPeer,
  pushToLanPeer,
  startLanSyncHost,
  stopLanSyncHost,
} from '../core/bridge';
import {
  COLLABORATOR_ROLE_LABELS,
  addCollaborator,
  mergeBookRevisions,
  removeCollaborator,
} from '../core/collab';
import { parseExtensionFile, serializeExtensionFile } from '../core/extensions';
import { normalizeProjectDefaults } from '../core/library';
import type { CollaboratorRole, LanSessionInfo } from '../core/types';
import { el, icon } from '../ui/dom';
import { LiquidGlassControl } from '../ui/liquid-glass';

type CollabTab = 'credits' | 'wifi' | 'bluetooth';

export function showCollabModal(actions: AppActions): void {
  const existing = document.getElementById('bv-collab-modal');
  if (existing) existing.remove();

  let activeTab: CollabTab = 'credits';
  let activeGlass: LiquidGlassControl<CollabTab> | null = null;
  let lanSession: LanSessionInfo | null = null;
  let savedPeerAddr = '192.168.1.';
  let savedPeerPin = '';

  const contentArea = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } });

  const mergeIncomingRaw = (rawJson: string, filenameHint: string, peerLabel: string) => {
    const parsed = parseExtensionFile(rawJson, filenameHint);
    if (parsed.extension !== '.bookvibe' && parsed.extension !== '.bvibe') {
      actions.notify('Peer file must be a .bookvibe or .bvibe book package.');
      return;
    }
    const summary = mergeBookRevisions(actions.getState().project, parsed.payload, peerLabel);
    actions.mutateProject(() => summary.project);
    actions.notify(
      `Synced ${peerLabel}: ${summary.updatedScenes} updated, ${summary.addedScenes} new scenes, ${summary.mergedAnnotations} notes`,
    );
  };

  const renderTabContent = async () => {
    contentArea.replaceChildren();
    const project = normalizeProjectDefaults(actions.getState().project);
    const collabs = project.collaborators ?? [];

    if (activeTab === 'credits') {
      const activeNames = [
        project.authorIdentity?.penName || project.author || 'Primary Author',
        ...collabs.map((c) => c.penName || c.name),
      ];
      const activeSel = el(
        'select',
        {
          className: 'bv-input',
          on: {
            change: () => {
              actions.mutateProject((prev) => ({ ...prev, activeAuthorLabel: activeSel.value }));
              actions.notify(`Active editing identity: ${activeSel.value}`);
            },
          },
        },
        ...activeNames.map((n) =>
          el('option', {
            text: n,
            attrs: { value: n, selected: project.activeAuthorLabel === n },
          }),
        ),
      );

      const list = el('div', { className: 'bv-snap-list' });
      if (collabs.length === 0) {
        list.appendChild(
          el('span', { className: 'bv-label', text: 'No co-authors or proofreaders credited yet.' }),
        );
      } else {
        for (const c of collabs) {
          list.appendChild(
            el(
              'div',
              { className: 'bv-list-card' },
              el(
                'div',
                {},
                el('div', {
                  text: `${c.penName || c.name} · ${COLLABORATOR_ROLE_LABELS[c.role]}`,
                  style: { fontWeight: '600', color: 'var(--text-primary)' },
                }),
                el('div', {
                  className: 'bv-label',
                  text: `${c.creditLine}${c.authorKeyId ? ` · Key ${c.authorKeyId}` : ''}`,
                }),
              ),
              el(
                'button',
                {
                  className: 'bv-mini-btn',
                  attrs: { type: 'button', title: 'Remove collaborator' },
                  on: {
                    click: () => {
                      actions.mutateProject((prev) => removeCollaborator(prev, c.id));
                      void renderTabContent();
                    },
                  },
                },
                icon('trash', 12),
              ),
            ),
          );
        }
      }

      const nameIn = el('input', {
        className: 'bv-input',
        attrs: { type: 'text', placeholder: 'Name / Pen name' },
      });
      const roleSel = el(
        'select',
        { className: 'bv-input' },
        ...(['co-author', 'proofreader', 'editor', 'beta-reader'] as const).map((r) =>
          el('option', { text: COLLABORATOR_ROLE_LABELS[r], attrs: { value: r } }),
        ),
      );
      const creditIn = el('input', {
        className: 'bv-input',
        attrs: { type: 'text', placeholder: 'Credit line (e.g. Copyediting & Proofreading)' },
      });
      const keyIn = el('input', {
        className: 'bv-input',
        attrs: { type: 'text', placeholder: 'Author Key ID (optional)' },
      });

      contentArea.append(
        el(
          'div',
          { className: 'bv-cork-card' },
          el('span', { className: 'bv-panel-title', text: 'Active Editor / Reviewer Role' }),
          el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Attribution for new proofreader notes & snapshots' }), activeSel),
        ),
        el(
          'div',
          { className: 'bv-two-col' },
          el(
            'div',
            { className: 'bv-cork-card' },
            el('span', { className: 'bv-panel-title', text: `Co-Authors & Proofreaders (${collabs.length})` }),
            list,
          ),
          el(
            'div',
            { className: 'bv-cork-card' },
            el('span', { className: 'bv-panel-title', text: 'Add Credit & Collaborator' }),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Name' }), nameIn),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Role' }), roleSel),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Published Credit Line' }), creditIn),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Peer Author Key ID' }), keyIn),
            el(
              'button',
              {
                className: 'bv-btn bv-btn-primary',
                attrs: { type: 'button' },
                on: {
                  click: () => {
                    if (!nameIn.value.trim()) {
                      actions.notify('Enter a collaborator name.');
                      return;
                    }
                    actions.mutateProject((prev) =>
                      addCollaborator(prev, {
                        name: nameIn.value,
                        role: roleSel.value as CollaboratorRole,
                        creditLine: creditIn.value,
                        authorKeyId: keyIn.value,
                      }),
                    );
                    void renderTabContent();
                    actions.notify('Added collaborator credit');
                  },
                },
              },
              icon('plus', 14),
              'Add Collaborator',
            ),
          ),
        ),
      );
      return;
    }

    if (activeTab === 'wifi') {
      lanSession = await getLanSyncStatus();
      const peerAddrIn = el('input', {
        className: 'bv-input',
        attrs: { type: 'text', value: savedPeerAddr, placeholder: '192.168.1.42:48321' },
        on: { input: () => (savedPeerAddr = peerAddrIn.value) },
      });
      const peerPinIn = el('input', {
        className: 'bv-input',
        attrs: { type: 'text', value: savedPeerPin, placeholder: '6-digit PIN' },
        on: { input: () => (savedPeerPin = peerPinIn.value) },
      });

      contentArea.append(
        el(
          'div',
          { className: 'bv-two-col' },
          el(
            'section',
            { className: 'bv-cork-card' },
            el('span', { className: 'bv-panel-title', text: 'Host Offline Same-Wi-Fi Session' }),
            el('p', {
              className: 'bv-label',
              text: 'Shares this book directly over your local Wi-Fi router without internet. Teammates enter your LAN address and 6-digit PIN.',
            }),
            lanSession?.active
              ? el(
                  'div',
                  { className: 'bv-list-card', style: { flexDirection: 'column', alignItems: 'flex-start', gap: '4px' } },
                  el('div', {
                    className: 'bv-mono-tag',
                    text: `Address: ${lanSession.hostIp}:${lanSession.port}`,
                    style: { color: 'var(--accent-ivory)', fontSize: '12.5px' },
                  }),
                  el('div', {
                    className: 'bv-mono-tag',
                    text: `Pairing PIN: ${lanSession.pin}`,
                    style: { color: 'var(--accent-emerald)', fontSize: '13px', fontWeight: '600' },
                  }),
                  el('div', {
                    className: 'bv-label',
                    text: `Pending peer pushes: ${lanSession.incomingCount}`,
                  }),
                )
              : null,
            el(
              'div',
              { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
              !lanSession?.active
                ? el(
                    'button',
                    {
                      className: 'bv-btn bv-btn-primary',
                      attrs: { type: 'button' },
                      on: {
                        click: async () => {
                          try {
                            const json = serializeExtensionFile('.bookvibe', actions.getState().project);
                            lanSession = await startLanSyncHost(
                              json,
                              actions.getState().project.activeAuthorLabel || 'Bookvibe Host',
                            );
                            void renderTabContent();
                            actions.notify(`LAN Host active at ${lanSession.hostIp}:${lanSession.port}`);
                          } catch (err) {
                            actions.notify(err instanceof Error ? err.message : 'Unable to start LAN host.');
                          }
                        },
                      },
                    },
                    icon('wifi', 14),
                    'Start LAN Sync Host',
                  )
                : el(
                    'button',
                    {
                      className: 'bv-btn',
                      text: 'Stop Host',
                      attrs: { type: 'button' },
                      on: {
                        click: async () => {
                          await stopLanSyncHost();
                          lanSession = null;
                          void renderTabContent();
                        },
                      },
                    },
                  ),
              lanSession?.active
                ? el('button', {
                    className: 'bv-btn',
                    text: 'Merge Incoming Push',
                    attrs: { type: 'button' },
                    on: {
                      click: async () => {
                        const incoming = await pollLanIncomingSync();
                        if (!incoming) {
                          actions.notify('No incoming peer edits waiting.');
                          return;
                        }
                        mergeIncomingRaw(incoming, 'peer.bookvibe', 'Wi-Fi Peer');
                        void renderTabContent();
                      },
                    },
                  })
                : null,
            ),
          ),
          el(
            'section',
            { className: 'bv-cork-card' },
            el('span', { className: 'bv-panel-title', text: 'Connect to Peer on Same Wi-Fi' }),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Peer LAN Address (IP:PORT)' }), peerAddrIn),
            el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Host 6-Digit PIN' }), peerPinIn),
            el(
              'div',
              { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
              el('button', {
                className: 'bv-btn bv-btn-primary',
                text: 'Pull & Merge Book',
                attrs: { type: 'button' },
                on: {
                  click: async () => {
                    try {
                      const raw = await pullFromLanPeer(peerAddrIn.value, peerPinIn.value);
                      mergeIncomingRaw(raw, 'lan-peer.bookvibe', peerAddrIn.value);
                    } catch (err) {
                      actions.notify(err instanceof Error ? err.message : 'LAN pull failed.');
                    }
                  },
                },
              }),
              el('button', {
                className: 'bv-btn',
                text: 'Push My Edits to Host',
                attrs: { type: 'button' },
                on: {
                  click: async () => {
                    try {
                      const json = serializeExtensionFile('.bookvibe', actions.getState().project);
                      await pushToLanPeer(peerAddrIn.value, peerPinIn.value, json);
                      actions.notify('Sent book edits to LAN host');
                    } catch (err) {
                      actions.notify(err instanceof Error ? err.message : 'LAN push failed.');
                    }
                  },
                },
              }),
            ),
          ),
        ),
      );
      return;
    }

    // Bluetooth / Nearby Share Sync
    contentArea.append(
      el(
        'div',
        { className: 'bv-two-col' },
        el(
          'section',
          { className: 'bv-cork-card' },
          el('span', { className: 'bv-panel-title', text: 'Send via Bluetooth / Nearby Share' }),
          el('p', {
            className: 'bv-label',
            text: 'Save a signed .bookvibe revision package and launch your OS Bluetooth File Transfer or Nearby Share / AirDrop wizard with zero internet connection.',
          }),
          el(
            'div',
            { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            el(
              'button',
              {
                className: 'bv-btn bv-btn-primary',
                attrs: { type: 'button' },
                on: {
                  click: async () => {
                    await actions.exportAsExtension('.bookvibe');
                    const msg = await launchBluetoothShare();
                    actions.notify(msg);
                  },
                },
              },
              icon('bluetooth', 14),
              'Save & Open Bluetooth Transfer',
            ),
          ),
        ),
        el(
          'section',
          { className: 'bv-cork-card' },
          el('span', { className: 'bv-panel-title', text: 'Merge Received Bluetooth / AirDrop File' }),
          el('p', {
            className: 'bv-label',
            text: 'Import a co-author or proofreader’s .bookvibe file received over Bluetooth or USB. Conflicting scene edits are automatically preserved as snapshots.',
          }),
          el(
            'button',
            {
              className: 'bv-btn',
              attrs: { type: 'button' },
              on: {
                click: async () => {
                  const opened = await openBookvibeFile();
                  if (!opened) return;
                  mergeIncomingRaw(opened.content, opened.filename, opened.filename);
                },
              },
            },
            icon('folder', 14),
            'Pick & Merge Peer File…',
          ),
        ),
      ),
    );
  };

  const tabSwitcher = new LiquidGlassControl<CollabTab>({
    ariaLabel: 'Collaboration method',
    surface: 'solid',
    compact: true,
    value: activeTab,
    options: [
      { id: 'credits', label: 'Co-Authors & Proofreaders', icon: 'collab' },
      { id: 'wifi', label: 'Same-Wi-Fi LAN Sync', icon: 'wifi' },
      { id: 'bluetooth', label: 'Bluetooth & Nearby Sync', icon: 'bluetooth' },
    ],
    onChange: (tab) => {
      activeTab = tab;
      void renderTabContent();
    },
  });
  activeGlass = tabSwitcher;

  const closeModal = () => {
    activeGlass?.destroy();
    backdrop.remove();
  };

  const modal = el(
    'div',
    {
      className: 'bv-modal',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Collaborate and Credits' },
    },
    el(
      'div',
      { className: 'bv-panel-head' },
      el('span', { className: 'bv-panel-title', text: 'Offline Collaboration · Co-Authors, Proofreaders & Direct Sync' }),
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
      tabSwitcher.element,
      contentArea,
    ),
  );

  const backdrop = el(
    'div',
    {
      className: 'bv-modal-backdrop',
      id: 'bv-collab-modal',
      on: {
        click: (e) => {
          if (e.target === backdrop) closeModal();
        },
      },
    },
    modal,
  );

  document.body.appendChild(backdrop);
  void renderTabContent();
}
