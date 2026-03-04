import React, { useState, useEffect } from 'react';
import { LLM_MODELS, LLM_CONFIG_STORAGE_KEY } from '../../../shared/constants';
import type { LLMProvider } from '../../../shared/types';
import { useGraphStore } from '../../../graph/store/graph-store';

export function SettingsPanel() {
  const [provider, setProvider] = useState<LLMProvider>('openai');
  const [model, setModel] = useState('gpt-4o');
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(LLM_CONFIG_STORAGE_KEY).then((result: Record<string, any>) => {
      const config = result[LLM_CONFIG_STORAGE_KEY];
      if (config) {
        setProvider(config.provider);
        setModel(config.model);
        setApiKey(config.apiKey);
      }
    }).catch(() => {
      // Not in extension context
    });
  }, []);

  const handleSave = async () => {
    const config = { provider, model, apiKey };
    try {
      await chrome.storage.local.set({ [LLM_CONFIG_STORAGE_KEY]: config });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  const handleClearKey = async () => {
    setApiKey('');
    try {
      await chrome.storage.local.remove(LLM_CONFIG_STORAGE_KEY);
    } catch (e) {
      // Not in extension context
    }
  };

  const models = LLM_MODELS[provider] ?? [];

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-semibold text-zinc-100">Settings</h3>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-zinc-400 block mb-1">LLM Provider</label>
          <select
            value={provider}
            onChange={(e) => {
              const p = e.target.value as LLMProvider;
              setProvider(p);
              setModel(LLM_MODELS[p][0]?.id ?? '');
            }}
            className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-400 block mb-1">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-400 block mb-1">API Key</label>
          <div className="flex gap-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter API key..."
              className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500 placeholder-zinc-600"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="px-2 py-1 bg-zinc-700 text-zinc-400 rounded text-xs hover:bg-zinc-600"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 bg-indigo-600 text-white text-sm py-1.5 rounded hover:bg-indigo-500 transition-colors"
          >
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
          <button
            onClick={handleClearKey}
            className="px-3 bg-red-900/50 text-red-400 text-sm py-1.5 rounded hover:bg-red-900"
          >
            Clear Key
          </button>
        </div>
      </div>

      <DangerZone />

      <div className="border-t border-zinc-700 pt-4 mt-4">
        <h4 className="text-xs font-medium text-zinc-400 mb-2">About</h4>
        <p className="text-xs text-zinc-500">
          Knowledge Graph Extension v0.1.0
        </p>
        <p className="text-xs text-zinc-600 mt-1">
          API keys are stored locally in Chrome's encrypted storage and never sent to third parties.
        </p>
      </div>
    </div>
  );
}

function DangerZone() {
  const [confirming, setConfirming] = useState(false);
  const clearAll = useGraphStore((s) => s.clearAll);
  const nodeCount = useGraphStore((s) => s.nodes.length);
  const edgeCount = useGraphStore((s) => s.edges.length);

  const handleClearAll = async () => {
    await clearAll();
    setConfirming(false);
  };

  return (
    <div className="border-t border-zinc-700 pt-4 mt-4">
      <h4 className="text-xs font-medium text-red-400 mb-2">Danger Zone</h4>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          disabled={nodeCount === 0 && edgeCount === 0}
          className="w-full bg-red-900/30 text-red-400 text-sm py-1.5 rounded border border-red-900/50 hover:bg-red-900/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clear All Nodes & Edges
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-red-400">
            Delete all {nodeCount} nodes and {edgeCount} edges? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleClearAll}
              className="flex-1 bg-red-600 text-white text-sm py-1.5 rounded hover:bg-red-500 transition-colors"
            >
              Confirm Delete
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 bg-zinc-700 text-zinc-300 text-sm py-1.5 rounded hover:bg-zinc-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
