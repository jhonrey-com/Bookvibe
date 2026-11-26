import type { AppActions, TypesetSubTab } from '../core/app-context';
import type { StudioViewId, ToolTier } from '../core/types';
import { el, icon } from './dom';

export interface CourseCheckpoint {
  question: string;
  options: readonly string[];
  correctIndex: number;
  explanation: string;
}

export interface CourseLesson {
  id: string;
  title: string;
  durationMin: number;
  instruction: string;
  objective: string;
  concepts: readonly string[];
  steps: readonly string[];
  example: {
    heading: string;
    body: string;
  };
  proTip: string;
  checkpoint: CourseCheckpoint;
  actionLabel: string;
  minTier: ToolTier;
  targetView: StudioViewId;
  targetTypesetTab?: TypesetSubTab;
  targetSelector?: string;
}

export interface CourseModule {
  id: string;
  number: number;
  title: string;
  summary: string;
  audience: string;
  lessons: readonly CourseLesson[];
}

const COURSE_PROGRESS_KEY = 'quillvibe.courseProgress.v1';
let memoryCompletedLessons = new Set<string>();

export const COURSE_MODULES: readonly CourseModule[] = [
  {
    id: 'mod-setup',
    number: 1,
    title: 'Desk Setup, Workspace Layouts & Multi-Window Books',
    summary:
      'Set up your book identity, switch between Focused, Editorial, and Full Studio layouts, resize columns, and work across parallel windows or tabs.',
    audience: 'First-time authors setting up a quiet desk',
    lessons: [
      {
        id: 'm1-title',
        title: 'Create Your Book Identity, Pen Name & Window Title',
        durationMin: 4,
        instruction:
          'Name your working manuscript in the top-left bar, configure your Author Key and pen name in Library, and pick how browser tabs or desktop windows display your title.',
        objective: 'Establish a clean book project with reliable local saving and personalized window labeling.',
        concepts: [
          'Quillvibe stores your active manuscript inside an indexed library on your device without requiring an account, login, or internet connection. Every keystroke triggers a debounce save timer (configurable in Settings between 150ms and 2000ms) so sudden restarts or closed laptops never drop your latest paragraph.',
          'Each book holds its own Author Identity record containing a published pen name, drawn ink signature, and local ECDSA signing key ID. You can also choose how the browser tab and desktop taskbar hover label identify your window: Book Name, Pen Name, Active Section, Brand Only, or a custom template such as "{book} — {section}".',
        ],
        steps: [
          'Click the working title input at the top left of the header and type your manuscript title.',
          'Open Library (bookshelf icon) to enter your Pen Name and verify your active book sits first on the shelf.',
          'Open Settings -> Workspace & Editor -> Window & Taskbar Title to pick whether tabs show your Book Name, Author Name, or Section.',
        ],
        example: {
          heading: 'Recommended Author Preferences',
          body: 'Series authors drafting Book I and Book II side by side often set Window Title Mode to "Quillvibe - <Book Name>" so switching via Alt+Tab or taskbar hover clearly distinguishes each open manuscript.',
        },
        proTip:
          'Even in public coworking spaces, switching Window Title Mode to "Quillvibe Only" hides private book titles from shoulder-surfing taskbars.',
        checkpoint: {
          question: 'Which placeholders are supported when using Custom Window Title Mode in Settings?',
          options: [
            '{book}, {author}, and {section}',
            '{chapter}, {words}, and {isbn}',
            '{theme}, {tier}, and {port}',
          ],
          correctIndex: 0,
          explanation:
            'Custom window titles substitute {book} (title), {author} (pen name), and {section} (active workspace tab) automatically.',
        },
        actionLabel: 'Highlight Title Input',
        minTier: 'basic',
        targetView: 'editor',
        targetSelector: '.bv-book-title-input',
      },
      {
        id: 'm1-tier',
        title: 'Switch Between Focused Drafting and Full Publishing Studio',
        durationMin: 4,
        instruction:
          'Draft in Focused layout for a quiet document sheet, then switch to Editorial or Full Studio when you want outlining, Story Bible cross-linking, or Cover Studio.',
        objective: 'Keep the interface calm while drafting and expose specialized tools only when needed.',
        concepts: [
          'Writing stalls when twenty unrelated panels compete for attention on chapter one. Focused layout intentionally hides multi-pane visualizers and cover tools so you see only your binder, clean sheet, and simple typography bar.',
          'Switching to Editorial opens Corkboard index cards, Outline filter ledger, Editorial Proofreading markup, and Interior Print Typesetting. Full Studio opens Story Bible, interactive Story Graph, Vector Book Cover Studio, Collaboration permissions, and .qvext extensions without changing a word of your manuscript.',
        ],
        steps: [
          'Open Settings -> Workspace & Editor (or click the Workspace pill in the bottom-left status bar) to pick Focused, Editorial, or Full Studio.',
          'Start drafting a scene in Focused layout for a quiet Ivory sheet.',
          'Switch to Editorial or Full Studio whenever you are ready to outline scenes or lay out a cover.',
        ],
        example: {
          heading: 'Practical Layout Workflow',
          body: 'Use Focused layout during morning first-draft sprints (500–1,500 new words), then switch to Full Studio during afternoon structural revision and cover layout.',
        },
        proTip:
          'Toolbar labels can also be set in Settings -> Toolbar Detail Mode to Icons Only, Balanced, or Full Details to match your screen size.',
        checkpoint: {
          question: 'Does switching Workspace Layout between Focused and Full Studio delete any Story Bible entries or cover layers?',
          options: [
            'Yes, switching layouts removes cover data',
            'No — Workspace Layouts only filter visible panels while keeping all book data',
            'Only Full Studio scenes are backed up',
          ],
          correctIndex: 1,
          explanation:
            'All parts, scenes, bible profiles, snapshots, and cover layers stay intact inside the book file across every layout.',
        },
        actionLabel: 'Open Workspace Layout Settings',
        minTier: 'basic',
        targetView: 'editor',
        targetSelector: '.qv-tier-pill',
      },
      {
        id: 'm1-resize',
        title: 'Customize Split Column Widths & Parallel Windows',
        durationMin: 4,
        instruction:
          'Drag the <-> handles between the Binder, Paper Sheet, and Inspector to fit your monitor, and launch separate windows from Library to cross-reference two books side by side.',
        objective: 'Arrange a comfortable reading measure and manage multiple manuscripts concurrently.',
        concepts: [
          'Line length strongly affects reading fatigue. By dragging the vertical <-> split resizers on either side of the paper sheet—and adjusting Paper Sheet Width in Settings—you can set a classic 60–75 character book measure on wide monitors or slim laptop screens alike. Your custom widths persist automatically in local cache and desktop storage.',
          'When working on sequels, anthologies, or companion guides, click Window next to any book in Library (or click the New Window button on the topbar) to open that manuscript in its own independent window while preserving shared library saves.',
        ],
        steps: [
          'Move your cursor over the thin vertical divider beside the left Binder or right Inspector until the horizontal resize arrows appear.',
          'Drag to widen or narrow each sidebar; double-click any resizer handle to snap back to default width.',
          'Open Library -> click Window beside a second book to open parallel manuscript windows.',
        ],
        example: {
          heading: 'Laptop Split Layout',
          body: 'Narrow Binder to 210px and Inspector to 230px on 13-inch screens, or close both sidebars cleanly when opening Book Cover Studio.',
        },
        proTip:
          'Whenever you switch into Cover & Typeset Studio or /course, Quillvibe collapses both sidebars automatically and restores your saved open/closed state when you return to Manuscript.',
        checkpoint: {
          question: 'How do you reset a resized sidebar width quickly?',
          options: [
            'Reinstall the application',
            'Double-click the vertical <-> resizer handle or click Reset in Settings',
            'Export to Markdown first',
          ],
          correctIndex: 1,
          explanation:
            'Double-clicking any vertical split handle restores its default pixel width immediately.',
        },
        actionLabel: 'Try Draft Split Panes',
        minTier: 'basic',
        targetView: 'editor',
        targetSelector: '.qv-resizer',
      },
    ],
  },
  {
    id: 'mod-draft',
    number: 2,
    title: 'Drafting Scenes, Right-Click Tools & Immersive Focus',
    summary:
      'Build Parts, Chapters, and Scenes, write cleanly with right-click formatting, and lock in uninterrupted sessions using Immersive Mode and Alarm Ringtones.',
    audience: 'Drafting daily scenes and organizing chapters',
    lessons: [
      {
        id: 'm2-binder',
        title: 'Organize Parts, Chapters, Scenes & Snapshots in the Binder',
        durationMin: 5,
        instruction:
          'Structure long books using nested Parts -> Chapters -> Scenes in the left Binder. Right-click any tree row for instant creation, duplication, movement, or standalone export.',
        objective: 'Split long chapters into manageable 800–2,500 word scenes that reorder cleanly.',
        concepts: [
          'Treating an entire 90,000-word novel as a single scrolling file slows scrolling and makes pacing adjustments painful. Grouping scenes inside Chapters and Parts lets you drag moments earlier or later without copy-pasting thousands of words.',
          'Word counters stay synchronized across Scene, Chapter, and full Book levels on the bottom status bar and inline next to each Binder row so you always know which chapters run long or thin.',
        ],
        steps: [
          'Click + Ch in the Binder header to append a new chapter under your active Part.',
          'Right-click any Scene row to Duplicate it, move it into another chapter, capture a snapshot, or export it as a standalone .qvscene file.',
          'Use Split Scene at Cursor when drafting if one scene naturally pivots into a new location or day.',
        ],
        example: {
          heading: 'Scene Naming Habit',
          body: 'Use working descriptors like "Dockside Confrontation" or "Clara Decodes Ledger" while drafting; Interior Typeset can suppress scene subtitles or insert crisp * * * scene breaks automatically.',
        },
        proTip:
          'Hold nothing back during rough drafts: press Ctrl+S inside Manuscript Editor anytime to capture an immutable Revision Snapshot before experimenting with a bold rewrite.',
        checkpoint: {
          question: 'What happens when you press Ctrl+S while actively editing inside Manuscript view?',
          options: [
            'It downloads an EPUB immediately',
            'It captures a timestamped Revision Snapshot of the active scene (in addition to continuous autosave)',
            'It locks the scene against editing',
          ],
          correctIndex: 1,
          explanation:
            'Continuous autosave already saves prose continuously; Ctrl+S in Editor stores a named checkpoint snapshot you can diff or restore anytime.',
        },
        actionLabel: 'Highlight Binder Tree',
        minTier: 'basic',
        targetView: 'editor',
        targetSelector: '.bv-binder',
      },
      {
        id: 'm2-format',
        title: 'Fast Drafting With Right-Click Context Menus & Keyboard Habits',
        durationMin: 5,
        instruction:
          'Select text inside the paper sheet and right-click for Cut/Copy, **Bold**, *Italic*, Blockquote, Chapter Headings, * * * scene breaks, or Split Scene at Cursor.',
        objective: 'Format prose rapidly with mouse or keyboard without cluttering the writing sheet.',
        concepts: [
          'Every primary workspace in Quillvibe—the Manuscript sheet, Binder rows, Corkboard index cards, Outline rows, Story Graph canvas, and Cover Studio artboard—provides a purpose-built right-click context menu instead of forcing long pointer trips to nested ribbons.',
          'All inline emphasis uses lightweight plain-text Markdown (**bold**, *italic*, > blockquote, ## subheading), ensuring your prose exports cleanly to print typography, EPUB 3, standalone HTML, and archival plain text.',
        ],
        steps: [
          'Select a sentence on the writing sheet and right-click anywhere inside the editor.',
          'Choose Bold (**...**) or Italic (*...*), or press Ctrl+B / Ctrl+I directly while typing.',
          'Right-click an empty line and click Insert Scene Break (* * *) to separate beats inside a scene.',
        ],
        example: {
          heading: 'Scene Break Pattern',
          body: 'Leave one blank line above and below * * * so Interior Typeset converts it into an authentic centered typographic dinkus.',
        },
        proTip:
          'Enable Typewriter Mode on the sub-toolbar so the active typing line stays padded toward the vertical center of the sheet rather than hugging the bottom bezel.',
        checkpoint: {
          question: 'Why does Quillvibe store bold and italic emphasis using ** and * inside scenes?',
          options: [
            'So scenes remain portable, searchable, diffable plain text across EPUB, Print PDF, Markdown, and backups',
            'Because browsers cannot display bold fonts otherwise',
            'To restrict copy and paste',
          ],
          correctIndex: 0,
          explanation:
            'Clean Markdown emphasis avoids brittle proprietary XML blobs while rendering cleanly into typeset print pages and eBooks.',
        },
        actionLabel: 'Focus Paper Sheet',
        minTier: 'basic',
        targetView: 'editor',
        targetSelector: '.bv-prose-textarea',
      },
      {
        id: 'm2-immersive',
        title: 'Ivory/Obsidian Paper, Immersive Fullscreen & Alarm Ringtones',
        durationMin: 4,
        instruction:
          'Press F11 (or click the Fullscreen icon) to enter Immersive Focus Mode with optional live wall clock, sprint timer, word progress, and a built-in Alarm Clock with gentle ringtones.',
        objective: 'Run focused 25- or 45-minute drafting sessions with zero OS distraction.',
        concepts: [
          'The Ivory theme pairs daylight paper contrast with crisp obsidian ink, while Warm Parchment softens contrast for late afternoons and Obsidian Dark protects night-owl eyesight. You can toggle sheet themes independently of the outer studio chrome.',
          'In Immersive Fullscreen mode (especially on the desktop executable), the window expands edge-to-edge with a quiet floating status pill. In Settings -> Immersive Fullscreen & Alarm Ringtones you choose whether to show the wall clock, sprint countdown, word goal progress, and Alarm Clock trigger—complete with five built-in Web Audio chimes that require no external audio files.',
        ],
        steps: [
          'Click the Fullscreen button (or press F11) in the top-right bar to enter Immersive Mode.',
          'Click the Alarm icon on the status bar or floating pill to arm a countdown (15m / 25m / 45m / 60m) or exact clock time.',
          'Open Settings -> Workspace & Editor to preview all five synthesized ringtones and adjust volume.',
        ],
        example: {
          heading: 'Daily Pomodoro Writing Block',
          body: 'Set a 45-minute countdown alarm labeled "Chapter Draft Complete" with Dusk Brass Bell or Warm Studio Chime, hide the Binder, and press F11 until the chime brings you back for tea.',
        },
        proTip:
          'On mobile browsers, Quillvibe detects virtual keyboard height via visualViewport so the sheet shrinks smoothly above the keyboard without trapping your cursor off-screen.',
        checkpoint: {
          question: 'Which keyboard shortcut toggles Zen Focus (hides sidebars) versus Immersive Fullscreen?',
          options: [
            'Ctrl+Shift+F toggles Zen Focus; F11 toggles Immersive Fullscreen',
            'F1 toggles Immersive Fullscreen',
            'Ctrl+O opens Immersive Mode',
          ],
          correctIndex: 0,
          explanation:
            'Ctrl+Shift+F hides sidebars inside your window; F11 switches the full display/native window into Immersive Fullscreen.',
        },
        actionLabel: 'Preview Paper Bar',
        minTier: 'basic',
        targetView: 'editor',
        targetSelector: '.bv-subbar',
      },
    ],
  },
  {
    id: 'mod-plot',
    number: 3,
    title: 'Story Architecture: Corkboard, Outline, Bible & Graph',
    summary:
      'Diagnose pacing holes visually on index cards, filter chapter ledgers by POV and location, build character codex dossiers, and map plot threads.',
    audience: 'Structural planners and revisers',
    lessons: [
      {
        id: 'm3-cork',
        title: 'Stage & Reorder Scenes on the Corkboard',
        durationMin: 4,
        instruction:
          'Switch to Corkboard (Editorial or Full Studio layout) to inspect scene synopsis cards side by side, update draft statuses, and drag scenes across chapters.',
        objective: 'Evaluate narrative momentum chapter-by-chapter before rewriting prose.',
        concepts: [
          'Reading prose line-by-line hides pacing flaws. Stepping up to Corkboard flattens every scene into a crisp index card showing scene title, synopsis, POV tag, word count against target progress bar, and workflow state (Outline, Draft, Revision, Final).',
          'Because cards accept drag-and-drop across chapter columns—as well as right-click quick actions—resequencing an investigation scene two chapters earlier takes two seconds instead of manual cut-and-paste.',
        ],
        steps: [
          'Set Workspace Layout to Editorial or Full Studio and open the Corkboard tab.',
          'Edit a scene synopsis directly on the index card and adjust its status badge.',
          'Drag any index card onto another chapter group or right-click to jump straight into Draft Editor.',
        ],
        example: {
          heading: 'Checking Act II Tension',
          body: 'Scan status pills down the Corkboard column: if four consecutive scenes show "Draft · Sub-200w", merge or expand those beats before copyediting.',
        },
        proTip:
          'Keep synopses to two factual sentences: Character Goal -> Scene Outcome/Shift.',
        checkpoint: {
          question: 'What visual feedback helps balance scene lengths on the Corkboard?',
          options: [
            'Progress fill bars showing each scene’s current word count against its word target',
            'Automatic word deletion',
            'Random color shuffling',
          ],
          correctIndex: 0,
          explanation:
            'Each card displays word progress relative to its target alongside status, POV, and synopsis.',
        },
        actionLabel: 'Open Corkboard',
        minTier: 'intermediate',
        targetView: 'corkboard',
        targetSelector: '.bv-main-stage',
      },
      {
        id: 'm3-outline',
        title: 'Filter Pacing, POV & Revision Stage in Outline',
        durationMin: 4,
        instruction:
          'Open Outline to inspect every scene in a sortable spreadsheet ledger and filter cleanly by POV, location, status, or keyword without losing input focus.',
        objective: 'Audit timeline continuity, POV balance, and remaining target words across the whole book.',
        concepts: [
          'In multi-POV novels or historical nonfiction, alternating voices and chronological stamps must follow deliberate rhythm. Outline compacts all metadata—Chapter, Scene, Synopsis, POV, Location, Timeline, Status, Words, and Target—onto one scannable grid.',
          'Right-click any Outline row to change stage immediately, duplicate a beat, or open the scene in the manuscript sheet.',
        ],
        steps: [
          'Open the Outline view and type a character or location into the search filter.',
          'Check POV alternation across Chapters I through V.',
          'Right-click any row showing Outline or Draft to advance or jump straight into editing.',
        ],
        example: {
          heading: 'Continuity Sweep',
          body: 'Type "Winter Harbor" into Outline search to list every scene set at the harbor in exact chronological order.',
        },
        proTip:
          'Combine Outline with Split Reference View in Editor when keeping character ages or travel times consistent.',
        checkpoint: {
          question: 'Which views are unlocked when moving from Basic tier to Intermediate tier?',
          options: [
            'Corkboard, Outline, Proofread Markup, and Typeset Studio',
            'Only Fonts settings',
            'Story Graph only',
          ],
          correctIndex: 0,
          explanation:
            'Intermediate unlocks Corkboard, Outline, Proofreading tools, and Studio Typesetting, reserving Bible/Graph/Advanced Cover tools for Advanced tier.',
        },
        actionLabel: 'Open Outline',
        minTier: 'intermediate',
        targetView: 'outline',
        targetSelector: '.bv-main-stage',
      },
      {
        id: 'm3-bible',
        title: 'Build Characters, Locations, Lore & Automatic Scene Mentions',
        durationMin: 5,
        instruction:
          'Open Story Bible (Advanced tier) to maintain Characters, Locations, Lore, or custom categories with portraits, aliases, and custom traits. Every appearance scans into your scenes automatically.',
        objective: 'Keep worldbuilding details one click away via automated name and alias detection.',
        concepts: [
          'Long books accumulate continuity traps: eye colors drift, aliases change spelling, and minor objects vanish. Quillvibe’s Story Bible automatically scans scene text against both canonical names and aliases using strict word-boundary detection.',
          'While writing inside Manuscript Editor, look at the Scene Inspector on the right: every character, place, or artifact mentioned in the active scene appears immediately as a clickable pill that jumps straight to its dossier or opens it in Split Reference Mode.',
        ],
        steps: [
          'Switch to Advanced tier and open the Story Bible tab.',
          'Create a Character or Location card, add comma-separated Aliases (e.g. "Captain Holm, Clara"), and upload a reference portrait.',
          'Return to any scene mentioning that alias and inspect detected mentions in the right Scene Inspector.',
        ],
        example: {
          heading: 'Alias Linking',
          body: 'Listing "The Cartographer, Tomas" as aliases on Tomas Lindqvist’s card catches scenes referring to him strictly by title.',
        },
        proTip:
          'Add Custom Categories (such as Guilds, Ships, Magic Rules, or Legal Statutes) in Story Bible to fit nonfiction, fantasy, or historical research equally well.',
        checkpoint: {
          question: 'How does Quillvibe detect Story Bible entries inside scenes?',
          options: [
            'It uses boundary-matched name and alias indexing directly against local scene text',
            'It uploads scenes to a cloud indexer',
            'You must tag entries manually with brackets',
          ],
          correctIndex: 0,
          explanation:
            'Local word-boundary indexing checks canonical names and aliases offline in real time.',
        },
        actionLabel: 'Open Story Bible',
        minTier: 'advanced',
        targetView: 'bible',
        targetSelector: '.bv-main-stage',
      },
      {
        id: 'm3-graph',
        title: 'Map Relationships & Arcs on the Dual-Mode Story Graph',
        durationMin: 6,
        instruction:
          'Switch seamlessly between Spatial Storyboard (cards, Act Group frames, 90-degree obstacle-avoiding elbow connectors, double-click node creation, and .canvas export) and Force Graph (physics layout, hop filters, and shortest path tracing).',
        objective: 'Visualize causal chains, Act structures, and [[wikilink]] connections cleanly across both spatial boards and dynamic networks.',
        concepts: [
          'In Spatial Storyboard mode, double-click anywhere on the canvas to drop a node, drag Act Group frames to move contained cards together, drag any card port dot to link or spawn a connected card, and drag a selected elbow line handle to fine-tune orthogonal spacing.',
          'Switch to Force Graph mode at any time using the topbar toggle to balance clusters dynamically, pin important plot hubs, isolate 1-to-3 hop neighborhoods, trace the shortest relationship path between two characters, or import/export standard .canvas files and high-resolution PNG/SVG diagrams.',
        ],
        steps: [
          'Open the Graph tab and toggle between Storyboard and Force Graph on the left sub-toolbar.',
          'Write [[Character Name]] or #tags inside a node Markdown panel and click Sync [[Wikilinks]] Now to generate connections automatically.',
          'Use + Group to organize scenes into Act frames, or export the board via .canvas, PNG, or SVG.',
        ],
        example: {
          heading: 'Mystery Clue Board',
          body: 'Link Victim -> Alibi -> Forensic Exhibit -> Suspect Nodes with relationship labels ("forged by", "discovered at") to spot missing clues.',
        },
        proTip:
          'Exporting the Story Graph SVG lets you print or keep an archival plot map alongside your pitch deck.',
        checkpoint: {
          question: 'How do you create a direct link between two cards inside Story Graph?',
          options: [
            'Drag from the circular node edge port (●) on one card onto the target card',
            'Double-click the status bar',
            'Edit CSS manually',
          ],
          correctIndex: 0,
          explanation:
            'Dragging from any card’s edge port creates a live directed relationship edge with configurable label and color.',
        },
        actionLabel: 'Open Story Graph',
        minTier: 'advanced',
        targetView: 'graph',
        targetSelector: '.bv-graph-canvas-wrap',
      },
    ],
  },
  {
    id: 'mod-proof',
    number: 4,
    title: 'Editorial Copyediting: Proofread Markup & Revision Diffs',
    summary:
      'Apply 15 traditional copyediting symbols by right-clicking prose, preview clean accepted copy before committing, and inspect word-by-word diffs.',
    audience: 'Self-editing writers, copyeditors, and proofreaders',
    lessons: [
      {
        id: 'm4-markup',
        title: 'Mark Copy via Right-Click With 15 Standard Proofread Symbols',
        durationMin: 5,
        instruction:
          'Switch Manuscript view to Proofread mode, highlight any passage, and right-click directly on the prose to insert Dele, Caret Insert, Substitute, Transpose, Stet, Space, Italic, or Marginal Query marks.',
        objective: 'Perform non-destructive copyediting without silently overwriting original phrasing.',
        concepts: [
          'Unlike sloppy direct find-and-replace, traditional copyediting tracks proposed changes cleanly against anchor character offsets so an author or collaborator can review each suggestion before committing it to prose.',
          'Quillvibe supports 15 classic proofreader marks: Delete, Caret Insert, Substitute, Margin Query, Highlight, Transpose Words, Stet (let it stand), Paragraph Break, Run-in, Close-up, Space, Capitalize, Lowercase, Italicize, and Boldface—accessible directly from the right-click menu when text is selected.',
        ],
        steps: [
          'Open Manuscript view and click Proofread on the floating paper pill (Intermediate or Advanced tier).',
          'Highlight a word or phrase, right-click directly over the selection, and choose Substitute or Delete.',
          'Type optional margin guidance or click a collaborator badge to attribute the note cleanly.',
        ],
        example: {
          heading: 'Querying Passive Verbs',
          body: 'Apply a Margin Query ("Tighten verb?") on weak constructions rather than deleting immediately, leaving the original rhythm intact during early review.',
        },
        proTip:
          'Integrated Extension "Style & Cliché Scanner" (Extensions modal -> Integrated) can automatically propose proofread marks across repetitive phrases in one click.',
        checkpoint: {
          question: 'What does a Stet proofread mark signify in publishing practice?',
          options: [
            'Ignore an earlier deletion/change and leave the original copy standing as set',
            'Delete the entire chapter',
            'Convert the scene into uppercase',
          ],
          correctIndex: 0,
          explanation:
            'Stet (Latin: "let it stand") restores/keeps original text even if prior marks proposed altering it.',
        },
        actionLabel: 'Open Proofread Mode',
        minTier: 'intermediate',
        targetView: 'editor',
        targetSelector: '.bv-paper-float-nav',
      },
      {
        id: 'm4-clean',
        title: 'Clean Preview, Inspector Navigation & Snapshot Safety',
        durationMin: 4,
        instruction:
          'Use Clean Preview to read accepted prose flow smoothly, jump straight to open marks from Scene Inspector, and commit marks cleanly with automatic backup snapshots.',
        objective: 'Resolve open copyedits confidently while always keeping an undoable safety snapshot.',
        concepts: [
          'Visual strikethroughs and carets can make rhythm hard to hear. Toggling Clean Preview temporarily renders how the page reads once every accepted/open mark is applied without committing changes yet.',
          'When satisfied, clicking Accept All in Proofread mode automatically creates a timestamped snapshot of the scene first, then applies every open mark cleanly in reverse offset order so later offsets never drift.',
        ],
        steps: [
          'Toggle Clean Preview inside the Proofread bar to read the revised prose cadence aloud.',
          'Inspect open marks in the right Scene Inspector and click Review on any item to scroll straight to it.',
          'Accept or Reject individual marks, or click Accept All knowing a backup snapshot is created automatically.',
        ],
        example: {
          heading: 'Final Proofread Sign-Off',
          body: 'Before exporting an EPUB or print proof, verify the Publish checklist shows zero open proofread marks across chapters.',
        },
        proTip:
          'Never delete marks manually inside raw text—always resolve them via Accept/Reject/Stet so alignment offsets stay exact.',
        checkpoint: {
          question: 'What safeguard runs automatically when clicking Accept All Marks in Proofread mode?',
          options: [
            'An automatic Revision Snapshot is saved before applying edits to the scene prose',
            'Your manuscript uploads to a server',
            'Chapters are merged into one scene',
          ],
          correctIndex: 0,
          explanation:
            'Quillvibe automatically captures a snapshot checkpoint immediately before committing batch proofread marks.',
        },
        actionLabel: 'Inspect Proofread Controls',
        minTier: 'intermediate',
        targetView: 'editor',
        targetSelector: '.bv-main-stage',
      },
      {
        id: 'm4-diff',
        title: 'Compare Prose Against Any Snapshot With Word-Level Diff',
        durationMin: 4,
        instruction:
          'Switch the paper pill to Revision Diff (Advanced tier) to view color-coded inserted and deleted words comparing live prose against any earlier snapshot.',
        objective: 'Audit major rewrites accurately and recover strong lines removed earlier.',
        concepts: [
          'After tearing apart an opening chapter, writers frequently worry that the earlier draft carried better pacing. Revision Diff calculates a true longest-common-subsequence word diff between your live scene and any stored snapshot.',
          'Removed words appear clearly with strikethrough and additions highlight cleanly—and restoring a prior snapshot creates a fresh "Auto-backup before restore" snapshot so nothing in either version is ever lost.',
        ],
        steps: [
          'Ensure your scene has at least one Snapshot (press Ctrl+S inside Editor to create one).',
          'Switch the Manuscript floating mode switcher to Revision Diff.',
          'Pick a snapshot from the dropdown to inspect word-level changes, or capture the difference in notes.',
        ],
        example: {
          heading: 'Cutting 20% in Line Edits',
          body: 'Capture a "Pre-Cut Draft" snapshot before tightening Chapter 1; Revision Diff shows net cut word counts and ensures crucial clues survived.',
        },
        proTip:
          'Combine snapshots with Co-Author merges: whenever an offline LAN/Bluetooth sync detects a conflict, it automatically stores the peer revision as a readable snapshot so you can diff it here.',
        checkpoint: {
          question: 'If you restore an older snapshot, what happens to your current draft words?',
          options: [
            'Quillvibe saves an automatic backup snapshot of your current text before restoring',
            'Your current draft is wiped permanently',
            'Only the title is restored',
          ],
          correctIndex: 0,
          explanation:
            'Restoring automatically generates an "Auto-backup before restore" snapshot first.',
        },
        actionLabel: 'Open Diff Mode',
        minTier: 'advanced',
        targetView: 'editor',
        targetSelector: '.bv-paper-float-nav',
      },
    ],
  },
  {
    id: 'mod-typeset',
    number: 5,
    title: 'Interior Print Typesetting & Custom Typography',
    summary:
      'Set trade book trim dimensions, drop caps, smart typography, running headers, installed OS/file fonts, Table of Contents, and Print PDF output.',
    audience: 'Authors preparing paperback, hardcover, or EPUB interiors',
    lessons: [
      {
        id: 'm5-interior',
        title: 'Trim Size, Margins, Drop Caps & Custom Typefaces (.ttf / .otf)',
        durationMin: 5,
        instruction:
          'Open Studio -> Interior Typeset to pick US/UK trade trim sizes (5x8, 5.5x8.5, 6x9, A5, Royal), install local .ttf/.otf/.woff2 fonts, configure drop caps, and inspect multi-page pagination.',
        objective: 'Transform raw draft prose into balanced book spreads matching print house specifications.',
        concepts: [
          'Standard consumer word processors default to 8.5×11 office sheets. Real books use specific trade dimensions like 5×8 pocket fiction, 5.5×8.5 digest nonfiction, or 6×9 standard trade with mirrored inside gutter margins and proportioned text blocks.',
          'Under Settings -> Typefaces & Fonts, you can drop any licensed .ttf, .otf, or .woff2 font file (validated locally by magic-byte header) or pick an installed OS font and apply it independently to your writing desk or your final typeset book.',
        ],
        steps: [
          'Open Studio -> Interior Typeset (Binder collapses automatically for wider preview spreads).',
          'Pick a trim preset (e.g. 6" × 9" Standard Trade) and choose Book Serif font family or custom installed font.',
          'Toggle Drop Caps, Smart Quotes/Em-Dashes, and Chapter Numeral Style (Roman, Word, or Numeric).',
        ],
        example: {
          heading: 'Classic Trade Interior Stack',
          body: '6" × 9" trim, 11pt Garamond or Baskerville serif, 1.5 line height, First-Line Indents enabled, Roman numeral chapter titles, and Drop Caps on chapter openings.',
        },
        proTip:
          'Exporting a .qvstyle preset lets you reuse your imprint’s exact interior typography measurements across an entire series in one click.',
        checkpoint: {
          question: 'Where do you install custom .ttf or .otf fonts for your book’s Interior Typeset & Covers?',
          options: [
            'Settings -> Typefaces & Fonts (drag-and-drop file or OS system font picker)',
            'Story Graph edge inspector',
            'Corkboard status dropdown',
          ],
          correctIndex: 0,
          explanation:
            'Settings -> Typefaces & Fonts validates magic bytes locally and exposes installed typefaces across Draft, Interior Typeset, and Cover Studio.',
        },
        actionLabel: 'Go to Interior Typeset',
        minTier: 'intermediate',
        targetView: 'typeset',
        targetTypesetTab: 'interior',
      },
      {
        id: 'm5-printpdf',
        title: 'Verify Front Matter, Table of Contents & Export Print PDF / EPUB 3',
        durationMin: 4,
        instruction:
          'Review automatically generated Title Page, Dedication, Copyright Page, Table of Contents, and Collaborator Credits inside the typeset preview before printing PDF or building EPUB 3.',
        objective: 'Inspect pagination flow cleanly and produce press-grade PDF or validated EPUB 3 packages.',
        concepts: [
          'Interior Typeset compiles front matter (title page, dedication, copyright notice, co-author/proofreader credits, and Table of Contents) ahead of Part/Chapter spreads with running headers showing book title and chapter markers.',
          'Clicking Print / Save PDF formats dedicated print stylesheets (`@media print`) or generates a downloadable `.pdf` without app chrome, while Export EPUB 3 packages standards-compliant XHTML chapters, NCX/OPF navigation, metadata, and your active Front Cover art into a single `.epub` archive ready for e-readers and digital bookstores.',
        ],
        steps: [
          'Confirm Dedication and Copyright Notice fields in Interior Typeset settings.',
          'Scroll through the paginated book preview to check Title Page, Contents, and Chapter I flow.',
          'Click Print / Save PDF or Export EPUB 3 (or pick .epub from the top-right Save extension bar).',
        ],
        example: {
          heading: 'Two-Format Proof Check',
          body: 'Save an EPUB 3 onto an e-reader for an evening read-through alongside printing a Print PDF proof—reading in a fresh layout reveals typos invisible in the draft editor.',
        },
        proTip:
          'When exporting EPUB 3, Quillvibe automatically embeds the live rendered canvas of your Book Cover Studio design as `cover.png`.',
        checkpoint: {
          question: 'What happens to Quillvibe navigation bars when choosing Print / Save PDF?',
          options: [
            'Print CSS hides all toolbars, sidebars, and UI chrome so only crisp formatted book pages print',
            'Topbar buttons print on page 1',
            'Every chapter prints at 50% zoom',
          ],
          correctIndex: 0,
          explanation:
            'Dedicated `@media print` rules strip every workspace panel so output contains strictly the book pages.',
        },
        actionLabel: 'Check Print Preview',
        minTier: 'intermediate',
        targetView: 'typeset',
        targetTypesetTab: 'interior',
      },
    ],
  },
  {
    id: 'mod-cover',
    number: 6,
    title: 'Cover Studio: Vector Shapes, Gradients & Wraps',
    summary:
      'Design covers across Front, Back, Spine, and Flaps using multi-layer text, geometric vector shapes, ornaments, corner resize handles, snap guides, and high-resolution PNG/PDF export.',
    audience: 'Authors designing eBook fronts and full print wraps',
    lessons: [
      {
        id: 'm6-layers',
        title: 'Compose Multi-Layer Covers With Vector Shapes, SVGs & Gradients',
        durationMin: 6,
        instruction:
          'Open Studio -> Book Cover Studio. Add unlimited display text boxes, geometric vector shapes, crisp SVG ornaments, or drop your own transparent .png/.svg assets onto any face.',
        objective: 'Build balanced jacket artwork with clean visual hierarchy, blend filters, and undoable transforms.',
        concepts: [
          'Professional book covers rely on clean typography spacing and restrained contrast—not crowded filters. In Cover Studio, every headline, subtitle, author credit, edition pill, vector shape (rectangles, circles, stars, triangles, arrows, hexagons), and uploaded graphic lives on an addressable stack with 100-step Undo/Redo, Ctrl+G layer grouping, 8-point resize and rotation handles, and inline double-click text editing right on the artboard.',
          'You can switch backgrounds between solid color, dual-stop linear gradients, or full-bleed artwork with live Brightness, Contrast, Blur, and Tint Dim controls so light display ink pops reliably over photography.',
        ],
        steps: [
          'Open Studio -> Book Cover Studio (Advanced tier) and note the quiet left tool rail, center artboard, and right Inspector.',
          'Pick a base palette or gradient on the left panel, then click Vector Shapes or Add Text Layer to place architectural dividers or praise ribbons.',
          'Drop a custom .svg or transparent .png directly onto the canvas, drag to position, and inspect Layer Stack ordering.',
        ],
        example: {
          heading: 'Editorial Cloth-Band Jacket',
          body: 'Pair a deep obsidian base background with a warm bronze horizontal rule shape (12px thick), an ivory serif title sized at 54pt, and subtle uppercase tracked author name at the bottom edge.',
        },
        proTip:
          'Lock completed background layers with the padlock button in the Layer Stack so clicking foreground typography never shifts artwork beneath it.',
        checkpoint: {
          question: 'Can you recover if an alignment nudge or deletion inside Cover Studio goes wrong?',
          options: [
            'Yes — Cover Studio maintains a dedicated Undo/Redo stack alongside global project history',
            'Only by reloading the browser',
            'No, shape layers are permanent',
          ],
          correctIndex: 0,
          explanation:
            'Use Undo/Redo buttons on the studio bar or Ctrl+Z inside Cover Studio to step cleanly through layout edits.',
        },
        actionLabel: 'Open Cover Studio',
        minTier: 'advanced',
        targetView: 'typeset',
        targetTypesetTab: 'cover',
      },
      {
        id: 'm6-snap',
        title: 'Use Snap-to-Grid, Magnetic Alignment & Full Print Wrap Faces',
        durationMin: 5,
        instruction:
          'Toggle Snap-to-Grid and Bleed Guides to center elements cleanly across Front Cover, Spine, Back Cover, Front Flap, and Back Flap, zoom between 10% and 500% with Space+Drag panning, and export 1x/2x/3x PNG, Transparent PNG, JPEG, Vector SVG, or Print Interior PDF.',
        objective: 'Eliminate off-center titles and verify calculated paperback spine width from manuscript page count.',
        concepts: [
          'A slight 3% off-center title ruins an otherwise striking cover. Turning on Snap & Guides activates quantized grid increments alongside live magnetic amber center lines whenever an element aligns to 50% horizontal, 25%/75% quarters, or safe trim margins.',
          'Switching the face selector between Front Cover, Back Cover (with author bio and ISBN barcode placeholder box), Spine (width computed automatically from estimated book page count), and Dust Jacket Flaps gives complete control over physical wrap production.',
        ],
        steps: [
          'Toggle Snap & Bleed Guides in the Cover Studio top bar and drag the Title element toward horizontal center until the dashed amber guide snaps cleanly.',
          'Switch Face to Back Cover to write your jacket blurb, Author Bio, and toggle the ISBN barcode box.',
          'Switch to Full Wrap view to inspect Spine lettering beside Front and Back, then click Export Front PNG or Full Wrap PNG.',
        ],
        example: {
          heading: 'Right-Click Canvas Menu',
          body: 'Right-click any layer directly on the Cover Studio canvas to Center Horizontally, Bring Forward, Send Backward, Duplicate Layer, or Lock Position.',
        },
        proTip:
          'Before printing wraps, finalize scene prose roughly so estimated page count produces accurate spine thickness.',
        checkpoint: {
          question: 'How does Quillvibe determine paperback Spine width in Full Wrap mode?',
          options: [
            'It calculates spine width from estimated manuscript page count alongside trim settings',
            'It locks spine permanently at 2 inches',
            'It ignores manuscript length',
          ],
          correctIndex: 0,
          explanation:
            'Spine geometry updates automatically from manuscript word count and standard paper bulk.',
        },
        actionLabel: 'Inspect Full Wrap',
        minTier: 'advanced',
        targetView: 'typeset',
        targetTypesetTab: 'cover',
      },
      {
        id: 'm6-vector-draw-urls',
        title: 'Desktop Vector Pen, Freehand Brush, Blend Modes & Artwork URLs',
        durationMin: 6,
        instruction:
          'In the Desktop App, use Cover Studio -> Draw for freehand brush strokes and multi-point vector paths, switch layer Blend Modes (Multiply, Screen, Overlay, Soft Light), or paste an https:// artwork URL in Uploads.',
        objective: 'Combine custom vector illustration strokes, blended shapes, and embedded remote photography inside print-ready covers.',
        concepts: [
          'The Draw tool rail tab (Desktop App only) provides two drawing modes: Freehand Brush sketches organic strokes as you drag across the front, spine, or back cover; Vector Pen places crisp straight-segment polygon/polyline anchors you commit as an editable SVG path layer.',
          'Every vector path, shape, graphic, and custom text layer supports per-layer Opacity plus 7 optical Blend Modes (Normal, Multiply, Screen, Overlay, Soft Light, Darken, Lighten) so textures, foil accents, and photography fuse naturally cleanly in live preview, PNG, JPEG, and Vector SVG exports.',
          'Under Uploads, Paste Image URL accepts clean https:// links or safe data:image URIs and downloads/embeds the raster pixels locally inside your project so exported Print wraps and .qv archives keep working completely offline. If an external image host disables cross-origin headers (CORS), Quillvibe reports it cleanly so you can save locally and upload instead.',
        ],
        steps: [
          'Open Studio -> Book Cover Studio (Full Studio layout in the Desktop App) and open the Draw tab.',
          'Draw a freehand accent curve or switch to Vector Pen, place 4+ anchor points on the cover, and click Commit Vector Path.',
          'Select the created path (or any uploaded photo/shape), adjust Stroke Width, Opacity, and try Multiply or Overlay Blend Mode in the right Properties panel.',
          'Open Uploads, paste an https:// image URL into Paste Image URL, and click Add as Layer or Set as Backdrop.',
        ],
        example: {
          heading: 'Soft Foil Glow Overlay',
          body: 'Draw a wide closed polygon across the upper third of a photographic cover, set its Fill Color to warm brass (#c7a97b), lower Opacity to 35%, and pick Overlay blend mode to cast atmospheric golden warmth over skies without obscuring details.',
        },
        proTip:
          'All vector paths scale cleanly when exporting Vector SVG (.svg) or ultra-high-res 3x PNG (1800 x 2880).',
        checkpoint: {
          question: 'Why does Paste Image URL convert a pasted https:// image into local embedded pixels inside your cover project?',
          options: [
            'So your cover exports and offline .qv / .qvdesign backups remain self-contained even without internet access',
            'So the image is deleted from your hard drive',
            'To lock the cover permanently against editing',
          ],
          correctIndex: 0,
          explanation:
            'Embedding the image locally ensures Print wraps, EPUB covers, and .qvdesign files never break if a website link goes offline later.',
        },
        actionLabel: 'Open Cover Draw Tools',
        minTier: 'advanced',
        targetView: 'typeset',
        targetTypesetTab: 'cover',
      },
      {
        id: 'm6-variants-compare',
        title: 'Drafting Cover Concepts & Running Side-by-Side Comparisons',
        durationMin: 4,
        instruction:
          'Save each stylistic direction inside the Drafts tab (Desktop App), then open Compare Side-by-Side to judge typography scale, contrast, and mood directly against rival drafts.',
        objective: 'Explore multiple strong cover compositions without losing earlier typography or color arrangements.',
        concepts: [
          'Strong book covers rarely succeed on the very first pass. Save early typography concepts as named Draft Variants (e.g., "Dark Serif Minimal", "Full-Bleed Landscape", "Editorial Band") inside Cover Studio.',
          'Side-by-Side Comparison renders any two drafts—or compares a saved draft against your current working canvas—at identical scale, displaying layer counts and template family so you can promote the sharpest direction in one click.',
        ],
        steps: [
          'Build your first clean cover layout, open the Drafts tool tab, enter a short name, and click Save Current as Draft.',
          'Experiment freely with a different backdrop gradient, ornament, or palette and save a second draft.',
          'Click Compare Side-by-Side, pick Left and Right concepts, evaluate title legibility at thumbnail scale, and click Promote Winner on the stronger design.',
        ],
        example: {
          heading: 'Thumbnail Contrast Audit',
          body: 'Store readers first see book covers at tiny ~120px thumbnails. Compare a serif-on-dark draft against a stark ivory draft side-by-side to see whose title remains readable across room distance.',
        },
        proTip:
          'Save your active layout as a Draft Variant right before testing bold gradient experiments so returning takes one click.',
        checkpoint: {
          question: 'What happens when you click Promote Winner in Side-by-Side Comparison?',
          options: [
            'The chosen draft becomes your active cover while keeping your saved variants and review pins intact',
            'All other scenes in your book are deleted',
            'Your font size resets to 8px',
          ],
          correctIndex: 0,
          explanation:
            'Promoting a draft swaps the active artwork layout safely while keeping your library of saved variants and collaboration pins.',
        },
        actionLabel: 'Compare Cover Drafts',
        minTier: 'advanced',
        targetView: 'typeset',
        targetTypesetTab: 'cover',
      },
      {
        id: 'm6-qvdesign-collab',
        title: 'Collaborating with Designers & Co-Authors Using .qvdesign',
        durationMin: 5,
        instruction:
          'Open Collab in Cover Studio (Desktop App) to drop numbered feedback pins directly on cover faces and export/merge editable .qvdesign packages.',
        objective: 'Exchange cover layouts and art critiques without shipping your private manuscript prose.',
        concepts: [
          'The official .qvdesign extension bundles your editable Cover Studio configuration—templates, typography, vector paths, shapes, embedded artwork, draft variants, and numbered review pins—without including manuscript chapters or Story Bible secrets.',
          'Co-authors and cover illustrators can open your .qvdesign in Quillvibe Desktop, add numbered canvas review pins on Front, Spine, or Back cover faces, edit vector layers, and send back an updated .qvdesign. When it arrives, choose Import .qvdesign to load their full design or Merge Pins Only to pull feedback notes onto your current canvas.',
        ],
        steps: [
          'Open the Collab tab in Cover Studio, enter your name, click Click Cover to Drop Pin, and click any region on the canvas.',
          'Click Export .qvdesign to save a shareable design archive for an illustrator, publisher, or co-author.',
          'When updated feedback arrives back, click Import .qvdesign or Merge Pins Only and resolve each pin as edits land.',
        ],
        example: {
          heading: 'Separate Art & Manuscript Handoff',
          body: 'Send an illustrator only .qvdesign (cover + spine width + pins) and .qvbible (character appearance notes) while keeping unpublished ending chapters strictly inside your sealed .qv file.',
        },
        proTip:
          'Double-clicking a .qvdesign file on Windows, macOS, or Linux desktop opens it directly into the Quillvibe Desktop window.',
        checkpoint: {
          question: 'When receiving feedback notes from an editor inside a .qvdesign file while keeping your own newer cover layout, which option should you use?',
          options: [
            'Merge Pins Only',
            'Delete All Layers',
            'Export Plain Text (.txt)',
          ],
          correctIndex: 0,
          explanation:
            'Merge Pins Only imports review pins without overwriting your local layer artwork edits.',
        },
        actionLabel: 'Open Cover Collaboration',
        minTier: 'advanced',
        targetView: 'typeset',
        targetTypesetTab: 'cover',
      },
    ],
  },
  {
    id: 'mod-publish',
    number: 7,
    title: 'Author Sealing, Secure LAN/Bluetooth/Enterprise Sync & Release',
    summary:
      'Sign your finished edition with a cryptographic ECDSA Author Key, sync safely with teams over Wi-Fi, Bluetooth, or your own HTTPS server, and publish.',
    audience: 'Teams, publishers, and authors shipping final editions',
    lessons: [
      {
        id: 'm7-seal',
        title: 'Cryptographic ECDSA Author Sealing & Preflight Checklist',
        durationMin: 4,
        instruction:
          'Open Studio -> Publish & Author Seal (or Library) to generate your local WebCrypto ECDSA P-256 Origin Key (QVK-/QVD-), register a separate Work Copyright Seal (QVC-), and verify every preflight check turns green.',
        objective: 'Distinguish original device & pen-name identity from work copyright ownership inside your `.qv` release bundle.',
        concepts: [
          'Quillvibe keeps two distinct seals: your permanent Author & Origin Device Key (`QVK-` + `QVD-`) identifies who created the manuscript and which device it originated on, while the Work Copyright Seal (`QVC-`) records copyright ownership, territory rights, and notice inside the finished book.',
          'The Publish Preflight Checklist audits common slip-ups automatically: book title & pen name filled, non-empty chapters, zero remaining open proofread marks, Cover Studio artwork populated, Origin Device verification, and Work Copyright registration.',
        ],
        steps: [
          'Open Studio -> Publish & Author Seal (Advanced tier).',
          'Click Create Permanent Author Key -> Sign & Seal Origin to bind your pen name and origin device ID (`QVD-`).',
          'Click Seal Work Copyright to stamp a `QVC-` copyright ownership certificate alongside your release exports.',
        ],
        example: {
          heading: 'Imprint Archival Master',
          body: 'Keep one sealed `.qv` master bundle alongside your `.epub` and Print Interior `.pdf` inside a dated release folder for every edition print run.',
        },
        proTip:
          'Back up your Author Key fingerprint cleanly; generating a fresh key creates a new key ID for future releases.',
        checkpoint: {
          question: 'Where are Author Keys generated and used during manuscript signing?',
          options: [
            'Strictly on your own device via standard browser/WebCrypto ECDSA APIs',
            'On a remote cloud key escrow server',
            'Inside external email attachments',
          ],
          correctIndex: 0,
          explanation:
            'Quillvibe generates and uses P-256 ECDSA keys purely locally on your device.',
        },
        actionLabel: 'Go to Publish & Seal',
        minTier: 'advanced',
        targetView: 'typeset',
        targetTypesetTab: 'publish',
      },
      {
        id: 'm7-collab',
        title: 'Collaborate Over Local Wi-Fi, Bluetooth, or Self-Hosted HTTPS Servers',
        durationMin: 5,
        instruction:
          'Use Offline Collaboration -> Wi-Fi LAN for PIN-paired desk sync, Bluetooth with SHA-256 checksums for air-gapped handoffs, or Enterprise / Website Sync to connect your own TLS server.',
        objective: 'Exchange co-author edits safely without exposing drafts to third-party SaaS clouds.',
        concepts: [
          'Teams sitting in the same studio can run Same-Wi-Fi LAN Sync directly between desktop executables, protected by a constant-time 6-digit PIN and private IPv4 checks that block unintended external traffic. Air-gapped rooms can share `.qv` packages via OS Bluetooth wizards and compare displayed SHA-256 checksums.',
          'Organizations or authors who operate their own domain can use the Enterprise / Website Sync tab to connect directly to a personal website or company HTTPS endpoint (`GET /books/:id` and `PUT /books/:id`) using Bearer or custom API key headers stored strictly in active session memory—never exported into book files. Adding a Co-Author also requires a cryptographically signed `QVCA1.` token generated on the co-writer’s separate device.',
        ],
        steps: [
          'Open Collaboration from the topbar (Advanced tier) and inspect all four tabs: Credits, Same-Wi-Fi, Bluetooth, and Enterprise / Website Sync.',
          'On a co-author’s second device, click Generate My Device Co-Author Key Token and paste that `QVCA1.` token on the primary device to verify separate-device co-writing.',
          'For teams using their own server, enter your https:// URL, book ID, and session token, test connection, and Push/Pull revisions with automatic snapshot conflict safety.',
        ],
        example: {
          heading: 'Editorial House Server Integration',
          body: 'A boutique publisher configures `https://editorial.myhouse.com/qv-sync` with per-editor Bearer tokens; copyeditors pull `.qv` drafts in a web browser or the desktop app, add proofread marks, and push back safely.',
        },
        proTip:
          'Plain unencrypted `http://` URLs are rejected automatically for public hostnames in Enterprise Sync; use `https://` everywhere outside localhost/LAN.',
        checkpoint: {
          question: 'How does Quillvibe protect conflicting edits when merging a collaborator file over LAN, Bluetooth, or Enterprise Sync?',
          options: [
            'Newer text merges cleanly while conflicting rival versions are preserved as readable Snapshots on the scene',
            'Remote text overwrites local work silently',
            'Both scenes are deleted',
          ],
          correctIndex: 0,
          explanation:
            'Merge logic compares revision timestamps and always preserves conflicting prose in scene Snapshots so zero lines disappear.',
        },
        actionLabel: 'Open Collaboration Hub',
        minTier: 'advanced',
        targetView: 'editor',
        targetSelector: '.bv-topbar-actions',
      },
      {
        id: 'm7-export',
        title: 'Choose File Formats: .qv Workspace, .pdf, .epub, & Legacy Imports',
        durationMin: 4,
        instruction:
          'Pick `.qv` as your default whole-book workspace format in the top-right save selector, or export `.pdf`, `.epub`, `.qvbible`, `.qvscene`, `.qvstyle`, `.md`, `.html`, and `.txt` packages.',
        objective: 'Archive complete books cleanly in `.qv` while importing older `.quillvibe` and `.bookvibe` files.',
        concepts: [
          'Quillvibe encodes all four official extensions (`.qv`, `.qvbible`, `.qvscene`, `.qvstyle`) in its protected binary container (`QVBX`) so external text editors or third-party converters cannot decode, alter, or swap data inside them.',
          'Older `.quillvibe`, `.qvibe`, `.qvbook`, `.bookvibe`, and `.bv*` archives stay separated from OS double-click associations. Whenever you need an older file, import it explicitly through Settings -> Publishing & Archive -> Import Legacy Archive.',
        ],
        steps: [
          'Click the extension selector beside the top-right Save icon and set `.qv` as your default quick-export format.',
          'Press Save/Export to save a protected `.qv` book workspace onto your drive.',
          'To bring in an older `.quillvibe` or `.bookvibe` file, open Settings -> Publishing & Archive and click Import Legacy Archive.',
        ],
        example: {
          heading: 'Sharing a World Bible Only',
          body: 'Export `.qvbible` when letting a beta-reader or illustrator browse character traits and reference portraits without sharing unfinished ending chapters.',
        },
        proTip:
          'You can also import `.docx` documents, Web HTML `.html`, `.rtf`, `.md`, or `.txt` manuscripts from Settings -> Publishing & Archive.',
        checkpoint: {
          question: 'Which extension preserves ALL book data—manuscript, Story Bible, Graph nodes, Cover Studio layers, Copyright Seal, and Typeset settings—in a single portable file?',
          options: ['.qv', '.txt only', '.qvstyle'],
          correctIndex: 0,
          explanation:
            '.qv archives serialize the full QUILLVIBE_V2 workspace so restoring onto any computer recovers every piece of the project.',
        },
        actionLabel: 'Open Publish Extensions',
        minTier: 'advanced',
        targetView: 'typeset',
        targetTypesetTab: 'publish',
      },
    ],
  },
  {
    id: 'mod-security',
    number: 8,
    title: 'Protected File Locks (QVBX), Passwords & Safety Checks',
    summary:
      'Learn why Quillvibe uses its own sealed file format, how export passwords work, how tampered or broken files are stopped, and how to bring in older files.',
    audience: 'Authors protecting drafts, passwords, and file integrity',
    lessons: [
      {
        id: 'm8-qvbx',
        title: 'How Quillvibe Seals Your Book Inside Protected QVBX Files',
        durationMin: 4,
        instruction:
          'Export any `.qv`, `.qvbible`, `.qvscene`, or `.qvstyle` file from the Save menu. Quillvibe writes a sealed binary file that only Quillvibe can read.',
        objective: 'Keep drafts private and unreadable to outside programs or plain-text viewers.',
        concepts: [
          'Just like desktop office suites store documents in their own binary container rather than raw editable JSON, Quillvibe packs every exported file inside a sealed `QVBX` binary container using authenticated encryption (`AES-GCM`).',
          'If someone opens a `.qv` file in a plain-text viewer or feeds it into an outside decoder, the bytes look scrambled. Modifying even one character breaks the check tag, so Quillvibe warns you right away instead of loading broken chapters.',
        ],
        steps: [
          'Pick `.qv` (or `.qvbible`, `.qvscene`, `.qvstyle`, `.pdf`, `.epub`) in the top-right Save dropdown.',
          'Click Save/Export to save the sealed file to your disk (a progress pill confirms loading during large exports).',
          'Open the file back in Quillvibe with Ctrl+O or by dropping it onto the workspace.',
        ],
        example: {
          heading: 'Sending a Clean Master Copy',
          body: 'Send a sealed `.qv` file to your verified co-author over USB or LAN sync knowing random viewers cannot open its chapters in a plain text editor.',
        },
        proTip:
          'Your active workspace still saves quickly in your browser or desktop data folder so everyday typing stays fast.',
        checkpoint: {
          question: 'What happens if an outside program edits bytes inside a sealed `.qv` file?',
          options: [
            'Quillvibe catches the mismatch and refuses to open the damaged data',
            'Quillvibe guesses the missing words automatically',
            'Nothing happens and the broken text overwrites your good copy',
          ],
          correctIndex: 0,
          explanation:
            'Every `QVBX` file checks a cryptographic integrity tag before decoding, so damaged or altered files are stopped cleanly.',
        },
        actionLabel: 'Inspect Protected Formats',
        minTier: 'basic',
        targetView: 'editor',
        targetSelector: '.bv-save-split',
      },
      {
        id: 'm8-password',
        title: 'Lock Exports With a Password & Spot Unsafe Content',
        durationMin: 5,
        instruction:
          'Use Studio -> Publish -> Password-Locked .qv (or turn on required export passwords in Settings) to lock exports with your own password. Quillvibe also scans incoming files for scripts or executable programs.',
        objective: 'Protect sensitive manuscripts with passwords and stop suspicious payloads on open.',
        concepts: [
          'When you add a password at export time, Quillvibe turns that password into a strong encryption key using 150,000 PBKDF2 rounds. Anyone opening the file in Quillvibe must enter the exact password. Wrong passwords or broken bytes stay scrambled and cannot be restored.',
          'Before a decoded book touches your library, Quillvibe checks for disguised executables (`MZ`), script injection tags (`<script>`), event handlers, or altered Author Keys so untrusted files cannot sneak harmful data into your workspace.',
        ],
        steps: [
          'Open Studio -> Publish & Author Seal (Intermediate/Advanced) and click Password-Locked .qv.',
          'Type a password you remember cleanly (there is no remote reset button).',
          'Test opening the saved file via Ctrl+O to verify the unlock prompt works.',
        ],
        example: {
          heading: 'Before Embargo Release Day',
          body: 'Publishers preparing pre-release galleys turn on Require password on every QVBX file export in Settings -> Publishing & Archive so zero unencrypted copies leave the office.',
        },
        proTip:
          'Never store your export password inside the book title or Synopsis card—share it with your team through a separate message.',
        checkpoint: {
          question: 'Can Quillvibe recover a password-locked `.qv` file if the password is lost?',
          options: [
            'No — there is no backdoor, so keep a safe note of any password you set',
            'Yes, email support resets every password',
            'Opening it twice bypasses the lock',
          ],
          correctIndex: 0,
          explanation:
            'Passwords derive the encryption key locally on your device, so without the password the contents stay locked.',
        },
        actionLabel: 'Open Password Export',
        minTier: 'intermediate',
        targetView: 'typeset',
        targetTypesetTab: 'publish',
      },
      {
        id: 'm8-legacy',
        title: 'Import Legacy .quillvibe & .bookvibe Archives Safely',
        durationMin: 3,
        instruction:
          'Legacy `.quillvibe`, `.qvibe`, `.qvbook`, `.bookvibe`, and `.bv*` files no longer open on double-click. Open Settings -> Publishing & Archive and click Import Legacy Archive whenever you want to bring one forward into `.qv`.',
        objective: 'Upgrade older manuscripts cleanly while keeping modern OS file registration focused strictly on `.qv` and `.qv*`.',
        concepts: [
          'Consolidating double-click associations around `.qv`, `.qvbible`, `.qvscene`, and `.qvstyle` keeps Windows, macOS, and Linux clean without duplicate extensions.',
          'At the same time, you never lose access to older books: the explicit importer in Settings -> Publishing & Archive reads old `.quillvibe`, `.qvbook`, `.bookvibe`, and `.bv*` files directly and upgrades them inside your library.',
        ],
        steps: [
          'Open Settings (gear icon) and select Publishing & Archive.',
          'Scroll to the Import section and click Import Legacy Archive.',
          'Pick the old file, let Quillvibe load it, and save a new `.qv` copy going forward.',
        ],
        example: {
          heading: 'Archiving a Series Backlist',
          body: 'Import Book 1 from an older `.bookvibe` or `.quillvibe` backup, verify chapters and Story Bible items, then export `book-1.qv` so all books share the same modern format.',
        },
        proTip:
          'Keep your original legacy file in an archive folder as a read-only backup after converting.',
        checkpoint: {
          question: 'Where do you open an old `.bookvibe` or `.quillvibe` archive in Quillvibe?',
          options: [
            'Settings -> Publishing & Archive -> Import Legacy Archive',
            'Double-click it on the Desktop',
            'Rename it to .png first',
          ],
          correctIndex: 0,
          explanation:
            'Legacy archives load through the explicit importer in Settings so modern OS double-click rules stay clean on `.qv`.',
        },
        actionLabel: 'Open Settings',
        minTier: 'basic',
        targetView: 'editor',
        targetSelector: '.bv-topbar-actions',
      },
    ],
  },
  {
    id: 'mod-teams',
    number: 9,
    title: 'Forever Author Keys, Team Permissions & Commercial Releases',
    summary:
      'Bind a permanent Author Key to each pen name, set per-role rules for co-authors and proofreaders, and fill commercial or publisher release fields.',
    audience: 'Co-authors, proofreaders, editors, typesetters, and publishers',
    lessons: [
      {
        id: 'm9-permkey',
        title: 'Bind One Permanent Author Key to Each Pen Name',
        durationMin: 4,
        instruction:
          'Open Book Library (bookshelf icon) or Studio -> Publish, enter your Pen Name, and click Create Permanent Author Key. Once created, that Author Key stays tied forever to that pen name.',
        objective: 'Protect author identity across editions and catch any attempt to swap your key inside exported files.',
        concepts: [
          'Every pen name receives its own single `QVK-...` Author Key stored locally in your permanent pen-name registry. You cannot replace or rotate that key once bound—guaranteeing every book published under that pen name matches the same cryptographic fingerprint.',
          'Quillvibe also stores the Author Key fingerprint in the sealed header of `QVBX` files. If someone edits the JSON inside a file to swap in a different pen name key, Quillvibe flags Author Key tampering immediately and blocks opening.',
        ],
        steps: [
          'Open Library -> check the Pen Name box while no key is set yet.',
          'Click Create Permanent Author Key -> observe the green Locked Forever to Pen Name badge.',
          'Click Sign & Seal Book to stamp the manuscript digest with that key.',
        ],
        example: {
          heading: 'Writing Under Two Pen Names',
          body: 'Use your thriller pen name on Book A (receiving its own forever key) and create a separate book for your romance pen name—each pen name keeps its own distinct permanent key.',
        },
        proTip:
          'Decide the exact spelling of your Pen Name before creating its permanent key, since the pen name locks alongside the key.',
        checkpoint: {
          question: 'Why cannot an author key be changed once created for a pen name?',
          options: [
            'So readers, collaborators, and publishers can trust that every book under that pen name comes from the same original key',
            'Because the button runs only once per computer reboot',
            'So nobody can read Chapter 1',
          ],
          correctIndex: 0,
          explanation:
            'Keeping one forever key per pen name prevents key swaps and impersonation across releases.',
        },
        actionLabel: 'Open Author Key View',
        minTier: 'advanced',
        targetView: 'typeset',
        targetTypesetTab: 'publish',
      },
      {
        id: 'm9-perms',
        title: 'Set Collaborator Roles & Access Restrictions',
        durationMin: 5,
        instruction:
          'Open Collaborate (Advanced tier) to add Co-Authors, Proofreaders, Editors, Typesetters, Publishers, or Beta Readers, and check or uncheck exact capabilities under each person.',
        objective: 'Give teammates the tools they need while locking prose edits, exports, or Author Keys when needed.',
        concepts: [
          'Not everyone touching a book should have the same buttons unlocked. A Proofreader or Beta Reader gets Proofread marks & notes enabled by default while Edit prose stays turned off—switching Manuscript Draft view into a calm read-only sheet with a direct switch to Proofread Mode.',
          'Collaborators can never alter the book owner’s permanent Author Key, and you can toggle six clear permissions per collaborator: Edit prose, Proofread marks & notes, Edit Bible & Graph, Edit Cover & Typeset, Export files, and Manage team.',
        ],
        steps: [
          'Open Collaborate from the top bar and switch Active Editor / Reviewer Role or add a new collaborator.',
          'Pick a role (for example Proofreader or Typesetter) to apply safe default rules.',
          'Check or uncheck any individual permission checkbox on the collaborator card to tailor access.',
        ],
        example: {
          heading: 'Locking Drafts During Final Proofreading',
          body: 'Add your copyeditor with Edit prose unchecked and Proofread marks & notes checked. They can place margin notes and mark typos without changing your finished sentences.',
        },
        proTip:
          'Typesetter role defaults allow Cover & Typeset work and exporting files while keeping prose read-only.',
        checkpoint: {
          question: 'What happens in Manuscript Editor when a collaborator has Edit prose unchecked?',
          options: [
            'The writing sheet switches to read-only and displays a banner linking straight to Proofread Mode',
            'The book deletes itself',
            'The theme turns bright red',
          ],
          correctIndex: 0,
          explanation:
            'Quillvibe keeps the manuscript safe in read-only mode while allowing permitted proofread marks and notes.',
        },
        actionLabel: 'Open Editor View',
        minTier: 'advanced',
        targetView: 'editor',
        targetSelector: '.bv-topbar-actions',
      },
      {
        id: 'm9-enterprise',
        title: 'Commercial & Publisher Release Options',
        durationMin: 4,
        instruction:
          'Open Settings -> Publishing & Archive to set Publisher Legal Entity, eBook ISBN, Rights Territory, Commercial License, BISAC Code, Press Embargo Date, ARC Proof Watermark, and Enterprise safety rules.',
        objective: 'Prepare professional publishing records, review-copy watermarks, and company release policies.',
        concepts: [
          'Commercial presses and studio teams track more than one print ISBN. Publishing & Archive lets you store your legal company name, separate Print and eBook ISBNs, territorial distribution rights (for example World All Languages), licensing terms, BISAC category codes, and embargo/street dates—exported cleanly inside your Editorial Handoff Sheet.',
          'Adding an Advance Review Copy (ARC) watermark stamps a diagonal light label across Printable Typeset HTML pages, while turning on Require password on every QVBX file export enforces password entry on every `.qv` export.',
        ],
        steps: [
          'Open Settings -> Publishing & Archive.',
          'Fill your Imprint, Publisher Legal Entity, Print/eBook ISBN, and Rights Territory.',
          'Optionally enter an ARC Proof Watermark or turn on Require valid Author Key signature / Require password on export.',
        ],
        example: {
          heading: 'Advance Review Proofs',
          body: 'Type "ADVANCE REVIEW COPY · NOT FOR SALE" into Printable ARC Watermark, then print your PDF proof for early reviewers.',
        },
        proTip:
          'Check Studio -> Publish Readiness anytime to confirm your Commercial / Publisher Release Info check turns green.',
        checkpoint: {
          question: 'Where does Printable ARC Watermark text show up when configured?',
          options: [
            'As a subtle diagonal watermark across Printable / Print PDF book pages',
            'Inside every scene word count counter',
            'Only inside browser console logs',
          ],
          correctIndex: 0,
          explanation:
            'Printable Typeset HTML overlays the configured ARC watermark safely on each printed proof page.',
        },
        actionLabel: 'Check Publish Readiness',
        minTier: 'advanced',
        targetView: 'typeset',
        targetTypesetTab: 'publish',
      },
    ],
  },
  {
    id: 'mod-desktop',
    number: 10,
    title: 'Desktop App Extras (Windows, macOS & Linux)',
    summary:
      'Learn what extra tools appear only in the installed desktop app: F11 Immersive HUD, parallel book windows, local Wi-Fi/Bluetooth sync, and OS file double-clicking.',
    audience: 'Writers comparing Web Studio vs the Desktop Installer',
    lessons: [
      {
        id: 'm10-hud-win',
        title: 'Immersive Fullscreen HUD (F11) & Multi-Window Editing',
        durationMin: 3,
        instruction:
          'On the desktop app, press F11 (or click Fullscreen) for edge-to-edge focus with a floating clock/sprint/word/alarm bar, or click Window in Book Library to edit two books in separate windows.',
        objective: 'Keep browser screens uncluttered while mastering the extra desktop-only controls.',
        concepts: [
          'Web browsers cannot turn every tab into a clean multi-window OS studio or bypass browser fullscreen banners reliably. Because of that, Quillvibe keeps web browsers clean by hiding desktop-only buttons there and showing them strictly inside the Windows, macOS, and Linux app.',
          'Inside the desktop app, Fullscreen mode gives you a custom floating status strip showing wall clock, sprint timer, word progress, and your Alarm Clock chime, while New Window launches any second book from your library side by side on dual monitors.',
        ],
        steps: [
          'Notice on web (`quillvibe.jhonrey.com`) that desktop-only buttons stay hidden so mobile and desktop browsers never glitch.',
          'Install the Desktop App from Releases when you want F11 Immersive Fullscreen and side-by-side book windows.',
          'Toggle which Immersive HUD widgets appear in Settings -> Workspace & Editor inside the desktop app.',
        ],
        example: {
          heading: 'Dual-Monitor Trilogy Editing',
          body: 'In the desktop app, keep Book 1 open in your left monitor window while drafting Book 2 in your right monitor window.',
        },
        proTip:
          'Web users still get full Zen Focus (`Ctrl+Shift+F`), all themes, Cover Studio, Typeset, EPUB 3, Print PDF, QVBX passwords, and the Sprint/Alarm Clock.',
        checkpoint: {
          question: 'Why does the website version hide the F11 Immersive Fullscreen and Multi-Window buttons?',
          options: [
            'So web layouts stay clean and unbroken across phones and desktop browsers while desktop-only controls live inside the desktop app',
            'Because writing courses are web-only',
            'To disable saving in browsers',
          ],
          correctIndex: 0,
          explanation:
            'Desktop OS features are shown only in the compiled desktop runtime so the website stays lightweight and reliable on every screen.',
        },
        actionLabel: 'View Practice Sheet',
        minTier: 'basic',
        targetView: 'editor',
        targetSelector: '.bv-statusbar',
      },
      {
        id: 'm10-lan-os',
        title: 'Local Wi-Fi LAN Sync, Bluetooth Transfer & File Double-Click',
        durationMin: 3,
        instruction:
          'In the desktop app, open Collaborate for Same-Wi-Fi PIN Sync and Bluetooth Receive/Send, or open Extensions -> File Formats to register `.qv`, `.qvbible`, `.qvscene`, and `.qvstyle` with Explorer or Finder.',
        objective: 'Sync over local Wi-Fi without cloud accounts and launch books straight from your file manager.',
        concepts: [
          'Same-Wi-Fi LAN Sync starts a local HTTP server bound strictly to your private LAN subnet with a 6-digit PIN (`X-Quillvibe-Pin`), allowing two writers in the same room to exchange revisions without internet access. On web, Collaborate automatically switches to show Team Permissions and HTTPS Enterprise / Website Sync cleanly.',
          'OS Shell registration lets Windows Explorer, macOS Finder, and Linux desktops launch Quillvibe when double-clicking `.qv`, `.qvbible`, `.qvscene`, or `.qvstyle` files. In Fullscreen (`F11`), the movable Immersive HUD can also collapse or reveal from the top screen hover bar.',
        ],
        steps: [
          'In the desktop app, open Collaborate -> Same-Wi-Fi LAN Sync to start hosting with a 6-digit PIN.',
          'Share the local IP:port and PIN verbally with your co-author on the same Wi-Fi router.',
          'Register `.qv` file associations once under Extensions -> File Formats -> Register in OS Shell.',
        ],
        example: {
          heading: 'Air-Gapped Co-Writing Retreat',
          body: 'Turn off internet Wi-Fi, connect both laptops to a travel router, and merge scenes safely via 6-digit PIN LAN sync.',
        },
        proTip:
          'On the web version, use signed/password-locked `.qv` downloads or Enterprise HTTPS Website Sync to share files safely.',
        checkpoint: {
          question: 'Which collaboration methods work directly inside the web browser without installing the desktop app?',
          options: [
            'Team roles & permissions, `.qv` file merge, and HTTPS Enterprise / Website Sync',
            'Raw local TCP Wi-Fi server hosting',
            'Windows Registry editing from a web tab',
          ],
          correctIndex: 0,
          explanation:
            'Browser mode supports collaborator permissions, manual `.qv` merges, and TLS Enterprise / Website Sync, while raw LAN sockets and OS shell hooks run in the desktop app.',
        },
        actionLabel: 'Back to Course Overview',
        minTier: 'basic',
        targetView: 'course',
      },
    ],
  },
];

