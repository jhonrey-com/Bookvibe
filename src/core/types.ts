export type SceneStatus = 'outline' | 'draft' | 'revision' | 'final';

export type PaperTheme = 'obsidian' | 'parchment' | 'ivory';

export type TrimSize = '5x8' | '5.5x8.5' | '6x9' | 'a5';

export type FontFamilyId = 'garamond' | 'baskerville' | 'palatino' | 'inter';

export type ChapterNumeralStyle = 'roman' | 'word' | 'numeric';

export type StudioViewId = 'editor' | 'corkboard' | 'outline' | 'bible' | 'graph' | 'typeset';

export type CollaboratorRole = 'co-author' | 'proofreader' | 'editor' | 'beta-reader';

export type GraphNodeKind = 'character' | 'location' | 'lore' | 'plot' | 'scene' | 'custom';

export type CoverTemplateId =
  | 'obsidian-foil'
  | 'ivory-classic'
  | 'editorial-band'
  | 'full-bleed'
  | 'minimal-spine';

export type BookvibeExtension =
  | '.bookvibe'
  | '.bvibe'
  | '.bvbook'
  | '.bvbible'
  | '.bvscene'
  | '.bvstyle';

export type ExportFormatId = BookvibeExtension | '.epub' | '.md' | '.html' | '.txt';

export type ProofreadMarkKind =
  | 'delete'
  | 'insert'
  | 'substitute'
  | 'comment'
  | 'highlight'
  | 'transpose'
  | 'stet'
  | 'paragraph'
  | 'run-in'
  | 'closeup'
  | 'space'
  | 'capitalize'
  | 'lowercase'
  | 'italic'
  | 'bold';

export interface ProofreadMark {
  id: string;
  kind: ProofreadMarkKind;
  start: number;
  end: number;
  originalText: string;
  replacement: string;
  note: string;
  authorName: string;
  role: CollaboratorRole;
  status: 'open' | 'accepted' | 'rejected' | 'stet';
  createdAt: string;
}

export type ExtensionPermission =
  | 'read:active-scene'
  | 'read:manuscript'
  | 'read:bible'
  | 'propose:proofread-marks'
  | 'apply:text-transform'
  | 'add:export-preset';

export interface ExtensionRuleDef {
  id: string;
  label: string;
  pattern: string;
  flags?: string;
  markKind: ProofreadMarkKind;
  replacement?: string;
  note: string;
}

export interface ExtensionTransformDef {
  id: string;
  label: string;
  description: string;
  kind: 'smart-typography' | 'collapse-double-spaces' | 'trim-trailing-spaces' | 'strip-straight-quotes';
}

export interface ExtensionPresetDef {
  id: string;
  label: string;
  paperTheme?: PaperTheme;
  typography?: Partial<TypographyConfig>;
}

export interface BookvibePluginManifest {
  magic: 'BOOKVIBE_EXT_V1';
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  kind: 'integrated' | 'external';
  permissions: ExtensionPermission[];
  dataUsageSummary: string;
  rules?: ExtensionRuleDef[];
  transforms?: ExtensionTransformDef[];
  presets?: ExtensionPresetDef[];
  metricsReport?: 'readability';
}

export interface InstalledExtension {
  manifest: BookvibePluginManifest;
  source: 'integrated' | 'external';
  enabled: boolean;
  grantedPermissions: ExtensionPermission[];
  installedAt: string;
  sha256: string;
}

export interface ExtensionAuditEntry {
  id: string;
  extensionId: string;
  extensionName: string;
  action: string;
  permissionsUsed: ExtensionPermission[];
  dataAccessed: string;
  timestamp: string;
}

export interface SceneSnapshot {
  id: string;
  createdAt: string;
  label: string;
  content: string;
  wordCount: number;
}

export interface SceneAnnotation {
  id: string;
  authorName: string;
  role: CollaboratorRole;
  quote: string;
  suggestion: string;
  note: string;
  status: 'open' | 'accepted' | 'dismissed';
  createdAt: string;
}

export interface SceneNode {
  id: string;
  title: string;
  synopsis: string;
  status: SceneStatus;
  pov: string;
  location: string;
  timeline: string;
  wordTarget: number;
  content: string;
  notes: string;
  snapshots: SceneSnapshot[];
  annotations?: SceneAnnotation[];
  proofreadMarks?: ProofreadMark[];
  updatedAt: string;
}

export interface ChapterNode {
  id: string;
  title: string;
  subtitle: string;
  collapsed: boolean;
  scenes: SceneNode[];
}

export interface PartNode {
  id: string;
  title: string;
  collapsed: boolean;
  chapters: ChapterNode[];
}

export interface CustomBibleField {
  key: string;
  value: string;
}

export interface CharacterEntry {
  id: string;
  name: string;
  aliases: string;
  role: string;
  motivation: string;
  appearance: string;
  notes: string;
  imageDataUrl?: string;
  customFields?: CustomBibleField[];
}

