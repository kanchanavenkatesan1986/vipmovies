import { useEffect } from 'react';

export function useKeyboardShortcuts(actions = {}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Don't intercept inside text inputs or textareas unless Ctrl combo
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

      if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
          case 'n':
            event.preventDefault();
            if (actions.onNewMovie) actions.onNewMovie();
            break;
          case 's':
            event.preventDefault();
            if (actions.onSave) actions.onSave();
            break;
          case 'f':
            event.preventDefault();
            if (actions.onSearch) actions.onSearch();
            break;
          default:
            break;
        }
      } else {
        if (!isInput) {
          if (event.key === 'Delete' && actions.onDelete) {
            event.preventDefault();
            actions.onDelete();
          }
          if (event.key === '?' && actions.onShowHelp) {
            event.preventDefault();
            actions.onShowHelp();
          }
        }
        if (event.key === 'Escape' && actions.onEscape) {
          actions.onEscape();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);
}
