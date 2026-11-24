import { safeJsonParse } from './extensions';
import type {
  AlarmRingtoneId,
  AppThemeId,
  BookProject,
  BookvibeSettings,
  StudioViewId,
  ToolbarDisplayMode,
  ToolTier,
  WindowTitleMode,
} from './types';

const SETTINGS_STORAGE_KEY = 'quillvibe.settings.v2';
const LEGACY_SETTINGS_KEY = 'bookvibe.settings.v1';

export const DEFAULT_SETTINGS: BookvibeSettings = {
  appTheme: 'ivory',
  toolTier: 'basic',
  toolbarDisplayMode: 'balanced',
  uiDensity: 'comfortable',
  editorFontFamily: '',
  editorFontSizePx: 18,
  editorLineHeight: 1.72,
  editorSheetMaxWidthPx: 820,
  binderWidthPx: 256,
  inspectorWidthPx: 288,
  studioLeftWidthPx: 296,
  studioRightWidthPx: 276,
  autoSaveDelayMs: 320,
  reducedMotionOverride: 'system',
  developerMode: false,
  defaultImprint: 'Independent Press',
  showOnboardingHints: true,
  windowTitleMode: 'book',
  windowTitleCustom: '',
  immersiveShowClock: true,
  immersiveShowTimer: true,
  immersiveShowWords: true,
  immersiveShowAlarm: true,
  alarmRingtone: 'warm-chime',
  alarmVolume: 0.65,
};

let memorySettings: BookvibeSettings = { ...DEFAULT_SETTINGS };

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.max(min, Math.min(max, n)));
}

function normalizeTheme(val: unknown): AppThemeId {
  return val === 'parchment' || val === 'obsidian' || val === 'ivory'
    ? val
    : DEFAULT_SETTINGS.appTheme;
}

function normalizeTier(val: unknown): ToolTier {
  return val === 'basic' || val === 'intermediate' || val === 'advanced'
    ? val
    : DEFAULT_SETTINGS.toolTier;
}

function normalizeToolbarMode(val: unknown): ToolbarDisplayMode {
  return val === 'icons' || val === 'balanced' || val === 'detailed'
    ? val
    : DEFAULT_SETTINGS.toolbarDisplayMode;
}

function normalizeWindowTitleMode(val: unknown): WindowTitleMode {
  return val === 'book' || val === 'author' || val === 'section' || val === 'brand' || val === 'custom'
    ? val
    : DEFAULT_SETTINGS.windowTitleMode;
}

function normalizeAlarmRingtone(val: unknown): AlarmRingtoneId {
  return val === 'warm-chime' ||
    val === 'brass-bell' ||
    val === 'wood-marimba' ||
    val === 'harbor-gong' ||
    val === 'acoustic-arp'
    ? val
    : DEFAULT_SETTINGS.alarmRingtone;
}

export function sanitizeSettings(raw: Partial<BookvibeSettings>): BookvibeSettings {
  const volNum = Number(raw.alarmVolume);
  const cleanVol = Number.isFinite(volNum) ? Math.max(0.05, Math.min(1, volNum)) : DEFAULT_SETTINGS.alarmVolume;
  return {
    appTheme: normalizeTheme(raw.appTheme),
    toolTier: normalizeTier(raw.toolTier),
    toolbarDisplayMode: normalizeToolbarMode(raw.toolbarDisplayMode),
    uiDensity: raw.uiDensity === 'compact' ? 'compact' : 'comfortable',
    editorFontFamily: typeof raw.editorFontFamily === 'string' ? raw.editorFontFamily.slice(0, 180) : '',
    editorFontSizePx: clampInt(raw.editorFontSizePx, 13, 28, DEFAULT_SETTINGS.editorFontSizePx),
    editorLineHeight: Math.max(1.3, Math.min(2.2, Number(raw.editorLineHeight) || DEFAULT_SETTINGS.editorLineHeight)),
    editorSheetMaxWidthPx: clampInt(raw.editorSheetMaxWidthPx, 540, 1080, DEFAULT_SETTINGS.editorSheetMaxWidthPx),
    binderWidthPx: clampInt(raw.binderWidthPx, 190, 440, DEFAULT_SETTINGS.binderWidthPx),
    inspectorWidthPx: clampInt(raw.inspectorWidthPx, 210, 480, DEFAULT_SETTINGS.inspectorWidthPx),
    studioLeftWidthPx: clampInt(raw.studioLeftWidthPx, 220, 440, DEFAULT_SETTINGS.studioLeftWidthPx),
    studioRightWidthPx: clampInt(raw.studioRightWidthPx, 220, 440, DEFAULT_SETTINGS.studioRightWidthPx),
    autoSaveDelayMs: clampInt(raw.autoSaveDelayMs, 150, 2000, DEFAULT_SETTINGS.autoSaveDelayMs),
    reducedMotionOverride: raw.reducedMotionOverride === 'reduce' ? 'reduce' : 'system',
    developerMode: Boolean(raw.developerMode),
    defaultImprint: typeof raw.defaultImprint === 'string' ? raw.defaultImprint.slice(0, 80) : DEFAULT_SETTINGS.defaultImprint,
    showOnboardingHints: raw.showOnboardingHints !== undefined ? Boolean(raw.showOnboardingHints) : true,
    windowTitleMode: normalizeWindowTitleMode(raw.windowTitleMode),
    windowTitleCustom: typeof raw.windowTitleCustom === 'string' ? raw.windowTitleCustom.slice(0, 120) : '',
    immersiveShowClock: raw.immersiveShowClock !== undefined ? Boolean(raw.immersiveShowClock) : true,
    immersiveShowTimer: raw.immersiveShowTimer !== undefined ? Boolean(raw.immersiveShowTimer) : true,
    immersiveShowWords: raw.immersiveShowWords !== undefined ? Boolean(raw.immersiveShowWords) : true,
    immersiveShowAlarm: raw.immersiveShowAlarm !== undefined ? Boolean(raw.immersiveShowAlarm) : true,
    alarmRingtone: normalizeAlarmRingtone(raw.alarmRingtone),
    alarmVolume: cleanVol,
  };
}

