export type SceneStatus = 'outline' | 'draft' | 'revision' | 'final';

export type PaperTheme = 'obsidian' | 'parchment' | 'ivory';

export type AppThemeId = 'system' | 'ivory' | 'parchment' | 'obsidian';

export type ToolTier = 'basic' | 'intermediate' | 'advanced';

export type ToolbarDisplayMode = 'icons' | 'balanced' | 'detailed';

export type TrimSize = '5x8' | '5.5x8.5' | '6x9' | 'a5' | 'royal' | 'letter';

export type FontFamilyId = 'garamond' | 'baskerville' | 'palatino' | 'inter';

export type ChapterNumeralStyle = 'roman' | 'word' | 'numeric';

export type StudioViewId =
  | 'editor'
  | 'corkboard'
  | 'outline'
  | 'bible'
  | 'graph'
  | 'typeset'
  | 'course'
  | 'help'
  | 'developer'
  | 'settings'
  | 'manual';

export type WindowTitleMode = 'book' | 'author' | 'section' | 'brand' | 'custom';

export type AlarmRingtoneId = 'warm-chime' | 'brass-bell' | 'wood-marimba' | 'harbor-gong' | 'acoustic-arp';

export type CollaboratorRole =
  | 'co-author'
  | 'proofreader'
  | 'editor'
  | 'typesetter'
  | 'publisher'
  | 'beta-reader';

export interface CollaboratorPermissions {
  canEditProse: boolean;
  canProofreadOnly: boolean;
  canEditBibleAndGraph: boolean;
  canEditCoverAndTypeset: boolean;
  canExportFiles: boolean;
  canManageCollaborators: boolean;
}

export type GraphNodeKind =
  | 'character'
  | 'location'
  | 'lore'
  | 'plot'
  | 'scene'
  | 'storyline'
  | 'faction'
  | 'item'
  | 'note'
  | 'custom';

export type CoverTemplateId =
  | 'obsidian-foil'
  | 'ivory-classic'
  | 'editorial-band'
  | 'full-bleed'
  | 'minimal-spine';

export type CoverFaceId = 'front' | 'back' | 'spine' | 'front-flap' | 'back-flap';

export type EditorialStage =
  | 'acquisition'
  | 'developmental'
  | 'line-edit'
  | 'copyedit'
  | 'proofread'
  | 'print-ready';

export type QuillvibeExtension =
  | '.qv'
  | '.qvbible'
  | '.qvscene'
  | '.qvstyle'
  | '.qvdesign';

export type LegacyImportExtension =
  | '.quillvibe'
  | '.qvibe'
  | '.qvbook'
  | '.bookvibe'
  | '.bvibe'
  | '.bvbook'
  | '.bvbible'
  | '.bvscene'
  | '.bvstyle';

export type AnyQuillvibeOrLegacyExtension = QuillvibeExtension | LegacyImportExtension;

export type ExportFormatId = QuillvibeExtension | '.pdf' | '.epub' | '.docx' | '.md' | '.html' | '.txt';

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
  | 'add:export-preset'
  | 'add:font-pack';

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

export interface ExtensionFontDef {
  id: string;
  family: string;
  cssStack: string;
  category: 'serif' | 'sans' | 'mono';
  dataUrl?: string;
}

export interface CustomFontEntry {
  id: string;
  family: string;
  format: 'ttf' | 'otf' | 'woff' | 'woff2' | 'system' | 'extension';
  source: 'device' | 'system' | 'extension';
  dataUrl?: string;
  cssStack: string;
  addedAt: string;
}

export interface QuillvibePluginManifest {
  magic: 'QUILLVIBE_EXT_V2' | 'BOOKVIBE_EXT_V1';
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
  fonts?: ExtensionFontDef[];
  metricsReport?: 'readability';
}

