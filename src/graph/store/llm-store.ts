import { create } from 'zustand';
import type { ExtractionDiff, AgentRun, AgentStep } from '../../shared/types';

type ExtractionStatus = 'idle' | 'extracting' | 'extracted' | 'reviewing' | 'merging' | 'error';

interface LLMStore {
  status: ExtractionStatus;
  diff: ExtractionDiff | null;
  error: string | null;
  inputText: string;
  sourceUrl: string | null;
  agentRun: AgentRun | null;

  setStatus: (status: ExtractionStatus) => void;
  setDiff: (diff: ExtractionDiff | null) => void;
  setError: (error: string | null) => void;
  setInputText: (text: string) => void;
  setSourceUrl: (url: string | null) => void;
  toggleDiffItem: (index: number) => void;
  acceptAllDiff: () => void;
  rejectAllDiff: () => void;
  reset: () => void;

  // Agent step lifecycle
  startAgentRun: (steps: Pick<AgentStep, 'id' | 'label'>[]) => string;
  advanceStep: () => void;
  completeCurrentStep: () => void;
  failCurrentStep: (error: string) => void;
  appendToCurrentStep: (chunk: string) => void;
}

export const useLLMStore = create<LLMStore>((set, get) => ({
  status: 'idle',
  diff: null,
  error: null,
  inputText: '',
  sourceUrl: null,
  agentRun: null,

  setStatus: (status) => set({ status }),
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
      diff: null,
      error: null,
      inputText: '',
      sourceUrl: null,
      agentRun: null,
    }),

  startAgentRun: (stepDefs) => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const steps: AgentStep[] = stepDefs.map((s, i) => ({
      id: s.id,
      label: s.label,
      status: i === 0 ? 'running' : 'pending',
      startedAt: i === 0 ? now : undefined,
      output: '',
    }));
    set({
      agentRun: {
        id,
        steps,
        currentStepIndex: 0,
        status: 'running',
        startedAt: now,
      },
    });
    return id;
  },

  advanceStep: () => {
    const run = get().agentRun;
    if (!run) return;
    const nextIndex = run.currentStepIndex + 1;
    if (nextIndex >= run.steps.length) return;
    const steps = [...run.steps];
    const now = Date.now();
    // Complete current step if still running
    if (steps[run.currentStepIndex].status === 'running') {
      steps[run.currentStepIndex] = {
        ...steps[run.currentStepIndex],
        status: 'completed',
        completedAt: now,
      };
    }
    // Start next step
    steps[nextIndex] = {
      ...steps[nextIndex],
      status: 'running',
      startedAt: now,
    };
    set({
      agentRun: { ...run, steps, currentStepIndex: nextIndex },
    });
  },

  completeCurrentStep: () => {
    const run = get().agentRun;
    if (!run) return;
    const steps = [...run.steps];
    const now = Date.now();
    steps[run.currentStepIndex] = {
      ...steps[run.currentStepIndex],
      status: 'completed',
      completedAt: now,
    };
    const allDone = steps.every((s) => s.status === 'completed');
    set({
      agentRun: {
        ...run,
        steps,
        status: allDone ? 'completed' : run.status,
        completedAt: allDone ? now : undefined,
      },
    });
  },

  failCurrentStep: (error) => {
    const run = get().agentRun;
    if (!run) return;
    const steps = [...run.steps];
    steps[run.currentStepIndex] = {
      ...steps[run.currentStepIndex],
      status: 'error',
      error,
      completedAt: Date.now(),
    };
    set({
      agentRun: { ...run, steps, status: 'error' },
    });
  },

  appendToCurrentStep: (chunk) => {
    const run = get().agentRun;
    if (!run) return;
    const step = run.steps[run.currentStepIndex];
    if (!step || step.status !== 'running') return;
    const steps = [...run.steps];
    steps[run.currentStepIndex] = {
      ...step,
      output: (step.output ?? '') + chunk,
    };
    set({ agentRun: { ...run, steps } });
  },
}));
