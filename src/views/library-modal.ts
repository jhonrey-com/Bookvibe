import type { AppActions } from '../core/app-context';
import {
  ensureAuthorIdentity,
  generateAuthorKeyPair,
  signManuscript,
} from '../core/identity';
import {
  addBookToLibrary,
  deleteBookFromLibrary,
  duplicateBookInLibrary,
  normalizeProjectDefaults,
} from '../core/library';
import { getProjectWordCount } from '../core/manuscript';
import { el, icon } from '../ui/dom';

export function showLibraryModal(actions: AppActions): void {
  const existing = document.getElementById('bv-library-modal');
  if (existing) existing.remove();

  const renderBody = (modalBody: HTMLElement) => {
    modalBody.replaceChildren();
    const state = actions.getState();
    const library = state.library;
    const activeBook = normalizeProjectDefaults(state.project);
    const identity = ensureAuthorIdentity(activeBook);

    // 1. Multi-Book Shelf
    const newTitleIn = el('input', {
      className: 'bv-input',
      attrs: { type: 'text', placeholder: 'New book title…', 'aria-label': 'New book title' },
    });
    const newPenIn = el('input', {
      className: 'bv-input',
      attrs: { type: 'text', value: identity.penName, placeholder: 'Pen name…', 'aria-label': 'New book pen name' },
    });

    const shelfList = el('div', { className: 'bv-snap-list' });
    for (const book of library.books) {
      const isCurrent = book.id === activeBook.id;
      const pen = book.authorIdentity?.penName || book.author;
      const keyBadge = book.authorIdentity?.authorKeyId || 'No Key';
      shelfList.appendChild(
        el(
          'div',
          {
            className: 'bv-list-card',
            style: {
              borderColor: isCurrent ? 'var(--accent-ivory)' : 'var(--border-subtle)',
              background: isCurrent ? 'var(--bg-elevated)' : 'var(--bg-bar)',
            },
          },
          el(
            'div',
            { style: { minWidth: '0', flex: '1' } },
            el('div', {
              text: book.title,
              style: { fontWeight: '600', fontSize: '13px', color: 'var(--text-primary)' },
            }),
            el('div', {
              className: 'bv-mono-tag',
              text: `Pen: ${pen} · ${getProjectWordCount(book).toLocaleString()}w · ${keyBadge}`,
            }),
          ),
          el(
            'div',
            { style: { display: 'flex', gap: '6px' } },
            !isCurrent
              ? el('button', {
                  className: 'bv-mini-btn',
                  text: 'Open',
                  attrs: { type: 'button' },
                  on: {
                    click: () => {
                      actions.switchBook(book.id);
                      renderBody(modalBody);
                    },
                  },
                })
              : el('span', {
                  className: 'bv-mono-tag',
                  text: 'ACTIVE',
                  style: { color: 'var(--accent-emerald)', padding: '3px 6px' },
                }),
            el('button', {
              className: 'bv-mini-btn',
              text: 'Duplicate',
              attrs: { type: 'button' },
              on: {
                click: () => {
                  const res = duplicateBookInLibrary(actions.getState().library, book.id);
                  actions.replaceLibrary(res.library);
                  renderBody(modalBody);
                },
              },
            }),
            library.books.length > 1
              ? el('button', {
                  className: 'bv-mini-btn',
                  tooltip: { title: 'Delete Book', short: 'Remove this manuscript from the library shelf.' },
                  attrs: { type: 'button' },
                  on: {
                    click: () => {
                      const nextLib = deleteBookFromLibrary(actions.getState().library, book.id);
                      actions.replaceLibrary(nextLib);
                      renderBody(modalBody);
                    },
                  },
                }, icon('trash', 12))
              : null,
          ),
        ),
      );
    }

    // 2. Active Book Pen Name, Signature Pad & Author Key
    const penNameIn = el('input', {
      className: 'bv-input',
      attrs: { type: 'text', value: identity.penName },
      on: {
        change: () => {
          actions.mutateProject((prev) => {
            const next = normalizeProjectDefaults(prev);
            next.author = penNameIn.value;
            next.authorIdentity!.penName = penNameIn.value;
            return next;
          });
        },
      },
    });
    const sigTextIn = el('input', {
      className: 'bv-input',
      attrs: { type: 'text', value: identity.signatureText, placeholder: 'Typed signature name…' },
      on: {
        change: () => {
          actions.mutateProject((prev) => {
            const next = normalizeProjectDefaults(prev);
            next.authorIdentity!.signatureText = sigTextIn.value;
            return next;
          });
        },
      },
    });

    const sigCanvas = el('canvas', {
      className: 'bv-sig-canvas',
      attrs: { width: 420, height: 110, 'aria-label': 'Draw author signature' },
    });
    const sigCtx = sigCanvas.getContext('2d');
    if (sigCtx) {
      sigCtx.strokeStyle = '#e8e2d5';
      sigCtx.lineWidth = 2.2;
      sigCtx.lineCap = 'round';
      sigCtx.lineJoin = 'round';
      if (identity.signatureSvgDataUrl) {
        const img = new Image();
        img.onload = () => sigCtx.drawImage(img, 0, 0, sigCanvas.width, sigCanvas.height);
        img.src = identity.signatureSvgDataUrl;
      }

      let drawing = false;
      sigCanvas.addEventListener('pointerdown', (e) => {
        drawing = true;
        sigCanvas.setPointerCapture(e.pointerId);
        const r = sigCanvas.getBoundingClientRect();
        sigCtx.beginPath();
        sigCtx.moveTo(
          ((e.clientX - r.left) / r.width) * sigCanvas.width,
          ((e.clientY - r.top) / r.height) * sigCanvas.height,
        );
      });
      sigCanvas.addEventListener('pointermove', (e) => {
        if (!drawing) return;
        const r = sigCanvas.getBoundingClientRect();
        sigCtx.lineTo(
          ((e.clientX - r.left) / r.width) * sigCanvas.width,
          ((e.clientY - r.top) / r.height) * sigCanvas.height,
        );
        sigCtx.stroke();
      });
      sigCanvas.addEventListener('pointerup', () => {
        if (!drawing) return;
        drawing = false;
        const url = sigCanvas.toDataURL('image/png');
        actions.mutateProject((prev) => {
          const next = normalizeProjectDefaults(prev);
          next.authorIdentity!.signatureSvgDataUrl = url;
          return next;
        }, false);
      });
    }

    modalBody.append(
      el(
        'div',
        { className: 'bv-two-col' },
        el(
          'section',
          { className: 'bv-cork-card' },
          el('span', { className: 'bv-panel-title', text: `Books in Library (${library.books.length})` }),
          shelfList,
          el(
            'div',
            { style: { display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '6px', marginTop: '6px' } },
            newTitleIn,
            newPenIn,
            el(
              'button',
              {
                className: 'bv-btn bv-btn-primary',
                attrs: { type: 'button' },
                on: {
                  click: () => {
                    const res = addBookToLibrary(
                      actions.getState().library,
                      newTitleIn.value || 'Untitled Book',
                      newPenIn.value || 'Pen Name',
                    );
                    actions.replaceLibrary(res.library);
                    actions.notify(`Created “${res.newBook.title}”`);
                    renderBody(modalBody);
                  },
                },
              },
              icon('plus', 13),
              'New Book',
            ),
          ),
        ),
        el(
          'section',
          { className: 'bv-cork-card' },
          el('span', { className: 'bv-panel-title', text: 'Active Book Author Identity & Key' }),
          el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Pen Name (Published Name)' }), penNameIn),
          el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Typed Signature' }), sigTextIn),
          el(
            'div',
            { className: 'bv-field' },
            el(
              'div',
              { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
              el('label', { className: 'bv-label', text: 'Handwritten Signature Pad' }),
              el('button', {
                className: 'bv-mini-btn',
                text: 'Clear Ink',
                attrs: { type: 'button' },
                on: {
                  click: () => {
                    sigCtx?.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
                    actions.mutateProject((prev) => {
                      const next = normalizeProjectDefaults(prev);
                      next.authorIdentity!.signatureSvgDataUrl = '';
                      return next;
                    });
                  },
                },
              }),
            ),
            sigCanvas,
          ),
          el('div', {
            className: 'bv-mono-tag',
            text: `Author Key ID: ${identity.authorKeyId || 'None'} · ${identity.manuscriptDigest ? `Seal ${identity.manuscriptDigest.slice(0, 14)}…` : 'Not sealed yet'}`,
          }),
          el(
            'div',
            { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            el(
              'button',
              {
                className: 'bv-btn',
                attrs: { type: 'button' },
                on: {
                  click: async () => {
                    const pair = await generateAuthorKeyPair();
                    actions.mutateProject((prev) => {
                      const next = normalizeProjectDefaults(prev);
                      next.authorIdentity = { ...ensureAuthorIdentity(next), ...pair };
                      return next;
                    });
                    renderBody(modalBody);
                    actions.notify(`Generated Author Key ${pair.authorKeyId}`);
                  },
                },
              },
              icon('key', 14),
              'Generate Key',
            ),
            el(
              'button',
              {
                className: 'bv-btn bv-btn-primary',
                attrs: { type: 'button' },
                on: {
                  click: async () => {
                    const signed = await signManuscript(actions.getState().project);
                    actions.mutateProject(() => signed);
                    renderBody(modalBody);
                    actions.notify('Signed & sealed active book');
                  },
                },
              },
              icon('check', 14),
              'Sign & Seal Book',
            ),
          ),
        ),
      ),
    );
  };

  const modalBody = el('div', { className: 'bv-modal-body' });
  renderBody(modalBody);

  const closeModal = () => backdrop.remove();
  const modal = el(
    'div',
    {
      className: 'bv-modal',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Book Library and Author Identity' },
    },
    el(
      'div',
      { className: 'bv-panel-head' },
      el('span', { className: 'bv-panel-title', text: 'Multi-Book Library · Pen Name, Signature & Author Key' }),
      el('button', {
        className: 'bv-mini-btn',
        text: 'Close',
        attrs: { type: 'button' },
        on: { click: closeModal },
      }),
    ),
    modalBody,
  );

  const backdrop = el(
    'div',
    {
      className: 'bv-modal-backdrop',
      id: 'bv-library-modal',
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
