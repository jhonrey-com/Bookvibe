import { el, icon, svgEl, type IconName } from './dom';

export interface LiquidGlassOption<T extends string = string> {
  id: T;
  label: string;
  icon?: IconName;
  title?: string;
}

export interface LiquidGlassConfig<T extends string = string> {
  options: LiquidGlassOption<T>[];
  value: T;
  ariaLabel: string;
  surface?: 'solid' | 'clear';
  compact?: boolean;
  onChange: (value: T) => void;
}

interface ButtonRecord<T extends string> {
  option: LiquidGlassOption<T>;
  button: HTMLButtonElement;
  baseContent: HTMLSpanElement;
  revealItem: HTMLDivElement;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface OdeState {
  value: number;
  velocity: number;
  target: number;
}

interface RgbaSample {
  r: number;
  g: number;
  b: number;
  a: number;
}

const OMEGA = 28.0;
const SCALE_OMEGA = 32.0;
const JELLY_OMEGA = 26.0;
const JELLY_ZETA = 0.4;
const BASE_PILL_RADIUS = 13;

let filterCounter = 0;
let sharedDisplacementDataUrl: string | null = null;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Signed distance to rounded box in normalized [-0.5, 0.5] coordinates.
 */
function sdRoundedBox(px: number, py: number, halfW: number, halfH: number, radius: number): number {
  const qx = Math.abs(px) - (halfW - radius);
  const qy = Math.abs(py) - (halfH - radius);
  const outDist = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inDist = Math.min(Math.max(qx, qy), 0);
  return outDist + inDist - radius;
}

/**
 * Pillar B: Generates a centered sRGB displacement texture around neutral 127.5 midpoint
 * with gentle radial center magnification and symmetric 4-corner inside-corner bevel refraction.
 */
function getDisplacementMapUrl(): string {
  if (sharedDisplacementDataUrl) return sharedDisplacementDataUrl;

  const w = 256;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    sharedDisplacementDataUrl = '';
    return '';
  }

  const img = ctx.createImageData(w, h);
  const data = img.data;
  const halfW = 0.485;
  const halfH = 0.465;
  const cornerRadius = 0.25;
  const eps = 0.004;

  for (let y = 0; y < h; y++) {
    const ny = (y + 0.5) / h - 0.5;
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5) / w - 0.5;
      const dist = sdRoundedBox(nx, ny, halfW, halfH, cornerRadius);

      let dx = -0.025 * nx;
      let dy = -0.025 * ny;

      if (dist <= 0) {
        // Confine convex edge refraction tightly to outer rim & inside corners so inner glyphs remain crisp
        const gx =
          (sdRoundedBox(nx + eps, ny, halfW, halfH, cornerRadius) -
            sdRoundedBox(nx - eps, ny, halfW, halfH, cornerRadius)) /
          (2 * eps);
        const gy =
          (sdRoundedBox(nx, ny + eps, halfW, halfH, cornerRadius) -
            sdRoundedBox(nx, ny - eps, halfW, halfH, cornerRadius)) /
          (2 * eps);

        const rimStrength = smoothstep(-0.085, 0.0, dist);
        const cornerBoost = 1.0 + 0.45 * smoothstep(0.12, 0.44, Math.abs(nx) * Math.abs(ny) * 4.0);
        dx += gx * rimStrength * 0.42 * cornerBoost;
        dy += gy * rimStrength * 0.42 * cornerBoost;
      } else {
        dx = 0;
        dy = 0;
      }

      const rByte = Math.round(clamp(127.5 + dx * 127.0, 0, 255));
      const gByte = Math.round(clamp(127.5 + dy * 127.0, 0, 255));
      const idx = (y * w + x) * 4;
      data[idx] = rByte;
      data[idx + 1] = gByte;
      data[idx + 2] = 128;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  try {
    sharedDisplacementDataUrl = canvas.toDataURL('image/png');
  } catch {
    sharedDisplacementDataUrl = '';
  }
  return sharedDisplacementDataUrl;
}

