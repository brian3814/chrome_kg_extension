import React from 'react';
import { useLLMStore } from '../../../graph/store/llm-store';

interface DiffViewProps {
  onApply: () => void;
}

export function DiffView({ onApply }: DiffViewProps) {
  const diff = useLLMStore((s) => s.diff);
  const toggleDiffItem = useLLMStore((s) => s.toggleDiffItem);
  const acceptAll = useLLMStore((s) => s.acceptAllDiff);
  const rejectAll = useLLMStore((s) => s.rejectAllDiff);

  if (!diff) return null;

  const nodeItems = diff.items.filter((i) => i.type === 'node');
  const edgeItems = diff.items.filter((i) => i.type === 'edge');
  const acceptedCount = diff.items.filter((i) => i.accepted).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">
          {acceptedCount}/{diff.items.length} items selected
        </span>
        <div className="flex gap-1">
          <button onClick={acceptAll} className="text-xs px-2 py-1 bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600">
            All
          </button>
          <button onClick={rejectAll} className="text-xs px-2 py-1 bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600">
            None
          </button>
        </div>
      </div>

      {nodeItems.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 mb-2">Nodes ({nodeItems.length})</h4>
          <div className="space-y-1">
            {nodeItems.map((item, idx) => {
              const globalIdx = diff.items.indexOf(item);
              const extracted = item.extracted as { label: string; type: string };
              return (
                <label
                  key={idx}
                  className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer ${
                    item.action === 'add'
                      ? 'bg-green-900/20 border border-green-800/30'
                      : 'bg-yellow-900/20 border border-yellow-800/30'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.accepted}
                    onChange={() => toggleDiffItem(globalIdx)}
                    className="rounded border-zinc-600"
                  />
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    item.action === 'add' ? 'bg-green-800 text-green-200' : 'bg-yellow-800 text-yellow-200'
                  }`}>
                    {item.action}
                  </span>
                  <span className="text-sm text-zinc-200 truncate">{extracted.label}</span>
                  <span className="text-xs text-zinc-500 ml-auto">{extracted.type}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {edgeItems.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 mb-2">Edges ({edgeItems.length})</h4>
          <div className="space-y-1">
            {edgeItems.map((item, idx) => {
              const globalIdx = diff.items.indexOf(item);
              const extracted = item.extracted as { sourceLabel: string; targetLabel: string; label: string };
              return (
                <label
                  key={idx}
                  className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer bg-green-900/20 border border-green-800/30"
                >
                  <input
                    type="checkbox"
                    checked={item.accepted}
                    onChange={() => toggleDiffItem(globalIdx)}
                    className="rounded border-zinc-600"
                  />
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-800 text-green-200">add</span>
                  <span className="text-sm text-zinc-200 truncate">
                    {extracted.sourceLabel} → {extracted.label} → {extracted.targetLabel}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={onApply}
        disabled={acceptedCount === 0}
        className="w-full bg-indigo-600 text-white text-sm py-2 rounded hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Apply {acceptedCount} Changes
      </button>
    </div>
  );
}
