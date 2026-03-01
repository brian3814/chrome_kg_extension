// Database row types
export interface DbNode {
  id: string;
  identifier: string | null;
  label: string;
  type: string;
  properties: string; // JSON string
  x: number | null;
  y: number | null;
  z: number | null;
  color: string | null;
  size: number;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbEdge {
  id: string;
  source_id: string;
  target_id: string;
  label: string;
  type: string;
  properties: string; // JSON string
  weight: number;
  directed: number; // 0 or 1
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbEntityAlias {
  id: string;
  node_id: string;
  alias: string;
  alias_lower: string;
}

export interface DbExtractionLog {
  id: string;
  source_url: string | null;
  source_text: string | null;
  provider: string;
  model: string;
  raw_output: string | null;
  nodes_added: number;
  edges_added: number;
  created_at: string;
}

// Application types (parsed from DB rows)
export interface GraphNode {
  id: string;
  identifier: string | null;
  label: string;
  type: string;
  properties: Record<string, unknown>;
  x?: number;
  y?: number;
  z?: number;
  color?: string;
  size: number;
  sourceUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  type: string;
  properties: Record<string, unknown>;
  weight: number;
  directed: boolean;
  sourceUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Input types for creating/updating
export interface CreateNodeInput {
  label: string;
  type?: string;
  identifier?: string;
  properties?: Record<string, unknown>;
  color?: string;
  size?: number;
  sourceUrl?: string;
}

export interface UpdateNodeInput {
  id: string;
  label?: string;
  type?: string;
  properties?: Record<string, unknown>;
  x?: number;
  y?: number;
  z?: number;
  color?: string;
  size?: number;
}

export interface CreateEdgeInput {
  sourceId: string;
  targetId: string;
  label: string;
  type?: string;
  properties?: Record<string, unknown>;
  weight?: number;
  directed?: boolean;
  sourceUrl?: string;
}

export interface UpdateEdgeInput {
  id: string;
  label?: string;
  type?: string;
  properties?: Record<string, unknown>;
  weight?: number;
}

// LLM types
export type LLMProvider = 'openai' | 'anthropic';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
}

export interface ExtractionResult {
  nodes: Array<{
    label: string;
    type: string;
    properties?: Record<string, unknown>;
  }>;
  edges: Array<{
    sourceLabel: string;
    targetLabel: string;
    label: string;
    type?: string;
  }>;
}

export interface DiffItem {
  action: 'add' | 'merge' | 'skip';
  type: 'node' | 'edge';
  extracted: ExtractionResult['nodes'][0] | ExtractionResult['edges'][0];
  existingMatch?: GraphNode | GraphEdge;
  accepted: boolean;
}

export interface ExtractionDiff {
  items: DiffItem[];
}

// Node type (from ontology_node_types table)
export interface NodeType {
  type: string;
  description: string | null;
  color: string | null;
}

// Display mode
export type DisplayMode = 'sidePanel' | 'tab';

// Settings
export interface AppSettings {
  displayMode: DisplayMode;
  llmConfig?: LLMConfig;
  clusteringEnabled: boolean;
  defaultLayout: string;
}
