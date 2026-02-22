import React, { useState } from 'react';

interface TextInputProps {
  onSubmit: (text: string, sourceUrl?: string) => void;
}

export function TextInput({ onSubmit }: TextInputProps) {
  const [text, setText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit(text.trim(), sourceUrl.trim() || undefined);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs font-medium text-zinc-400 block mb-1">
          Text to extract from
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste text here to extract entities and relationships..."
          className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500 placeholder-zinc-600 min-h-[120px] resize-y"
          autoFocus
        />
      </div>

      <div>
        <label className="text-xs font-medium text-zinc-400 block mb-1">
          Source URL (optional)
        </label>
        <input
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://..."
          className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500 placeholder-zinc-600"
        />
      </div>

      <button
        type="submit"
        disabled={!text.trim()}
        className="w-full bg-indigo-600 text-white text-sm py-2 rounded hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Extract Entities
      </button>
    </form>
  );
}
