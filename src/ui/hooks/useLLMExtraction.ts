import { useCallback } from 'react';
import { useLLMStore } from '../../graph/store/llm-store';
import { useGraphStore } from '../../graph/store/graph-store';
import { extractionResultSchema } from '../../shared/schema';
import type { DiffItem, AgentProgressEvent } from '../../shared/types';

function streamFromOffscreen(
  requestId: string,
  onChunk: (text: string) => void
): Promise<{ content?: string; error?: string }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('LLM stream timed out after 120s'));
    }, 120_000);

    const listener = (message: any) => {
      if (message.type !== 'LLM_STREAM_CHUNK' || message.payload?.requestId !== requestId) return;
      const { chunk, done, content, error } = message.payload;
      if (chunk) onChunk(chunk);
      if (done) {
        cleanup();
        resolve({ content, error });
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      chrome.runtime.onMessage.removeListener(listener);
    };

    chrome.runtime.onMessage.addListener(listener);
  });
}

export function useLLMExtraction() {
  const startExtraction = useCallback(async (text: string, sourceUrl?: string) => {
    const llm = useLLMStore.getState();
    llm.setInputText(text);
    llm.setSourceUrl(sourceUrl ?? null);
    llm.setError(null);

    // Start agent run with steps
    const requestId = llm.startAgentRun([
      { id: 'extract', label: 'Extracting entities via LLM' },
      { id: 'parse', label: 'Parsing response' },
    ]);

    llm.setStatus('extracting');

    try {
      const result = await chrome.storage.local.get('llmConfig') as Record<string, any>;
      const config = result.llmConfig;
      if (!config?.apiKey) {
        throw new Error('No API key configured. Go to Settings to add one.');
      }

      // Send LLM_REQUEST with requestId — offscreen acks immediately
      chrome.runtime.sendMessage({
        type: 'LLM_REQUEST',
        requestId,
        payload: {
          provider: config.provider,
          model: config.model,
          apiKey: config.apiKey,
          prompt: text,
        },
      });

      // Listen for stream chunks
      const streamResult = await streamFromOffscreen(requestId, (chunk) => {
        useLLMStore.getState().appendToCurrentStep(chunk);
      });

      if (streamResult.error) {
        throw new Error(streamResult.error);
      }

      // Complete extract step, advance to parse step
      useLLMStore.getState().completeCurrentStep();
      useLLMStore.getState().advanceStep();

      // Get the content from the stream result or from the step output
      const content = streamResult.content
        ?? useLLMStore.getState().agentRun?.steps[0]?.output
        ?? '';

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

      // Complete parse step
      useLLMStore.getState().completeCurrentStep();
      useLLMStore.getState().setDiff({ items });
      useLLMStore.getState().setStatus('extracted');
    } catch (e: any) {
      const llmState = useLLMStore.getState();
      llmState.failCurrentStep(e.message);
      llmState.setError(e.message);
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

  const startAgentExtraction = useCallback(async (prompt: string) => {
    const llm = useLLMStore.getState();
    llm.setError(null);
    llm.clearAgentTurns();

    // Get active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id) {
      llm.setError('No active tab found');
      return;
    }

    // Get LLM config
    const result = await chrome.storage.local.get('llmConfig') as Record<string, any>;
    const config = result.llmConfig;
    if (!config?.apiKey) {
      llm.setError('No API key configured. Go to Settings to add one.');
      return;
    }
    if (config.provider !== 'anthropic') {
      llm.setError('Page extraction requires an Anthropic API key. Configure one in Settings.');
      return;
    }

    const runId = crypto.randomUUID();
    llm.setStatus('agent-running');
    llm.setSourceUrl(tab.url ?? null);

    // Send AGENT_RUN_START
    chrome.runtime.sendMessage({
      type: 'AGENT_RUN_START',
      payload: {
        runId,
        userPrompt: prompt,
        tabId: tab.id,
        provider: config.provider,
        model: config.model,
        apiKey: config.apiKey,
      },
    });

    // Listen for AGENT_PROGRESS events
    const listener = (message: any) => {
      if (message.type !== 'AGENT_PROGRESS' || message.payload?.runId !== runId) return;

      const event: AgentProgressEvent = message.payload.event;
      const store = useLLMStore.getState();

      switch (event.type) {
        case 'llm_start':
          store.addAgentTurn({ type: 'thinking', content: '' });
          break;
        case 'llm_chunk':
          store.appendToLastTurn(event.text ?? '');
          break;
        case 'tool_call':
          if (event.toolCall) {
            store.addAgentTurn({
              type: 'tool_call',
              content: '',
              toolName: event.toolCall.name,
              toolInput: event.toolCall.input,
            });
          }
          break;
        case 'tool_result':
          store.addAgentTurn({
            type: 'tool_result',
            content: event.toolResult ?? event.toolError ?? '',
            toolName: event.toolCall?.name,
          });
          break;
        case 'extraction_complete': {
          chrome.runtime.onMessage.removeListener(listener);
          if (event.extractionResult) {
            const validated = extractionResultSchema.parse(event.extractionResult);
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
            useLLMStore.getState().setStatus('extracted');
          }
          break;
        }
        case 'error':
          chrome.runtime.onMessage.removeListener(listener);
          useLLMStore.getState().setError(event.error ?? 'Agent loop failed');
          break;
        case 'done':
          chrome.runtime.onMessage.removeListener(listener);
          // If status is still agent-running (no extraction_complete), just finish
          if (useLLMStore.getState().status === 'agent-running') {
            useLLMStore.getState().setStatus('idle');
          }
          break;
      }
    };

    chrome.runtime.onMessage.addListener(listener);
  }, []);

  const proceedToReview = useCallback(() => {
    useLLMStore.getState().setStatus('reviewing');
  }, []);

  return { startExtraction, startAgentExtraction, applyDiff, proceedToReview };
}
