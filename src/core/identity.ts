import { getPublisherProvenance } from './provenance';
import type { AuthorIdentity, BookProject, CopyrightOwnershipRecord } from './types';

const PERMANENT_KEYS_STORAGE_KEY = 'quillvibe.permanentAuthorKeys.v1';
const LOCAL_DEVICE_ID_KEY = 'quillvibe.localDeviceId.v1';
const LOCAL_DEVICE_NAME_KEY = 'quillvibe.localDeviceName.v1';
let memoryDeviceId = '';

export function getOrCreateLocalDeviceId(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const existing = window.localStorage.getItem(LOCAL_DEVICE_ID_KEY);
      if (existing && /^QVD-[0-9A-F]{12}$/.test(existing)) {
        return existing;
      }
    } catch {
      // Fallback below
    }
  }
  if (memoryDeviceId) return memoryDeviceId;

  let hex = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    hex = bytesToHex(crypto.getRandomValues(new Uint8Array(6))).toUpperCase();
  } else {
    hex = Math.random().toString(16).slice(2, 14).padEnd(12, '0').slice(0, 12).toUpperCase();
  }
  const id = `QVD-${hex}`;
  memoryDeviceId = id;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(LOCAL_DEVICE_ID_KEY, id);
    } catch {
      // Ignore storage quota errors
    }
  }
  return id;
}

export function getLocalDeviceLabel(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const custom = window.localStorage.getItem(LOCAL_DEVICE_NAME_KEY);
      if (custom && custom.trim()) return custom.trim();
    } catch {
      // Ignore
    }
  }
  const plat = typeof navigator !== 'undefined' ? navigator.platform || navigator.userAgent : 'Desktop';
  const shortHost = /win/i.test(plat)
    ? 'Windows Workstation'
    : /mac/i.test(plat)
      ? 'Mac Workstation'
      : /linux/i.test(plat)
        ? 'Linux Workstation'
        : 'Quillvibe Device';
  return `${shortHost} (${getOrCreateLocalDeviceId()})`;
}

export interface PermanentAuthorKeyRecord {
  penName: string;
  normalizedPenName: string;
  authorKeyId: string;
  publicKeyJwk: string;
  privateKeyJwk: string;
  keyFingerprint: string;
  createdAt: string;
  lockedForever: true;
}

let memoryPermanentKeys = new Map<string, PermanentAuthorKeyRecord>();

function normalizePenKey(penName: string): string {
  return penName.trim().toLowerCase().replace(/\s+/g, ' ');
}

function readPermanentKeyStore(): Map<string, PermanentAuthorKeyRecord> {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(PERMANENT_KEYS_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as PermanentAuthorKeyRecord[];
        if (Array.isArray(arr)) {
          const map = new Map<string, PermanentAuthorKeyRecord>();
          for (const rec of arr) {
            if (rec?.normalizedPenName && rec?.authorKeyId) {
              map.set(rec.normalizedPenName, { ...rec, lockedForever: true });
            }
          }
          memoryPermanentKeys = map;
          return map;
        }
      }
    } catch {
      // Keep memory map on storage error
    }
  }
  return new Map(memoryPermanentKeys);
}

