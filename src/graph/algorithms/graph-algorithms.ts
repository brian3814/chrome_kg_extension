import type { AdjacencyMap } from './adjacency';
import type { GraphNode } from '../../shared/types';

/**
 * BFS shortest path between two nodes. Returns the node ID path or null if unreachable.
 */
export function bfsPath(
  map: AdjacencyMap,
  sourceId: string,
  targetId: string,
  maxHops = 6
): string[] | null {
  if (sourceId === targetId) return [sourceId];

  const visited = new Set<string>([sourceId]);
  const parent = new Map<string, string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: sourceId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth >= maxHops) continue;

    const neighbors = map.get(id);
    if (!neighbors) continue;

    for (const entry of neighbors) {
      if (visited.has(entry.nodeId)) continue;
      visited.add(entry.nodeId);
      parent.set(entry.nodeId, id);

      if (entry.nodeId === targetId) {
        // Reconstruct path
        const path: string[] = [targetId];
        let current = targetId;
        while (current !== sourceId) {
          current = parent.get(current)!;
          path.push(current);
        }
        return path.reverse();
      }

      queue.push({ id: entry.nodeId, depth: depth + 1 });
    }
  }

  return null;
}

/**
 * All node IDs within N hops of startId.
 */
export function nHopNeighborhood(map: AdjacencyMap, startId: string, hops: number): Set<string> {
  const visited = new Set<string>([startId]);
  let frontier = [startId];

  for (let i = 0; i < hops && frontier.length > 0; i++) {
    const nextFrontier: string[] = [];
    for (const id of frontier) {
      const neighbors = map.get(id);
      if (!neighbors) continue;
      for (const entry of neighbors) {
        if (!visited.has(entry.nodeId)) {
          visited.add(entry.nodeId);
          nextFrontier.push(entry.nodeId);
        }
      }
    }
    frontier = nextFrontier;
  }

  return visited;
}

/**
 * Normalized degree centrality for all nodes.
 */
export function degreeCentrality(map: AdjacencyMap, nodes: GraphNode[]): Map<string, number> {
  const n = nodes.length;
  const denom = n > 1 ? n - 1 : 1;
  const result = new Map<string, number>();

  for (const node of nodes) {
    const degree = (map.get(node.id) ?? []).length;
    result.set(node.id, degree / denom);
  }

  return result;
}

/**
 * Connected components via BFS. Returns an array of sets, each containing node IDs.
 */
export function connectedComponents(map: AdjacencyMap, nodes: GraphNode[]): Set<string>[] {
  const visited = new Set<string>();
  const components: Set<string>[] = [];

  for (const node of nodes) {
    if (visited.has(node.id)) continue;

    const component = new Set<string>();
    const queue = [node.id];
    visited.add(node.id);

    while (queue.length > 0) {
      const id = queue.shift()!;
      component.add(id);

      const neighbors = map.get(id);
      if (!neighbors) continue;
      for (const entry of neighbors) {
        if (!visited.has(entry.nodeId)) {
          visited.add(entry.nodeId);
          queue.push(entry.nodeId);
        }
      }
    }

    components.push(component);
  }

  return components;
}
