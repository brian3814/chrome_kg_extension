import { create } from 'zustand';
import type { DisplayMode } from '../../shared/types';

type ActivePanel = 'none' | 'nodeDetail' | 'edgeDetail' | 'create' | 'search' | 'llm' | 'settings';
type LayoutType = string;

interface UIStore {
  displayMode: DisplayMode;
  activePanel: ActivePanel;
  layoutType: LayoutType;
  is3D: boolean;
  clusteringEnabled: boolean;
  graphKey: number; // increment to force graph re-render

  setDisplayMode: (mode: DisplayMode) => void;
  setActivePanel: (panel: ActivePanel) => void;
  setLayoutType: (layout: LayoutType) => void;
  toggle3D: () => void;
  toggleClustering: () => void;
  incrementGraphKey: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  displayMode: 'sidePanel',
  activePanel: 'none',
  layoutType: 'forceDirected2d',
  is3D: false,
  clusteringEnabled: true,
  graphKey: 0,

  setDisplayMode: (mode) => set({ displayMode: mode }),
  setActivePanel: (panel) =>
    set((state) => ({
      activePanel: state.activePanel === panel ? 'none' : panel,
    })),
  setLayoutType: (layout) => set({ layoutType: layout }),
  toggle3D: () =>
    set((state) => {
      const is3D = !state.is3D;
      return {
        is3D,
        layoutType: is3D ? 'forceDirected3d' : 'forceDirected2d',
      };
    }),
  toggleClustering: () =>
    set((state) => ({ clusteringEnabled: !state.clusteringEnabled })),
  incrementGraphKey: () =>
    set((state) => ({ graphKey: state.graphKey + 1 })),
}));