export interface InstalledExtension {
  manifest: QuillvibePluginManifest;
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

export interface QuillvibeSettings {
  appTheme: AppThemeId;
  toolTier: ToolTier;
  toolbarDisplayMode: ToolbarDisplayMode;
  uiDensity: 'comfortable' | 'compact';
  editorFontFamily: string;
  editorFontSizePx: number;
  editorLineHeight: number;
  editorSheetMaxWidthPx: number;
  binderWidthPx: number;
  inspectorWidthPx: number;
  studioLeftWidthPx: number;
  studioRightWidthPx: number;
  autoSaveDelayMs: number;
  reducedMotionOverride: 'system' | 'reduce';
  developerMode: boolean;
  defaultImprint: string;
  showOnboardingHints: boolean;
  windowTitleMode: WindowTitleMode;
  windowTitleCustom: string;
  immersiveShowClock: boolean;
  immersiveShowTimer: boolean;
  immersiveShowWords: boolean;
  immersiveShowAlarm: boolean;
  alarmRingtone: AlarmRingtoneId;
  alarmVolume: number;
  enableSpellcheck: boolean;
  enableDesktopBookTabs: boolean;
  enableSmoothAnimations: boolean;
  linkPaperThemeToAppTheme: boolean;
  immersiveHudX: number;
  immersiveHudY: number;
  immersiveHudCollapsed: boolean;
}

export type SceneImageWrapMode =
  | 'inline'
  | 'square-left'
  | 'square-right'
  | 'top-bottom'
  | 'behind-text';

export interface SceneImageItem {
  id: string;
  dataUrl: string;
  originalDataUrl?: string;
  alt: string;
  caption?: string;
  widthPx: number;
  heightPx: number;
  offsetX: number;
  offsetY: number;
  wrapMode: SceneImageWrapMode;
  anchorParagraph: number;
  bgRemoved?: boolean;
  bgTolerance?: number;
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
  images?: SceneImageItem[];
  updatedAt: string;
}

export interface ChapterNode {
  id: string;
  title: string;
  subtitle: string;
  collapsed: boolean;
  locked?: boolean;
  scenes: SceneNode[];
}

export interface PartNode {
  id: string;
  title: string;
  collapsed: boolean;
  locked?: boolean;
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
  customFontFamily?: string;
  fontSizePt: number;
  lineHeight: number;
  marginInches: number;
  dropCaps: boolean;
  smartTypography: boolean;
  chapterNumeralStyle: ChapterNumeralStyle;
  runningHeader: boolean;
  includeFrontMatter: boolean;
  includeTableOfContents?: boolean;
  includePageNumbers?: boolean;
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
  provenanceMark?: string;
  keyLockedForever?: boolean;
  keyCreatedAt?: string;
  keyFingerprint?: string;
  originDeviceId?: string;
  originDeviceName?: string;
  originVerifiedAt?: string;
}

export interface CopyrightOwnershipRecord {
  sealId: string;
  ownerName: string;
  copyrightNotice: string;
  workTitle: string;
  registeredAt: string;
  workDigestSha256: string;
  certificateSignature?: string;
  rightsTerritory: string;
  editionNumber: string;
}

export interface Collaborator {
  id: string;
  name: string;
  penName: string;
  role: CollaboratorRole;
  creditLine: string;
  authorKeyId: string;
  deviceId?: string;
  deviceLabel?: string;
  coAuthorKeyId?: string;
  publicKeyJwk?: string;
  deviceSignature?: string;
  verifiedDevice?: boolean;
  verifiedAt?: string;
  color: string;
  addedAt: string;
  permissions?: CollaboratorPermissions;
}

export type GraphAnchorSide = 'auto' | 'top' | 'right' | 'bottom' | 'left';
export type GraphRoutingMode = 'elbow' | 'curved' | 'straight';
export type GraphLineStyle = 'solid' | 'dashed' | 'dotted';
export type GraphArrowHead = 'none' | 'arrow' | 'diamond' | 'circle';

export interface StoryGraphNode {
  id: string;
  kind: GraphNodeKind;
  refId?: string;
  label: string;
  subtitle: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color: string;
  notes: string;
  tags?: string[];
  pinned?: boolean;
  arc?: string;
  status?: string;
}

export interface StoryGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  style: GraphLineStyle;
  color: string;
  sourceAnchor?: GraphAnchorSide;
  targetAnchor?: GraphAnchorSide;
  routingMode?: GraphRoutingMode;
  startArrow?: GraphArrowHead;
  endArrow?: GraphArrowHead;
  elbowOffset?: number;
}

