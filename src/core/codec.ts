import type {
  AnyQuillvibeOrLegacyExtension,
  QuillvibeEnvelope,
  QuillvibeExtension,
} from './types';

export type QuillvibeCodecErrorCode =
  | 'INVALID_FORMAT'
  | 'PASSWORD_REQUIRED'
  | 'WRONG_PASSWORD_OR_DAMAGED'
  | 'DAMAGED_OR_TAMPERED'
  | 'AUTHOR_KEY_TAMPERED'
  | 'MALWARE_DETECTED';

export class QuillvibeCodecError extends Error {
  readonly code: QuillvibeCodecErrorCode;

  constructor(code: QuillvibeCodecErrorCode, message: string) {
    super(message);
    this.name = 'QuillvibeCodecError';
    this.code = code;
  }
}

export const QVBX_MAGIC = [0x51, 0x56, 0x42, 0x58] as const; // "QVBX"
export const QVBX_VERSION = 2;
export const QVBX_HEADER_SIZE = 84;
const PBKDF2_ITERATIONS = 150_000;

const FLAG_PASSWORD_PROTECTED = 0x01;
const FLAG_AUTHOR_KEY_BOUND = 0x02;
const FLAG_RESTRICTED_COLLAB = 0x04;

const EXT_TO_CODE: Partial<Record<AnyQuillvibeOrLegacyExtension, number>> = {
  '.qv': 7,
  '.qvbible': 4,
  '.qvscene': 5,
  '.qvstyle': 6,
  '.qvdesign': 8,
  '.quillvibe': 1,
  '.qvibe': 2,
  '.qvbook': 3,
};

const CODE_TO_EXT: Record<number, AnyQuillvibeOrLegacyExtension> = {
  1: '.quillvibe',
  2: '.qvibe',
  3: '.qvbook',
  4: '.qvbible',
  5: '.qvscene',
  6: '.qvstyle',
  7: '.qv',
  8: '.qvdesign',
};

// Internal format key seed used to keep non-password QVBX files opaque outside Quillvibe
const QVBX_FORMAT_SEED = new Uint8Array([
  0x51, 0x76, 0x42, 0x78, 0x2d, 0x4a, 0x68, 0x6f,
  0x6e, 0x72, 0x65, 0x79, 0x2d, 0x46, 0x6f, 0x6c,
  0x69, 0x6f, 0x2d, 0x32, 0x30, 0x32, 0x36, 0x2d,
  0x4b, 0x65, 0x79, 0x2d, 0x56, 0x32, 0x21, 0x23,
]);

function getSubtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c || !c.subtle) {
    throw new QuillvibeCodecError(
      'DAMAGED_OR_TAMPERED',
      'Secure cryptographic engine is unavailable in this environment.',
    );
  }
  return c.subtle;
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(u8.byteLength);
  copy.set(u8);
  return copy.buffer;
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await getSubtle().digest('SHA-256', toArrayBuffer(bytes));
  return new Uint8Array(digest);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((acc, p) => acc + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function deriveKeyMaterial(
  salt: Uint8Array,
  extCode: number,
  password?: string,
): Promise<CryptoKey> {
  const subtle = getSubtle();
  if (password && password.length > 0) {
    const passBytes = new TextEncoder().encode(`QVBX_PASS_V2:${extCode}:${password}`);
    const baseKey = await subtle.importKey(
      'raw',
      toArrayBuffer(passBytes),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    return subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: toArrayBuffer(salt),
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  const rawMat = await sha256(
    concatBytes(QVBX_FORMAT_SEED, salt, new Uint8Array([extCode, QVBX_VERSION])),
  );
  return subtle.importKey(
    'raw',
    toArrayBuffer(rawMat),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Deterministic salt-keyed byte diffusion so binary files cannot be patched or read by external tools.
 */
function diffuseCipherBytes(data: Uint8Array, header: Uint8Array, forward: boolean): Uint8Array {
  const out = new Uint8Array(data.length);
  let s1 = 0x811c9dc5;
  let s2 = 0x9e3779b9;
  for (let i = 0; i < header.length; i++) {
    s1 = Math.imul(s1 ^ header[i], 0x01000193) >>> 0;
    s2 = Math.imul(s2 ^ (header[i] + i), 0x85ebca6b) >>> 0;
  }

  for (let i = 0; i < data.length; i++) {
    s1 = (Math.imul(s1 ^ (i & 0xff), 0x01000193) + 0x27d4eb2d) >>> 0;
    s2 = (Math.imul(s2 ^ ((s1 >>> 16) & 0xff), 0x85ebca6b) ^ (s1 >>> 7)) >>> 0;
    const mask = (s1 ^ s2) & 0xff;
    const rot = (s2 >>> 3) & 7;
    if (forward) {
      const x = data[i] ^ mask;
      out[i] = ((x << rot) | (x >>> (8 - rot))) & 0xff;
    } else {
      const b = data[i];
      const unrot = ((b >>> rot) | (b << (8 - rot))) & 0xff;
      out[i] = unrot ^ mask;
    }
  }
  return out;
}

export function isQvbxBinary(bytes: Uint8Array): boolean {
  return (
    bytes.length >= QVBX_HEADER_SIZE &&
    bytes[0] === QVBX_MAGIC[0] &&
    bytes[1] === QVBX_MAGIC[1] &&
    bytes[2] === QVBX_MAGIC[2] &&
    bytes[3] === QVBX_MAGIC[3]
  );
}

export interface QvbxHeaderInfo {
  isQvbx: boolean;
  version: number;
  passwordProtected: boolean;
  authorKeyBound: boolean;
  restricted: boolean;
  extension: AnyQuillvibeOrLegacyExtension | null;
  authorKeyId: string;
}

export function inspectQuillvibeBinary(bytes: Uint8Array): QvbxHeaderInfo {
  if (!isQvbxBinary(bytes)) {
    return {
      isQvbx: false,
      version: 0,
      passwordProtected: false,
      authorKeyBound: false,
      restricted: false,
      extension: null,
      authorKeyId: '',
    };
  }
  const version = bytes[4];
  const flags = bytes[5];
  const extCode = bytes[6];
  const keySlice = bytes.slice(68, 84);
  const authorKeyId = new TextDecoder().decode(keySlice).replace(/\0+$/g, '').trim();
  return {
    isQvbx: true,
    version,
    passwordProtected: Boolean(flags & FLAG_PASSWORD_PROTECTED),
    authorKeyBound: Boolean(flags & FLAG_AUTHOR_KEY_BOUND),
    restricted: Boolean(flags & FLAG_RESTRICTED_COLLAB),
    extension: CODE_TO_EXT[extCode] ?? null,
    authorKeyId,
  };
}

const SCRIPT_THREAT_RE =
  /<script\b|<\/script>|<foreignobject\b|<animate(?:motion|transform)?\b|<set\b|<iframe\b|<object\b|<embed\b|<style\b|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|data\s*:\s*application\/javascript/i;
const INLINE_HANDLER_RE = /\bon[a-z]+\s*=/i;

function decodeDataUrlHeaderBytes(dataUrl: string): Uint8Array | null {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;
  const meta = dataUrl.slice(0, comma).toLowerCase();
  if (!meta.includes(';base64')) return null;
  const b64 = dataUrl.slice(comma + 1, comma + 65).replace(/\s+/g, '');
  if (!b64 || typeof atob !== 'function') return null;
  try {
    const padded = b64.slice(0, Math.floor(b64.length / 4) * 4);
    const bin = atob(padded);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  } catch {
    return null;
  }
}

function hasExecutableSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 2) return false;
  // Windows PE ("MZ"), ELF ("\x7fELF"), Mach-O (0xFEEDFACE / 0xCFFAEDFE), Shebang ("#!")
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) return true;
  if (bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) return true;
  if (bytes[0] === 0x23 && bytes[1] === 0x21) return true;
  return false;
}

/**
 * Recursively inspects decoded payloads to block embedded scripts, executable binaries,
 * prototype-pollution keys, and unsafe nesting before Quillvibe accepts any file.
 */
export function scanPayloadForThreats(value: unknown, depth = 0, parentKey = ''): void {
  if (depth > 40) {
    throw new QuillvibeCodecError(
      'MALWARE_DETECTED',
      'Rejected file: payload nesting depth exceeds safety limit.',
    );
  }
  if (value === null || value === undefined) return;

  if (typeof value === 'string') {
    const isMediaField =
      parentKey === 'dataUrl' ||
      parentKey === 'backgroundImageDataUrl' ||
      parentKey === 'imageDataUrl' ||
      parentKey === 'signatureSvgDataUrl';

    const isSvgDataUri = value.slice(0, 24).toLowerCase().startsWith('data:image/svg+xml');
    if (isMediaField && value.startsWith('data:')) {
      const lowerPrefix = value.slice(0, 64).toLowerCase();
      const safeMedia =
        lowerPrefix.startsWith('data:image/png;') ||
        lowerPrefix.startsWith('data:image/jpeg;') ||
        lowerPrefix.startsWith('data:image/webp;') ||
        lowerPrefix.startsWith('data:image/svg+xml') ||
        lowerPrefix.startsWith('data:font/');
      if (!safeMedia) {
        throw new QuillvibeCodecError(
          'MALWARE_DETECTED',
          `Blocked suspicious embedded media URI in "${parentKey}".`,
        );
      }
      const head = decodeDataUrlHeaderBytes(value);
      if (head && hasExecutableSignature(head)) {
        throw new QuillvibeCodecError(
          'MALWARE_DETECTED',
          'Blocked embedded executable binary disguised inside media field.',
        );
      }
    }
    if (isSvgDataUri) {
      const lowerPrefix = value.slice(0, 64).toLowerCase();
      let svgInspect = value;
      const commaIdx = value.indexOf(',');
      if (commaIdx >= 0) {
        const rawBody = value.slice(commaIdx + 1);
        if (lowerPrefix.includes(';base64')) {
          try {
            const cleanB64 = rawBody.replace(/\s+/g, '');
            svgInspect += '\n' + (typeof atob === 'function' ? atob(cleanB64) : '');
          } catch {
            throw new QuillvibeCodecError(
              'MALWARE_DETECTED',
              'Blocked malformed base64 SVG payload.',
            );
          }
        } else {
          try {
            svgInspect += '\n' + decodeURIComponent(rawBody);
          } catch {
            svgInspect += '\n' + rawBody;
          }
        }
      }
      if (
        SCRIPT_THREAT_RE.test(svgInspect) ||
        INLINE_HANDLER_RE.test(svgInspect) ||
        /<a\b|\s(?:xlink:)?href\s*=\s*["']\s*(?:https?:|data:text\/html)/i.test(svgInspect)
      ) {
        throw new QuillvibeCodecError(
          'MALWARE_DETECTED',
          'Blocked SVG payload containing active script or event handlers.',
        );
      }
    } else if (parentKey !== 'content' && parentKey !== 'notes' && parentKey !== 'synopsis') {
      if (SCRIPT_THREAT_RE.test(value) || INLINE_HANDLER_RE.test(value)) {
        throw new QuillvibeCodecError(
          'MALWARE_DETECTED',
          `Blocked suspicious script content detected in field "${parentKey || 'root'}".`,
        );
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      scanPayloadForThreats(value[i], depth + 1, parentKey);
    }
    return;
  }

  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    for (const key of Object.keys(rec)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new QuillvibeCodecError(
          'MALWARE_DETECTED',
          `Blocked unsafe object property "${key}".`,
        );
      }
      scanPayloadForThreats(rec[key], depth + 1, key);
    }
  }
}

function extractAuthorKeyIdFromEnvelope(envelope: QuillvibeEnvelope): string {
  const payload = envelope.payload as Record<string, unknown> | undefined;
  if (!payload || typeof payload !== 'object') return '';
  const ai = payload.authorIdentity as Record<string, unknown> | undefined;
  if (!ai || typeof ai !== 'object') return '';
  return typeof ai.authorKeyId === 'string' ? ai.authorKeyId.trim() : '';
}

export interface EncodeQvbxOptions {
  password?: string;
  sealAuthorKeyId?: string;
  enforceRestrictions?: boolean;
}

export async function encodeQuillvibeBinary(
  envelope: QuillvibeEnvelope,
  options?: EncodeQvbxOptions,
): Promise<Uint8Array> {
  const isOfficialOut =
    envelope.extension === '.qv' ||
    envelope.extension === '.qvbible' ||
    envelope.extension === '.qvscene' ||
    envelope.extension === '.qvstyle' ||
    envelope.extension === '.qvdesign';
  const extCode = isOfficialOut ? EXT_TO_CODE[envelope.extension as QuillvibeExtension] : undefined;
  if (!extCode) {
    throw new QuillvibeCodecError(
      'INVALID_FORMAT',
      `Only official Quillvibe extensions (.qv, .qvbible, .qvscene, .qvstyle, .qvdesign) can be encoded to QVBX. Received "${envelope.extension}".`,
    );
  }

  const jsonStr = JSON.stringify(envelope);
  const plainBytes = new TextEncoder().encode(jsonStr);

  const password = options?.password?.trim() || '';
  const authorKeyId = (options?.sealAuthorKeyId ?? extractAuthorKeyIdFromEnvelope(envelope)).slice(0, 16);

  let flags = 0;
  if (password.length > 0) flags |= FLAG_PASSWORD_PROTECTED;
  if (authorKeyId.length > 0) flags |= FLAG_AUTHOR_KEY_BOUND;
  if (options?.enforceRestrictions) flags |= FLAG_RESTRICTED_COLLAB;

  const salt = new Uint8Array(16);
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(salt);
  globalThis.crypto.getRandomValues(iv);

  const keyIdBytes = new Uint8Array(16);
  keyIdBytes.set(new TextEncoder().encode(authorKeyId).slice(0, 16));

  // Seal covers extension code + author key ID + plaintext JSON bytes
  const seal = await sha256(
    concatBytes(new Uint8Array([extCode]), keyIdBytes, plainBytes),
  );

  const header = new Uint8Array(QVBX_HEADER_SIZE);
  header.set(QVBX_MAGIC, 0);
  header[4] = QVBX_VERSION;
  header[5] = flags;
  header[6] = extCode;
  header[7] = 0;
  header.set(salt, 8);
  header.set(iv, 24);
  header.set(seal, 36);
  header.set(keyIdBytes, 68);

  const key = await deriveKeyMaterial(salt, extCode, password || undefined);
  const cipherBuf = await getSubtle().encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(header),
    },
    key,
    toArrayBuffer(plainBytes),
  );

  const diffused = diffuseCipherBytes(new Uint8Array(cipherBuf), header, true);
  return concatBytes(header, diffused);
}

