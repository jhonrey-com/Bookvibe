import { safeJsonParse } from './extensions';
import type { BookvibeSettings } from './types';

const SETTINGS_STORAGE_KEY = 'bookvibe.settings.v1';

export const DEFAULT_SETTINGS: BookvibeSettings = {
  uiDensity: 'comfortable',
  editorFontFamily: '',
  editorFontSizePx: 18,
  editorLineHeight: 1.72,
  editorSheetMaxWidthPx: 740,
  autoSaveDelayMs: 320,
  reducedMotionOverride: 'system',
  developerMode: false,
  defaultImprint: 'Independent Press',
  showOnboardingHints: true,
};

let memorySettings: BookvibeSettings = { ...DEFAULT_SETTINGS };

export function sanitizeSettings(raw: Partial<BookvibeSettings>): BookvibeSettings {
  return {
    uiDensity: raw.uiDensity === 'compact' ? 'compact' : 'comfortable',
    editorFontFamily: typeof raw.editorFontFamily === 'string' ? raw.editorFontFamily.slice(0, 180) : '',
    editorFontSizePx: Math.max(13, Math.min(28, Number(raw.editorFontSizePx) || DEFAULT_SETTINGS.editorFontSizePx)),
    editorLineHeight: Math.max(1.3, Math.min(2.2, Number(raw.editorLineHeight) || DEFAULT_SETTINGS.editorLineHeight)),
    editorSheetMaxWidthPx: Math.max(540, Math.min(980, Number(raw.editorSheetMaxWidthPx) || DEFAULT_SETTINGS.editorSheetMaxWidthPx)),
    autoSaveDelayMs: Math.max(150, Math.min(2000, Number(raw.autoSaveDelayMs) || DEFAULT_SETTINGS.autoSaveDelayMs)),
    reducedMotionOverride: raw.reducedMotionOverride === 'reduce' ? 'reduce' : 'system',
    developerMode: Boolean(raw.developerMode),
    defaultImprint: typeof raw.defaultImprint === 'string' ? raw.defaultImprint.slice(0, 80) : DEFAULT_SETTINGS.defaultImprint,
    showOnboardingHints: raw.showOnboardingHints !== undefined ? Boolean(raw.showOnboardingHints) : true,
  };
}

export function loadSettings(): BookvibeSettings {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        memorySettings = sanitizeSettings(safeJsonParse<Partial<BookvibeSettings>>(raw));
      }
    } catch {
      // Keep defaults on malformed store
    }
  }
  return { ...memorySettings };
}

export function saveSettings(next: BookvibeSettings): BookvibeSettings {
  memorySettings = sanitizeSettings(next);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(memorySettings));
    } catch {
      // Ignore quota issues
    }
  }
  return { ...memorySettings };
}

export function applySettingsToDocument(settings: BookvibeSettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.density = settings.uiDensity;
  root.dataset.devMode = settings.developerMode ? 'true' : 'false';
  root.dataset.motion = settings.reducedMotionOverride;

  if (settings.editorFontFamily.trim()) {
    root.style.setProperty('--bv-editor-font', settings.editorFontFamily.trim());
  } else {
    root.style.removeProperty('--bv-editor-font');
  }
  root.style.setProperty('--bv-editor-size', `${settings.editorFontSizePx}px`);
  root.style.setProperty('--bv-editor-lh', String(settings.editorLineHeight));
  root.style.setProperty('--bv-sheet-max-w', `${settings.editorSheetMaxWidthPx}px`);
}
