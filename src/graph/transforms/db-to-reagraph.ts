import type { GraphNode, GraphEdge } from '../../shared/types';
import { NODE_TYPE_COLORS } from '../../shared/constants';

// Reagraph node format
export interface ReagraphNode {
  id: string;
  label: string;
  fill?: string;
  size?: number;
  data?: Record<string, unknown>;
}

// Reagraph edge format
export interface ReagraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  size?: number;
  data?: Record<string, unknown>;
}

export function graphNodesToReagraph(nodes: GraphNode[]): ReagraphNode[] {
  return nodes.map((node) => ({
    id: node.id,
    label: node.label,
    fill: node.color || NODE_TYPE_COLORS[node.type] || NODE_TYPE_COLORS.entity,
    size: node.size,
    data: {
      type: node.type,
      properties: node.properties,
      sourceUrl: node.sourceUrl,
      createdAt: node.createdAt,
    },
  }));
}

export function graphEdgesToReagraph(edges: GraphEdge[]): ReagraphEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    label: edge.label,
    size: edge.weight,
    data: {
      type: edge.type,
      properties: edge.properties,
      weight: edge.weight,
      directed: edge.directed,
      sourceUrl: edge.sourceUrl,
    },
  }));
}

export function graphDataToReagraph(nodes: GraphNode[], edges: GraphEdge[]): {
  nodes: ReagraphNode[];
  edges: ReagraphEdge[];
} {
  return {
    nodes: graphNodesToReagraph(nodes),
    edges: graphEdgesToReagraph(edges),
  };
}
