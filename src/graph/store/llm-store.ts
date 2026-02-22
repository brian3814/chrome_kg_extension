import { create } from 'zustand';
import type { ExtractionDiff, DiffItem, LLMConfig } from '../../shared/types';

type ExtractionStatus = 'idle' | 'extracting' | 'reviewing' | 'merging' | 'error';

interface LLMStore {
  status: ExtractionStatus;
  streamingOutput: string;
  diff: ExtractionDiff | null;
  error: string | null;
  inputText: string;
  sourceUrl: string | null;

  setStatus: (status: ExtractionStatus) => void;
  appendStreamChunk: (chunk: string) => void;
  setStreamingOutput: (text: string) => void;
  setDiff: (diff: ExtractionDiff | null) => void;
  setError: (error: string | null) => void;
  setInputText: (text: string) => void;
  setSourceUrl: (url: string | null) => void;
  toggleDiffItem: (index: number) => void;
  acceptAllDiff: () => void;
  rejectAllDiff: () => void;
  reset: () => void;
}

export const useLLMStore = create<LLMStore>((set) => ({
  status: 'idle',
  streamingOutput: '',
  diff: null,
  error: null,
  inputText: '',
  sourceUrl: null,

  setStatus: (status) => set({ status }),
  appendStreamChunk: (chunk) =>
    set((state) => ({ streamingOutput: state.streamingOutput + chunk })),
  setStreamingOutput: (text) => set({ streamingOutput: text }),
  setDiff: (diff) => set({ diff }),
  setError: (error) => set({ error, status: error ? 'error' : 'idle' }),
  setInputText: (text) => set({ inputText: text }),
  setSourceUrl: (url) => set({ sourceUrl: url }),
  toggleDiffItem: (index) =>
    set((state) => {
      if (!state.diff) return {};
      const items = [...state.diff.items];
      items[index] = { ...items[index], accepted: !items[index].accepted };
      return { diff: { items } };
    }),
  acceptAllDiff: () =>
    set((state) => {
      if (!state.diff) return {};
      return {
        diff: {
          items: state.diff.items.map((item) => ({ ...item, accepted: true })),
        },
      };
    }),
  rejectAllDiff: () =>
    set((state) => {
      if (!state.diff) return {};
      return {
        diff: {
          items: state.diff.items.map((item) => ({ ...item, accepted: false })),
        },
      };
    }),
  reset: () =>
    set({
      status: 'idle',
      streamingOutput: '',
      diff: null,
      error: null,
      inputText: '',
      sourceUrl: null,
    }),
}));
