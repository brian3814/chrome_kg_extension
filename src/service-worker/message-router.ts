import { ensureOffscreenDocument } from './offscreen-manager';
import { openExtensionTab, closeExtensionTab } from './tab-manager';
import type { RuntimeMessage } from '../shared/messages';

export function handleMessage(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean {
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
      // Forward to offscreen document
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
