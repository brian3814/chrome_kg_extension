import { create } from 'zustand';
import { nodeTypes as dbNodeTypes } from '../../db/client/db-client';
import { TYPE_COLOR_PALETTE, FALLBACK_TYPE_COLOR } from '../../shared/constants';
import type { NodeType } from '../../shared/types';

interface NodeTypeStore {
  types: NodeType[];
  loading: boolean;

  loadTypes: () => Promise<void>;
  createType: (input: { type: string; description?: string; color?: string }) => Promise<NodeType | null>;
  getColorForType: (type: string) => string;
}

export const useNodeTypeStore = create<NodeTypeStore>((set, get) => ({
  types: [],
  loading: false,

  loadTypes: async () => {
    set({ loading: true });
    try {
      const types = await dbNodeTypes.getAll();
      set({ types, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createType: async (input) => {
    try {
      const color = input.color ?? nextPaletteColor(get().types);
      const created = await dbNodeTypes.create({ ...input, color });
      set((state) => ({ types: [...state.types, created] }));
      return created;
    } catch {
      return null;
    }
  },

  getColorForType: (type: string) => {
    const found = get().types.find((t) => t.type === type);
    return found?.color ?? FALLBACK_TYPE_COLOR;
  },
}));

function nextPaletteColor(existing: NodeType[]): string {
  const usedColors = new Set(existing.map((t) => t.color));
  for (const color of TYPE_COLOR_PALETTE) {
    if (!usedColors.has(color)) return color;
  }
  // All palette colors used — cycle
  return TYPE_COLOR_PALETTE[existing.length % TYPE_COLOR_PALETTE.length];
}
