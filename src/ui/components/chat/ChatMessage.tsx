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
            {message.mode === 'smart' ? (
              <MarkdownContent content={message.content || '...'} />
            ) : (
              <pre className="whitespace-pre-wrap text-zinc-300 font-mono text-xs">
                {message.content || '...'}
              </pre>
            )}
            <span className="inline-block w-1.5 h-3.5 bg-indigo-400 animate-pulse ml-0.5" />
          </div>
        )}

        {message.status === 'executing' && (
          <div className="bg-zinc-800 border border-zinc-700 text-sm px-3 py-2 rounded-lg">
            <p className="text-zinc-400 text-xs">
              {message.mode === 'smart' ? 'Searching knowledge graph...' : 'Running query...'}
            </p>
          </div>
        )}

        {message.status === 'complete' && (
          <div className="bg-zinc-800 border border-zinc-700 text-sm px-3 py-2 rounded-lg space-y-2">
            {message.mode === 'smart' ? (
              <>
                <MarkdownContent content={message.content} />
                {message.ragContext && <RAGContextDetails context={message.ragContext} />}
              </>
            ) : (
              <>
                {message.generatedJson && <GeneratedDSL json={message.generatedJson} />}
                {message.results && <QueryResults results={message.results} />}
                {!message.results && !message.generatedJson && (
                  <p className="text-zinc-300 text-xs">{message.content}</p>
                )}
              </>
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

/** Simple markdown renderer (bold, links, lists, headers) */
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <div className="text-zinc-300 text-xs leading-relaxed space-y-1.5">
      {lines.map((line, i) => {
        // Headers
        if (line.startsWith('### ')) {
          return <h4 key={i} className="text-zinc-200 font-semibold text-xs mt-2">{processInline(line.slice(4))}</h4>;
        }
        if (line.startsWith('## ')) {
          return <h3 key={i} className="text-zinc-200 font-semibold text-sm mt-2">{processInline(line.slice(3))}</h3>;
        }
        if (line.startsWith('# ')) {
          return <h2 key={i} className="text-zinc-100 font-bold text-sm mt-2">{processInline(line.slice(2))}</h2>;
        }
        // List items
        if (line.match(/^[-*]\s/)) {
          return <p key={i} className="pl-3">• {processInline(line.slice(2))}</p>;
        }
        if (line.match(/^\d+\.\s/)) {
          const num = line.match(/^(\d+)\.\s/)![1];
          return <p key={i} className="pl-3">{num}. {processInline(line.replace(/^\d+\.\s/, ''))}</p>;
        }
        // Empty lines
        if (!line.trim()) return <br key={i} />;
        // Regular text
        return <p key={i}>{processInline(line)}</p>;
      })}
    </div>
  );
}

/** Process inline markdown (bold, links, inline code, source citations) */
function processInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Source citations: [Source: url]
    const sourceMatch = remaining.match(/\[Source:\s*([^\]]+)\]/);
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    // Inline code: `text`
    const codeMatch = remaining.match(/`([^`]+)`/);
    // Links: [text](url)
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

    // Find the earliest match
    const matches = [
      sourceMatch && { type: 'source', match: sourceMatch },
      boldMatch && { type: 'bold', match: boldMatch },
      codeMatch && { type: 'code', match: codeMatch },
      linkMatch && { type: 'link', match: linkMatch },
    ].filter(Boolean).sort((a, b) => a!.match.index! - b!.match.index!);

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    const earliest = matches[0]!;
    const idx = earliest.match.index!;

    // Text before match
    if (idx > 0) {
      parts.push(remaining.slice(0, idx));
    }

    switch (earliest.type) {
      case 'source': {
        const url = earliest.match[1].trim();
        parts.push(
          <a
            key={key++}
            href={url}
            target="_blank"
            rel="noopener"
            className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
            title={url}
          >
            [source]
          </a>
        );
        remaining = remaining.slice(idx + earliest.match[0].length);
        break;
      }
      case 'bold':
        parts.push(<strong key={key++} className="text-zinc-200 font-medium">{earliest.match[1]}</strong>);
        remaining = remaining.slice(idx + earliest.match[0].length);
        break;
      case 'code':
        parts.push(
          <code key={key++} className="bg-zinc-900 px-1 py-0.5 rounded text-indigo-300 text-[11px]">
            {earliest.match[1]}
          </code>
        );
        remaining = remaining.slice(idx + earliest.match[0].length);
        break;
      case 'link':
        parts.push(
          <a
            key={key++}
            href={earliest.match[2]}
            target="_blank"
            rel="noopener"
            className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
          >
            {earliest.match[1]}
          </a>
        );
        remaining = remaining.slice(idx + earliest.match[0].length);
        break;
    }
  }

  return <>{parts}</>;
}

function RAGContextDetails({ context }: { context: NonNullable<ChatMessageType['ragContext']> }) {
  const [open, setOpen] = useState(false);

  return (
    <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="text-zinc-500 text-[10px] cursor-pointer hover:text-zinc-400 mt-2">
        Context: {context.relevantNodes.length} entities, {context.relevantEdges.length} relationships, {context.sourceExcerpts.length} sources
      </summary>
      <div className="mt-1 space-y-1.5 text-[10px]">
        {context.relevantNodes.slice(0, 10).map((node) => (
          <span key={node.id} className="inline-block mr-1 px-1.5 py-0.5 bg-zinc-900 rounded text-zinc-400">
            [{node.type}] {node.label}
          </span>
        ))}
        {context.relevantNodes.length > 10 && (
          <span className="text-zinc-600">+{context.relevantNodes.length - 10} more</span>
        )}
        {context.sourceExcerpts.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {context.sourceExcerpts.map((s, i) => (
              <p key={i} className="text-zinc-500 truncate">
                <a href={s.url} target="_blank" rel="noopener" className="text-indigo-400/60 hover:text-indigo-400">
                  {s.title ?? s.url}
                </a>
              </p>
            ))}
          </div>
        )}
      </div>
    </details>
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