export interface StoryGraphGroup {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  collapsed?: boolean;
}

export interface StoryGraphColorRule {
  id: string;
  query: string;
  color: string;
}

export type GraphBoardTheme =
  | 'obsidian-dots'
  | 'slate-blueprint'
  | 'warm-paper'
  | 'charcoal-solid'
  | 'ivory-grid';

export interface StoryGraph {
  nodes: StoryGraphNode[];
  edges: StoryGraphEdge[];
  groups?: StoryGraphGroup[];
  colorRules?: StoryGraphColorRule[];
  boardTheme?: GraphBoardTheme;
  autoSyncWithBook?: boolean;
}

export interface CoverElementPlacement {
  xPct: number;
  yPct: number;
  fontSize: number;
  align: 'left' | 'center' | 'right';
  visible: boolean;
  color?: string;
  letterSpacingEm?: number;
  lineHeight?: number;
  uppercase?: boolean;
  italic?: boolean;
  fontWeight?: '400' | '500' | '600' | '700';
  strokeColor?: string;
  strokeWidth?: number;
  shadowBlur?: number;
  rotationDeg?: number;
  opacity?: number;
  locked?: boolean;
}

export type CoverBlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'darken'
  | 'lighten';

export interface CoverPathPoint {
  xPct: number;
  yPct: number;
}

export interface CoverPathLayer {
  id: string;
  face: CoverFaceId;
  name: string;
  points: CoverPathPoint[];
  closed: boolean;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  opacity: number;
  blendMode?: CoverBlendMode;
  rotationDeg?: number;
  locked?: boolean;
  visible?: boolean;
  groupId?: string;
  zIndex?: number;
}

export interface CoverReviewComment {
  id: string;
  face: CoverFaceId;
  xPct: number;
  yPct: number;
  author: string;
  text: string;
  resolved: boolean;
  createdAt: string;
}

export interface CoverDesignVariant {
  id: string;
  name: string;
  createdAt: string;
  snapshot: Omit<BookCoverConfig, 'variants' | 'comments'>;
}

export interface QuillvibeDesignPayload {
  designName: string;
  bookTitle: string;
  author: string;
  trimSize: TrimSize;
  cover: BookCoverConfig;
}

export interface CoverGraphicLayer {
  id: string;
  face: CoverFaceId;
  name: string;
  dataUrl: string;
  xPct: number;
  yPct: number;
  widthPct: number;
  rotationDeg: number;
  opacity: number;
  kind: 'svg' | 'image';
  flipX?: boolean;
  flipY?: boolean;
  locked?: boolean;
  visible?: boolean;
  brightnessPct?: number;
  contrastPct?: number;
  saturationPct?: number;
  blurPx?: number;
  borderRadiusPct?: number;
  blendMode?: CoverBlendMode;
  groupId?: string;
  zIndex?: number;
}

export type CoverShapeKind =
  | 'rect'
  | 'rounded-rect'
  | 'circle'
  | 'triangle'
  | 'arrow'
  | 'star'
  | 'polygon'
  | 'line'
  | 'frame'
  | 'badge';

export interface CoverShapeLayer {
  id: string;
  face: CoverFaceId;
  name: string;
  shape: CoverShapeKind;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  fillColor: string;
  gradientEndColor?: string;
  strokeColor: string;
  strokeWidth: number;
  cornerRadius: number;
  rotationDeg: number;
  opacity: number;
  blendMode?: CoverBlendMode;
  locked?: boolean;
  visible?: boolean;
  groupId?: string;
  zIndex?: number;
}

export interface CoverTextLayer {
  id: string;
  face: CoverFaceId;
  name: string;
  text: string;
  xPct: number;
  yPct: number;
  fontSize: number;
  fontFamily?: string;
  color: string;
  align: 'left' | 'center' | 'right';
  fontWeight: '400' | '500' | '600' | '700';
  italic: boolean;
  uppercase: boolean;
  letterSpacingEm: number;
  lineHeight: number;
  strokeColor?: string;
  strokeWidth?: number;
  shadowBlur?: number;
  backgroundColor?: string;
  textDecoration?: 'none' | 'underline' | 'line-through';
  rotationDeg: number;
  opacity: number;
  blendMode?: CoverBlendMode;
  locked?: boolean;
  visible?: boolean;
  groupId?: string;
  zIndex?: number;
}

