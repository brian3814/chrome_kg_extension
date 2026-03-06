import { useState, useCallback } from 'react';
import { nodes, edges, graph } from '../../db/client/db-client';
import { buildNLQuerySystemPrompt } from '../components/query/nl-query-prompt';
import { graphQuerySchema } from '../../db/worker/query-engine/schema';
import type { QueryResult } from '../../db/worker/query-engine/types';

type NLQueryStatus = 'idle' | 'streaming' | 'executing' | 'done' | 'error';

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

export function useNLQuery() {
  const [status, setStatus] = useState<NLQueryStatus>('idle');
  const [streamText, setStreamText] = useState('');
  const [generatedJson, setGeneratedJson] = useState<string | null>(null);
  const [results, setResults] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (input: string) => {
    setStatus('streaming');
    setStreamText('');
    setGeneratedJson(null);
    setResults(null);
    setError(null);

    try {
      // Fetch types and LLM config in parallel
      const [nodeTypesList, edgeTypesList, storageResult] = await Promise.all([
        nodes.getTypes(),
        edges.getTypes(),
        chrome.storage.local.get('llmConfig') as Promise<Record<string, any>>,
      ]);

      const config = storageResult.llmConfig;
      if (!config?.apiKey) {
        throw new Error('No API key configured. Go to Settings to add one.');
      }

      const systemPrompt = buildNLQuerySystemPrompt(nodeTypesList, edgeTypesList);
      const requestId = crypto.randomUUID();

      // Send LLM request with custom system prompt
      chrome.runtime.sendMessage({
        type: 'LLM_REQUEST',
        requestId,
        payload: {
          provider: config.provider,
          model: config.model,
          apiKey: config.apiKey,
          prompt: input,
          systemPrompt,
        },
      });

      // Stream response
      const streamResult = await streamFromOffscreen(requestId, (chunk) => {
        setStreamText((prev) => prev + chunk);
      });

      if (streamResult.error) {
        throw new Error(streamResult.error);
      }

      const content = streamResult.content ?? '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }

      const rawJson = jsonMatch[0];
      setGeneratedJson(rawJson);

      // Validate with Zod
      const parsed = JSON.parse(rawJson);
      const validated = graphQuerySchema.parse(parsed);

      // Execute the query
      setStatus('executing');
      const result = await graph.query(validated) as QueryResult;
      setResults(result);
      setStatus('done');
    } catch (e: any) {
      setError(e.message || 'Query failed');
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setStreamText('');
    setGeneratedJson(null);
    setResults(null);
    setError(null);
  }, []);

  return { status, streamText, generatedJson, results, error, execute, reset };
}
