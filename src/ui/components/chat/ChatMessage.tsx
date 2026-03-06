import React, { useState } from 'react';
import { QueryResults } from '../query/QueryResults';
import type { ChatMessage as ChatMessageType } from '../../hooks/useChatQuery';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-indigo-600/20 border border-indigo-500/30 text-zinc-200 text-sm px-3 py-2 rounded-lg">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[95%] space-y-2">
        {message.status === 'streaming' && (
          <div className="bg-zinc-800 border border-zinc-700 text-sm px-3 py-2 rounded-lg">
            <pre className="whitespace-pre-wrap text-zinc-300 font-mono text-xs">
              {message.content || '...'}
            </pre>
            <span className="inline-block w-1.5 h-3.5 bg-indigo-400 animate-pulse ml-0.5" />
          </div>
        )}

        {message.status === 'executing' && (
          <div className="bg-zinc-800 border border-zinc-700 text-sm px-3 py-2 rounded-lg">
            <p className="text-zinc-400 text-xs">Running query...</p>
          </div>
        )}

        {message.status === 'complete' && (
          <div className="bg-zinc-800 border border-zinc-700 text-sm px-3 py-2 rounded-lg space-y-2">
            {message.generatedJson && <GeneratedDSL json={message.generatedJson} />}
            {message.results && <QueryResults results={message.results} />}
            {!message.results && !message.generatedJson && (
              <p className="text-zinc-300 text-xs">{message.content}</p>
            )}
          </div>
        )}

        {message.status === 'error' && (
          <div className="bg-zinc-800 border border-red-500/30 text-sm px-3 py-2 rounded-lg space-y-2">
            <p className="text-red-400 text-xs">{message.error}</p>
            {message.generatedJson && <GeneratedDSL json={message.generatedJson} />}
          </div>
        )}
      </div>
    </div>
  );
}

function GeneratedDSL({ json }: { json: string }) {
  const [open, setOpen] = useState(false);

  let formatted: string;
  try {
    formatted = JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    formatted = json;
  }

  return (
    <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="text-zinc-500 text-xs cursor-pointer hover:text-zinc-400">
        Generated DSL
      </summary>
      <pre className="mt-1 p-2 bg-zinc-900 rounded text-zinc-400 overflow-auto max-h-32 font-mono text-[11px]">
        {formatted}
      </pre>
    </details>
  );
}
