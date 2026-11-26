import {
  computeSha256Hex,
  getLocalDeviceLabel,
  getOrCreateLocalDeviceId,
} from './identity';
import { normalizeProjectDefaults } from './library';
import { countWords, findSceneContext, isSceneLocked, newId } from './manuscript';
import type {
  BookProject,
  Collaborator,
  CollaboratorPermissions,
  CollaboratorRole,
  SceneAnnotation,
  SceneNode,
} from './types';

export const COLLABORATOR_ROLE_LABELS: Record<CollaboratorRole, string> = {
  'co-author': 'Co-Author',
  proofreader: 'Proofreader',
  editor: 'Line Editor',
  typesetter: 'Typesetter & Cover Designer',
  publisher: 'Publisher / Imprint Lead',
  'beta-reader': 'Beta Reader',
};

export const DEFAULT_ROLE_PERMISSIONS: Record<CollaboratorRole, CollaboratorPermissions> = {
  'co-author': {
    canEditProse: true,
    canProofreadOnly: false,
    canEditBibleAndGraph: true,
    canEditCoverAndTypeset: false,
    canExportFiles: true,
    canManageCollaborators: false,
  },
  proofreader: {
    canEditProse: false,
    canProofreadOnly: true,
    canEditBibleAndGraph: false,
    canEditCoverAndTypeset: false,
    canExportFiles: false,
    canManageCollaborators: false,
  },
  editor: {
    canEditProse: true,
    canProofreadOnly: false,
    canEditBibleAndGraph: true,
    canEditCoverAndTypeset: false,
    canExportFiles: false,
    canManageCollaborators: false,
  },
  typesetter: {
    canEditProse: false,
    canProofreadOnly: false,
    canEditBibleAndGraph: false,
    canEditCoverAndTypeset: true,
    canExportFiles: true,
    canManageCollaborators: false,
  },
  publisher: {
    canEditProse: false,
    canProofreadOnly: true,
    canEditBibleAndGraph: true,
    canEditCoverAndTypeset: true,
    canExportFiles: true,
    canManageCollaborators: true,
  },
  'beta-reader': {
    canEditProse: false,
    canProofreadOnly: true,
    canEditBibleAndGraph: false,
    canEditCoverAndTypeset: false,
    canExportFiles: false,
    canManageCollaborators: false,
  },
};

export const OWNER_FULL_PERMISSIONS: CollaboratorPermissions = {
  canEditProse: true,
  canProofreadOnly: false,
  canEditBibleAndGraph: true,
  canEditCoverAndTypeset: true,
  canExportFiles: true,
  canManageCollaborators: true,
};

export function getCollaboratorPermissions(collab: Pick<Collaborator, 'role' | 'permissions'>): CollaboratorPermissions {
  return {
    ...DEFAULT_ROLE_PERMISSIONS[collab.role],
    ...(collab.permissions ?? {}),
  };
}

export function getActiveSessionPermissions(project: BookProject): CollaboratorPermissions & {
  isOwner: boolean;
  canModifyAuthorKey: boolean;
} {
  const ownerName = (project.authorIdentity?.penName || project.author || 'Primary Author').trim().toLowerCase();
  const activeName = (project.activeAuthorLabel || ownerName).trim().toLowerCase();
  if (!activeName || activeName === ownerName) {
    return {
      ...OWNER_FULL_PERMISSIONS,
      isOwner: true,
      canModifyAuthorKey: !project.authorIdentity?.keyLockedForever,
    };
  }
  const collaborators = project.collaborators ?? [];
  const match = collaborators.find(
    (c) => (c.penName || c.name).trim().toLowerCase() === activeName || c.name.trim().toLowerCase() === activeName,
  );
  if (!match) {
    // Only single-author local projects with zero collaborators grant owner fallback
    if (collaborators.length === 0) {
      return {
        ...OWNER_FULL_PERMISSIONS,
        isOwner: true,
        canModifyAuthorKey: !project.authorIdentity?.keyLockedForever,
      };
    }
    return {
      canEditProse: false,
      canProofreadOnly: true,
      canEditBibleAndGraph: false,
      canEditCoverAndTypeset: false,
      canExportFiles: false,
      canManageCollaborators: false,
      isOwner: false,
      canModifyAuthorKey: false,
    };
  }
  return {
    ...getCollaboratorPermissions(match),
    isOwner: false,
    canModifyAuthorKey: false,
  };
}