export interface BookCoverConfig {
  template: CoverTemplateId;
  backgroundColor: string;
  bgMode?: 'solid' | 'linear-gradient' | 'radial-gradient';
  bgGradientEnd?: string;
  bgGradientAngle?: number;
  bgBrightnessPct?: number;
  bgContrastPct?: number;
  bgBlurPx?: number;
  backBackgroundColor?: string;
  spineBackgroundColor?: string;
  accentColor: string;
  textColor: string;
  backgroundImageDataUrl: string;
  imageOverlayOpacity: number;
  backHeadline?: string;
  backBlurb: string;
  authorBio?: string;
  spineTitle?: string;
  showBarcodeBox?: boolean;
  frontFlapText?: string;
  backFlapText?: string;
  customFontFamily?: string;
  snapToGrid?: boolean;
  showGrid?: boolean;
  gridSizePx?: number;
  showGuides?: boolean;
  graphicLayers?: CoverGraphicLayer[];
  shapeLayers?: CoverShapeLayer[];
  textLayers?: CoverTextLayer[];
  pathLayers?: CoverPathLayer[];
  variants?: CoverDesignVariant[];
  comments?: CoverReviewComment[];
  editionLabel: string;
  elements: {
    title: CoverElementPlacement;
    subtitle: CoverElementPlacement;
    author: CoverElementPlacement;
    edition: CoverElementPlacement;
    signature: CoverElementPlacement;
  };
}

export interface BookPublishingMeta {
  imprintName: string;
  isbn: string;
  editionNumber: string;
  editorialStage: EditorialStage;
  publisherCompany?: string;
  ebookIsbn?: string;
  rightsTerritory?: string;
  commercialLicense?: string;
  bisacCategory?: string;
  embargoDate?: string;
  arcWatermarkText?: string;
  enterpriseRequireSignedSync?: boolean;
  enterpriseRequirePasswordExport?: boolean;
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
  copyrightOwnership?: CopyrightOwnershipRecord;
  collaborators?: Collaborator[];
  activeAuthorLabel?: string;
  storyGraph?: StoryGraph;
  cover?: BookCoverConfig;
  publishing?: BookPublishingMeta;
  updatedAt?: string;
}

export interface BookLibraryState {
  activeBookId: string;
  books: BookProject[];
}

export interface LanSessionInfo {
  hostIp: string;
  candidateIps?: string[];
  port: number;
  pin: string;
  hostName: string;
  active: boolean;
  incomingCount: number;
}

export interface QuillvibeEnvelope<T = unknown> {
  magic: 'QUILLVIBE_V2' | 'BOOKVIBE_V1';
  formatVersion: string;
  extension: AnyQuillvibeOrLegacyExtension;
  mimeType: string;
  uti: string;
  exportedAt: string;
  provenanceMark?: string;
  payload: T;
}

export interface QuillvibeManuscriptPayload {
  title: string;
  subtitle: string;
  author: string;
  dedication: string;
  copyrightNotice: string;
  language: string;
  wordTarget: number;
  parts: PartNode[];
  authorIdentity?: AuthorIdentity;
  copyrightOwnership?: CopyrightOwnershipRecord;
  collaborators?: Collaborator[];
  cover?: BookCoverConfig;
  publishing?: BookPublishingMeta;
}

export interface QuillvibeBiblePayload {
  seriesName: string;
  characters: CharacterEntry[];
  locations: LocationEntry[];
  lore: LoreEntry[];
  customCategories?: CustomBibleCategory[];
  customEntries?: CustomBibleEntry[];
}

export interface QuillvibeScenePayload {
  bookTitle: string;
  chapterTitle: string;
  scene: SceneNode;
}

export interface QuillvibeStylePayload {
  presetName: string;
  paperTheme: PaperTheme;
  typography: TypographyConfig;
}

export interface OpenedFileResult {
  path: string;
  filename: string;
  extension: string;
  content: string;
  contentBase64?: string;
  bytes?: Uint8Array;
  isBinary?: boolean;
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
