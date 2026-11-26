import type { AppActions } from '../core/app-context';
import {
  getDesktopRuntimeInfo,
  isTauriRuntime,
  listenDesktopMenuAction,
} from '../core/bridge';

let desktopShellCleanup: (() => void) | null = null;

/**
 * Mounts native desktop integrations (Rust menu bar actions, desktop zoom guard,
 * and runtime diagnostics binding) cleanly separate from the browser web bundle.
 */
export async function mountDesktopShell(actions: AppActions): Promise<() => void> {
  desktopShellCleanup?.();

  if (typeof document !== 'undefined') {
    document.documentElement.dataset.runtime = 'desktop';
  }

  if (!isTauriRuntime()) {
    desktopShellCleanup = () => {};
    return desktopShellCleanup;
  }

  const unlistenMenu = await listenDesktopMenuAction((actionId) => {
    switch (actionId) {
      case 'new-window':
        void actions.openNewWindow();
        break;
      case 'open-file':
        void actions.openAnyQuillvibeFile();
        break;
      case 'save-snapshot':
        actions.createSnapshot();
        break;
      case 'export-default':
        void actions.exportDefaultFormat();
        break;
      case 'settings':
        actions.openSettingsModal('editor');
        break;
      case 'extensions':
        actions.openExtensionsModal('integrated');
        break;
      case 'manual':
        actions.openHelpModal('reference');
        break;
      case 'course':
        actions.openCoursePage();
        break;
      case 'undo':
        actions.undo();
        break;
      case 'redo':
        actions.redo();
        break;
      case 'toggle-binder':
        actions.setState({ showBinder: !actions.getState().showBinder }, false);
        break;
      case 'toggle-inspector':
        actions.setState({ showInspector: !actions.getState().showInspector }, false);
        break;
      case 'toggle-fullscreen':
        void actions.toggleImmersiveMode();
        break;
      case 'combine-windows':
        actions.mergeAllWindowsHere();
        break;
      default:
        break;
    }
  });

  // Prevent WebView2 default browser zoom/navigation shortcuts outside spatial boards
  const onDesktopKeydown = (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const view = actions.getState().activeView;
    const subTab = actions.getState().typesetSubTab;
    const isSpatialBoard =
      view === 'graph' || (view === 'typeset' && subTab === 'cover');
    if (isSpatialBoard) return;
    if (
      e.key === '=' ||
      e.key === '+' ||
      e.key === '-' ||
      e.key === '_' ||
      e.key === '0'
    ) {
      e.preventDefault();
    }
  };
  window.addEventListener('keydown', onDesktopKeydown, { capture: true });

  void getDesktopRuntimeInfo();

  desktopShellCleanup = () => {
    unlistenMenu();
    window.removeEventListener('keydown', onDesktopKeydown, { capture: true });
  };
  return desktopShellCleanup;
}
