import type { AppActions, AppState } from '../core/app-context';
import { isTauriRuntime } from '../core/bridge';
import { getAllScenes } from '../core/manuscript';
import type { AppThemeId } from '../core/types';
import { setCoursePageSelection } from '../views/course-page';
import { HELP_FAQ_ARTICLES, setHelpPageArticle, setHelpPageSearch } from '../views/help-page';
import { CONTROL_REFERENCE_ITEMS } from './controls-catalog';
import { COURSE_MODULES } from './course';
import { clearNode, el, icon, type IconName } from './dom';
import { QUILLVIBE_ERROR_CATALOG } from './error-dialog';

type SearchScope = 'all' | 'tools' | 'course' | 'help' | 'book';

interface SearchResultItem {
  id: string;
  group: 'Tools & Workspaces' | 'Book Writing Course' | 'Help, FAQ & Errors' | 'Manuscript & Story Bible';
  scope: Exclude<SearchScope, 'all'>;
  iconName: IconName;
  title: string;
  subtitle: string;
  badge: string;
  searchText: string;
  scoreBoost: number;
  run: () => void;
}

const MODAL_ID = 'qv-universal-search-modal';

function openCourseTarget(actions: AppActions, moduleId?: string, lessonId?: string): void {
  setCoursePageSelection(moduleId, lessonId);
  actions.setState({ activeView: 'course' }, true);
}

function openHelpTarget(actions: AppActions, options: { articleId?: string; query?: string }): void {
  if (options.articleId) {
    setHelpPageArticle(options.articleId);
  } else if (options.query) {
    setHelpPageSearch(options.query);
  }
  actions.setState({ activeView: 'help' }, true);
}

