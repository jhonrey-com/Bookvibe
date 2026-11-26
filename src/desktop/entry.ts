import { bootQuillvibeApp } from '../main';
import { mountDesktopShell } from './desktop-shell';

if (typeof window !== 'undefined') {
  (window as unknown as { __QUILLVIBE_MANUAL_BOOT__?: boolean }).__QUILLVIBE_MANUAL_BOOT__ = true;
}

if (typeof document !== 'undefined') {
  document.documentElement.dataset.runtime = 'desktop';
}

void bootQuillvibeApp().then((appActions) => mountDesktopShell(appActions));