function writePermanentKeyStore(map: Map<string, PermanentAuthorKeyRecord>): void {
  memoryPermanentKeys = new Map(map);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(
        PERMANENT_KEYS_STORAGE_KEY,
        JSON.stringify(Array.from(map.values())),
      );
    } catch {
      // Ignore storage quota errors
    }
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-f]/gi, '');
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function computeSha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const copy = new Uint8Array(enc.byteLength);
    copy.set(enc);
    const hashBuf = await crypto.subtle.digest('SHA-256', copy.buffer);
    return bytesToHex(new Uint8Array(hashBuf));
  }
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < enc.length; i++) {
    h1 = Math.imul(h1 ^ enc[i], 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (enc[i] + i), 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export function createDefaultAuthorIdentity(author = 'Pen Name'): AuthorIdentity {
  return {
    penName: author,
    signatureText: author,
    signatureSvgDataUrl: '',
    authorKeyId: '',
    publicKeyJwk: '',
    lastSignedAt: '',
    manuscriptDigest: '',
    keyLockedForever: false,
  };
}

export function ensureAuthorIdentity(project: BookProject): AuthorIdentity {
  const base = createDefaultAuthorIdentity(project.author || 'Pen Name');
  if (!project.authorIdentity) return base;
  return {
    ...base,
    ...project.authorIdentity,
    penName: project.authorIdentity.penName || project.author || base.penName,
    keyLockedForever: Boolean(
      project.authorIdentity.keyLockedForever || project.authorIdentity.authorKeyId,
    ),
  };
}

export function getPermanentAuthorKeyForPenName(penName: string): PermanentAuthorKeyRecord | null {
  const norm = normalizePenKey(penName);
  if (!norm) return null;
  const store = readPermanentKeyStore();
  return store.get(norm) ?? null;
}

export function listPermanentAuthorKeys(): PermanentAuthorKeyRecord[] {
  return Array.from(readPermanentKeyStore().values());
}

/**
 * Creates or returns the immutable forever Author Key bound to this pen name.
 * Once generated for a pen name, it never changes or rotates.
 */
export async function getOrCreatePermanentAuthorKey(penName: string): Promise<PermanentAuthorKeyRecord> {
  const cleanPen = penName.trim() || 'Pen Name';
  const norm = normalizePenKey(cleanPen);
  const store = readPermanentKeyStore();
  const existing = store.get(norm);
  if (existing) {
    return existing;
  }

  let authorKeyId = '';
  let publicKeyJwk = '';
  let privateKeyJwk = '';
  let keyFingerprint = '';

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const pair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify'],
      );
      const pub = await crypto.subtle.exportKey('jwk', pair.publicKey);
      const priv = await crypto.subtle.exportKey('jwk', pair.privateKey);
      publicKeyJwk = JSON.stringify(pub);
      privateKeyJwk = JSON.stringify(priv);
      keyFingerprint = await computeSha256Hex(publicKeyJwk);
      authorKeyId = `QVK-${keyFingerprint.slice(0, 12).toUpperCase()}`;
    } catch {
      // Fallback below
    }
  }

  if (!authorKeyId) {
    const rand =
      typeof crypto !== 'undefined' && crypto.getRandomValues
        ? bytesToHex(crypto.getRandomValues(new Uint8Array(16)))
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    keyFingerprint = await computeSha256Hex(`${norm}:${rand}`);
    authorKeyId = `QVK-${keyFingerprint.slice(0, 12).toUpperCase()}`;
    publicKeyJwk = JSON.stringify({ kty: 'QV-LOCAL', fp: keyFingerprint.slice(0, 24) });
    privateKeyJwk = JSON.stringify({ kty: 'QV-LOCAL-PRIV', secret: keyFingerprint });
  }

  const record: PermanentAuthorKeyRecord = {
    penName: cleanPen,
    normalizedPenName: norm,
    authorKeyId,
    publicKeyJwk,
    privateKeyJwk,
    keyFingerprint,
    createdAt: new Date().toISOString(),
    lockedForever: true,
  };
  store.set(norm, record);
  writePermanentKeyStore(store);
  return record;
}

export async function generateAuthorKeyPair(penName = 'Pen Name'): Promise<{
  authorKeyId: string;
  publicKeyJwk: string;
  privateKeyJwk: string;
  keyLockedForever: true;
  keyCreatedAt: string;
  keyFingerprint: string;
}> {
  const rec = await getOrCreatePermanentAuthorKey(penName);
  return {
    authorKeyId: rec.authorKeyId,
    publicKeyJwk: rec.publicKeyJwk,
    privateKeyJwk: rec.privateKeyJwk,
    keyLockedForever: true,
    keyCreatedAt: rec.createdAt,
    keyFingerprint: rec.keyFingerprint,
  };
}

export function buildCanonicalManuscriptText(project: BookProject): string {
  const identity = ensureAuthorIdentity(project);
  const chunks: string[] = [
    project.title,
    project.subtitle,
    identity.penName,
    identity.authorKeyId,
    JSON.stringify(project.collaborators ?? []),
  ];
  for (const part of project.parts) {
    chunks.push(part.title);
    for (const ch of part.chapters) {
      chunks.push(ch.title);
      for (const sc of ch.scenes) {
        chunks.push(sc.title, sc.content);
      }
    }
  }
  return chunks.join('\n\u241e\n');
}

