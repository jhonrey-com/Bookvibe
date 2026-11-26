import type { TypesetSubTab } from './app-context';
import type { StudioViewId } from './types';

export interface RouteMatch {
  view: StudioViewId;
  typesetSubTab?: TypesetSubTab;
  showStartSplash: boolean;
  canonicalPath: string;
}

const VIEW_TO_PATH: Record<StudioViewId, string> = {
  editor: '/write',
  corkboard: '/corkboard',
  outline: '/outline',
  bible: '/bible',
  graph: '/graph',
  typeset: '/studio',
  course: '/course',
  help: '/help',
  developer: '/developer',
  settings: '/settings',
  manual: '/manual',
};

export function resolvePathToRoute(pathname: string, isFirstWebVisit = false): RouteMatch {
  const clean = pathname.replace(/\/+$/, '').toLowerCase() || '/';

  if (clean === '/start') {
    return { view: 'editor', showStartSplash: true, canonicalPath: '/start' };
  }
  if (clean === '/' && isFirstWebVisit) {
    return { view: 'editor', showStartSplash: true, canonicalPath: '/start' };
  }
  if (clean === '/course' || clean.startsWith('/course/')) {
    return { view: 'course', showStartSplash: false, canonicalPath: '/course' };
  }
  if (clean === '/help' || clean.startsWith('/help/') || clean === '/faq' || clean.startsWith('/faq/')) {
    return { view: 'help', showStartSplash: false, canonicalPath: clean.startsWith('/faq') ? '/faq' : '/help' };
  }
  if (clean === '/developer' || clean.startsWith('/developer/') || clean === '/developers' || clean.startsWith('/developers/')) {
    return { view: 'developer', showStartSplash: false, canonicalPath: '/developer' };
  }
  if (clean === '/settings' || clean.startsWith('/settings/')) {
    return { view: 'settings', showStartSplash: false, canonicalPath: '/settings' };
  }
  if (clean === '/manual' || clean.startsWith('/manual/')) {
    return { view: 'manual', showStartSplash: false, canonicalPath: '/manual' };
  }
  if (clean === '/write' || clean === '/editor' || clean === '/') {
    return { view: 'editor', showStartSplash: false, canonicalPath: '/write' };
  }
  if (clean === '/corkboard') {
    return { view: 'corkboard', showStartSplash: false, canonicalPath: '/corkboard' };
  }
  if (clean === '/outline') {
    return { view: 'outline', showStartSplash: false, canonicalPath: '/outline' };
  }
  if (clean === '/bible') {
    return { view: 'bible', showStartSplash: false, canonicalPath: '/bible' };
  }
  if (clean === '/graph') {
    return { view: 'graph', showStartSplash: false, canonicalPath: '/graph' };
  }
  if (clean === '/studio/cover') {
    return { view: 'typeset', typesetSubTab: 'cover', showStartSplash: false, canonicalPath: '/studio/cover' };
  }
  if (clean === '/studio/publish') {
    return { view: 'typeset', typesetSubTab: 'publish', showStartSplash: false, canonicalPath: '/studio/publish' };
  }
  if (clean === '/studio' || clean === '/typeset') {
    return { view: 'typeset', typesetSubTab: 'interior', showStartSplash: false, canonicalPath: '/studio' };
  }
  return { view: 'editor', showStartSplash: false, canonicalPath: '/write' };
}

export function routeForState(view: StudioViewId, typesetSubTab: TypesetSubTab = 'interior'): string {
  if (view === 'typeset') {
    if (typesetSubTab === 'cover') return '/studio/cover';
    if (typesetSubTab === 'publish') return '/studio/publish';
    return '/studio';
  }
  return VIEW_TO_PATH[view] ?? '/write';
}

/**
 * Restores deep links forwarded from public/404.html (?qv_route=/start) on static hosts.
 */
export function readInitialBrowserRoute(isFirstWebVisit: boolean): RouteMatch {
  if (typeof window === 'undefined') {
    return { view: 'editor', showStartSplash: false, canonicalPath: '/write' };
  }
  const params = new URLSearchParams(window.location.search);
  const forwarded = params.get('qv_route');
  const rawPath = forwarded || window.location.pathname;
  const resolved = resolvePathToRoute(rawPath, isFirstWebVisit);

  if (
    forwarded ||
    window.location.pathname === '/' ||
    window.location.pathname === '/index.html'
  ) {
    try {
      window.history.replaceState({}, '', resolved.canonicalPath);
    } catch {
      // Ignore restricted history APIs (e.g. file://)
    }
  }
  return resolved;
}

export function syncBrowserPath(path: string, replace = false): void {
  if (typeof window === 'undefined' || window.location.protocol === 'file:' || window.location.protocol === 'tauri:') {
    return;
  }
  if (window.location.pathname === path) return;
  try {
    if (replace) {
      window.history.replaceState({}, '', path);
    } else {
      window.history.pushState({}, '', path);
    }
  } catch {
    // Ignore history API errors
  }
}
