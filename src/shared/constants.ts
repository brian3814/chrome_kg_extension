export const DB_NAME = 'kg_extension.db';

export const NODE_TYPE_COLORS: Record<string, string> = {
  person: '#4F46E5',     // indigo
  organization: '#059669', // emerald
  location: '#D97706',   // amber
  event: '#DC2626',      // red
  concept: '#7C3AED',    // violet
  technology: '#0891B2', // cyan
  document: '#65A30D',   // lime
  entity: '#6B7280',     // gray (default)
};

export const DEFAULT_NODE_SIZE = 1.0;
export const DEFAULT_EDGE_WEIGHT = 1.0;

export const SUBGRAPH_DEFAULT_HOPS = 2;
export const SUBGRAPH_MAX_HOPS = 5;

export const SEARCH_RESULT_LIMIT = 50;

export const DB_REQUEST_TIMEOUT_MS = 10_000;

export const LLM_MODELS = {
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { id: 'claude-haiku-4-20250414', label: 'Claude Haiku 4' },
  ],
} as const;

export const OFFSCREEN_KEEPALIVE_INTERVAL_MS = 20_000;

export const DISPLAY_MODE_STORAGE_KEY = 'displayMode';
export const LLM_CONFIG_STORAGE_KEY = 'llmConfig';

export const SIDE_PANEL_WIDTH_THRESHOLD = 500;

export const LAYOUT_OPTIONS = [
  { id: 'forceDirected2d', label: 'Force Directed 2D' },
  { id: 'forceDirected3d', label: 'Force Directed 3D' },
  { id: 'treeTd2d', label: 'Tree (Top Down)' },
  { id: 'treeLr2d', label: 'Tree (Left Right)' },
  { id: 'radialOut2d', label: 'Radial' },
  { id: 'hierarchicalTd', label: 'Hierarchical' },
] as const;