export async function signManuscript(project: BookProject): Promise<BookProject> {
  const next = structuredClone(project);
  let identity = ensureAuthorIdentity(next);
  const targetPen = identity.penName || next.author || 'Pen Name';

  // Always bind to the permanent pen-name key; never overwrite a locked key with a different one
  const permanent = await getOrCreatePermanentAuthorKey(targetPen);
  if (
    identity.authorKeyId &&
    identity.authorKeyId !== permanent.authorKeyId &&
    identity.keyLockedForever
  ) {
    throw new Error(
      `Pen name "${targetPen}" is permanently bound to Author Key ${identity.authorKeyId} and cannot be changed.`,
    );
  }

  const localDeviceId = getOrCreateLocalDeviceId();
  const localDeviceLabel = getLocalDeviceLabel();
  const nowIso = new Date().toISOString();

  identity = {
    ...identity,
    penName: targetPen,
    authorKeyId: identity.authorKeyId || permanent.authorKeyId,
    publicKeyJwk: identity.publicKeyJwk || permanent.publicKeyJwk,
    privateKeyJwk: identity.privateKeyJwk || permanent.privateKeyJwk,
    keyCreatedAt: identity.keyCreatedAt || permanent.createdAt,
    keyFingerprint: identity.keyFingerprint || permanent.keyFingerprint,
    originDeviceId: identity.originDeviceId || localDeviceId,
    originDeviceName: identity.originDeviceName || localDeviceLabel,
    originVerifiedAt: identity.originVerifiedAt || nowIso,
    keyLockedForever: true,
  };

  const canonical = buildCanonicalManuscriptText({ ...next, authorIdentity: identity });
  const digest = await computeSha256Hex(canonical);
  let signatureToken = digest;

  if (identity.privateKeyJwk && typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const parsedPriv = JSON.parse(identity.privateKeyJwk) as JsonWebKey;
      if (parsedPriv.kty === 'EC') {
        const key = await crypto.subtle.importKey(
          'jwk',
          parsedPriv,
          { name: 'ECDSA', namedCurve: 'P-256' },
          false,
          ['sign'],
        );
        const digestBytes = new TextEncoder().encode(digest);
        const copy = new Uint8Array(digestBytes.byteLength);
        copy.set(digestBytes);
        const sigBuf = await crypto.subtle.sign(
          { name: 'ECDSA', hash: 'SHA-256' },
          key,
          copy.buffer,
        );
        signatureToken = `${digest}.${bytesToHex(new Uint8Array(sigBuf))}`;
      }
    } catch {
      // Keep SHA-256 digest seal if JWK is local-only fallback
    }
  }

  next.author = identity.penName || next.author;
  next.authorIdentity = {
    ...identity,
    manuscriptDigest: signatureToken,
    lastSignedAt: new Date().toISOString(),
    provenanceMark: getPublisherProvenance(next.id).mark,
  };
  return next;
}

export interface AuthorKeyCheckResult {
  ok: boolean;
  reason?: string;
}

export async function verifyProjectAuthorKeyIntegrity(
  project: BookProject,
): Promise<AuthorKeyCheckResult> {
  const identity = project.authorIdentity;
  if (!identity || !identity.authorKeyId) {
    return { ok: true };
  }

  if (identity.publicKeyJwk) {
    const fp = await computeSha256Hex(identity.publicKeyJwk);
    const expectedPrefix = identity.authorKeyId.startsWith('BVK-') ? 'BVK-' : 'QVK-';
    const expectedId = `${expectedPrefix}${fp.slice(0, 12).toUpperCase()}`;
    if (identity.authorKeyId !== expectedId && !identity.publicKeyJwk.includes('QV-LOCAL') && !identity.publicKeyJwk.includes('BV-LOCAL')) {
      return {
        ok: false,
        reason: `Author Key ID (${identity.authorKeyId}) does not match embedded public key fingerprint (${expectedId}).`,
      };
    }
  }

  const localForever = getPermanentAuthorKeyForPenName(identity.penName);
  if (localForever && localForever.authorKeyId !== identity.authorKeyId) {
    return {
      ok: false,
      reason: `Author Key mismatch for pen name "${identity.penName}": expected permanent key ${localForever.authorKeyId}, file carried ${identity.authorKeyId}.`,
    };
  }

  if (
    identity.manuscriptDigest &&
    identity.manuscriptDigest.includes('.') &&
    identity.publicKeyJwk &&
    typeof crypto !== 'undefined' &&
    crypto.subtle
  ) {
    const [digestHex, sigHex] = identity.manuscriptDigest.split('.');
    if (sigHex && sigHex.length >= 64) {
      try {
        const parsedPub = JSON.parse(identity.publicKeyJwk) as JsonWebKey;
        if (parsedPub.kty === 'EC') {
          const pubKey = await crypto.subtle.importKey(
            'jwk',
            parsedPub,
            { name: 'ECDSA', namedCurve: 'P-256' },
            false,
            ['verify'],
          );
          const sigBytes = hexToBytes(sigHex);
          const sigCopy = new Uint8Array(sigBytes.byteLength);
          sigCopy.set(sigBytes);
          const msgBytes = new TextEncoder().encode(digestHex);
          const msgCopy = new Uint8Array(msgBytes.byteLength);
          msgCopy.set(msgBytes);
          const validSig = await crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            pubKey,
            sigCopy.buffer,
            msgCopy.buffer,
          );
          if (!validSig) {
            return {
              ok: false,
              reason: 'Cryptographic ECDSA author seal verification failed.',
            };
          }
        }
      } catch {
        return {
          ok: false,
          reason: 'Malformed public Author Key JWK.',
        };
      }
    }
  }

  return { ok: true };
}

/**
 * Removes private signing keys before saving portable `.qv` files or syncing.
 */
