import { getPublisherProvenance } from './provenance';
import type { AuthorIdentity, BookProject } from './types';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function computeSha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuf = await crypto.subtle.digest('SHA-256', enc);
    return bytesToHex(new Uint8Array(hashBuf));
  }
  // Deterministic fallback hash when Web Crypto subtle is unavailable
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
  };
}

export function ensureAuthorIdentity(project: BookProject): AuthorIdentity {
  const base = createDefaultAuthorIdentity(project.author || 'Pen Name');
  if (!project.authorIdentity) return base;
  return {
    ...base,
    ...project.authorIdentity,
    penName: project.authorIdentity.penName || project.author || base.penName,
  };
}

export async function generateAuthorKeyPair(): Promise<{
  authorKeyId: string;
  publicKeyJwk: string;
  privateKeyJwk: string;
}> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const pair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify'],
      );
      const pub = await crypto.subtle.exportKey('jwk', pair.publicKey);
      const priv = await crypto.subtle.exportKey('jwk', pair.privateKey);
      const pubJson = JSON.stringify(pub);
      const fp = await computeSha256Hex(pubJson);
      return {
        authorKeyId: `BVK-${fp.slice(0, 12).toUpperCase()}`,
        publicKeyJwk: pubJson,
        privateKeyJwk: JSON.stringify(priv),
      };
    } catch {
      // Fallback below
    }
  }

  const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const fp = await computeSha256Hex(seed);
  return {
    authorKeyId: `BVK-${fp.slice(0, 12).toUpperCase()}`,
    publicKeyJwk: JSON.stringify({ kty: 'BV-LOCAL', fp: fp.slice(0, 24) }),
    privateKeyJwk: JSON.stringify({ kty: 'BV-LOCAL-PRIV', secret: fp }),
  };
}

export function buildCanonicalManuscriptText(project: BookProject): string {
  const identity = ensureAuthorIdentity(project);
  const chunks: string[] = [
    project.title,
    project.subtitle,
    identity.penName,
    identity.authorKeyId,
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
  if (!identity.authorKeyId || !identity.publicKeyJwk) {
    const keys = await generateAuthorKeyPair();
    identity = { ...identity, ...keys };
  }

  const canonical = buildCanonicalManuscriptText(next);
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
        const sigBuf = await crypto.subtle.sign(
          { name: 'ECDSA', hash: 'SHA-256' },
          key,
          new TextEncoder().encode(digest),
        );
        signatureToken = `${digest}.${bytesToHex(new Uint8Array(sigBuf)).slice(0, 32)}`;
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

/**
 * Removes private signing keys before saving portable `.bookvibe` / `.bvbook` files or LAN syncing.
 */
export function stripPrivateAuthorSecrets(project: BookProject): BookProject {
  const clean = structuredClone(project);
  if (clean.authorIdentity) {
    const { privateKeyJwk: _ignored, ...safeIdentity } = clean.authorIdentity;
    clean.authorIdentity = safeIdentity;
  }
  return clean;
}
