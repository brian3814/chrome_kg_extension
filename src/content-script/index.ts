import { extractPageContent, getSelectedText } from './page-extractor';

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'EXTRACT_PAGE': {
      const content = extractPageContent();
      chrome.runtime.sendMessage({
        type: 'PAGE_CONTENT',
        payload: content,
        source: 'content-script',
        timestamp: Date.now(),
      });
      sendResponse({ success: true });
      break;
    }

    case 'EXTRACT_SELECTION': {
      const selectedText = message.payload?.text || getSelectedText();
      if (selectedText) {
        chrome.runtime.sendMessage({
          type: 'SELECTION',
          payload: {
            text: selectedText,
            url: window.location.href,
          },
          source: 'content-script',
          timestamp: Date.now(),
        });
      }
      sendResponse({ success: true });
      break;
    }
  }

  return false;
});