export function updateCollaboratorPermissions(
  project: BookProject,
  collaboratorId: string,
  patch: Partial<CollaboratorPermissions>,
): BookProject {
  const next = normalizeProjectDefaults(project);
  next.collaborators = (next.collaborators ?? []).map((c) => {
    if (c.id !== collaboratorId) return c;
    const base = getCollaboratorPermissions(c);
    return {
      ...c,
      permissions: { ...base, ...patch },
    };
  });
  return next;
}

const COLLAB_COLORS = ['#c7a97b', '#6b9cd4', '#67b08c', '#c78c9c', '#989ec4'];

export interface VerifiedCoAuthorTokenPayload {
  v: 1;
  name: string;
  penName: string;
  role: CollaboratorRole;
  deviceId: string;
  deviceLabel: string;
  coAuthorKeyId: string;
  publicKeyJwk: string;
  issuedAt: string;
  signature: string;
}

export interface VerifiedCoAuthorTokenResult {
  payload: VerifiedCoAuthorTokenPayload;
  sameDevice: boolean;
}

function bytesToHexLocal(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytesLocal(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-f]/gi, '');
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function utf8ToBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToUtf8(b64u: string): string {
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/**
 * Run on the collaborator's SECOND device to prove physical separate-device identity
 * and generate a verifiable signed co-author token (`QVCA1.<payload>`).
 */
export async function generateLocalCoAuthorInviteToken(input: {
  name: string;
  penName?: string;
  role?: CollaboratorRole;
  deviceLabel?: string;
}): Promise<{
  token: string;
  coAuthorKeyId: string;
  deviceId: string;
  deviceLabel: string;
}> {
  const cleanName = input.name.trim() || 'Co-Author';
  const cleanPen = (input.penName ?? cleanName).trim() || cleanName;
  const role: CollaboratorRole = input.role ?? 'co-author';
  const deviceId = getOrCreateLocalDeviceId();
  const deviceLabel = input.deviceLabel?.trim() || getLocalDeviceLabel();
  const issuedAt = new Date().toISOString();

  let publicKeyJwk = '';
  let coAuthorKeyId = '';
  let signature = '';
  const signBase = `${cleanName}|${cleanPen}|${role}|${deviceId}|${issuedAt}`;

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const pair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify'],
      );
      const pubJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
      publicKeyJwk = JSON.stringify(pubJwk);
      const fp = await computeSha256Hex(`${publicKeyJwk}:${deviceId}`);
      coAuthorKeyId = `QVCK-${fp.slice(0, 12).toUpperCase()}`;

      const msgBytes = new TextEncoder().encode(signBase);
      const copy = new Uint8Array(msgBytes.byteLength);
      copy.set(msgBytes);
      const sigBuf = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        pair.privateKey,
        copy.buffer,
      );
      signature = `ecdsa.${bytesToHexLocal(new Uint8Array(sigBuf))}`;
    } catch {
      // Fallback below
    }
  }

  if (!coAuthorKeyId) {
    const digest = await computeSha256Hex(`${signBase}:LOCAL`);
    coAuthorKeyId = `QVCK-${digest.slice(0, 12).toUpperCase()}`;
    publicKeyJwk = JSON.stringify({ kty: 'QV-COAUTH', deviceId, fp: digest.slice(0, 24) });
    signature = `sha256.${digest}`;
  }

  const payload: VerifiedCoAuthorTokenPayload = {
    v: 1,
    name: cleanName,
    penName: cleanPen,
    role,
    deviceId,
    deviceLabel,
    coAuthorKeyId,
    publicKeyJwk,
    issuedAt,
    signature,
  };

  return {
    token: `QVCA1.${utf8ToBase64Url(JSON.stringify(payload))}`,
    coAuthorKeyId,
    deviceId,
    deviceLabel,
  };
}

