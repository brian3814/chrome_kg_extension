import { create } from 'zustand';
import { nodes as dbNodes, edges as dbEdges } from '../../db/client/db-client';
import type { GraphNode, GraphEdge, GraphData, CreateNodeInput, UpdateNodeInput, CreateEdgeInput, UpdateEdgeInput, DbNode, DbEdge } from '../../shared/types';

function dbNodeToGraphNode(row: DbNode): GraphNode {
  return {
    id: row.id,
    identifier: row.identifier,
    label: row.label,
    type: row.type,
    properties: JSON.parse(row.properties || '{}'),
    x: row.x ?? undefined,
    y: row.y ?? undefined,
    z: row.z ?? undefined,
    color: row.color ?? undefined,
    size: row.size,
    sourceUrl: row.source_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function dbEdgeToGraphEdge(row: DbEdge): GraphEdge {
  return {
    id: row.id,
    sourceId: row.source_id,
    targetId: row.target_id,
    label: row.label,
    type: row.type,
    properties: JSON.parse(row.properties || '{}'),
    weight: row.weight,
    directed: row.directed === 1,
    sourceUrl: row.source_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface GraphStore {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  loadAll: () => Promise<void>;
  createNode: (input: CreateNodeInput) => Promise<GraphNode | null>;
  updateNode: (input: UpdateNodeInput) => Promise<GraphNode | null>;
  deleteNode: (id: string) => Promise<boolean>;
  createEdge: (input: CreateEdgeInput) => Promise<GraphEdge | null>;
  updateEdge: (input: UpdateEdgeInput) => Promise<GraphEdge | null>;
  deleteEdge: (id: string) => Promise<boolean>;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  clearSelection: () => void;
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  loading: false,
  error: null,

  loadAll: async () => {
    set({ loading: true, error: null });
    try {
      const [nodeRows, edgeRows] = await Promise.all([
        dbNodes.getAll(),
        dbEdges.getAll(),
      ]);
      set({
        nodes: nodeRows.map(dbNodeToGraphNode),
        edges: edgeRows.map(dbEdgeToGraphEdge),
        loading: false,
      });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  createNode: async (input) => {
    try {
      const row = await dbNodes.create({
        label: input.label,
        type: input.type,
        properties: JSON.stringify(input.properties ?? {}),
        color: input.color,
        size: input.size,
        sourceUrl: input.sourceUrl,
      });
      if (!row) return null;
      const node = dbNodeToGraphNode(row);
      set((state) => ({ nodes: [...state.nodes, node] }));
      return node;
    } catch (e: any) {
      set({ error: e.message });
      return null;
    }
  },

  updateNode: async (input) => {
    try {
      const row = await dbNodes.update({
        id: input.id,
        label: input.label,
        type: input.type,
        properties: input.properties ? JSON.stringify(input.properties) : undefined,
        x: input.x,
        y: input.y,
        z: input.z,
        color: input.color,
        size: input.size,
      });
      if (!row) return null;
      const node = dbNodeToGraphNode(row);
      set((state) => ({
        nodes: state.nodes.map((n) => (n.id === node.id ? node : n)),
      }));
      return node;
    } catch (e: any) {
      set({ error: e.message });
      return null;
    }
  },

  deleteNode: async (id) => {
    try {
      const success = await dbNodes.delete(id);
      if (success) {
        set((state) => ({
          nodes: state.nodes.filter((n) => n.id !== id),
          edges: state.edges.filter(
            (e) => e.sourceId !== id && e.targetId !== id
          ),
          selectedNodeId:
            state.selectedNodeId === id ? null : state.selectedNodeId,
        }));
      }
      return success;
    } catch (e: any) {
      set({ error: e.message });
      return false;
    }
  },

  createEdge: async (input) => {
    try {
      const row = await dbEdges.create({
        sourceId: input.sourceId,
        targetId: input.targetId,
        label: input.label,
        type: input.type,
        properties: JSON.stringify(input.properties ?? {}),
        weight: input.weight,
        directed: input.directed,
        sourceUrl: input.sourceUrl,
      });
      if (!row) return null;
      const edge = dbEdgeToGraphEdge(row);
      set((state) => ({ edges: [...state.edges, edge] }));
      return edge;
    } catch (e: any) {
      set({ error: e.message });
      return null;
    }
  },

  updateEdge: async (input) => {
    try {
      const row = await dbEdges.update({
        id: input.id,
        label: input.label,
        type: input.type,
        properties: input.properties ? JSON.stringify(input.properties) : undefined,
        weight: input.weight,
      });
      if (!row) return null;
      const edge = dbEdgeToGraphEdge(row);
      set((state) => ({
        edges: state.edges.map((e) => (e.id === edge.id ? edge : e)),
      }));
      return edge;
    } catch (e: any) {
      set({ error: e.message });
      return null;
    }
  },

  deleteEdge: async (id) => {
    try {
      const success = await dbEdges.delete(id);
      if (success) {
        set((state) => ({
          edges: state.edges.filter((e) => e.id !== id),
          selectedEdgeId:
            state.selectedEdgeId === id ? null : state.selectedEdgeId,
        }));
      }
      return success;
    } catch (e: any) {
      set({ error: e.message });
      return false;
    }
  },

  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),
  clearSelection: () => set({ selectedNodeId: null, selectedEdgeId: null }),
}));
