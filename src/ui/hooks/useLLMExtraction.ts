import { useCallback } from 'react';
import { useLLMStore } from '../../graph/store/llm-store';
import { useGraphStore } from '../../graph/store/graph-store';
import { extractionResultSchema } from '../../shared/schema';
import type { DiffItem } from '../../shared/types';

export function useLLMExtraction() {
  const startExtraction = useCallback(async (text: string, sourceUrl?: string) => {
    const llm = useLLMStore.getState();
    llm.setInputText(text);
    llm.setSourceUrl(sourceUrl ?? null);
    llm.setStatus('extracting');
    llm.setStreamingOutput('');
    llm.setError(null);

    try {
      const result = await chrome.storage.local.get('llmConfig') as Record<string, any>;
      const config = result.llmConfig;
      if (!config?.apiKey) {
        throw new Error('No API key configured. Go to Settings to add one.');
      }

      const response = await chrome.runtime.sendMessage({
        type: 'LLM_REQUEST',
        payload: {
          provider: config.provider,
          model: config.model,
          apiKey: config.apiKey,
          prompt: text,
        },
      });

      if (response?.error) {
        throw new Error(response.error);
      }

      const content = response?.content ?? useLLMStore.getState().streamingOutput;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const validated = extractionResultSchema.parse(parsed);

      const graph = useGraphStore.getState();
      const items: DiffItem[] = [];

      for (const node of validated.nodes) {
        const existing = graph.nodes.find(
          (n) => n.label.toLowerCase() === node.label.toLowerCase()
        );
        items.push({
          action: existing ? 'merge' : 'add',
          type: 'node',
          extracted: node,
          existingMatch: existing,
          accepted: true,
        });
      }

      for (const edge of validated.edges) {
        items.push({
          action: 'add',
          type: 'edge',
          extracted: edge,
          accepted: true,
        });
      }

      useLLMStore.getState().setDiff({ items });
      useLLMStore.getState().setStatus('reviewing');
    } catch (e: any) {
      useLLMStore.getState().setError(e.message);
    }
  }, []);

  const applyDiff = useCallback(async () => {
    const llm = useLLMStore.getState();
    const diff = llm.diff;
    if (!diff) return;

    llm.setStatus('merging');

    try {
      const graph = useGraphStore.getState();
      const nodeIdMap = new Map<string, string>();

      // First pass: create/merge nodes
      for (const item of diff.items) {
        if (!item.accepted || item.type !== 'node') continue;

        const extracted = item.extracted as { label: string; type: string; properties?: Record<string, unknown> };

        if (item.action === 'add') {
          const created = await graph.createNode({
            label: extracted.label,
            type: extracted.type,
            properties: extracted.properties,
            sourceUrl: llm.sourceUrl ?? undefined,
          });
          if (created) {
            nodeIdMap.set(extracted.label.toLowerCase(), created.id);
          }
        } else if (item.existingMatch) {
          nodeIdMap.set(extracted.label.toLowerCase(), item.existingMatch.id);
        }
      }

      // Second pass: create edges (re-read graph state to include newly created nodes)
      const updatedGraph = useGraphStore.getState();
      for (const item of diff.items) {
        if (!item.accepted || item.type !== 'edge') continue;

        const extracted = item.extracted as { sourceLabel: string; targetLabel: string; label: string; type?: string };

        const sourceId =
          nodeIdMap.get(extracted.sourceLabel.toLowerCase()) ??
          updatedGraph.nodes.find(
            (n) => n.label.toLowerCase() === extracted.sourceLabel.toLowerCase()
          )?.id;

        const targetId =
          nodeIdMap.get(extracted.targetLabel.toLowerCase()) ??
          updatedGraph.nodes.find(
            (n) => n.label.toLowerCase() === extracted.targetLabel.toLowerCase()
          )?.id;

        if (sourceId && targetId) {
          await updatedGraph.createEdge({
            sourceId,
            targetId,
            label: extracted.label,
            type: extracted.type,
            sourceUrl: llm.sourceUrl ?? undefined,
          });
        }
      }

      useLLMStore.getState().reset();
    } catch (e: any) {
      useLLMStore.getState().setError(e.message);
    }
  }, []);

  return { startExtraction, applyDiff };
}
