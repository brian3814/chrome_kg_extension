import { useState, useEffect, useCallback } from 'react';
import type { DisplayMode } from '../../shared/types';
import { DISPLAY_MODE_STORAGE_KEY, SIDE_PANEL_WIDTH_THRESHOLD } from '../../shared/constants';

export function useDisplayMode() {
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    // Check URL param first
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'tab' || mode === 'sidePanel') return mode;

    // Heuristic: side panel is typically narrow
    return window.innerWidth < SIDE_PANEL_WIDTH_THRESHOLD ? 'sidePanel' : 'tab';
  });

  useEffect(() => {
    const handleResize = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode')) return; // Don't override explicit mode

      const newMode: DisplayMode =
        window.innerWidth < SIDE_PANEL_WIDTH_THRESHOLD ? 'sidePanel' : 'tab';
      setDisplayMode(newMode);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleMode = useCallback(async () => {
    const newMode: DisplayMode =
      displayMode === 'sidePanel' ? 'tab' : 'sidePanel';

    // Persist preference
    try {
      await chrome.storage.local.set({ [DISPLAY_MODE_STORAGE_KEY]: newMode });
    } catch (e) {
      // Not in extension context
    }

    // Ask service worker to open the other view
    try {
      await chrome.runtime.sendMessage({
        type: 'TOGGLE_DISPLAY_MODE',
        payload: { currentMode: displayMode },
      });
    } catch (e) {
      // Fallback: just change mode in-place
      setDisplayMode(newMode);
    }
  }, [displayMode]);

  return { displayMode, toggleMode };
}