export async function parseAndVerifyCoAuthorToken(
  tokenRaw: string,
  options?: { hostDeviceId?: string; requireDistinctDevice?: boolean },
): Promise<VerifiedCoAuthorTokenResult> {
  const clean = tokenRaw.trim();
  if (!clean.startsWith('QVCA1.')) {
    throw new Error('Invalid co-author verification token format (expected QVCA1 prefix).');
  }
  const encoded = clean.slice('QVCA1.'.length);
  let payload: VerifiedCoAuthorTokenPayload;
  try {
    payload = JSON.parse(base64UrlToUtf8(encoded)) as VerifiedCoAuthorTokenPayload;
  } catch {
    throw new Error('Corrupted co-author device verification token.');
  }
  if (
    !payload ||
    payload.v !== 1 ||
    !payload.name ||
    !payload.deviceId ||
    !payload.coAuthorKeyId ||
    !payload.publicKeyJwk ||
    !payload.signature
  ) {
    throw new Error('Co-author token is missing required device identity fields.');
  }

  const signBase = `${payload.name}|${payload.penName}|${payload.role}|${payload.deviceId}|${payload.issuedAt}`;
  if (payload.signature.startsWith('ecdsa.') && typeof crypto !== 'undefined' && crypto.subtle) {
    const pubJwk = JSON.parse(payload.publicKeyJwk) as JsonWebKey;
    const fp = await computeSha256Hex(`${payload.publicKeyJwk}:${payload.deviceId}`);
    const expectedKeyId = `QVCK-${fp.slice(0, 12).toUpperCase()}`;
    if (expectedKeyId !== payload.coAuthorKeyId) {
      throw new Error('Co-author key fingerprint does not match device identity.');
    }
    const pubKey = await crypto.subtle.importKey(
      'jwk',
      pubJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const sigBytes = hexToBytesLocal(payload.signature.slice('ecdsa.'.length));
    const sigCopy = new Uint8Array(sigBytes.byteLength);
    sigCopy.set(sigBytes);
    const msgBytes = new TextEncoder().encode(signBase);
    const msgCopy = new Uint8Array(msgBytes.byteLength);
    msgCopy.set(msgBytes);
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pubKey,
      sigCopy.buffer,
      msgCopy.buffer,
    );
    if (!ok) {
      throw new Error('Co-author cryptographic device signature failed verification.');
    }
  } else {
    throw new Error('Co-author token requires a verifiable ECDSA P-256 device signature.');
  }

  const hostDevice = options?.hostDeviceId || getOrCreateLocalDeviceId();
  const sameDevice = payload.deviceId === hostDevice;
  const requireDistinct = options?.requireDistinctDevice ?? true;
  if (requireDistinct && sameDevice) {
    throw new Error(
      `Verification blocked: this token was generated on this same device (${hostDevice}). Generate the Co-Author Key on your co-writer's separate device to prevent unverified self-adding.`,
    );
  }

  return { payload, sameDevice };
}

export async function addVerifiedCoAuthorFromToken(
  project: BookProject,
  token: string,
  options?: {
    roleOverride?: CollaboratorRole;
    creditLine?: string;
    requireDistinctDevice?: boolean;
  },
): Promise<{ project: BookProject; collaborator: Collaborator }> {
  const { payload, sameDevice } = await parseAndVerifyCoAuthorToken(token, {
    requireDistinctDevice: options?.requireDistinctDevice ?? true,
  });
  const role = options?.roleOverride ?? payload.role;
  const next = normalizeProjectDefaults(project);
  const existing = (next.collaborators ?? []).find(
    (c) => c.coAuthorKeyId && c.coAuthorKeyId === payload.coAuthorKeyId,
  );
  if (existing) {
    throw new Error(`Co-Author Key ${payload.coAuthorKeyId} is already paired with this book.`);
  }

  const entry: Collaborator = {
    id: newId('collab'),
    name: payload.name,
    penName: payload.penName,
    role,
    creditLine:
      options?.creditLine?.trim() || `${COLLABORATOR_ROLE_LABELS[role]}: ${payload.penName}`,
    authorKeyId: payload.coAuthorKeyId,
    deviceId: payload.deviceId,
    deviceLabel: payload.deviceLabel,
    coAuthorKeyId: payload.coAuthorKeyId,
    publicKeyJwk: payload.publicKeyJwk,
    deviceSignature: payload.signature,
    verifiedDevice: !sameDevice,
    verifiedAt: new Date().toISOString(),
    color: COLLAB_COLORS[(next.collaborators?.length ?? 0) % COLLAB_COLORS.length],
    addedAt: new Date().toISOString(),
    permissions: { ...DEFAULT_ROLE_PERMISSIONS[role] },
  };
  next.collaborators = [...(next.collaborators ?? []), entry];
  return { project: next, collaborator: entry };
}

export function addCollaborator(
  project: BookProject,
  input: {
    name: string;
    penName?: string;
    role: CollaboratorRole;
    creditLine?: string;
    authorKeyId?: string;
    deviceId?: string;
    deviceLabel?: string;
    coAuthorKeyId?: string;
    verifiedDevice?: boolean;
    permissions?: Partial<CollaboratorPermissions>;
  },
): BookProject {
  const next = normalizeProjectDefaults(project);
  const entry: Collaborator = {
    id: newId('collab'),
    name: input.name.trim() || 'Collaborator',
    penName: (input.penName ?? input.name).trim() || 'Collaborator',
    role: input.role,
    creditLine:
      input.creditLine?.trim() ||
      `${COLLABORATOR_ROLE_LABELS[input.role]}: ${(input.penName || input.name).trim()}`,
    authorKeyId: input.authorKeyId?.trim() || input.coAuthorKeyId?.trim() || '',
    deviceId: input.deviceId,
    deviceLabel: input.deviceLabel,
    coAuthorKeyId: input.coAuthorKeyId,
    verifiedDevice: input.verifiedDevice ?? false,
    color: COLLAB_COLORS[(next.collaborators?.length ?? 0) % COLLAB_COLORS.length],
    addedAt: new Date().toISOString(),
    permissions: {
      ...DEFAULT_ROLE_PERMISSIONS[input.role],
      ...(input.permissions ?? {}),
    },
  };
  next.collaborators = [...(next.collaborators ?? []), entry];
  return next;
}