export async function decodeQuillvibeBinary(
  bytes: Uint8Array,
  password?: string,
): Promise<QuillvibeEnvelope> {
  if (!isQvbxBinary(bytes)) {
    throw new QuillvibeCodecError(
      'INVALID_FORMAT',
      'File does not carry the Quillvibe QVBX binary signature.',
    );
  }

  const info = inspectQuillvibeBinary(bytes);
  if (info.version !== QVBX_VERSION || !info.extension) {
    throw new QuillvibeCodecError(
      'DAMAGED_OR_TAMPERED',
      'Unsupported or damaged Quillvibe container header.',
    );
  }

  const cleanPass = password?.trim() || '';
  if (info.passwordProtected && !cleanPass) {
    throw new QuillvibeCodecError(
      'PASSWORD_REQUIRED',
      'This Quillvibe file is password-protected. Enter the file password to unlock it.',
    );
  }

  const extCode = bytes[6];
  const header = bytes.slice(0, QVBX_HEADER_SIZE);
  const salt = bytes.slice(8, 24);
  const iv = bytes.slice(24, 36);
  const expectedSeal = bytes.slice(36, 68);
  const keyIdBytes = bytes.slice(68, 84);
  const body = bytes.slice(QVBX_HEADER_SIZE);

  if (body.length < 16) {
    throw new QuillvibeCodecError(
      'DAMAGED_OR_TAMPERED',
      'File payload is truncated or damaged and cannot be restored.',
    );
  }

  const encrypted = diffuseCipherBytes(body, header, false);
  const key = await deriveKeyMaterial(salt, extCode, info.passwordProtected ? cleanPass : undefined);

  let plainBuf: ArrayBuffer;
  try {
    plainBuf = await getSubtle().decrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(header),
      },
      key,
      toArrayBuffer(encrypted),
    );
  } catch {
    if (info.passwordProtected) {
      throw new QuillvibeCodecError(
        'WRONG_PASSWORD_OR_DAMAGED',
        'Incorrect password or this protected Quillvibe file was modified outside Quillvibe and cannot be restored.',
      );
    }
    throw new QuillvibeCodecError(
      'DAMAGED_OR_TAMPERED',
      'File integrity check failed: this file was edited or damaged outside Quillvibe and cannot be restored.',
    );
  }

  const plainBytes = new Uint8Array(plainBuf);
  const computedSeal = await sha256(
    concatBytes(new Uint8Array([extCode]), keyIdBytes, plainBytes),
  );
  if (!equalBytes(expectedSeal, computedSeal)) {
    throw new QuillvibeCodecError(
      'DAMAGED_OR_TAMPERED',
      'SHA-256 content seal mismatch: file data is damaged or altered.',
    );
  }

  let parsed: unknown;
  try {
    const rawJson = new TextDecoder().decode(plainBytes);
    parsed = JSON.parse(rawJson, (k, v) =>
      k === '__proto__' || k === 'constructor' || k === 'prototype' ? undefined : v,
    );
  } catch {
    throw new QuillvibeCodecError(
      'DAMAGED_OR_TAMPERED',
      'Decoded payload is corrupted and cannot be restored.',
    );
  }

  scanPayloadForThreats(parsed);

  const envelope = parsed as QuillvibeEnvelope;
  if (!envelope || typeof envelope !== 'object' || envelope.extension !== info.extension) {
    throw new QuillvibeCodecError(
      'DAMAGED_OR_TAMPERED',
      'Container extension header does not match inner payload.',
    );
  }

  const innerAuthorKey = extractAuthorKeyIdFromEnvelope(envelope);
  if (info.authorKeyBound && info.authorKeyId && innerAuthorKey !== info.authorKeyId) {
    throw new QuillvibeCodecError(
      'AUTHOR_KEY_TAMPERED',
      `Author Key tampering detected (header ${info.authorKeyId} vs payload ${innerAuthorKey || 'missing'}). File rejected.`,
    );
  }

  return envelope;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  // 32766 is a multiple of 3 bytes so intermediate chunks emit no '=' padding.
  const chunk = 0x7ffe;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    parts.push(btoa(String.fromCharCode(...slice)));
  }
  return parts.join('');
}

export function base64ToUint8Array(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '');
  if (!clean) return new Uint8Array(0);
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}
