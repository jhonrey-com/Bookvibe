import { FONT_STACKS } from './export';
import { safeJsonParse } from './extensions';
import { newId } from './manuscript';
import type { CustomFontEntry, FontFamilyId, InstalledExtension } from './types';

const FONTS_STORAGE_KEY = 'bookvibe.customFonts.v1';
let memoryCustomFonts: CustomFontEntry[] = [];

export type DetectedFontFormat = 'ttf' | 'otf' | 'woff' | 'woff2';

export function validateFontBytes(bytes: Uint8Array, filename = ''): DetectedFontFormat | null {
  if (bytes.length < 12) return null;
  const b0 = bytes[0];
  const b1 = bytes[1];
  const b2 = bytes[2];
  const b3 = bytes[3];

  // WOFF ("wOFF")
  if (b0 === 0x77 && b1 === 0x4f && b2 === 0x46 && b3 === 0x46) return 'woff';
  // WOFF2 ("wOF2")
  if (b0 === 0x77 && b1 === 0x4f && b2 === 0x46 && b3 === 0x32) return 'woff2';
  // OpenType CFF ("OTTO")
  if (b0 === 0x4f && b1 === 0x54 && b2 === 0x54 && b3 === 0x4f) return 'otf';
  // TrueType (0x00010000 or "true" / "ttcf")
  if (
    (b0 === 0x00 && b1 === 0x01 && b2 === 0x00 && b3 === 0x00) ||
    (b0 === 0x74 && b1 === 0x72 && b2 === 0x75 && b3 === 0x65) ||
    (b0 === 0x74 && b1 === 0x74 && b2 === 0x63 && b3 === 0x66)
  ) {
    return filename.toLowerCase().endsWith('.otf') ? 'otf' : 'ttf';
  }
  return null;
}

export function sanitizeFontFamilyName(rawName: string): string {
  const clean = rawName
    .replace(/\.(ttf|otf|woff2?)$/i, '')
    .replace(/[^a-zA-Z0-9\s_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.slice(0, 48) || 'Custom Author Font';
}

function quoteCssFamily(family: string): string {
  const safe = family.replace(/["'\\;{}<>]/g, '');
  return `"${safe}", Georgia, serif`;
}

async function registerFontFaceIfSupported(entry: CustomFontEntry): Promise<void> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined' || !entry.dataUrl) {
    return;
  }
  try {
    const face = new FontFace(entry.family, `url(${entry.dataUrl})`);
    await face.load();
    document.fonts.add(face);
  } catch {
    // Font failed to decode in Chromium FontFace loader
  }
}

export function loadCustomFonts(): CustomFontEntry[] {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(FONTS_STORAGE_KEY);
      if (raw) {
        const parsed = safeJsonParse<CustomFontEntry[]>(raw);
        if (Array.isArray(parsed)) {
          memoryCustomFonts = parsed;
        }
      }
    } catch {
      // Fallback cleanly
    }
  }
  for (const font of memoryCustomFonts) {
    void registerFontFaceIfSupported(font);
  }
  return [...memoryCustomFonts];
}

export function saveCustomFonts(items: CustomFontEntry[]): void {
  memoryCustomFonts = [...items];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(FONTS_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage quota fallback
    }
  }
}

function readBytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function installDeviceFontFile(file: File): Promise<CustomFontEntry> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Font file exceeds 5 MB limit.');
  }
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const format = validateFontBytes(bytes, file.name);
  if (!format) {
    throw new Error('Unsupported file. Upload a valid TTF, OTF, WOFF, or WOFF2 font.');
  }

  const mime =
    format === 'woff2'
      ? 'font/woff2'
      : format === 'woff'
        ? 'font/woff'
        : format === 'otf'
          ? 'font/otf'
          : 'font/ttf';
  const dataUrl = `data:${mime};base64,${readBytesToBase64(bytes)}`;
  const family = sanitizeFontFamilyName(file.name);

  const entry: CustomFontEntry = {
    id: newId('font'),
    family,
    format,
    source: 'device',
    dataUrl,
    cssStack: quoteCssFamily(family),
    addedAt: new Date().toISOString(),
  };

  await registerFontFaceIfSupported(entry);
  const current = loadCustomFonts().filter((f) => f.family.toLowerCase() !== family.toLowerCase());
  saveCustomFonts([...current, entry]);
  return entry;
}

