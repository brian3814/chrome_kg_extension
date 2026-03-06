import React, { useState, useRef, useEffect } from 'react';
import { useUIStore } from '../../../graph/store/ui-store';
import { useChatQuery } from '../../hooks/useChatQuery';
import { ChatMessage } from './ChatMessage';

export function ChatBot() {
  const { chatOpen, chatDisplayMode, toggleChat, setChatDisplayMode } = useUIStore();
  const { messages, sendMessage, clearHistory, isProcessing } = useChatQuery();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const displayMode = useUIStore((s) => s.displayMode);
  const isSidePanel = displayMode === 'sidePanel';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    sendMessage(input.trim());
    setInput('');
  };

  if (!chatOpen) {
    return (
      <button
        onClick={toggleChat}
        title="Ask your graph"
        className="fixed bottom-4 right-4 z-50 w-10 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
      >
        <ChatBubbleIcon />
      </button>
    );
  }

  // Sidebar mode: rendered inline by the layout, not fixed
  if (chatDisplayMode === 'sidebar') {
    return (
      <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-700">
        <ChatHeader
          onClose={toggleChat}
          onClear={clearHistory}
          chatDisplayMode={chatDisplayMode}
          onToggleMode={() => setChatDisplayMode('float')}
        />
        <ChatMessages messages={messages} messagesEndRef={messagesEndRef} />
        <ChatInput
          input={input}
          setInput={setInput}
          onSubmit={handleSubmit}
          isProcessing={isProcessing}
        />
      </div>
    );
  }

  // Float mode: fixed overlay
  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex flex-col bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl ${
        isSidePanel ? 'w-[calc(100vw-2rem)] h-[60vh]' : 'w-96 h-[500px]'
      }`}
    >
      <ChatHeader
        onClose={toggleChat}
        onClear={clearHistory}
        chatDisplayMode={chatDisplayMode}
        onToggleMode={() => setChatDisplayMode('sidebar')}
      />
      <ChatMessages messages={messages} messagesEndRef={messagesEndRef} />
      <ChatInput
        input={input}
        setInput={setInput}
        onSubmit={handleSubmit}
        isProcessing={isProcessing}
      />
    </div>
  );
}

function ChatHeader({
  onClose,
  onClear,
  chatDisplayMode,
  onToggleMode,
}: {
  onClose: () => void;
  onClear: () => void;
  chatDisplayMode: 'float' | 'sidebar';
  onToggleMode: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700 shrink-0">
      <span className="text-sm font-medium text-zinc-200">Ask your graph</span>
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleMode}
          title={chatDisplayMode === 'float' ? 'Dock as sidebar' : 'Float'}
          className="p-1 text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-700 transition-colors"
        >
          {chatDisplayMode === 'float' ? <DockIcon /> : <UndockIcon />}
        </button>
        <button
          onClick={onClear}
          title="Clear history"
          className="p-1 text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-700 transition-colors"
        >
          <TrashIcon />
        </button>
        <button
          onClick={onClose}
          title="Close"
          className="p-1 text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-700 transition-colors"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

function ChatMessages({
  messages,
  messagesEndRef,
}: {
  messages: ReturnType<typeof useChatQuery>['messages'];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-0">
        <p className="text-zinc-500 text-sm">Ask a question about your graph</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3">
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

function ChatInput({
  input,
  setInput,
  onSubmit,
  isProcessing,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isProcessing: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="flex gap-2 p-3 border-t border-zinc-700 shrink-0">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask about your graph..."
        className="flex-1 bg-zinc-800 text-sm text-zinc-100 px-3 py-1.5 rounded border border-zinc-700 focus:border-indigo-500 focus:outline-none"
        disabled={isProcessing}
      />
      <button
        type="submit"
        disabled={isProcessing || !input.trim()}
        className="bg-indigo-600 text-white text-sm px-3 py-1.5 rounded hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? '...' : 'Send'}
      </button>
    </form>
  );
}

// Icons
const ChatBubbleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
  </svg>
);

const DockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M15 3v18" />
  </svg>
);

const UndockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="6" y="6" width="14" height="14" rx="2" /><path d="M6 18 4 20" /><path d="M4 14v6h6" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
  </svg>
);
