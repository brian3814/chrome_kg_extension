import React from 'react';
import { Header } from '../components/Header';
import { KnowledgeGraph } from '../components/graph/KnowledgeGraph';
import { ActivePanel } from '../components/ActivePanel';
import { ChatBot } from '../components/chat/ChatBot';
import { RelatedWidget } from '../components/RelatedWidget';
import { useUIStore } from '../../graph/store/ui-store';

export function TabLayout() {
  const activePanel = useUIStore((s) => s.activePanel);
  const chatOpen = useUIStore((s) => s.chatOpen);
  const chatDisplayMode = useUIStore((s) => s.chatDisplayMode);
  const showChatSidebar = chatOpen && chatDisplayMode === 'sidebar';

  return (
    <div className="flex flex-col h-full bg-zinc-900 relative">
      <Header />
      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="flex-1 min-h-0 relative">
          <KnowledgeGraph />
        </div>
        {activePanel !== 'none' && (
          <div className="w-[400px] border-l border-zinc-700 overflow-y-auto">
            <ActivePanel />
          </div>
        )}
        {showChatSidebar && (
          <div className="w-[400px] border-l border-zinc-700 min-h-0">
            <ChatBot />
          </div>
        )}
      </div>
      {/* Float mode FAB / overlay */}
      {(!chatOpen || chatDisplayMode === 'float') && <ChatBot />}
    </div>
  );
}