export async function pickLocalSystemFont(): Promise<CustomFontEntry | null> {
  const nav = window as unknown as {
    queryLocalFonts?: () => Promise<Array<{ family: string; fullName?: string }>>;
  };
  if (typeof nav.queryLocalFonts !== 'function') {
    throw new Error(
      'Direct system font picker is unavailable in this runtime. Upload a .ttf, .otf, .woff, or .woff2 file instead.',
    );
  }
  const list = await nav.queryLocalFonts();
  const firstUnique = list.find((f) => f.family && f.family.trim().length > 0);
  if (!firstUnique) return null;

  const family = sanitizeFontFamilyName(firstUnique.family);
  const entry: CustomFontEntry = {
    id: newId('font'),
    family,
    format: 'system',
    source: 'system',
    cssStack: quoteCssFamily(family),
    addedAt: new Date().toISOString(),
  };
  const current = loadCustomFonts().filter((f) => f.family.toLowerCase() !== family.toLowerCase());
  saveCustomFonts([...current, entry]);
  return entry;
}

export async function installFontPackFromExtension(
  ext: InstalledExtension,
): Promise<CustomFontEntry[]> {
  if (!ext.enabled || !ext.grantedPermissions.includes('add:font-pack')) {
    throw new Error(`Permission denied: "${ext.manifest.name}" lacks "add:font-pack" permission.`);
  }
  const defs = ext.manifest.fonts ?? [];
  if (defs.length === 0) return [];

  const installed: CustomFontEntry[] = [];
  const existing = loadCustomFonts();
  const nextList = [...existing];

  for (const def of defs) {
    const family = sanitizeFontFamilyName(def.family);
    const cssStack = def.cssStack?.trim() ? def.cssStack : quoteCssFamily(family);
    const entry: CustomFontEntry = {
      id: newId('font'),
      family,
      format: 'extension',
      source: 'extension',
      dataUrl: def.dataUrl,
      cssStack,
      addedAt: new Date().toISOString(),
    };
    if (entry.dataUrl) {
      await registerFontFaceIfSupported(entry);
    }
    const idx = nextList.findIndex((f) => f.family.toLowerCase() === family.toLowerCase());
    if (idx >= 0) nextList[idx] = entry;
    else nextList.push(entry);
    installed.push(entry);
  }

  saveCustomFonts(nextList);
  return installed;
}

export function removeCustomFont(fontId: string): CustomFontEntry[] {
  const next = loadCustomFonts().filter((f) => f.id !== fontId);
  saveCustomFonts(next);
  return next;
}

export interface FontChoiceOption {
  id: string;
  label: string;
  cssStack: string;
  builtInKey?: FontFamilyId;
  source: 'built-in' | 'device' | 'system' | 'extension';
}

export function getAllAvailableFontChoices(): FontChoiceOption[] {
  const builtIn: FontChoiceOption[] = (Object.keys(FONT_STACKS) as FontFamilyId[]).map((key) => ({
    id: `builtin:${key}`,
    label: FONT_STACKS[key].label,
    cssStack: FONT_STACKS[key].css,
    builtInKey: key,
    source: 'built-in',
  }));
  const custom = loadCustomFonts().map((f) => ({
    id: f.family,
    label: `${f.family} (${f.source})`,
    cssStack: f.cssStack,
    source: f.source,
  }));
  return [...builtIn, ...custom];
}

export function resolveEffectiveFontCss(
  builtInKey: FontFamilyId,
  customFamily?: string,
): string {
  if (customFamily && customFamily.trim()) {
    const match = loadCustomFonts().find(
      (f) => f.family.toLowerCase() === customFamily.trim().toLowerCase(),
    );
    if (match) return match.cssStack;
    if (!customFamily.startsWith('builtin:')) {
      return quoteCssFamily(sanitizeFontFamilyName(customFamily));
    }
  }
  return FONT_STACKS[builtInKey].css;
}
