import React from 'react';
import { Header } from '../components/Header';
import { KnowledgeGraph } from '../components/graph/KnowledgeGraph';
import { ActivePanel } from '../components/ActivePanel';
import { useUIStore } from '../../graph/store/ui-store';

export function SidePanelLayout() {
  const activePanel = useUIStore((s) => s.activePanel);

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      <Header />
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className={`${activePanel === 'none' ? 'flex-1' : 'h-[45%]'} min-h-0 relative`}>
          <KnowledgeGraph compact />
        </div>
        {activePanel !== 'none' && (
          <div className="flex-1 min-h-0 border-t border-zinc-700 overflow-y-auto">
            <ActivePanel />
          </div>
        )}
      </div>
    </div>
  );
}
