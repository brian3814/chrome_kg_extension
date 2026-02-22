import { useMemo } from 'react';
import { useGraphStore } from '../../graph/store/graph-store';
import { useUIStore } from '../../graph/store/ui-store';
import { graphDataToReagraph } from '../../graph/transforms/db-to-reagraph';

export function useGraphData() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);

  const reagraphData = useMemo(
    () => graphDataToReagraph(nodes, edges),
    [nodes, edges]
  );

  return reagraphData;
}
