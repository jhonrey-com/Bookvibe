import type { AppActions } from '../core/app-context';
import { removeImageBackgroundClient } from '../core/bg-remove';
import { updateSceneInProject } from '../core/manuscript';
import {
  WRAP_MODE_LABELS,
  computeSnappedImagePosition,
  readImageFileToSceneImage,
} from '../core/scene-images';
import type { SceneImageItem, SceneImageWrapMode, SceneNode } from '../core/types';
import { el, icon } from './dom';
import { showErrorDialog } from './error-dialog';

let selectedImageId = '';
let visualLayoutOpen = true;
let snapToGridEnabled = true;

export function setSelectedSceneImage(id: string, openLayout = true): void {
  selectedImageId = id;
  if (openLayout) visualLayoutOpen = true;
}

export async function addImageFilesToScene(
  files: FileList | File[],
  sceneId: string,
  actions: AppActions,
  anchorParagraph = 0,
): Promise<void> {
  const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
  if (list.length === 0) return;

  try {
    const created: SceneImageItem[] = [];
    for (const file of list) {
      const item = await readImageFileToSceneImage(file, anchorParagraph);
      created.push(item);
    }
    if (created.length === 0) return;
    selectedImageId = created[created.length - 1].id;
    visualLayoutOpen = true;
    actions.mutateProject((prev) => {
      let existing: SceneImageItem[] = [];
      for (const p of prev.parts) {
        for (const ch of p.chapters) {
          const sc = ch.scenes.find((s) => s.id === sceneId);
          if (sc) existing = sc.images ?? [];
        }
      }
      return updateSceneInProject(prev, sceneId, {
        images: [...existing, ...created],
      });
    }, true);
    actions.notify(
      created.length === 1
        ? `Added image “${created[0].alt}” to scene`
        : `Added ${created.length} images to scene`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to add image to scene.';
    showErrorDialog({
      code: 'QV-202',
      message: msg,
      details: err instanceof Error ? err.stack : undefined,
      onOpenHelp: (code) => actions.openHelpPage(code),
    });
  }
}

function mutateSceneImages(
  actions: AppActions,
  sceneId: string,
  updater: (imgs: SceneImageItem[]) => SceneImageItem[],
  rerender = true,
): void {
  actions.mutateProject((prev) => {
    let current: SceneImageItem[] = [];
    for (const p of prev.parts) {
      for (const ch of p.chapters) {
        const sc = ch.scenes.find((s) => s.id === sceneId);
        if (sc) current = sc.images ?? [];
      }
    }
    return updateSceneInProject(prev, sceneId, { images: updater(current) });
  }, rerender);
}

export function renderSceneImageComposer(
  scene: SceneNode,
  actions: AppActions,
  onEditProseClick: () => void,
): HTMLElement | null {
  const images = scene.images ?? [];
  if (images.length === 0) return null;

  if (!images.some((img) => img.id === selectedImageId)) {
    selectedImageId = images[0].id;
  }

  const host = el('section', {
    className: `qv-scene-img-studio${snapToGridEnabled ? ' has-grid' : ''}`,
    attrs: { 'aria-label': 'Book Image Layout Studio' },
  });

  const activeImg = images.find((i) => i.id === selectedImageId) ?? images[0];
  const paragraphs = scene.content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) {
    paragraphs.push('Type prose in this scene to watch text automatically wrap and relocate around your placed images.');
  }

  const headerBar = el(
    'div',
    { className: 'qv-img-studio-head' },
    el(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
      icon('image', 14),
      el('strong', { text: `Scene Images (${images.length})`, style: { fontSize: '12.5px' } }),
      el('button', {
        className: `bv-mini-btn${visualLayoutOpen ? ' is-active' : ''}`,
        text: visualLayoutOpen ? 'Hide Text-Wrap Preview' : 'Show Text-Wrap Preview',
        attrs: { type: 'button' },
        on: {
          click: () => {
            visualLayoutOpen = !visualLayoutOpen;
            actions.setState({}, true);
          },
        },
      }),
      el('button', {
        className: `bv-mini-btn${snapToGridEnabled ? ' is-active' : ''}`,
        text: snapToGridEnabled ? 'Snap Grid: On' : 'Snap Grid: Off',
        attrs: { type: 'button' },
        on: {
          click: () => {
            snapToGridEnabled = !snapToGridEnabled;
            actions.setState({}, true);
          },
        },
      }),
    ),
    el(
      'button',
      {
        className: 'bv-mini-btn',
        text: 'Jump to Prose Editor',
        attrs: { type: 'button' },
        on: { click: onEditProseClick },
      },
    ),
  );

  host.appendChild(headerBar);

  if (typeof window !== 'undefined' && window.innerWidth <= 768) {
    host.appendChild(
      el('div', {
        className: 'qv-img-mobile-note',
        text: 'Mobile touch controls are active. For finer drag-and-snap image layout, desktop web or the installed desktop app is recommended.',
      }),
    );
  }

  // Controls toolbar for active selected image
  if (activeImg) {
    const wrapSelect = el(
      'select',
      {
        className: 'bv-select',
        attrs: { 'aria-label': 'Image text wrap layout' },
        on: {
          change: () => {
            const nextMode = wrapSelect.value as SceneImageWrapMode;
            mutateSceneImages(actions, scene.id, (list) =>
              list.map((it) => (it.id === activeImg.id ? { ...it, wrapMode: nextMode } : it)),
            );
          },
        },
      },
      ...(Object.keys(WRAP_MODE_LABELS) as SceneImageWrapMode[]).map((mode) =>
        el('option', {
          text: WRAP_MODE_LABELS[mode],
          attrs: { value: mode, selected: activeImg.wrapMode === mode },
        }),
      ),
    );

    const paraSelect = el(
      'select',
      {
        className: 'bv-select',
        attrs: { 'aria-label': 'Anchor paragraph for text wrap' },
        on: {
          change: () => {
            const pIdx = Math.max(0, Number(paraSelect.value) || 0);
            mutateSceneImages(actions, scene.id, (list) =>
              list.map((it) => (it.id === activeImg.id ? { ...it, anchorParagraph: pIdx } : it)),
            );
          },
        },
      },
      ...paragraphs.map((_, idx) =>
        el('option', {
          text: `Paragraph ${idx + 1}`,
          attrs: { value: String(idx), selected: Math.min(activeImg.anchorParagraph, paragraphs.length - 1) === idx },
        }),
      ),
    );

    const widthLabel = el('span', { className: 'bv-mono-tag', text: `${activeImg.widthPx}px` });
    const widthSlider = el('input', {
      attrs: {
        type: 'range',
        min: 96,
        max: 640,
        step: snapToGridEnabled ? 12 : 4,
        value: activeImg.widthPx,
        'aria-label': 'Image width',
      },
      style: { width: '96px' },
      on: {
        input: () => {
          const w = Number(widthSlider.value) || 240;
          const aspect = activeImg.heightPx / Math.max(1, activeImg.widthPx);
          const h = Math.max(64, Math.round(w * aspect));
          widthLabel.textContent = `${w}px`;
          mutateSceneImages(
            actions,
            scene.id,
            (list) => list.map((it) => (it.id === activeImg.id ? { ...it, widthPx: w, heightPx: h } : it)),
            false,
          );
          const cardEl = host.querySelector<HTMLElement>(`[data-scene-img-id="${activeImg.id}"]`);
          if (cardEl) cardEl.style.width = `${w}px`;
        },
        change: () => actions.setState({}, true),
      },
    });

    const tolSlider = el('input', {
      attrs: {
        type: 'range',
        min: 14,
        max: 105,
        step: 2,
        value: activeImg.bgTolerance ?? 44,
        title: 'Background removal sensitivity',
        'aria-label': 'Background removal tolerance',
      },
      style: { width: '74px' },
      on: {
        change: async () => {
          const tol = Number(tolSlider.value) || 44;
          if (!activeImg.bgRemoved) {
            mutateSceneImages(
              actions,
              scene.id,
              (list) => list.map((it) => (it.id === activeImg.id ? { ...it, bgTolerance: tol } : it)),
              false,
            );
            return;
          }
          try {
            const cleanUrl = await removeImageBackgroundClient(activeImg.originalDataUrl || activeImg.dataUrl, tol);
            mutateSceneImages(actions, scene.id, (list) =>
              list.map((it) =>
                it.id === activeImg.id
                  ? { ...it, dataUrl: cleanUrl, bgRemoved: true, bgTolerance: tol }
                  : it,
              ),
            );
          } catch (err) {
            showErrorDialog({
              code: 'QV-202',
              message: err instanceof Error ? err.message : 'Background removal failed.',
              onOpenHelp: (code) => actions.openHelpPage(code),
            });
          }
        },
      },
    });

    const bgBtn = el('button', {
      className: `bv-mini-btn${activeImg.bgRemoved ? ' is-active' : ''}`,
      text: activeImg.bgRemoved ? 'Restore Original' : 'Remove Background',
      attrs: { type: 'button' },
      on: {
        click: async () => {
          if (activeImg.bgRemoved && activeImg.originalDataUrl) {
            mutateSceneImages(actions, scene.id, (list) =>
              list.map((it) =>
                it.id === activeImg.id
                  ? { ...it, dataUrl: it.originalDataUrl || it.dataUrl, bgRemoved: false }
                  : it,
              ),
            );
            actions.notify('Restored original image background');
            return;
          }
          bgBtn.disabled = true;
          bgBtn.textContent = 'Removing…';
          try {
            const tol = Number(tolSlider.value) || activeImg.bgTolerance || 44;
            const processed = await removeImageBackgroundClient(
              activeImg.originalDataUrl || activeImg.dataUrl,
              tol,
            );
            mutateSceneImages(actions, scene.id, (list) =>
              list.map((it) =>
                it.id === activeImg.id
                  ? {
                      ...it,
                      originalDataUrl: it.originalDataUrl || it.dataUrl,
                      dataUrl: processed,
                      bgRemoved: true,
                      bgTolerance: tol,
                    }
                  : it,
              ),
            );
            actions.notify('Removed image background locally');
          } catch (err) {
            bgBtn.disabled = false;
            bgBtn.textContent = 'Remove Background';
            showErrorDialog({
              code: 'QV-202',
              message: err instanceof Error ? err.message : 'Background removal failed.',
              onOpenHelp: (code) => actions.openHelpPage(code),
            });
          }
        },
      },
    });

    const captionInput = el('input', {
      className: 'bv-input',
      style: { height: '26px', fontSize: '11.5px', flex: '1 1 140px', minWidth: '120px' },
      attrs: {
        type: 'text',
        value: activeImg.caption ?? '',
        placeholder: 'Image caption (optional)…',
        'aria-label': 'Image caption',
      },
      on: {
        change: () => {
          const cap = captionInput.value.trim();
          mutateSceneImages(actions, scene.id, (list) =>
            list.map((it) => (it.id === activeImg.id ? { ...it, caption: cap } : it)),
          );
        },
      },
    });

    const delBtn = el(
      'button',
      {
        className: 'bv-mini-btn',
        attrs: { type: 'button', 'aria-label': 'Remove image from scene' },
        on: {
          click: () => {
            mutateSceneImages(actions, scene.id, (list) => list.filter((it) => it.id !== activeImg.id));
            actions.notify('Removed image from scene');
          },
        },
      },
      icon('trash', 12),
    );

    host.appendChild(
      el(
        'div',
        { className: 'qv-img-controls-row' },
        wrapSelect,
        paraSelect,
        el('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px' } }, widthSlider, widthLabel),
        bgBtn,
        el('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } }, el('span', { className: 'bv-mono-tag', text: 'Edge' }), tolSlider),
        captionInput,
        delBtn,
      ),
    );
  }

  if (!visualLayoutOpen) return host;

  // Interactive Live Wrapped Text + Image Canvas
  const stage = el('div', { className: 'qv-img-wrap-stage' });
  const guideXLine = el('div', { className: 'qv-img-guide-x' });
  const guideYLine = el('div', { className: 'qv-img-guide-y' });
  stage.append(guideXLine, guideYLine);

  const renderImageCard = (item: SceneImageItem): HTMLElement => {
    const isSelected = item.id === selectedImageId;
    const fig = el('figure', {
      className: `qv-scene-img-box wrap-${item.wrapMode}${isSelected ? ' is-selected' : ''}`,
      dataset: { sceneImgId: item.id },
      style: {
        width: `${item.widthPx}px`,
        ...(item.wrapMode === 'behind-text'
          ? { left: `${item.offsetX}px`, top: `${item.offsetY}px` }
          : {}),
      },
    });

    const imgEl = el('img', {
      attrs: {
        src: item.dataUrl,
        alt: item.alt,
        draggable: 'false',
      },
    });
    fig.appendChild(imgEl);

    if (item.caption) {
      fig.appendChild(el('figcaption', { className: 'qv-scene-img-cap', text: item.caption }));
    }

    const resizeHandle = el('div', {
      className: 'qv-scene-img-resize',
      attrs: { title: 'Drag to resize image', 'aria-label': 'Resize image handle' },
    });
    fig.appendChild(resizeHandle);

    // Drag to reposition, snap to grid/elements, and auto-relocate text across paragraphs
    fig.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement)?.closest('.qv-scene-img-resize')) return;
      if (e.button !== 0) return;
      selectedImageId = item.id;
      const startX = e.clientX;
      const startY = e.clientY;
      const origX = item.offsetX;
      const origY = item.offsetY;
      let latestX = origX;
      let latestY = origY;
      let moved = false;

      fig.setPointerCapture(e.pointerId);
      const stageRect = stage.getBoundingClientRect();
      const others = images.filter((o) => o.id !== item.id);

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!moved && Math.hypot(dx, dy) < 5) return;
        moved = true;
        const snapped = computeSnappedImagePosition(
          { offsetX: origX + dx, offsetY: origY + dy, widthPx: item.widthPx, heightPx: item.heightPx },
          others,
          Math.max(240, stageRect.width - 24),
          { snapGrid: snapToGridEnabled, gridPx: 12 },
        );
        latestX = snapped.offsetX;
        latestY = snapped.offsetY;

        if (snapped.guideX !== null) {
          guideXLine.style.left = `${snapped.guideX}px`;
          guideXLine.classList.add('is-visible');
        } else {
          guideXLine.classList.remove('is-visible');
        }
        if (snapped.guideY !== null) {
          guideYLine.style.top = `${snapped.guideY}px`;
          guideYLine.classList.add('is-visible');
        } else {
          guideYLine.classList.remove('is-visible');
        }

        if (item.wrapMode === 'behind-text') {
          fig.style.left = `${latestX}px`;
          fig.style.top = `${latestY}px`;
        } else {
          fig.style.transform = `translate(${dx}px, ${dy}px)`;
        }
      };

      const onUp = (ev: PointerEvent) => {
        fig.removeEventListener('pointermove', onMove);
        fig.removeEventListener('pointerup', onUp);
        fig.removeEventListener('pointercancel', onUp);
        guideXLine.classList.remove('is-visible');
        guideYLine.classList.remove('is-visible');
        fig.style.transform = '';

        if (!moved) {
          actions.setState({}, true);
          return;
        }

        // Auto-relocate wrap side & paragraph based on where the writer dropped the image!
        let nextWrap: SceneImageWrapMode = item.wrapMode;
        let nextPara = item.anchorParagraph;
        if (item.wrapMode !== 'behind-text') {
          const relX = (ev.clientX - stageRect.left) / Math.max(1, stageRect.width);
          if (relX < 0.34) nextWrap = 'square-left';
          else if (relX > 0.66) nextWrap = 'square-right';
          else nextWrap = 'top-bottom';

          const paraNodes = Array.from(stage.querySelectorAll<HTMLElement>('.qv-wrap-para'));
          for (let i = 0; i < paraNodes.length; i++) {
            const pr = paraNodes[i].getBoundingClientRect();
            if (ev.clientY <= pr.bottom + 8) {
              nextPara = i;
              break;
            }
            nextPara = i;
          }
        }

        mutateSceneImages(actions, scene.id, (list) =>
          list.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  offsetX: latestX,
                  offsetY: latestY,
                  wrapMode: nextWrap,
                  anchorParagraph: nextPara,
                }
              : it,
          ),
        );
      };

      fig.addEventListener('pointermove', onMove);
      fig.addEventListener('pointerup', onUp);
      fig.addEventListener('pointercancel', onUp);
    });

    // Corner handle drag to resize proportionally with snap-to-grid
    resizeHandle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      selectedImageId = item.id;
      const startX = e.clientX;
      const origW = item.widthPx;
      const aspect = item.heightPx / Math.max(1, item.widthPx);
      let nextW = origW;
      resizeHandle.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const rawW = origW + (ev.clientX - startX);
        const snappedW = snapToGridEnabled ? Math.round(rawW / 12) * 12 : Math.round(rawW);
        nextW = Math.max(96, Math.min(640, snappedW));
        fig.style.width = `${nextW}px`;
      };
      const onUp = () => {
        resizeHandle.removeEventListener('pointermove', onMove);
        resizeHandle.removeEventListener('pointerup', onUp);
        resizeHandle.removeEventListener('pointercancel', onUp);
        const nextH = Math.max(64, Math.round(nextW * aspect));
        mutateSceneImages(actions, scene.id, (list) =>
          list.map((it) => (it.id === item.id ? { ...it, widthPx: nextW, heightPx: nextH } : it)),
        );
      };
      resizeHandle.addEventListener('pointermove', onMove);
      resizeHandle.addEventListener('pointerup', onUp);
      resizeHandle.addEventListener('pointercancel', onUp);
    });

    return fig;
  };

  // Behind-text images sit behind the prose flow
  for (const bgImg of images.filter((i) => i.wrapMode === 'behind-text')) {
    stage.appendChild(renderImageCard(bgImg));
  }

  // Flowing paragraphs with anchored wrapped images so text automatically relocates around images
  const flowWrap = el('div', { className: 'qv-wrap-flow' });
  paragraphs.forEach((paraText, idx) => {
    const anchored = images.filter(
      (i) =>
        i.wrapMode !== 'behind-text' &&
        Math.min(i.anchorParagraph, paragraphs.length - 1) === idx,
    );
    for (const imgItem of anchored) {
      flowWrap.appendChild(renderImageCard(imgItem));
    }
    flowWrap.appendChild(
      el('p', {
        className: 'qv-wrap-para',
        text: paraText.replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/\*([^*\n]+)\*/g, '$1'),
        on: { dblclick: onEditProseClick },
      }),
    );
  });
  flowWrap.appendChild(el('div', { style: { clear: 'both' } }));
  stage.appendChild(flowWrap);
  host.appendChild(stage);
  return host;
}
