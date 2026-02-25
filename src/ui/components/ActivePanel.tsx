import React from 'react';
import { useUIStore } from '../../graph/store/ui-store';
import { NodeDetailPanel } from './panels/NodeDetailPanel';
import { EdgeDetailPanel } from './panels/EdgeDetailPanel';
import { CreatePanel } from './panels/CreatePanel';
import { SearchPanel } from './search/SearchPanel';
import { QueryPanel } from './query/QueryPanel';
import { LLMPanel } from './llm/LLMPanel';
import { SettingsPanel } from './settings/SettingsPanel';

export function ActivePanel() {
  const activePanel = useUIStore((s) => s.activePanel);

  switch (activePanel) {
    case 'nodeDetail':
      return <NodeDetailPanel />;
    case 'edgeDetail':
      return <EdgeDetailPanel />;
    case 'create':
      return <CreatePanel />;
    case 'search':
      return <SearchPanel />;
    case 'query':
      return <QueryPanel />;
    case 'llm':
      return <LLMPanel />;
    case 'settings':
      return <SettingsPanel />;
    default:
      return null;
  }
}
