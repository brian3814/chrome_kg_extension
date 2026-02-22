import React from 'react';
import { useLLMStore } from '../../../graph/store/llm-store';
import { useLLMExtraction } from '../../hooks/useLLMExtraction';
import { TextInput } from './TextInput';
import { DiffView } from './DiffView';

export function LLMPanel() {
  const status = useLLMStore((s) => s.status);
  const error = useLLMStore((s) => s.error);
  const streamingOutput = useLLMStore((s) => s.streamingOutput);
  const reset = useLLMStore((s) => s.reset);
  const { startExtraction, applyDiff } = useLLMExtraction();

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">LLM Extraction</h3>
        {status !== 'idle' && (
          <button
            onClick={reset}
            className="text-xs px-2 py-1 bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600"
          >
            Reset
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded p-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {status === 'idle' || status === 'error' ? (
        <TextInput onSubmit={startExtraction} />
      ) : status === 'extracting' ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-zinc-400">Extracting entities...</span>
          </div>
          {streamingOutput && (
            <pre className="text-xs text-zinc-500 bg-zinc-800 rounded p-3 overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap">
              {streamingOutput}
            </pre>
          )}
        </div>
      ) : status === 'reviewing' ? (
        <DiffView onApply={applyDiff} />
      ) : status === 'merging' ? (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-zinc-400">Merging into graph...</span>
        </div>
      ) : null}
    </div>
  );
}
