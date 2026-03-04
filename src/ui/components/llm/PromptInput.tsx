import React, { useState, useEffect } from 'react';

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
}

export function PromptInput({ onSubmit }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [tabUrl, setTabUrl] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    // Get current tab URL
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      setTabUrl(tabs[0]?.url ?? null);
    });

    // Check for Anthropic config
    chrome.storage.local.get('llmConfig').then((result: Record<string, any>) => {
      const config = result.llmConfig;
      if (!config?.apiKey) {
        setConfigError('No API key configured. Go to Settings to add one.');
      } else if (config.provider !== 'anthropic') {
        setConfigError('Page extraction requires an Anthropic API key.');
      }
    });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || configError) return;
    onSubmit(prompt.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {tabUrl && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 truncate">
          <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 4h12v9H2z" />
            <path d="M5 4V2h6v2" />
          </svg>
          <span className="truncate">{tabUrl}</span>
        </div>
      )}

      <div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What would you like to extract from this page?"
          className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500 placeholder-zinc-600 min-h-[80px] resize-y"
          autoFocus
        />
      </div>

      {configError && (
        <p className="text-xs text-amber-400">{configError}</p>
      )}

      <button
        type="submit"
        disabled={!prompt.trim() || !!configError}
        className="w-full bg-indigo-600 text-white text-sm py-2 rounded hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Extract from Page
      </button>
    </form>
  );
}