export function loadSettings(): BookvibeSettings {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw =
        window.localStorage.getItem(SETTINGS_STORAGE_KEY) ??
        window.localStorage.getItem(LEGACY_SETTINGS_KEY);
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

export function isTierAtLeast(current: ToolTier, required: ToolTier): boolean {
  const rank: Record<ToolTier, number> = { basic: 0, intermediate: 1, advanced: 2 };
  return rank[current] >= rank[required];
}

export function resolveSectionDisplayName(
  activeView: StudioViewId,
  typesetSubTab?: 'interior' | 'cover' | 'publish',
): string {
  switch (activeView) {
    case 'editor':
      return 'Manuscript';
    case 'corkboard':
      return 'Corkboard';
    case 'outline':
      return 'Outline';
    case 'bible':
      return 'Story Bible';
    case 'graph':
      return 'Story Graph';
    case 'course':
      return 'Book Writing Course';
    case 'typeset':
      if (typesetSubTab === 'cover') return 'Book Cover Studio';
      if (typesetSubTab === 'publish') return 'Publish & Author Seal';
      return 'Interior Typeset';
    default:
      return 'Manuscript';
  }
}

/**
 * Formats the browser tab or native desktop window/taskbar title based on user preference.
 */
export function formatAppWindowTitle(
  settings: Pick<BookvibeSettings, 'windowTitleMode' | 'windowTitleCustom'>,
  project: Pick<BookProject, 'title' | 'author' | 'authorIdentity'>,
  activeView: StudioViewId,
  typesetSubTab: 'interior' | 'cover' | 'publish' = 'interior',
  isDesktop = false,
): string {
  const bookName = project.title?.trim() || 'Untitled Book';
  const authorName =
    project.authorIdentity?.penName?.trim() || project.author?.trim() || 'Author';
  const sectionName = resolveSectionDisplayName(activeView, typesetSubTab);

  switch (settings.windowTitleMode) {
    case 'book':
      return isDesktop ? `Quillvibe - ${bookName}` : `${bookName} — Quillvibe`;
    case 'author':
      return `Quillvibe - ${authorName}`;
    case 'section':
      return `Quillvibe - ${sectionName}`;
    case 'brand':
      return 'Quillvibe';
    case 'custom': {
      const tpl = settings.windowTitleCustom.trim();
      if (!tpl) return 'Quillvibe';
      return tpl
        .replace(/\{book\}/gi, bookName)
        .replace(/\{author\}/gi, authorName)
        .replace(/\{section\}/gi, sectionName);
    }
    default:
      return isDesktop ? `Quillvibe - ${bookName}` : `${bookName} — Quillvibe`;
  }
}

export function applySettingsToDocument(settings: BookvibeSettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = settings.appTheme;
  root.dataset.tier = settings.toolTier;
  root.dataset.toolbarMode = settings.toolbarDisplayMode;
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
  root.style.setProperty('--qv-binder-w', `${settings.binderWidthPx}px`);
  root.style.setProperty('--qv-inspector-w', `${settings.inspectorWidthPx}px`);
  root.style.setProperty('--qv-studio-left-w', `${settings.studioLeftWidthPx}px`);
  root.style.setProperty('--qv-studio-right-w', `${settings.studioRightWidthPx}px`);

  const metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.content =
      settings.appTheme === 'obsidian'
        ? '#08080a'
        : settings.appTheme === 'parchment'
          ? '#ebe4d5'
          : '#f6f4ef';
  }
}
