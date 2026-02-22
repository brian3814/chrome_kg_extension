import { executeLLMRequest } from './llm-executor';

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LLM_REQUEST') {
    executeLLMRequest(message.payload)
      .then(sendResponse)
      .catch((e) => sendResponse({ content: '', error: e.message }));
    return true; // Keep channel open for async
  }

  if (message.type === 'KEEPALIVE') {
    sendResponse({ alive: true });
    return false;
  }
});

console.log('[Offscreen] Document loaded');
