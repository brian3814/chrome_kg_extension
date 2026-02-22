import React, { useRef, useCallback } from 'react';
import { GraphCanvas, GraphCanvasRef, useSelection } from 'reagraph';
import { useGraphData } from '../../hooks/useGraphData';
import { useUIStore } from '../../../graph/store/ui-store';
import { useGraphStore } from '../../../graph/store/graph-store';
import { NodeTooltip } from './NodeTooltip';
import { GraphControls } from './GraphControls';

interface KnowledgeGraphProps {
  compact?: boolean;
}

export function KnowledgeGraph({ compact = false }: KnowledgeGraphProps) {
  const graphRef = useRef<GraphCanvasRef>(null);
  const { nodes, edges } = useGraphData();
  const layoutType = useUIStore((s) => s.layoutType);
  const is3D = useUIStore((s) => s.is3D);
  const clusteringEnabled = useUIStore((s) => s.clusteringEnabled);
  const graphKey = useUIStore((s) => s.graphKey);
  const selectNode = useGraphStore((s) => s.selectNode);
  const selectEdge = useGraphStore((s) => s.selectEdge);
  const setActivePanel = useUIStore((s) => s.setActivePanel);

  const {
    selections,
    actives,
    onNodeClick,
    onCanvasClick,
    onNodePointerOver,
    onNodePointerOut,
  } = useSelection({
    ref: graphRef,
    nodes,
    edges,
    type: 'single',
    pathSelectionType: 'all',
  });

  const handleNodeClick = useCallback(
    (node: any) => {
      onNodeClick?.(node);
      selectNode(node.id);
      setActivePanel('nodeDetail');
    },
    [onNodeClick, selectNode, setActivePanel]
  );

  const handleEdgeClick = useCallback(
    (edge: any) => {
      selectEdge(edge.id);
      setActivePanel('edgeDetail');
    },
    [selectEdge, setActivePanel]
  );

  const handleCanvasClick = useCallback(
    (event: any) => {
      onCanvasClick?.(event);
      useGraphStore.getState().clearSelection();
    },
    [onCanvasClick]
  );

  if (nodes.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">
        <div className="text-center p-4">
          <p>No nodes yet</p>
          <p className="text-xs mt-1 text-zinc-600">
            Create nodes or extract from text to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <GraphCanvas
        key={graphKey}
        ref={graphRef}
        nodes={nodes}
        edges={edges}
        layoutType={layoutType as any}
        selections={selections}
        actives={actives}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onCanvasClick={handleCanvasClick}
        onNodePointerOver={onNodePointerOver}
        onNodePointerOut={onNodePointerOut}
        draggable
        edgeArrowPosition="end"
        labelType={compact ? 'auto' : 'all'}
        sizingType="default"
        theme={{
          canvas: { background: '#18181b' },
          node: {
            fill: '#6366f1',
            activeFill: '#818cf8',
            opacity: 1,
            selectedOpacity: 1,
            inactiveOpacity: 0.2,
            label: { color: '#e4e4e7', activeColor: '#ffffff' },
          },
          ring: {
            fill: '#818cf8',
            activeFill: '#a5b4fc',
          },
          edge: {
            fill: '#52525b',
            activeFill: '#a1a1aa',
            opacity: 1,
            selectedOpacity: 1,
            inactiveOpacity: 0.1,
            label: { color: '#71717a', activeColor: '#a1a1aa' },
          },
          arrow: {
            fill: '#52525b',
            activeFill: '#a1a1aa',
          },
          lasso: {
            background: 'rgba(99, 102, 241, 0.1)',
            border: '#6366f1',
          },
          cluster: {
            stroke: '#3f3f46',
            label: { color: '#a1a1aa' },
          },
        }}
        clusterAttribute={clusteringEnabled && layoutType.startsWith('forceDirected') ? 'type' : undefined}
        cameraMode={is3D ? 'rotate' : 'pan'}
      />
      {!compact && <GraphControls graphRef={graphRef} />}
    </div>
  );
}