export function stripPrivateAuthorSecrets(project: BookProject): BookProject {
  const clean = structuredClone(project);
  if (clean.authorIdentity) {
    const { privateKeyJwk: _ignored, ...safeIdentity } = clean.authorIdentity;
    clean.authorIdentity = safeIdentity;
  }
  return clean;
}

export interface OriginDeviceCheckResult {
  isOriginDevice: boolean;
  hasOriginRecord: boolean;
  originDeviceId: string;
  originDeviceName: string;
  localDeviceId: string;
  penName: string;
  authorKeyId: string;
  summary: string;
}

export function checkBookOriginDevice(project: BookProject): OriginDeviceCheckResult {
  const localDeviceId = getOrCreateLocalDeviceId();
  const id = project.authorIdentity;
  const originDeviceId = id?.originDeviceId || '';
  const originDeviceName = id?.originDeviceName || '';
  const penName = id?.penName || project.author || 'Primary Author';
  const authorKeyId = id?.authorKeyId || '';

  if (!originDeviceId) {
    return {
      isOriginDevice: false,
      hasOriginRecord: false,
      originDeviceId: '',
      originDeviceName: '',
      localDeviceId,
      penName,
      authorKeyId,
      summary: `Unbound origin device. Sign manuscript on this device (${localDeviceId}) to record where it originated.`,
    };
  }

  const isOriginDevice = originDeviceId === localDeviceId;
  return {
    isOriginDevice,
    hasOriginRecord: true,
    originDeviceId,
    originDeviceName,
    localDeviceId,
    penName,
    authorKeyId,
    summary: isOriginDevice
      ? `Origin Match: Created and sealed on this device (${originDeviceId}) by ${penName}.`
      : `External Device Copy: Originated on ${originDeviceName || originDeviceId}; currently opened on ${localDeviceId}.`,
  };
}

/**
 * Registers and cryptographically seals a Work Copyright & Ownership record (`QVC-`)
 * inside the book project (separate from the permanent Author & Origin Device Key).
 */
export async function sealWorkCopyright(
  project: BookProject,
  options?: {
    ownerName?: string;
    rightsTerritory?: string;
    editionNumber?: string;
  },
): Promise<BookProject> {
  const signed = await signManuscript(project);
  const ownerName =
    options?.ownerName?.trim() ||
    signed.copyrightOwnership?.ownerName ||
    signed.authorIdentity?.penName ||
    signed.author ||
    'Author';
  const rightsTerritory =
    options?.rightsTerritory?.trim() ||
    signed.publishing?.rightsTerritory ||
    signed.copyrightOwnership?.rightsTerritory ||
    'Worldwide';
  const editionNumber =
    options?.editionNumber?.trim() ||
    signed.publishing?.editionNumber ||
    signed.copyrightOwnership?.editionNumber ||
    '1st Edition';

  const noticeYear = new Date().getFullYear();
  const copyrightNotice =
    signed.copyrightNotice?.trim() ||
    `Copyright © ${noticeYear} ${ownerName}. All rights reserved.`;

  const canonicalWork = buildCanonicalManuscriptText(signed);
  const workDigestSha256 = await computeSha256Hex(
    `${canonicalWork}\nCOPYRIGHT:${ownerName}|${rightsTerritory}|${copyrightNotice}`,
  );
  const sealId = `QVC-${workDigestSha256.slice(0, 12).toUpperCase()}`;

  let certificateSignature = workDigestSha256;
  const privJson = signed.authorIdentity?.privateKeyJwk;
  if (privJson && typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const parsedPriv = JSON.parse(privJson) as JsonWebKey;
      if (parsedPriv.kty === 'EC') {
        const key = await crypto.subtle.importKey(
          'jwk',
          parsedPriv,
          { name: 'ECDSA', namedCurve: 'P-256' },
          false,
          ['sign'],
        );
        const raw = new TextEncoder().encode(`${sealId}:${workDigestSha256}`);
        const copy = new Uint8Array(raw.byteLength);
        copy.set(raw);
        const sigBuf = await crypto.subtle.sign(
          { name: 'ECDSA', hash: 'SHA-256' },
          key,
          copy.buffer,
        );
        certificateSignature = `${workDigestSha256}.${bytesToHex(new Uint8Array(sigBuf))}`;
      }
    } catch {
      // Keep SHA-256 certificate digest
    }
  }

  const record: CopyrightOwnershipRecord = {
    sealId,
    ownerName,
    copyrightNotice,
    workTitle: signed.title,
    registeredAt: new Date().toISOString(),
    workDigestSha256,
    certificateSignature,
    rightsTerritory,
    editionNumber,
  };

  signed.copyrightNotice = copyrightNotice;
  signed.copyrightOwnership = record;
  return signed;
}