export function readCompletedCourseLessons(): Set<string> {
  if (typeof window === 'undefined' || !window.localStorage) return new Set(memoryCompletedLessons);
  try {
    const raw = window.localStorage.getItem(COURSE_PROGRESS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function writeCompletedCourseLessons(done: Set<string>): void {
  memoryCompletedLessons = new Set(done);
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(COURSE_PROGRESS_KEY, JSON.stringify(Array.from(done)));
  } catch {
    // Ignore storage limits
  }
}

export function toggleCourseLessonDone(lessonId: string, forceState?: boolean): Set<string> {
  const done = readCompletedCourseLessons();
  const nextVal = forceState !== undefined ? forceState : !done.has(lessonId);
  if (nextVal) done.add(lessonId);
  else done.delete(lessonId);
  writeCompletedCourseLessons(done);
  return done;
}

export function getCourseCompletionSummary(): { completed: number; total: number; pct: number } {
  const done = readCompletedCourseLessons();
  const all = COURSE_MODULES.flatMap((m) => m.lessons);
  const completed = all.filter((l) => done.has(l.id)).length;
  const total = all.length;
  return { completed, total, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

let activeCourseDrawer: HTMLElement | null = null;
let activeModuleIndex = 0;

export function closeInteractiveCourseDrawer(): void {
  if (activeCourseDrawer) {
    activeCourseDrawer.remove();
    activeCourseDrawer = null;
  }
}

export function navigateToCourseLesson(actions: AppActions, lesson: CourseLesson): void {
  if (lesson.minTier === 'advanced' && actions.getState().settings.toolTier !== 'advanced') {
    actions.updateSettings({ toolTier: 'advanced' });
    actions.notify('Switched Workspace Layout to Full Studio for this lesson.');
  } else if (lesson.minTier === 'intermediate' && actions.getState().settings.toolTier === 'basic') {
    actions.updateSettings({ toolTier: 'intermediate' });
    actions.notify('Switched Workspace Layout to Editorial for this lesson.');
  }

  actions.setState(
    {
      activeView: lesson.targetView,
      ...(lesson.targetTypesetTab ? { typesetSubTab: lesson.targetTypesetTab } : {}),
      ...(lesson.targetView === 'editor' && lesson.id.startsWith('m4-')
        ? { editorSubMode: lesson.id === 'm4-diff' ? 'diff' : 'proofread' }
        : {}),
    },
    true,
  );

  if (lesson.targetSelector) {
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(lesson.targetSelector!);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('qv-course-pulse');
        window.setTimeout(() => target.classList.remove('qv-course-pulse'), 1600);
      }
    });
  }
}

/**
 * Compact side-by-side interactive practice drawer paired with the full /course Academy page.
 */
export function openInteractiveCourseDrawer(actions: AppActions, moduleIndex = 0): void {
  closeInteractiveCourseDrawer();
  activeModuleIndex = Math.max(0, Math.min(COURSE_MODULES.length - 1, moduleIndex));

  const drawer = el('aside', {
    className: 'qv-course-drawer',
    id: 'qv-course-drawer',
    attrs: { role: 'complementary', 'aria-label': 'Interactive Book Writing Course' },
  });

  const renderDrawer = () => {
    drawer.replaceChildren();
    const mod = COURSE_MODULES[activeModuleIndex];
    const done = readCompletedCourseLessons();
    const summary = getCourseCompletionSummary();

    const modPills = el('div', { className: 'qv-course-mod-pills' });
    COURSE_MODULES.forEach((m, idx) => {
      const modAllDone = m.lessons.every((l) => done.has(l.id));
      modPills.appendChild(
        el('button', {
          className: `bv-mini-btn${idx === activeModuleIndex ? ' is-active' : ''}`,
          text: `${m.number}. ${modAllDone ? '✓' : ''}`,
          attrs: { type: 'button', 'aria-label': `Module ${m.number}: ${m.title}` },
          on: {
            click: () => {
              activeModuleIndex = idx;
              renderDrawer();
            },
          },
        }),
      );
    });

    const lessonList = el('div', { className: 'qv-course-lessons' });
    for (const lesson of mod.lessons) {
      const isDone = done.has(lesson.id);
      const chk = el('input', {
        attrs: { type: 'checkbox', checked: isDone, 'aria-label': `Complete ${lesson.title}` },
        on: {
          change: () => {
            toggleCourseLessonDone(lesson.id, chk.checked);
            renderDrawer();
          },
        },
      });

      lessonList.appendChild(
        el(
          'div',
          { className: `qv-course-lesson-card${isDone ? ' is-done' : ''}` },
          el(
            'div',
            { className: 'qv-course-lesson-head' },
            chk,
            el('strong', { text: lesson.title, style: { fontSize: '12.5px', flex: '1' } }),
            el('span', { className: 'bv-mono-tag', text: lesson.minTier.toUpperCase() }),
          ),
          el('p', {
            className: 'bv-label',
            text: lesson.instruction,
            style: { margin: '4px 0 8px', color: 'var(--text-secondary)' },
          }),
          el(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' } },
            el(
              'button',
              {
                className: 'bv-btn bv-btn-primary',
                style: { height: '26px', fontSize: '11.5px', padding: '0 10px' },
                attrs: { type: 'button' },
                on: { click: () => navigateToCourseLesson(actions, lesson) },
              },
              lesson.actionLabel,
            ),
            el('button', {
              className: 'bv-mini-btn',
              text: isDone ? 'Completed ✓' : 'Mark Done',
              attrs: { type: 'button' },
              on: {
                click: () => {
                  toggleCourseLessonDone(lesson.id, !isDone);
                  renderDrawer();
                },
              },
            }),
          ),
        ),
      );
    }

    drawer.append(
      el(
        'div',
        { className: 'bv-panel-head' },
        el(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
          icon('course', 15),
          el('span', { className: 'bv-panel-title', text: 'Practice Companion' }),
        ),
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
          el('span', { className: 'bv-mono-tag', text: `${summary.completed}/${summary.total} (${summary.pct}%)` }),
          el('button', {
            className: 'bv-mini-btn',
            text: 'Full Course',
            attrs: { type: 'button' },
            on: {
              click: () => {
                closeInteractiveCourseDrawer();
                actions.openCoursePage(mod.id);
              },
            },
          }),
          el('button', {
            className: 'bv-mini-btn',
            text: 'Close',
            attrs: { type: 'button' },
            on: { click: closeInteractiveCourseDrawer },
          }),
        ),
      ),
      el(
        'div',
        { className: 'qv-course-body' },
        modPills,
        el('h4', { text: `Module ${mod.number}: ${mod.title}`, style: { margin: '6px 0 2px', fontSize: '14px' } }),
        el('p', { className: 'bv-label', text: mod.summary, style: { margin: '0 0 8px' } }),
        lessonList,
      ),
      el(
        'div',
        { className: 'qv-course-footer' },
        el('button', {
          className: 'bv-btn',
          text: 'Previous Module',
          attrs: { type: 'button', disabled: activeModuleIndex === 0 },
          on: {
            click: () => {
              activeModuleIndex = Math.max(0, activeModuleIndex - 1);
              renderDrawer();
            },
          },
        }),
        el('button', {
          className: 'bv-btn bv-btn-primary',
          text: activeModuleIndex < COURSE_MODULES.length - 1 ? 'Next Module ->' : 'Finish Course',
          attrs: { type: 'button' },
          on: {
            click: () => {
              if (activeModuleIndex < COURSE_MODULES.length - 1) {
                activeModuleIndex++;
                renderDrawer();
              } else {
                closeInteractiveCourseDrawer();
                actions.notify('You completed all Quillvibe book-writing modules.');
              }
            },
          },
        }),
      ),
    );
  };

  activeCourseDrawer = drawer;
  document.body.appendChild(drawer);
  renderDrawer();
}
