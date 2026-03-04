import { ensureOffscreenDocument } from './offscreen-manager';
import { openExtensionTab, closeExtensionTab } from './tab-manager';
import type { RuntimeMessage } from '../shared/messages';

export function handleMessage(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean {
  // Broadcast messages from offscreen — SW should ignore them
  if (message.type === 'LLM_STREAM_CHUNK') return false;
  if (message.type === 'AGENT_PROGRESS') return false;

  // Handle async responses
  handleMessageAsync(message, sender).then(sendResponse).catch((e) => {
    console.error('[SW] Message handling error:', e);
    sendResponse({ error: e.message });
  });

  return true; // Keep message channel open for async response
}

async function handleMessageAsync(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  switch (message.type) {
    case 'PAGE_CONTENT':
    case 'SELECTION': {
      // Forward content from content script to the side panel/tab
      // Store in session storage for pickup
      await chrome.storage.session.set({
        pendingExtraction: {
          ...message.payload,
          timestamp: Date.now(),
        },
      });
      return { success: true };
    }

    case 'LLM_REQUEST': {
      // Forward to offscreen document — it acks immediately, then streams chunks via broadcast
      await ensureOffscreenDocument();
      const response = await chrome.runtime.sendMessage(message);
      return response;
    }

    case 'TOGGLE_DISPLAY_MODE': {
      const payload = message.payload as { currentMode: 'sidePanel' | 'tab' };
      if (payload.currentMode === 'sidePanel') {
        // Side panel → tab: open tab (no user gesture needed for tabs)
        await openExtensionTab();
      } else {
        // Tab → side panel: preference is already saved by the UI.
        // sidePanel.open() requires a user gesture so we can't call it here.
        // The storage listener in index.ts will set openPanelOnActionClick=true,
        // so the user just clicks the icon to open the side panel.
        // Close the current tab to complete the switch.
        await closeExtensionTab();
      }
      return { success: true };
    }

    case 'AGENT_RUN_START': {
      // Forward to offscreen document (same pattern as LLM_REQUEST)
      await ensureOffscreenDocument();
      const response = await chrome.runtime.sendMessage(message);
      return response;
    }

    case 'TOOL_EXECUTE': {
      // Relay to content script via tabs.sendMessage, return response
      const { tabId } = (message as any).payload;
      try {
        // Ensure content script is injected (handles tabs opened before extension load)
        await ensureContentScript(tabId);
        const response = await chrome.tabs.sendMessage(tabId, message);
        return response;
      } catch (e: any) {
        return { result: '', error: `Content script unreachable: ${e.message}` };
      }
    }

    case 'KEEPALIVE': {
      return { alive: true };
    }

    case 'QUERY_EXECUTE':
    case 'MUTATION_EXECUTE': {
      // Forward to the extension's UI view (side panel or tab) which owns the DB worker.
      // chrome.runtime.sendMessage broadcasts to all extension contexts;
      // the UI's query-message-handler listener will pick it up and respond.
      const response = await chrome.runtime.sendMessage(message);
      return response;
    }

    default:
      console.warn('[SW] Unknown message type:', message.type);
      return { error: 'Unknown message type' };
  }
}

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    // Ping the content script to see if it's already there
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
  } catch {
    // Content script not present — inject it
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-script.js'],
    });
  }
}