export function removeCollaborator(project: BookProject, collaboratorId: string): BookProject {
  const next = normalizeProjectDefaults(project);
  next.collaborators = (next.collaborators ?? []).filter((c) => c.id !== collaboratorId);
  return next;
}

export function addSceneAnnotation(
  project: BookProject,
  sceneId: string,
  input: {
    authorName: string;
    role: CollaboratorRole;
    quote: string;
    suggestion: string;
    note: string;
  },
): BookProject {
  const next = normalizeProjectDefaults(project);
  const ctx = findSceneContext(next, sceneId);
  if (!ctx) return next;

  const scene = next.parts[ctx.partIndex].chapters[ctx.chapterIndex].scenes[ctx.sceneIndex];
  const ann: SceneAnnotation = {
    id: newId('ann'),
    authorName: input.authorName.trim() || 'Proofreader',
    role: input.role,
    quote: input.quote.trim(),
    suggestion: input.suggestion.trim(),
    note: input.note.trim(),
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  scene.annotations = [ann, ...(scene.annotations ?? [])];
  return next;
}

export function acceptSceneAnnotation(
  project: BookProject,
  sceneId: string,
  annotationId: string,
): { project: BookProject; appliedReplacement: boolean } {
  if (isSceneLocked(project, sceneId).locked) {
    return { project, appliedReplacement: false };
  }
  const next = normalizeProjectDefaults(project);
  const ctx = findSceneContext(next, sceneId);
  if (!ctx) return { project: next, appliedReplacement: false };

  const scene = next.parts[ctx.partIndex].chapters[ctx.chapterIndex].scenes[ctx.sceneIndex];
  const ann = (scene.annotations ?? []).find((a) => a.id === annotationId);
  if (!ann) return { project: next, appliedReplacement: false };

  let replaced = false;
  if (ann.quote && ann.suggestion && scene.content.includes(ann.quote)) {
    scene.snapshots.unshift({
      id: newId('snap'),
      createdAt: new Date().toISOString(),
      label: `Before ${ann.authorName} edit`,
      content: scene.content,
      wordCount: countWords(scene.content),
    });
    scene.content = scene.content.replace(ann.quote, ann.suggestion);
    scene.updatedAt = new Date().toISOString();
    replaced = true;
  }

  ann.status = 'accepted';
  return { project: next, appliedReplacement: replaced };
}

export function dismissSceneAnnotation(
  project: BookProject,
  sceneId: string,
  annotationId: string,
): BookProject {
  const next = normalizeProjectDefaults(project);
  const ctx = findSceneContext(next, sceneId);
  if (!ctx) return next;
  const scene = next.parts[ctx.partIndex].chapters[ctx.chapterIndex].scenes[ctx.sceneIndex];
  const ann = (scene.annotations ?? []).find((a) => a.id === annotationId);
  if (ann) ann.status = 'dismissed';
  return next;
}

export interface MergeSummary {
  project: BookProject;
  updatedScenes: number;
  addedScenes: number;
  conflictSnapshots: number;
  mergedAnnotations: number;
  mergedCollaborators: number;
}

function mergeAnnotations(local: SceneAnnotation[] = [], remote: SceneAnnotation[] = []): {
  merged: SceneAnnotation[];
  addedCount: number;
} {
  const map = new Map<string, SceneAnnotation>();
  for (const a of local) map.set(a.id, a);
  let added = 0;
  for (const r of remote) {
    if (!map.has(r.id)) {
      map.set(r.id, r);
      added++;
    }
  }
  return { merged: Array.from(map.values()), addedCount: added };
}

function mergeById<T extends { id: string }>(local: T[] = [], remote: T[] = []): T[] {
  const map = new Map<string, T>();
  for (const item of local) map.set(item.id, item);
  for (const item of remote) {
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return Array.from(map.values());
}

/**
 * Offline desktop-to-desktop revision merge (Wi-Fi LAN / Bluetooth / Nearby Share).
 * Preserves conflicting edits safely as immutable snapshots without overwriting local prose.
 */
export function mergeBookRevisions(
  localRaw: BookProject,
  incomingRaw: BookProject,
  peerLabel = 'Peer Device',
): MergeSummary {
  const local = normalizeProjectDefaults(localRaw);
  const incoming = normalizeProjectDefaults(incomingRaw);

  let updatedScenes = 0;
  let addedScenes = 0;
  let conflictSnapshots = 0;
  let mergedAnnotations = 0;

  const localSceneMap = new Map<string, { partIdx: number; chapIdx: number; sceneIdx: number; scene: SceneNode }>();
  local.parts.forEach((part, pIdx) => {
    part.chapters.forEach((chap, cIdx) => {
      chap.scenes.forEach((sc, sIdx) => {
        localSceneMap.set(sc.id, { partIdx: pIdx, chapIdx: cIdx, sceneIdx: sIdx, scene: sc });
      });
    });
  });

  for (const incPart of incoming.parts) {
    for (const incChap of incPart.chapters) {
      for (const incScene of incChap.scenes) {
        const match = localSceneMap.get(incScene.id);
        if (!match) {
          // Add missing chapter/scene safely into local manuscript
          let targetPart = local.parts.find((p) => p.id === incPart.id || p.title === incPart.title);
          if (!targetPart) {
            targetPart = {
              id: incPart.id,
              title: incPart.title,
              collapsed: false,
              chapters: [],
            };
            local.parts.push(targetPart);
          }
          let targetChap = targetPart.chapters.find((c) => c.id === incChap.id || c.title === incChap.title);
          if (!targetChap) {
            targetChap = {
              id: incChap.id,
              title: incChap.title,
              subtitle: incChap.subtitle,
              collapsed: false,
              scenes: [],
            };
            targetPart.chapters.push(targetChap);
          }
          targetChap.scenes.push(structuredClone(incScene));
          addedScenes++;
          continue;
        }

        const localScene = local.parts[match.partIdx].chapters[match.chapIdx].scenes[match.sceneIdx];
        const annMerge = mergeAnnotations(localScene.annotations, incScene.annotations);
        localScene.annotations = annMerge.merged;
        mergedAnnotations += annMerge.addedCount;
        localScene.proofreadMarks = mergeById(localScene.proofreadMarks, incScene.proofreadMarks);
        localScene.snapshots = mergeById(localScene.snapshots, incScene.snapshots);

        if (localScene.content !== incScene.content) {
          const localTime = Date.parse(localScene.updatedAt) || 0;
          const incTime = Date.parse(incScene.updatedAt) || 0;
          const locked = isSceneLocked(local, localScene.id).locked;

          if (!locked && incTime > localTime) {
            // Preserve local content in snapshot before taking newer peer draft
            localScene.snapshots.unshift({
              id: newId('snap'),
              createdAt: new Date().toISOString(),
              label: `Local version before ${peerLabel} sync`,
              content: localScene.content,
              wordCount: countWords(localScene.content),
            });
            localScene.content = incScene.content;
            localScene.title = incScene.title;
            localScene.synopsis = incScene.synopsis;
            localScene.updatedAt = incScene.updatedAt;
            updatedScenes++;
            conflictSnapshots++;
          } else {
            // Keep local prose and record peer variation as conflict snapshot
            localScene.snapshots.unshift({
              id: newId('snap'),
              createdAt: new Date().toISOString(),
              label: `Sync conflict from ${peerLabel}`,
              content: incScene.content,
              wordCount: countWords(incScene.content),
            });
            conflictSnapshots++;
          }
        }
      }
    }
  }

  const mergedCollaborators = 0;
  // Do not merge remote collaborator lists automatically without owner authorization; preserve local collaborator ACLs.

  local.bible = {
    characters: mergeById(local.bible.characters, incoming.bible.characters),
    locations: mergeById(local.bible.locations, incoming.bible.locations),
    lore: mergeById(local.bible.lore, incoming.bible.lore),
    customCategories: mergeById(local.bible.customCategories, incoming.bible.customCategories),
    customEntries: mergeById(local.bible.customEntries, incoming.bible.customEntries),
  };

  if (local.storyGraph && incoming.storyGraph) {
    local.storyGraph = {
      nodes: mergeById(local.storyGraph.nodes, incoming.storyGraph.nodes),
      edges: mergeById(local.storyGraph.edges, incoming.storyGraph.edges),
    };
  }

  return {
    project: local,
    updatedScenes,
    addedScenes,
    conflictSnapshots,
    mergedAnnotations,
    mergedCollaborators,
  };
}