function buildSearchCorpus(actions: AppActions, state: AppState): SearchResultItem[] {
  const items: SearchResultItem[] = [];

  const ensureTier = (minTier: 'intermediate' | 'advanced') => {
    const cur = state.settings.toolTier;
    if (minTier === 'advanced' && cur !== 'advanced') {
      actions.updateSettings({ toolTier: 'advanced' });
    } else if (minTier === 'intermediate' && cur === 'basic') {
      actions.updateSettings({ toolTier: 'intermediate' });
    }
  };

  // 1. Studio Tools, Views & Quick Actions
  const toolEntries: Array<{
    id: string;
    iconName: IconName;
    title: string;
    subtitle: string;
    badge: string;
    keywords: string;
    boost?: number;
    run: () => void;
  }> = [
    {
      id: 'tool-editor',
      iconName: 'quill',
      title: 'Manuscript Writing Sheet',
      subtitle: 'Draft chapters, toggle Proofread marks, Split View, and Revision Diff.',
      badge: 'Workspace',
      keywords: 'write draft manuscript scene proofread split diff',
      boost: 15,
      run: () => actions.setState({ activeView: 'editor' }, true),
    },
    {
      id: 'tool-corkboard',
      iconName: 'corkboard',
      title: 'Corkboard Scene Cards',
      subtitle: 'Arrange scenes visually and track scene word targets.',
      badge: 'Editorial',
      keywords: 'corkboard cards synopsis index arrange reorder',
      boost: 12,
      run: () => {
        ensureTier('intermediate');
        actions.setState({ activeView: 'corkboard' }, true);
      },
    },
    {
      id: 'tool-outline',
      iconName: 'outline',
      title: 'Outline Ledger',
      subtitle: 'Filter scenes by POV, status, timeline, location, or export CSV.',
      badge: 'Editorial',
      keywords: 'outline ledger table csv pacing status pov timeline',
      boost: 12,
      run: () => {
        ensureTier('intermediate');
        actions.setState({ activeView: 'outline' }, true);
      },
    },
    {
      id: 'tool-bible',
      iconName: 'bible',
      title: 'Story Bible',
      subtitle: 'Manage Characters, Locations, Lore, Portraits, and custom world shelves.',
      badge: 'Full Studio',
      keywords: 'story bible characters locations lore worldbuilding wiki',
      boost: 12,
      run: () => {
        ensureTier('advanced');
        actions.setState({ activeView: 'bible' }, true);
      },
    },
    {
      id: 'tool-graph',
      iconName: 'graph',
      title: 'Story Graph',
      subtitle: 'Spatial Storyboard & 60 FPS Force Graph synced to your book.',
      badge: 'Full Studio',
      keywords: 'story graph nodes canvas storyboard force mindmap',
      boost: 12,
      run: () => {
        ensureTier('advanced');
        actions.setState({ activeView: 'graph' }, true);
      },
    },
    {
      id: 'tool-typeset',
      iconName: 'typeset',
      title: 'Interior Typeset (Print PDF & EPUB 3)',
      subtitle: 'Configure trim size, margins, drop caps, running headers, and typography.',
      badge: 'Editorial',
      keywords: 'typeset print pdf epub trim font margin drop cap interior',
      boost: 12,
      run: () => {
        ensureTier('intermediate');
        actions.setState({ activeView: 'typeset', typesetSubTab: 'interior' }, true);
      },
    },
    {
      id: 'tool-cover',
      iconName: 'cover',
      title: 'Book Cover Studio',
      subtitle: 'Design front, spine, back, and dust-jacket wraps with PNG/SVG/PDF export.',
      badge: 'Full Studio',
      keywords: 'book cover studio spine jacket wrap vector svg png qvdesign',
      boost: 13,
      run: () => {
        ensureTier('advanced');
        actions.setState({ activeView: 'typeset', typesetSubTab: 'cover' }, true);
      },
    },
    {
      id: 'tool-publish',
      iconName: 'printer',
      title: 'Publish, Seals & Archive Export',
      subtitle: 'Export Print PDF, EPUB 3, .docx, .qv archive, ISBN, and Copyright Seals.',
      badge: 'Publishing',
      keywords: 'publish export docx pdf epub qv isbn seal copyright key',
      boost: 11,
      run: () => {
        ensureTier('intermediate');
        actions.setState({ activeView: 'typeset', typesetSubTab: 'publish' }, true);
      },
    },
    {
      id: 'tool-library',
      iconName: 'library',
      title: 'Book Library & Author Identity',
      subtitle: 'Switch books, create a new book, or configure Pen Name & Author Key.',
      badge: 'Modal',
      keywords: 'library switch book create new author key pen name signature',
      boost: 11,
      run: () => actions.openLibraryModal(),
    },
    {
      id: 'tool-collab',
      iconName: 'collab',
      title: 'Collaborate Offline & Co-Authors',
      subtitle: 'Manage co-author roles, proofreader permissions, and LAN / HTTPS sync.',
      badge: 'Full Studio',
      keywords: 'collaborate wifi bluetooth pin co-author proofreader permissions sync',
      boost: 10,
      run: () => actions.openCollabModal(),
    },
    {
      id: 'tool-course',
      iconName: 'course',
      title: 'Quillvibe Academy (Book Writing Course)',
      subtitle: `${COURSE_MODULES.length} structured modules covering craft, worldbuilding, cover & publishing.`,
      badge: 'Academy',
      keywords: 'course academy lessons learn writing dialogue pacing tutorial',
      boost: 12,
      run: () => openCourseTarget(actions),
    },
    {
      id: 'tool-help',
      iconName: 'help',
      title: 'Help Center, FAQ & Error Codes',
      subtitle: 'Browse guides, QV error diagnostics, file formats, and web/desktop help.',
      badge: 'Help',
      keywords: 'help faq support error code qv manual troubleshooting',
      boost: 12,
      run: () => actions.setState({ activeView: 'help' }, true),
    },
    {
      id: 'tool-settings',
      iconName: 'settings',
      title: 'Settings, Layouts, Fonts & Updates',
      subtitle: 'Change theme, Workspace Layout, custom fonts (.ttf/.otf/.woff2), or backup archives.',
      badge: 'Settings',
      keywords: 'settings preferences theme dark light parchment ivory fonts updates layout',
      boost: 11,
      run: () => actions.setState({ activeView: 'settings' }, true),
    },
    {
      id: 'tool-extensions',
      iconName: 'extensions',
      title: 'Extensions & Official .qv* Formats',
      subtitle: 'Inspect .qv / .qvbible / .qvscene / .qvstyle / .qvdesign or load .qvext packs.',
      badge: 'Formats',
      keywords: 'extensions qvext formats qv qvbible qvscene qvstyle qvdesign',
      boost: 9,
      run: () => actions.setState({ activeView: 'extensions' }, true),
    },
    {
      id: 'tool-theme',
      iconName: 'palette',
      title: 'Switch Theme (System / Ivory / Parchment / Obsidian)',
      subtitle: 'Cycle through Quillvibe paper and studio color themes smoothly.',
      badge: 'Action',
      keywords: 'theme dark mode light mode ivory parchment obsidian switch cycle',
      boost: 10,
      run: () => {
        const order: AppThemeId[] = ['system', 'ivory', 'parchment', 'obsidian'];
        const cur = actions.getState().settings.appTheme;
        const next = order[(order.indexOf(cur) + 1) % order.length];
        actions.updateSettings({ appTheme: next });
        actions.notify(`Theme: ${next}`);
      },
    },
    {
      id: 'tool-open-file',
      iconName: 'folder',
      title: 'Open .qv / .qvscene / .qvext File',
      subtitle: 'Load a saved Quillvibe file from your computer (Ctrl+O).',
      badge: 'Ctrl+O',
      keywords: 'open file load import qv qvbible qvscene',
      boost: 8,
      run: () => void actions.openAnyQuillvibeFile(),
    },
  ];

  if (!isTauriRuntime()) {
    toolEntries.push({
      id: 'tool-landing',
      iconName: 'book',
      title: 'Overview & Landing Page',
      subtitle: 'View Quillvibe features overview, README links, and desktop downloads.',
      badge: 'Home',
      keywords: 'landing home overview download windows mac linux readme open source',
      boost: 8,
      run: () => actions.setState({ activeView: 'landing' }, true),
    });
  }

  for (const t of toolEntries) {
    items.push({
      id: t.id,
      group: 'Tools & Workspaces',
      scope: 'tools',
      iconName: t.iconName,
      title: t.title,
      subtitle: t.subtitle,
      badge: t.badge,
      searchText: `${t.title} ${t.subtitle} ${t.keywords}`.toLowerCase(),
      scoreBoost: t.boost ?? 10,
      run: t.run,
    });
  }

  // 2. Book Writing Course Modules & Lessons
  for (const mod of COURSE_MODULES) {
    for (const lesson of mod.lessons) {
      items.push({
        id: `course-${lesson.id}`,
        group: 'Book Writing Course',
        scope: 'course',
        iconName: 'course',
        title: lesson.title,
        subtitle: `Module ${mod.number}: ${mod.title} — ${lesson.instruction}`,
        badge: `${lesson.durationMin}m`,
        searchText: `${mod.title} ${lesson.title} ${lesson.instruction} ${lesson.objective} ${lesson.proTip} ${lesson.minTier}`.toLowerCase(),
        scoreBoost: 7,
        run: () => openCourseTarget(actions, mod.id, lesson.id),
      });
    }
  }

  // 3. Help Articles, Error Codes & Controls
  for (const art of HELP_FAQ_ARTICLES) {
    items.push({
      id: `help-${art.id}`,
      group: 'Help, FAQ & Errors',
      scope: 'help',
      iconName: 'help',
      title: art.title,
      subtitle: art.summary,
      badge: art.category,
      searchText: `${art.title} ${art.category} ${art.summary} ${art.keywords} ${art.details.join(' ')}`.toLowerCase(),
      scoreBoost: 8,
      run: () => openHelpTarget(actions, { articleId: art.id }),
    });
  }

  for (const err of QUILLVIBE_ERROR_CATALOG) {
    items.push({
      id: `err-${err.code}`,
      group: 'Help, FAQ & Errors',
      scope: 'help',
      iconName: 'shield',
      title: `${err.code}: ${err.title}`,
      subtitle: err.fix,
      badge: err.category,
      searchText: `${err.code} ${err.title} ${err.category} ${err.cause} ${err.fix}`.toLowerCase(),
      scoreBoost: 9,
      run: () => openHelpTarget(actions, { query: err.code }),
    });
  }

  for (const ctrl of CONTROL_REFERENCE_ITEMS) {
    items.push({
      id: `ctrl-${ctrl.id}`,
      group: 'Help, FAQ & Errors',
      scope: 'help',
      iconName: 'settings',
      title: ctrl.name,
      subtitle: `${ctrl.location} — ${ctrl.summary}`,
      badge: ctrl.controlType,
      searchText: `${ctrl.name} ${ctrl.category} ${ctrl.location} ${ctrl.summary} ${ctrl.keywords}`.toLowerCase(),
      scoreBoost: 5,
      run: () => openHelpTarget(actions, { query: ctrl.name }),
    });
  }

  // 4. Current Book Chapters, Scenes & Story Bible Entries
  const scenes = getAllScenes(state.project);
  for (const ref of scenes) {
    const snippet = ref.scene.synopsis?.trim() || ref.scene.content.slice(0, 110).replace(/\s+/g, ' ').trim();
    items.push({
      id: `scene-${ref.scene.id}`,
      group: 'Manuscript & Story Bible',
      scope: 'book',
      iconName: 'draft-sheet',
      title: ref.scene.title || 'Untitled Scene',
      subtitle: `${ref.chapter.title} · ${snippet || 'Empty scene draft'}`,
      badge: ref.scene.status.toUpperCase(),
      searchText: `${ref.part.title} ${ref.chapter.title} ${ref.scene.title} ${ref.scene.synopsis} ${ref.scene.pov} ${ref.scene.location} ${ref.scene.content.slice(0, 1500)}`.toLowerCase(),
      scoreBoost: 9,
      run: () => actions.selectScene(ref.scene.id, true),
    });
  }

  for (const ch of state.project.bible.characters) {
    items.push({
      id: `bible-char-${ch.id}`,
      group: 'Manuscript & Story Bible',
      scope: 'book',
      iconName: 'bible',
      title: ch.name,
      subtitle: `${ch.role || 'Character'} — ${ch.motivation || ch.notes || ''}`.trim(),
      badge: 'Character',
      searchText: `${ch.name} ${ch.aliases} ${ch.role} ${ch.motivation} ${ch.appearance} ${ch.notes}`.toLowerCase(),
      scoreBoost: 8,
      run: () => {
        ensureTier('advanced');
        actions.openBibleEntry('characters', ch.id);
      },
    });
  }

  for (const loc of state.project.bible.locations) {
    items.push({
      id: `bible-loc-${loc.id}`,
      group: 'Manuscript & Story Bible',
      scope: 'book',
      iconName: 'bible',
      title: loc.name,
      subtitle: `${loc.region || 'Location'} — ${loc.atmosphere || loc.notes || ''}`.trim(),
      badge: 'Location',
      searchText: `${loc.name} ${loc.region} ${loc.atmosphere} ${loc.notes}`.toLowerCase(),
      scoreBoost: 8,
      run: () => {
        ensureTier('advanced');
        actions.openBibleEntry('locations', loc.id);
      },
    });
  }

  for (const lore of state.project.bible.lore) {
    items.push({
      id: `bible-lore-${lore.id}`,
      group: 'Manuscript & Story Bible',
      scope: 'book',
      iconName: 'bible',
      title: lore.name,
      subtitle: `${lore.category || 'Lore'} — ${lore.summary || lore.notes || ''}`.trim(),
      badge: 'Lore',
      searchText: `${lore.name} ${lore.category} ${lore.summary} ${lore.notes}`.toLowerCase(),
      scoreBoost: 8,
      run: () => {
        ensureTier('advanced');
        actions.openBibleEntry('lore', lore.id);
      },
    });
  }

  for (const custom of state.project.bible.customEntries ?? []) {
    items.push({
      id: `bible-custom-${custom.id}`,
      group: 'Manuscript & Story Bible',
      scope: 'book',
      iconName: 'bible',
      title: custom.name,
      subtitle: custom.subtitle || custom.summary || custom.notes || 'Story Bible Entry',
      badge: 'Bible',
      searchText: `${custom.name} ${custom.subtitle} ${custom.summary} ${custom.notes}`.toLowerCase(),
      scoreBoost: 8,
      run: () => {
        ensureTier('advanced');
        actions.openBibleEntry(custom.categoryId, custom.id);
      },
    });
  }

  return items;
}

