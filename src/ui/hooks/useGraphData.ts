import { useMemo } from 'react';
import { useGraphStore } from '../../graph/store/graph-store';
import { useNodeTypeStore } from '../../graph/store/node-type-store';
import { graphDataToReagraph } from '../../graph/transforms/db-to-reagraph';

export function useGraphData() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const types = useNodeTypeStore((s) => s.types);

  const typeColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of types) {
      if (t.color) map.set(t.type, t.color);
    }
    return map;
  }, [types]);

  const reagraphData = useMemo(
    () => graphDataToReagraph(nodes, edges, typeColorMap),
    [nodes, edges, typeColorMap]
  );

  return reagraphData;
}
