import { useState, useCallback } from 'react';
import { graph } from '../../db/client/db-client';
import { buildNLQuerySystemPrompt } from '../components/query/nl-query-prompt';
import { streamFromOffscreen, fetchLLMConfigAndTypes, parseJsonFromLLMResponse } from './nl-query-utils';
import type { QueryResult } from '../../db/worker/query-engine/types';

type MessageStatus = 'complete' | 'streaming' | 'executing' | 'error';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  generatedJson?: string;
  results?: QueryResult | null;
  error?: string;
  status: MessageStatus;
}

export function useChatQuery() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const updateMessage = (id: string, updates: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  };

  const sendMessage = useCallback(async (input: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      status: 'complete',
    };

    const assistantId = crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      status: 'streaming',
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      const { nodeTypesList, edgeTypesList, config } = await fetchLLMConfigAndTypes();
      const systemPrompt = buildNLQuerySystemPrompt(nodeTypesList, edgeTypesList);
      const requestId = crypto.randomUUID();

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

      const streamResult = await streamFromOffscreen(requestId, (chunk) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m
          )
        );
      });

      if (streamResult.error) {
        throw new Error(streamResult.error);
      }

      const content = streamResult.content ?? '';
      const { rawJson, validated } = parseJsonFromLLMResponse(content);

      updateMessage(assistantId, { status: 'executing', generatedJson: rawJson });

      const result = await graph.query(validated) as QueryResult;
      updateMessage(assistantId, { status: 'complete', results: result });
    } catch (e: any) {
      updateMessage(assistantId, {
        status: 'error',
        error: e.message || 'Query failed',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setIsProcessing(false);
  }, []);

  return { messages, sendMessage, clearHistory, isProcessing };
}
