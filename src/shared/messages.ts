// Message types for communication between extension contexts
export type MessageSource = 'content-script' | 'service-worker' | 'side-panel' | 'tab' | 'offscreen';

// DB Worker messages (postMessage, not chrome.runtime)
export type DbWorkerRequest =
  | { type: 'init' }
  | { type: 'exec'; sql: string; params?: unknown[] }
  | { type: 'query'; sql: string; params?: unknown[] }
  | { type: 'run-migrations' };

export type DbWorkerResponse =
  | { type: 'init-result'; success: boolean; error?: string }
  | { type: 'exec-result'; requestId: string; success: boolean; changes?: number; error?: string }
  | { type: 'query-result'; requestId: string; success: boolean; rows?: unknown[]; error?: string }
  | { type: 'migration-result'; requestId: string; success: boolean; version?: number; error?: string };

// Wrap with requestId for the postMessage protocol
export interface DbRequest {
  requestId: string;
  message: DbWorkerRequest;
}

export interface DbResponse {
  requestId: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

// Chrome runtime messages (between content script, service worker, panel/tab, offscreen)
export interface ExtensionMessage {
  type: string;
  payload?: unknown;
  requestId?: string;
  source?: MessageSource;
  timestamp?: number;
}

// Content script -> Service worker
export interface PageContentMessage extends ExtensionMessage {
  type: 'PAGE_CONTENT';
  payload: {
    title: string;
    text: string;
    url: string;
    selectedText?: string;
  };
}

export interface SelectionMessage extends ExtensionMessage {
  type: 'SELECTION';
  payload: {
    text: string;
    url: string;
  };
}

// Service worker -> Content script
export interface ExtractPageMessage extends ExtensionMessage {
  type: 'EXTRACT_PAGE';
}

export interface ExtractSelectionMessage extends ExtensionMessage {
  type: 'EXTRACT_SELECTION';
}

// Service worker -> Offscreen
export interface LLMRequestMessage extends ExtensionMessage {
  type: 'LLM_REQUEST';
  payload: {
    provider: string;
    model: string;
    apiKey: string;
    prompt: string;
    systemPrompt?: string;
  };
}

// Offscreen -> Service worker -> Panel/Tab
export interface LLMStreamChunkMessage extends ExtensionMessage {
  type: 'LLM_STREAM_CHUNK';
  payload: {
    requestId: string;
    chunk: string;
    done: boolean;
  };
}

export interface LLMResponseMessage extends ExtensionMessage {
  type: 'LLM_RESPONSE';
  payload: {
    requestId: string;
    content: string;
    error?: string;
  };
}

// Display mode messages
export interface OpenSidePanelMessage extends ExtensionMessage {
  type: 'OPEN_SIDE_PANEL';
}

export interface OpenTabMessage extends ExtensionMessage {
  type: 'OPEN_TAB';
}

export interface ToggleDisplayModeMessage extends ExtensionMessage {
  type: 'TOGGLE_DISPLAY_MODE';
  payload: { currentMode: 'sidePanel' | 'tab' };
}

// Keepalive for offscreen
export interface KeepaliveMessage extends ExtensionMessage {
  type: 'KEEPALIVE';
}

// Union of all chrome.runtime messages
export type RuntimeMessage =
  | PageContentMessage
  | SelectionMessage
  | ExtractPageMessage
  | ExtractSelectionMessage
  | LLMRequestMessage
  | LLMStreamChunkMessage
  | LLMResponseMessage
  | OpenSidePanelMessage
  | OpenTabMessage
  | ToggleDisplayModeMessage
  | KeepaliveMessage;

// Helper to create messages
export function createMessage<T extends ExtensionMessage>(
  msg: Omit<T, 'timestamp'> & { source: MessageSource }
): T {
  return {
    ...msg,
    timestamp: Date.now(),
  } as T;
}