function scoreMatch(item: SearchResultItem, query: string): number {
  if (!query) return item.scoreBoost;
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return item.scoreBoost;

  const titleLower = item.title.toLowerCase();
  if (!terms.every((t) => item.searchText.includes(t))) {
    return -1;
  }

  let score = item.scoreBoost;
  if (titleLower === query.toLowerCase()) score += 45;
  else if (titleLower.startsWith(query.toLowerCase())) score += 28;
  for (const term of terms) {
    if (titleLower.includes(term)) score += 14;
  }
  return score;
}

export function openUniversalSearch(actions: AppActions, getState: () => AppState): void {
  const existing = document.getElementById(MODAL_ID);
  if (existing) {
    existing.remove();
    return;
  }

  const corpus = buildSearchCorpus(actions, getState());
  let activeScope: SearchScope = 'all';
  let query = '';
  let activeIndex = 0;
  let visibleResults: SearchResultItem[] = [];

  const backdrop = el('div', {
    className: 'bv-modal-backdrop qv-usearch-backdrop',
    id: MODAL_ID,
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Universal Search' },
  });

  const closeModal = () => {
    window.removeEventListener('keydown', onModalKey, true);
    backdrop.remove();
  };

  backdrop.addEventListener('pointerdown', (e) => {
    if (e.target === backdrop) closeModal();
  });
  backdrop.addEventListener('bv-close-modal', closeModal);

  const searchInput = el('input', {
    className: 'qv-usearch-input',
    attrs: {
      type: 'search',
      placeholder: 'Search courses, FAQs, error codes, scenes, characters, or tools…',
      'aria-label': 'Search across Quillvibe',
    },
  });

  const scopeBar = el('div', { className: 'qv-usearch-scopes' });
  const resultsEl = el('div', { className: 'qv-usearch-results', attrs: { role: 'listbox' } });
  const footerHint = el('div', {
    className: 'qv-usearch-footer',
    text: '↑↓ Select · Enter Open · Esc Close',
  });

  const renderScopes = () => {
    clearNode(scopeBar);
    const scopes: Array<{ id: SearchScope; label: string }> = [
      { id: 'all', label: 'All' },
      { id: 'tools', label: 'Tools' },
      { id: 'course', label: 'Courses' },
      { id: 'help', label: 'Help & FAQ' },
      { id: 'book', label: 'Current Book' },
    ];
    for (const s of scopes) {
      scopeBar.appendChild(
        el('button', {
          className: `bv-mini-btn${activeScope === s.id ? ' is-active' : ''}`,
          text: s.label,
          attrs: { type: 'button' },
          on: {
            click: () => {
              activeScope = s.id;
              activeIndex = 0;
              renderResults();
              renderScopes();
              searchInput.focus();
            },
          },
        }),
      );
    }
  };

  const executeItem = (item: SearchResultItem) => {
    closeModal();
    item.run();
  };

  const renderResults = () => {
    clearNode(resultsEl);
    const trimmed = query.trim();
    const scored: Array<{ item: SearchResultItem; score: number }> = [];
    for (const item of corpus) {
      if (activeScope !== 'all' && item.scope !== activeScope) continue;
      const sc = scoreMatch(item, trimmed);
      if (sc >= 0) scored.push({ item, score: sc });
    }
    scored.sort((a, b) => b.score - a.score);
    visibleResults = scored.slice(0, trimmed ? 36 : 16).map((s) => s.item);

    if (visibleResults.length === 0) {
      resultsEl.appendChild(
        el(
          'div',
          { className: 'qv-usearch-empty' },
          el('strong', { text: `No matches for “${trimmed}”` }),
          el('p', {
            className: 'bv-label',
            text: 'Try another keyword like Cover Studio, Dialogue, QV-102, .qvdesign, or a character name.',
          }),
        ),
      );
      return;
    }

    if (activeIndex >= visibleResults.length) {
      activeIndex = 0;
    }

    let lastGroup = '';
    visibleResults.forEach((item, idx) => {
      if (item.group !== lastGroup) {
        lastGroup = item.group;
        resultsEl.appendChild(
          el('div', { className: 'qv-usearch-group-label', text: lastGroup }),
        );
      }

      const row = el(
        'button',
        {
          className: `qv-usearch-row${idx === activeIndex ? ' is-selected' : ''}`,
          attrs: {
            type: 'button',
            role: 'option',
            'aria-selected': String(idx === activeIndex),
          },
          on: {
            mouseenter: () => {
              activeIndex = idx;
              const rows = resultsEl.querySelectorAll('.qv-usearch-row');
              rows.forEach((r, rIdx) => r.classList.toggle('is-selected', rIdx === idx));
            },
            click: () => executeItem(item),
          },
        },
        el('span', { className: 'qv-usearch-row-icon' }, icon(item.iconName, 15)),
        el(
          'div',
          { className: 'qv-usearch-row-copy' },
          el('div', { className: 'qv-usearch-row-title', text: item.title }),
          el('div', { className: 'qv-usearch-row-sub', text: item.subtitle }),
        ),
        el('span', { className: 'bv-mono-tag qv-usearch-row-badge', text: item.badge }),
      );
      resultsEl.appendChild(row);
    });
  };

  function onModalKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
      return;
    }
    if (visibleResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % visibleResults.length;
      renderResults();
      resultsEl.querySelector('.qv-usearch-row.is-selected')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + visibleResults.length) % visibleResults.length;
      renderResults();
      resultsEl.querySelector('.qv-usearch-row.is-selected')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      const target = visibleResults[activeIndex];
      if (target) {
        e.preventDefault();
        executeItem(target);
      }
    }
  }

  searchInput.addEventListener('input', () => {
    query = searchInput.value;
    activeIndex = 0;
    renderResults();
  });

  const panel = el(
    'div',
    { className: 'qv-usearch-dialog' },
    el(
      'div',
      { className: 'qv-usearch-input-wrap' },
      icon('search', 16),
      searchInput,
      el('button', {
        className: 'bv-mini-btn',
        text: 'Esc',
        attrs: { type: 'button', 'aria-label': 'Close Search' },
        on: { click: closeModal },
      }),
    ),
    scopeBar,
    resultsEl,
    footerHint,
  );

  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);
  window.addEventListener('keydown', onModalKey, true);
  renderScopes();
  renderResults();
  requestAnimationFrame(() => searchInput.focus());
}
