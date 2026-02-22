import React, { useState, useCallback } from 'react';
import { useGraphStore } from '../../../graph/store/graph-store';
import { useUIStore } from '../../../graph/store/ui-store';
import { nodes as dbNodes } from '../../../db/client/db-client';
import { NODE_TYPE_COLORS } from '../../../shared/constants';
import type { DbNode } from '../../../shared/types';

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DbNode[]>([]);
  const [searching, setSearching] = useState(false);
  const selectNode = useGraphStore((s) => s.selectNode);
  const setActivePanel = useUIStore((s) => s.setActivePanel);
  const allNodes = useGraphStore((s) => s.nodes);

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (q.length === 0) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      // Try FTS search first
      let found: DbNode[];
      try {
        found = await dbNodes.search(q);
      } catch {
        // FTS may fail if table empty or query invalid; fall back to local filter
        found = allNodes
          .filter((n) => n.label.toLowerCase().includes(q.toLowerCase()))
          .map((n) => ({
            id: n.id,
            label: n.label,
            type: n.type,
            properties: JSON.stringify(n.properties),
            x: n.x ?? null,
            y: n.y ?? null,
            z: n.z ?? null,
            color: n.color ?? null,
            size: n.size,
            source_url: n.sourceUrl ?? null,
            created_at: n.createdAt,
            updated_at: n.updatedAt,
          })) as DbNode[];
      }
      setResults(found);
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setSearching(false);
    }
  }, [allNodes]);

  const handleSelect = (id: string) => {
    selectNode(id);
    setActivePanel('nodeDetail');
  };

  return (
    <div className="p-4 space-y-3">
      <div>
        <input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search nodes..."
          className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500 placeholder-zinc-600"
          autoFocus
        />
      </div>

      {searching && (
        <p className="text-xs text-zinc-500">Searching...</p>
      )}

      {results.length > 0 && (
        <div className="space-y-1">
          {results.map((node) => {
            const color = NODE_TYPE_COLORS[node.type] || NODE_TYPE_COLORS.entity;
            return (
              <button
                key={node.id}
                onClick={() => handleSelect(node.id)}
                className="w-full text-left px-3 py-2 bg-zinc-800 rounded hover:bg-zinc-700 flex items-center gap-2"
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm text-zinc-200 truncate">{node.label}</span>
                <span className="text-xs text-zinc-500 ml-auto shrink-0">{node.type}</span>
              </button>
            );
          })}
        </div>
      )}

      {query.length > 0 && !searching && results.length === 0 && (
        <p className="text-xs text-zinc-500 text-center py-4">No results found</p>
      )}
    </div>
  );
}
