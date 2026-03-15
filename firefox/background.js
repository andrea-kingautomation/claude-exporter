// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Claude Conversation Exporter installed');
});

// Inject content script into already-open Claude.ai tabs when extension is installed/updated
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ url: 'https://claude.ai/*' }, (tabs) => {
    tabs.forEach(tab => {
      const files = ['jszip.min.js', 'utils.js', 'content.js'];
      files.forEach(file => {
        chrome.tabs.executeScript(tab.id, { file }, () => {
          if (chrome.runtime.lastError) {
            console.log('Could not inject', file, 'into tab', tab.id, chrome.runtime.lastError.message);
          }
        });
      });
    });
  });
});

// Handle messages from popup
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // Open a URL inside a specific container — only background scripts can do this reliably
  if (request.action === 'openTabInContainer') {
    const createProps = { url: request.url };
    if (request.cookieStoreId && request.cookieStoreId !== 'firefox-default') {
      createProps.cookieStoreId = request.cookieStoreId;
    }
    browser.tabs.create(createProps).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      console.error('openTabInContainer error:', err);
      // Fallback: open without container
      browser.tabs.create({ url: request.url });
      sendResponse({ success: true });
    });
    return true;
  }

  // Ensure content script is injected
  if (request.action === 'ensureContentScript') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const files = ['jszip.min.js', 'utils.js', 'content.js'];
        let injected = 0;
        files.forEach(file => {
          chrome.tabs.executeScript(tabs[0].id, { file }, () => {
            injected++;
            if (injected === files.length) {
              sendResponse({ success: true });
            }
          });
        });
      }
    });
    return true;
  }

});