function stepCriticallyDamped(state: OdeState, omega: number, dt: number): boolean {
  const x0 = state.value - state.target;
  if (Math.abs(x0) < 0.002 && Math.abs(state.velocity) < 0.002) {
    state.value = state.target;
    state.velocity = 0;
    return false;
  }
  const exp = Math.exp(-omega * dt);
  const temp = state.velocity + omega * x0;
  const newX = (x0 + temp * dt) * exp;
  const newV = (state.velocity - temp * omega * dt) * exp;
  state.value = state.target + newX;
  state.velocity = newV;
  return true;
}

function stepUnderdamped(state: OdeState, omega: number, zeta: number, dt: number): boolean {
  const x0 = state.value - state.target;
  if (Math.abs(x0) < 0.001 && Math.abs(state.velocity) < 0.001) {
    state.value = state.target;
    state.velocity = 0;
    return false;
  }
  const accel = -2 * zeta * omega * state.velocity - omega * omega * x0;
  state.velocity += accel * dt;
  state.value += state.velocity * dt;
  return true;
}

function buildRoundedRectSubpath(x: number, y: number, w: number, h: number, rx: number, ry: number): string {
  if (w <= 0 || h <= 0) return '';
  const rX = Math.min(rx, w / 2);
  const rY = Math.min(ry, h / 2);
  const right = x + w;
  const bottom = y + h;
  return [
    `M ${(x + rX).toFixed(2)} ${y.toFixed(2)}`,
    `H ${(right - rX).toFixed(2)}`,
    `A ${rX.toFixed(2)} ${rY.toFixed(2)} 0 0 1 ${right.toFixed(2)} ${(y + rY).toFixed(2)}`,
    `V ${(bottom - rY).toFixed(2)}`,
    `A ${rX.toFixed(2)} ${rY.toFixed(2)} 0 0 1 ${(right - rX).toFixed(2)} ${bottom.toFixed(2)}`,
    `H ${(x + rX).toFixed(2)}`,
    `A ${rX.toFixed(2)} ${rY.toFixed(2)} 0 0 1 ${x.toFixed(2)} ${(bottom - rY).toFixed(2)}`,
    `V ${(y + rY).toFixed(2)}`,
    `A ${rX.toFixed(2)} ${rY.toFixed(2)} 0 0 1 ${(x + rX).toFixed(2)} ${y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function linearizeChannel(byteVal: number): number {
  const srgb = clamp(byteVal / 255, 0, 1);
  return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb: RgbaSample): number {
  return (
    0.2126 * linearizeChannel(rgb.r) +
    0.7152 * linearizeChannel(rgb.g) +
    0.0722 * linearizeChannel(rgb.b)
  );
}

function parseCssColor(raw: string): RgbaSample | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'transparent' || trimmed === 'none') return null;

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i,
  );
  if (rgbMatch) {
    let a = 1;
    if (rgbMatch[4] !== undefined) {
      a = rgbMatch[4].endsWith('%') ? parseFloat(rgbMatch[4]) / 100 : parseFloat(rgbMatch[4]);
    }
    return {
      r: clamp(parseFloat(rgbMatch[1]), 0, 255),
      g: clamp(parseFloat(rgbMatch[2]), 0, 255),
      b: clamp(parseFloat(rgbMatch[3]), 0, 255),
      a: clamp(a, 0, 1),
    };
  }

  const srgbMatch = trimmed.match(
    /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/i,
  );
  if (srgbMatch) {
    return {
      r: clamp(parseFloat(srgbMatch[1]) * 255, 0, 255),
      g: clamp(parseFloat(srgbMatch[2]) * 255, 0, 255),
      b: clamp(parseFloat(srgbMatch[3]) * 255, 0, 255),
      a: srgbMatch[4] !== undefined ? clamp(parseFloat(srgbMatch[4]), 0, 1) : 1,
    };
  }

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }
  return null;
}

function compositeSourceOver(fg: RgbaSample, bg: RgbaSample): RgbaSample {
  const a = fg.a + bg.a * (1 - fg.a);
  if (a <= 0.0001) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
    g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
    b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
    a,
  };
}

/**
 * Apple iOS 26/27 Liquid Glass Segmented Switcher enforcing all 6 pillars:
 * 1. Dual-layer stacked X-ray cookie-cutter mask (sharp curved-edge split, zero fade)
 * 2. Centered SVG SDF inside-corner magnifying refraction (`objectBoundingBox`, `127.5` sRGB)
 * 3. Real-time pixel sampling behind glass across canvas/img/video/CSS layers
 * 4. Automatic WCAG BT.709 light-to-dark polarity flipping with hysteresis
 * 5. Critically-damped ODE glide & press physics honoring prefers-reduced-motion
 */
export class LiquidGlassControl<T extends string = string> {
  public readonly element: HTMLDivElement;

  private readonly bar: HTMLDivElement;
  private readonly pill: HTMLDivElement;
  private readonly baseLayer: HTMLDivElement;
  private readonly revealLayer: HTMLDivElement;
  private readonly svgFilterEl: SVGSVGElement;
  private readonly filterId: string;
  private readonly options: LiquidGlassOption<T>[];
  private readonly records: ButtonRecord<T>[] = [];
  private readonly surface: 'solid' | 'clear';
  private readonly onChange: (value: T) => void;

  private currentValue: T;
  private previewValue: T;
  private barWidth = 0;
  private barHeight = 0;
  private isLifted = false;
  private isDragging = false;
  private activePointerId: number | null = null;
  private pointerDownX = 0;
  private pointerDownIndex = 0;
  private holdTimer: number | null = null;
  private releaseTimer: number | null = null;
  private rafId: number | null = null;
  private lastTick = 0;
  private lastSampleTime = 0;
  private isVisible = true;
  private destroyed = false;
  private currentTone: 'dark' | 'light' = 'dark';

  private readonly xOde: OdeState = { value: 0, velocity: 0, target: 0 };
  private readonly wOde: OdeState = { value: 64, velocity: 0, target: 64 };
  private readonly scaleOde: OdeState = { value: 1, velocity: 0, target: 1 };
  private readonly jellyOde: OdeState = { value: 0, velocity: 0, target: 0 };

  private readonly sampleCanvas: HTMLCanvasElement;
  private readonly sampleCtx: CanvasRenderingContext2D | null;
  private readonly resizeObserver: ResizeObserver;
  private readonly intersectionObserver: IntersectionObserver | null;
  private heartbeatTimer: number | null = null;

  constructor(config: LiquidGlassConfig<T>) {
    this.options = config.options;
    this.currentValue = config.value;
    this.previewValue = config.value;
    this.surface = config.surface ?? 'clear';
    this.onChange = config.onChange;
    this.filterId = `lg-refract-${++filterCounter}`;

    this.sampleCanvas = document.createElement('canvas');
    this.sampleCanvas.width = 12;
    this.sampleCanvas.height = 6;
    this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true });

    this.element = el('div', {
      className: `lg-host${config.compact ? ' lg-compact' : ''} lg-surface-${this.surface} tone-dark`,
    });

    this.svgFilterEl = this.createRefractionFilterSvg();
    this.element.appendChild(this.svgFilterEl);

    this.bar = el('div', {
      className: 'lg-bar',
      attrs: {
        role: 'tablist',
        'aria-label': config.ariaLabel,
      },
    });

    this.pill = el('div', {
      className: 'lg-pill',
      attrs: { 'aria-hidden': 'true' },
    });
    this.pill.style.setProperty('--lg-refract-filter', `url(#${this.filterId})`);

    this.baseLayer = el('div', { className: 'lg-layer-base' });
    this.revealLayer = el('div', {
      className: 'lg-layer-reveal',
      attrs: { 'aria-hidden': 'true' },
    });

    for (const opt of this.options) {
      const baseContent = el(
        'span',
        { className: 'lg-btn-content' },
        opt.icon ? icon(opt.icon, 14) : null,
        el('span', { className: 'lg-btn-label', text: opt.label }),
      );

      const button = el(
        'button',
        {
          className: `lg-btn${opt.id === this.currentValue ? ' is-selected' : ''}`,
          attrs: {
            type: 'button',
            role: 'tab',
            'aria-selected': String(opt.id === this.currentValue),
            title: opt.title ?? opt.label,
            tabindex: opt.id === this.currentValue ? 0 : -1,
          },
          dataset: { lgId: opt.id },
        },
        baseContent,
      );

      const revealItem = el(
        'div',
        { className: 'lg-reveal-item' },
        opt.icon ? icon(opt.icon, 14) : null,
        el('span', { className: 'lg-btn-label', text: opt.label }),
      );

      this.baseLayer.appendChild(button);
      this.revealLayer.appendChild(revealItem);
      this.records.push({
        option: opt,
        button,
        baseContent,
        revealItem,
        left: 0,
        top: 0,
        width: 0,
        height: 0,
      });
    }

    this.bar.append(this.pill, this.baseLayer, this.revealLayer);
    this.element.appendChild(this.bar);

    this.bindEvents();

    this.resizeObserver = new ResizeObserver(() => {
      this.measureLayout(true);
      this.sampleBackdrop(true);
    });
    this.resizeObserver.observe(this.bar);

    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        const entry = entries[0];
        this.isVisible = Boolean(entry?.isIntersecting);
        if (this.isVisible) this.sampleBackdrop(true);
      });
      this.intersectionObserver.observe(this.element);
    } else {
      this.intersectionObserver = null;
    }

    requestAnimationFrame(() => {
      if (!this.destroyed) {
        this.measureLayout(true);
        this.sampleBackdrop(true);
      }
    });

    this.heartbeatTimer = window.setInterval(() => {
      if (!this.destroyed && this.isVisible && !document.hidden) {
        this.sampleBackdrop(false);
      }
    }, 220);
  }

  private createRefractionFilterSvg(): SVGSVGElement {
    const mapUrl = getDisplacementMapUrl();
    const svg = svgEl('svg', {
      class: 'lg-svg-defs',
      width: 0,
      height: 0,
      'aria-hidden': 'true',
    });

    const filter = svgEl('filter', {
      id: this.filterId,
      filterUnits: 'objectBoundingBox',
      primitiveUnits: 'objectBoundingBox',
      x: '0',
      y: '0',
      width: '1',
      height: '1',
      'color-interpolation-filters': 'sRGB',
    });

    const feImg = svgEl('feImage', {
      href: mapUrl,
      result: 'refractMap',
      preserveAspectRatio: 'none',
      x: '0',
      y: '0',
      width: '1',
      height: '1',
    });

    const feDisp = svgEl('feDisplacementMap', {
      in: 'SourceGraphic',
      in2: 'refractMap',
      scale: '0.065',
      xChannelSelector: 'R',
      yChannelSelector: 'G',
    });

    filter.append(feImg, feDisp);
    svg.appendChild(filter);
    return svg;
  }

  private bindEvents(): void {
    this.bar.addEventListener('pointerdown', this.handlePointerDown);
    this.bar.addEventListener('lostpointercapture', this.handleForceRelease);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handleForceRelease);
    window.addEventListener('blur', this.handleForceRelease);
    document.addEventListener('visibilitychange', this.handleVisibilityRelease);
    this.bar.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('scroll', this.handlePassiveViewportEvent, { passive: true, capture: true });
    window.addEventListener('resize', this.handlePassiveViewportEvent, { passive: true });
  }

  private handleVisibilityRelease = (): void => {
    if (document.hidden) {
      this.handleForceRelease();
    }
  };

  private handleForceRelease = (): void => {
    this.isDragging = false;
    this.activePointerId = null;
    this.clearTimers();
    this.engageLift(false);
  };

  private handlePassiveViewportEvent = (): void => {
    if (!this.destroyed && this.isVisible) {
      this.sampleBackdrop(false);
    }
  };

  private handleKeyDown = (ev: KeyboardEvent): void => {
    const idx = this.records.findIndex((r) => r.option.id === this.currentValue);
    if (idx < 0) return;

    let nextIdx = -1;
    if (ev.key === 'ArrowRight') nextIdx = (idx + 1) % this.records.length;
    else if (ev.key === 'ArrowLeft') nextIdx = (idx - 1 + this.records.length) % this.records.length;
    else if (ev.key === 'Home') nextIdx = 0;
    else if (ev.key === 'End') nextIdx = this.records.length - 1;

    if (nextIdx >= 0) {
      ev.preventDefault();
      const rec = this.records[nextIdx];
      this.selectValue(rec.option.id, true);
      rec.button.focus();
    }
  };

  private handlePointerDown = (ev: PointerEvent): void => {
    if (ev.button !== 0) return;
    const btn = (ev.target as HTMLElement | null)?.closest<HTMLButtonElement>('.lg-btn');
    if (!btn) return;

    const id = btn.dataset.lgId as T | undefined;
    if (!id) return;

    const idx = this.records.findIndex((r) => r.option.id === id);
    if (idx < 0) return;

    this.activePointerId = ev.pointerId;
    this.pointerDownX = ev.clientX;
    this.pointerDownIndex = idx;
    this.isDragging = true;

    try {
      this.bar.setPointerCapture(ev.pointerId);
    } catch {
      // Ignore synthetic events without pointer capture support
    }

    this.clearTimers();
    this.engageLift(true);
    this.previewValue = id;
    this.setPillTargetToRecord(this.records[idx]);
  };

  private handlePointerMove = (ev: PointerEvent): void => {
    if (!this.isDragging || ev.pointerId !== this.activePointerId) return;
    const rect = this.bar.getBoundingClientRect();
    if (rect.width <= 0) return;

    const localX = clamp(ev.clientX - rect.left, 0, rect.width);
    const activeRecord = this.findRecordAtLocalX(localX);
    if (!activeRecord) return;

    // Continuous smooth drag positioning when pointer moves >= 4px
    if (Math.abs(ev.clientX - this.pointerDownX) >= 4) {
      const targetCenter = clamp(localX, activeRecord.width / 2, rect.width - activeRecord.width / 2);
      const pillLeft = clamp(targetCenter - activeRecord.width / 2, 4, Math.max(4, rect.width - activeRecord.width - 4));
      this.xOde.target = pillLeft;
      this.wOde.target = activeRecord.width;
      this.previewValue = activeRecord.option.id;
      this.startLoop();
    }
  };

  private handlePointerUp = (ev: PointerEvent): void => {
    if (!this.isDragging || ev.pointerId !== this.activePointerId) return;
    this.isDragging = false;
    this.activePointerId = null;
    this.clearTimers();

    try {
      if (this.bar.hasPointerCapture(ev.pointerId)) {
        this.bar.releasePointerCapture(ev.pointerId);
      }
    } catch {
      // Ignore
    }

    const rect = this.bar.getBoundingClientRect();
    const movedDist = Math.abs(ev.clientX - this.pointerDownX);
    let targetRecord = this.records[this.pointerDownIndex];

    if (movedDist >= 6 && rect.width > 0) {
      const localX = clamp(ev.clientX - rect.left, 0, rect.width);
      targetRecord = this.findRecordAtLocalX(localX) ?? targetRecord;
    }

    // Disengage Liquid Glass immediately once pointer releases so resting tab shows zero glass effect
    this.engageLift(false);
    this.selectValue(targetRecord.option.id, true);
  };

  private findRecordAtLocalX(localX: number): ButtonRecord<T> | undefined {
    let closest = this.records[0];
    let bestDist = Infinity;
    for (const rec of this.records) {
      if (localX >= rec.left && localX <= rec.left + rec.width) {
        return rec;
      }
      const center = rec.left + rec.width / 2;
      const dist = Math.abs(localX - center);
      if (dist < bestDist) {
        bestDist = dist;
        closest = rec;
      }
    }
    return closest;
  }

  private clearTimers(): void {
    if (this.holdTimer !== null) {
      window.clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    if (this.releaseTimer !== null) {
      window.clearTimeout(this.releaseTimer);
      this.releaseTimer = null;
    }
  }

  private engageLift(lift: boolean): void {
    if (this.isLifted === lift) return;
    this.isLifted = lift;
    this.pill.classList.toggle('is-liquid-active', lift);
    this.scaleOde.target = lift && !this.prefersReducedMotion() ? 1.07 : 1.0;
    this.startLoop();
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  public setValue(value: T): void {
    if (value === this.currentValue) return;
    this.selectValue(value, false);
  }

  private selectValue(value: T, emit: boolean): void {
    const rec = this.records.find((r) => r.option.id === value);
    if (!rec) return;

    const prev = this.currentValue;
    this.currentValue = value;
    this.previewValue = value;

    for (const item of this.records) {
      const selected = item.option.id === value;
      item.button.classList.toggle('is-selected', selected);
      item.button.setAttribute('aria-selected', String(selected));
      item.button.tabIndex = selected ? 0 : -1;
    }

    this.setPillTargetToRecord(rec);
    if (emit && prev !== value) {
      this.onChange(value);
    }
  }

  private setPillTargetToRecord(rec: ButtonRecord<T>): void {
    this.xOde.target = rec.left;
    this.wOde.target = rec.width;

    if (this.prefersReducedMotion() || this.barWidth <= 0) {
      this.xOde.value = rec.left;
      this.xOde.velocity = 0;
      this.wOde.value = rec.width;
      this.wOde.velocity = 0;
      this.scaleOde.value = 1;
      this.scaleOde.velocity = 0;
      this.jellyOde.value = 0;
      this.jellyOde.velocity = 0;
      this.applyGeometry();
    } else {
      this.startLoop();
    }
  }

  private measureLayout(snap: boolean): void {
    const barRect = this.bar.getBoundingClientRect();
    this.barWidth = this.bar.clientWidth || barRect.width;
    this.barHeight = this.bar.clientHeight || barRect.height;

    for (const rec of this.records) {
      const btnRect = rec.button.getBoundingClientRect();
      if (barRect.width > 0 && btnRect.width > 0) {
        rec.left = btnRect.left - barRect.left - this.bar.clientLeft;
        rec.top = btnRect.top - barRect.top - this.bar.clientTop;
        rec.width = btnRect.width;
        rec.height = btnRect.height;
      } else {
        rec.left = rec.button.offsetLeft + this.baseLayer.offsetLeft;
        rec.top = rec.button.offsetTop + this.baseLayer.offsetTop;
        rec.width = rec.button.offsetWidth;
        rec.height = rec.button.offsetHeight;
      }

      // Keep Layer 2 pixel-locked to Layer 1 button coordinates inside .lg-bar
      rec.revealItem.style.left = `${rec.left.toFixed(2)}px`;
      rec.revealItem.style.top = `${rec.top.toFixed(2)}px`;
      rec.revealItem.style.width = `${rec.width.toFixed(2)}px`;
      rec.revealItem.style.height = `${rec.height.toFixed(2)}px`;
    }

    const active =
      this.records.find((r) => r.option.id === (this.isDragging ? this.previewValue : this.currentValue)) ??
      this.records[0];
    if (active && active.width > 0) {
      this.xOde.target = active.left;
      this.wOde.target = active.width;
      if (snap || this.wOde.value <= 0) {
        this.xOde.value = active.left;
        this.xOde.velocity = 0;
        this.wOde.value = active.width;
        this.wOde.velocity = 0;
      }
      this.applyGeometry();
    }
  }

  private startLoop(): void {
    if (this.rafId !== null || this.destroyed) return;
    this.lastTick = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.rafId = null;
    if (this.destroyed) return;

    const dt = clamp((now - this.lastTick) / 1000, 0.001, 0.05);
    this.lastTick = now;

    if (this.prefersReducedMotion()) {
      this.xOde.value = this.xOde.target;
      this.xOde.velocity = 0;
      this.wOde.value = this.wOde.target;
      this.wOde.velocity = 0;
      this.scaleOde.value = 1;
      this.scaleOde.velocity = 0;
      this.jellyOde.value = 0;
      this.jellyOde.velocity = 0;
      this.applyGeometry();
      return;
    }

    const movingX = stepCriticallyDamped(this.xOde, OMEGA, dt);
    const movingW = stepCriticallyDamped(this.wOde, OMEGA, dt);
    const movingS = stepCriticallyDamped(this.scaleOde, SCALE_OMEGA, dt);

    // Velocity-gated damped jelly/skew impulse during active fast glide
    this.jellyOde.target = clamp(this.xOde.velocity / 1400, -0.08, 0.08);
    const movingJ = stepUnderdamped(this.jellyOde, JELLY_OMEGA, JELLY_ZETA, dt);

    this.applyGeometry();

    if (now - this.lastSampleTime >= 28) {
      this.sampleBackdrop(false);
    }

    if (movingX || movingW || movingS || movingJ) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  };

  /**
   * Pillar A: Dual-Layer Stacked X-Ray Cookie-Cutter Mask + Live Scaled Pill Geometry.
   * Negative inset offsets are deliberately used when expanded scale crosses bar bounds.
   */
  private applyGeometry(): void {
    if (this.barWidth <= 0 || this.barHeight <= 0) return;

    const active = this.records[0];
    const baseTop = active ? active.top : 3;
    const baseH = active && active.height > 0 ? active.height : Math.max(24, this.barHeight - 6);

    const scale = this.scaleOde.value;
    const stretch = 1 + Math.abs(this.jellyOde.value) * 0.45;
    const scaleX = scale * stretch;
    const scaleY = scale / Math.sqrt(stretch);

    const pillW = Math.max(12, this.wOde.value);
    const pillH = Math.max(16, baseH);
    const centerX = this.xOde.value + pillW / 2;
    const centerY = baseTop + pillH / 2;

    const scaledW = pillW * scaleX;
    const scaledH = pillH * scaleY;
    const scaledLeft = centerX - scaledW / 2;
    const scaledTop = centerY - scaledH / 2;
    const scaledRight = scaledLeft + scaledW;
    const scaledBottom = scaledTop + scaledH;

    const rx = BASE_PILL_RADIUS * scaleX;
    const ry = BASE_PILL_RADIUS * scaleY;

    // Position the optical Liquid Glass pill cleanly around its center
    this.pill.style.left = `${this.xOde.value.toFixed(2)}px`;
    this.pill.style.top = `${baseTop.toFixed(2)}px`;
    this.pill.style.width = `${pillW.toFixed(2)}px`;
    this.pill.style.height = `${pillH.toFixed(2)}px`;
    this.pill.style.transform = `scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`;

    // Clip Layer 2 strictly inside the pill's scaled curved boundary
    const insetTop = scaledTop;
    const insetRight = this.barWidth - scaledRight;
    const insetBottom = this.barHeight - scaledBottom;
    const insetLeft = scaledLeft;
    this.revealLayer.style.clipPath = `inset(${insetTop.toFixed(2)}px ${insetRight.toFixed(2)}px ${insetBottom.toFixed(2)}px ${insetLeft.toFixed(2)}px round ${rx.toFixed(2)}px / ${ry.toFixed(2)}px)`;

    // Punch the exact complementary curved rounded-rect hole out of each Layer 1 button
    for (const rec of this.records) {
      if (rec.width <= 0 || rec.height <= 0) continue;
      const localPillX = scaledLeft - rec.left;
      const localPillY = scaledTop - rec.top;
      const intersects =
        localPillX < rec.width &&
        localPillX + scaledW > 0 &&
        localPillY < rec.height &&
        localPillY + scaledH > 0;

      if (!intersects) {
        rec.baseContent.style.clipPath = 'none';
        continue;
      }

      const outer = `M -12 -12 H ${(rec.width + 12).toFixed(2)} V ${(rec.height + 12).toFixed(2)} H -12 Z`;
      const hole = buildRoundedRectSubpath(localPillX, localPillY, scaledW, scaledH, rx, ry);
      rec.baseContent.style.clipPath = `path(evenodd, "${outer} ${hole}")`;
    }
  }

  /**
   * Pillars C & D: Real-time pixel sampling behind the glass across DOM layers,
   * `<canvas>`, `<img>`, `<video>`, and CSS colors, with WCAG BT.709 hysteresis flipping.
   */
  public sampleBackdrop(force: boolean): void {
    const now = performance.now();
    if (!force && now - this.lastSampleTime < 28) return;
    this.lastSampleTime = now;

    if (this.surface === 'solid') {
      // Solid obsidian dock bars remain fixed on obsidian dark tone unless parent switches
      this.applyTone('dark');
      return;
    }

    const barRect = this.bar.getBoundingClientRect();
    if (barRect.width <= 0 || barRect.height <= 0) return;

    // Sample center of active pill as well as bar midpoint
    const sampleX = clamp(barRect.left + this.xOde.value + this.wOde.value / 2, 0, window.innerWidth - 1);
    const sampleY = clamp(barRect.top + barRect.height / 2, 0, window.innerHeight - 1);
    const color = this.sampleColorAtPoint(sampleX, sampleY);
    const lum = relativeLuminance(color);

    // Hysteresis prevents mid-tone flicker (>0.34 light, <0.25 dark)
    const nextTone =
      this.currentTone === 'dark'
        ? lum > 0.34
          ? 'light'
          : 'dark'
        : lum < 0.25
          ? 'dark'
          : 'light';

    this.applyTone(nextTone);
  }

  private applyTone(tone: 'dark' | 'light'): void {
    if (tone === this.currentTone && this.element.classList.contains(`tone-${tone}`)) return;
    this.currentTone = tone;
    this.element.classList.toggle('tone-light', tone === 'light');
    this.element.classList.toggle('tone-dark', tone === 'dark');
  }

  private sampleColorAtPoint(clientX: number, clientY: number): RgbaSample {
    const stack = document.elementsFromPoint(clientX, clientY);
    const layers: RgbaSample[] = [];

    for (const node of stack) {
      if (this.element.contains(node)) continue;
      const htmlNode = node as HTMLElement;
      if (htmlNode.tagName === 'CANVAS' || htmlNode.tagName === 'IMG' || htmlNode.tagName === 'VIDEO') {
        const mediaRgb = this.sampleMediaElement(htmlNode as HTMLCanvasElement | HTMLImageElement | HTMLVideoElement, clientX, clientY);
        if (mediaRgb) layers.push(mediaRgb);
      } else {
        const mediaChild = htmlNode.querySelector<HTMLCanvasElement | HTMLImageElement | HTMLVideoElement>(
          'canvas, img, video',
        );
        if (mediaChild && getComputedStyle(mediaChild).pointerEvents === 'none') {
          const mr = mediaChild.getBoundingClientRect();
          if (clientX >= mr.left && clientX <= mr.right && clientY >= mr.top && clientY <= mr.bottom) {
            const mediaRgb = this.sampleMediaElement(mediaChild, clientX, clientY);
            if (mediaRgb) layers.push(mediaRgb);
          }
        }
      }

      const style = getComputedStyle(htmlNode);
      const bgParsed = parseCssColor(style.backgroundColor);
      if (bgParsed && bgParsed.a > 0.01) {
        layers.push(bgParsed);
      }
    }

    // Composite back-to-front over obsidian canvas root
    let result: RgbaSample = { r: 8, g: 8, b: 10, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) {
      result = compositeSourceOver(layers[i], result);
    }
    return result;
  }

  private sampleMediaElement(
    media: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
    clientX: number,
    clientY: number,
  ): RgbaSample | null {
    if (!this.sampleCtx) return null;
    const rect = media.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    let srcW = 0;
    let srcH = 0;
    if (media instanceof HTMLImageElement) {
      if (!media.complete || media.naturalWidth === 0) return null;
      srcW = media.naturalWidth;
      srcH = media.naturalHeight;
    } else if (media instanceof HTMLVideoElement) {
      if (media.readyState < 2 || media.videoWidth === 0) return null;
      srcW = media.videoWidth;
      srcH = media.videoHeight;
    } else {
      srcW = media.width;
      srcH = media.height;
    }
    if (srcW <= 0 || srcH <= 0) return null;

    const u = clamp((clientX - rect.left) / rect.width, 0, 1);
    const v = clamp((clientY - rect.top) / rect.height, 0, 1);
    const sx = clamp(Math.floor(u * Math.max(1, srcW - 12)), 0, Math.max(0, srcW - 1));
    const sy = clamp(Math.floor(v * Math.max(1, srcH - 6)), 0, Math.max(0, srcH - 1));
    const sw = Math.min(12, srcW - sx);
    const sh = Math.min(6, srcH - sy);

    try {
      this.sampleCtx.clearRect(0, 0, 12, 6);
      this.sampleCtx.drawImage(media, sx, sy, sw, sh, 0, 0, 12, 6);
      const px = this.sampleCtx.getImageData(0, 0, 12, 6).data;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      const count = px.length / 4;
      for (let i = 0; i < px.length; i += 4) {
        r += px[i];
        g += px[i + 1];
        b += px[i + 2];
        a += px[i + 3] / 255;
      }
      return { r: r / count, g: g / count, b: b / count, a: a / count };
    } catch {
      return null;
    }
  }

  public destroy(): void {
    this.destroyed = true;
    this.clearTimers();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.resizeObserver.disconnect();
    this.intersectionObserver?.disconnect();
    this.bar.removeEventListener('pointerdown', this.handlePointerDown);
    this.bar.removeEventListener('lostpointercapture', this.handleForceRelease);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handleForceRelease);
    window.removeEventListener('blur', this.handleForceRelease);
    document.removeEventListener('visibilitychange', this.handleVisibilityRelease);
    this.bar.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('scroll', this.handlePassiveViewportEvent, true);
    window.removeEventListener('resize', this.handlePassiveViewportEvent);
  }
}