export interface LocationEntry {
  id: string;
  name: string;
  region: string;
  atmosphere: string;
  notes: string;
  imageDataUrl?: string;
  customFields?: CustomBibleField[];
}

export interface LoreEntry {
  id: string;
  name: string;
  category: string;
  summary: string;
  notes: string;
  imageDataUrl?: string;
  customFields?: CustomBibleField[];
}

export interface CustomBibleCategory {
  id: string;
  name: string;
  description: string;
}

export interface CustomBibleEntry {
  id: string;
  categoryId: string;
  name: string;
  subtitle: string;
  summary: string;
  notes: string;
  imageDataUrl?: string;
  customFields: CustomBibleField[];
}

export interface StoryBible {
  characters: CharacterEntry[];
  locations: LocationEntry[];
  lore: LoreEntry[];
  customCategories?: CustomBibleCategory[];
  customEntries?: CustomBibleEntry[];
}

export interface TypographyConfig {
  trimSize: TrimSize;
  fontFamily: FontFamilyId;
  fontSizePt: number;
  lineHeight: number;
  marginInches: number;
  dropCaps: boolean;
  smartTypography: boolean;
  chapterNumeralStyle: ChapterNumeralStyle;
  runningHeader: boolean;
  includeFrontMatter: boolean;
}

export interface AuthorIdentity {
  penName: string;
  signatureText: string;
  signatureSvgDataUrl: string;
  authorKeyId: string;
  publicKeyJwk: string;
  privateKeyJwk?: string;
  lastSignedAt: string;
  manuscriptDigest: string;
}

export interface Collaborator {
  id: string;
  name: string;
  penName: string;
  role: CollaboratorRole;
  creditLine: string;
  authorKeyId: string;
  color: string;
  addedAt: string;
}

export interface StoryGraphNode {
  id: string;
  kind: GraphNodeKind;
  refId?: string;
  label: string;
  subtitle: string;
  x: number;
  y: number;
  color: string;
  notes: string;
}

export interface StoryGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  style: 'solid' | 'dashed';
  color: string;
}

export interface StoryGraph {
  nodes: StoryGraphNode[];
  edges: StoryGraphEdge[];
}

export interface CoverElementPlacement {
  xPct: number;
  yPct: number;
  fontSize: number;
  align: 'left' | 'center' | 'right';
  visible: boolean;
}

export interface BookCoverConfig {
  template: CoverTemplateId;
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  backgroundImageDataUrl: string;
  imageOverlayOpacity: number;
  backBlurb: string;
  editionLabel: string;
  elements: {
    title: CoverElementPlacement;
    subtitle: CoverElementPlacement;
    author: CoverElementPlacement;
    edition: CoverElementPlacement;
    signature: CoverElementPlacement;
  };
}

export interface BookProject {
  id: string;
  title: string;
  subtitle: string;
  author: string;
  dedication: string;
  copyrightNotice: string;
  language: string;
  wordTarget: number;
  paperTheme: PaperTheme;
  typography: TypographyConfig;
  parts: PartNode[];
  bible: StoryBible;
  authorIdentity?: AuthorIdentity;
  collaborators?: Collaborator[];
  activeAuthorLabel?: string;
  storyGraph?: StoryGraph;
  cover?: BookCoverConfig;
}

export interface BookLibraryState {
  activeBookId: string;
  books: BookProject[];
}

export interface LanSessionInfo {
  hostIp: string;
  port: number;
  pin: string;
  hostName: string;
  active: boolean;
  incomingCount: number;
}

export interface BookvibeEnvelope<T = unknown> {
  magic: 'BOOKVIBE_V1';
  formatVersion: string;
  extension: BookvibeExtension;
  mimeType: string;
  uti: string;
  exportedAt: string;
  payload: T;
}

export interface BookvibeManuscriptPayload {
  title: string;
  subtitle: string;
  author: string;
  dedication: string;
  copyrightNotice: string;
  language: string;
  wordTarget: number;
  parts: PartNode[];
  authorIdentity?: AuthorIdentity;
  collaborators?: Collaborator[];
  cover?: BookCoverConfig;
}

export interface BookvibeBiblePayload {
  seriesName: string;
  characters: CharacterEntry[];
  locations: LocationEntry[];
  lore: LoreEntry[];
  customCategories?: CustomBibleCategory[];
  customEntries?: CustomBibleEntry[];
}

export interface BookvibeScenePayload {
  bookTitle: string;
  chapterTitle: string;
  scene: SceneNode;
}

export interface BookvibeStylePayload {
  presetName: string;
  paperTheme: PaperTheme;
  typography: TypographyConfig;
}

export interface OpenedFileResult {
  path: string;
  filename: string;
  extension: string;
  content: string;
}

export interface ExtensionAssocStatus {
  extension: string;
  name: string;
  mimeType: string;
  uti: string;
  progId: string;
  registered: boolean;
  detail: string;
}

export interface AssociationReport {
  platform: string;
  executablePath: string;
  scope: string;
  allRegistered: boolean;
  items: ExtensionAssocStatus[];
}
