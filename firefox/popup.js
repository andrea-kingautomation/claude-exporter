// Get organization ID from storage, container-aware for Firefox Multi-Account Containers
async function getOrgId() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const cookieStoreId = (tab && tab.cookieStoreId) ? tab.cookieStoreId : 'firefox-default';

  return new Promise((resolve) => {
    chrome.storage.sync.get(['containerOrgs', 'organizationId'], (result) => {
      const containerOrgs = result.containerOrgs || {};
      let orgId = containerOrgs[cookieStoreId];
      // Fallback to legacy single-value for default container (pre-migration)
      if (!orgId && cookieStoreId === 'firefox-default' && result.organizationId) {
        orgId = result.organizationId;
      }
      resolve(orgId);
    });
  });
}

// Check if org ID is configured on popup load
document.addEventListener('DOMContentLoaded', async () => {
  // Display version from manifest
  const manifest = chrome.runtime.getManifest();
  document.getElementById('header-version').textContent = `v${manifest.version}`;

  const orgId = await getOrgId();
  if (!orgId) {
    document.getElementById('setupNotice').style.display = 'block';
    document.getElementById('exportCurrent').disabled = true;
    document.getElementById('exportAll').disabled = true;
  }

  // Handle checkbox dependencies
  const includeChatsCheckbox = document.getElementById('includeChats');
  const includeThinkingCheckbox = document.getElementById('includeThinking');
  const includeMetadataCheckbox = document.getElementById('includeMetadata');
  const includeArtifactsCheckbox = document.getElementById('includeArtifacts');

  function updateCheckboxStates() {
    const chatsEnabled = includeChatsCheckbox.checked;

    // Disable thinking, metadata and inline artifacts when chats is unchecked
    includeThinkingCheckbox.disabled = !chatsEnabled;
    includeMetadataCheckbox.disabled = !chatsEnabled;
    includeArtifactsCheckbox.disabled = !chatsEnabled;

    // Optionally uncheck them when disabled
    if (!chatsEnabled) {
      includeThinkingCheckbox.checked = false;
      includeMetadataCheckbox.checked = false;
      includeArtifactsCheckbox.checked = false;
    }
  }

  includeChatsCheckbox.addEventListener('change', updateCheckboxStates);
  updateCheckboxStates(); // Initialize on load
});

// Handle options link click
document.getElementById('openOptions').addEventListener('click', async (e) => {
  e.preventDefault();
  // Get container ID from the active claude.ai tab
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  const cookieStoreId = (activeTab && activeTab.cookieStoreId) ? activeTab.cookieStoreId : 'firefox-default';
  const optionsUrl = browser.runtime.getURL('options.html') + '?container=' + encodeURIComponent(cookieStoreId);
  // Ask background script to open options in the correct container
  browser.runtime.sendMessage({ action: 'openTabInContainer', url: optionsUrl, cookieStoreId: cookieStoreId });
});
  
  // Get current conversation ID from URL
  async function getCurrentConversationId() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url);
    const match = url.pathname.match(/\/chat\/([a-f0-9-]+)/);
    return match ? match[1] : null;
  }
  
  // Show status message
  function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    statusEl.className = `status ${type}`;
    statusEl.textContent = message;
    
    if (type === 'success') {
      setTimeout(() => {
        statusEl.textContent = '';
        statusEl.className = '';
      }, 3000);
    }
  }
  
  // Export current conversation
document.getElementById('exportCurrent').addEventListener('click', async () => {
  const button = document.getElementById('exportCurrent');
  button.disabled = true;
  showStatus('Fetching conversation...', 'info');
  
  try {
    const orgId = await getOrgId();
    const conversationId = await getCurrentConversationId();
    
    if (!orgId) {
      throw new Error('Organization ID not configured. Click the setup link above to configure it.');
    }
    if (!conversationId) {
      throw new Error('Could not detect conversation ID. Make sure you are on a Claude.ai conversation page.');
    }

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    
    // Check if we're on Claude.ai
    if (!tab.url.includes('claude.ai')) {
      throw new Error('Please navigate to a Claude.ai conversation page first.');
    }
      
          chrome.tabs.sendMessage(tab.id, {
      action: 'exportConversation',
      conversationId,
      orgId,
      format: document.getElementById('format').value,
      includeChats: document.getElementById('includeChats').checked,
      includeThinking: document.getElementById('includeThinking').checked,
      includeMetadata: document.getElementById('includeMetadata').checked,
      includeArtifacts: document.getElementById('includeArtifacts').checked,
      extractArtifacts: document.getElementById('extractArtifacts').checked,
      artifactFormat: document.getElementById('artifactFormat').value,
      flattenArtifacts: document.getElementById('flattenArtifacts').checked
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Chrome runtime error:', chrome.runtime.lastError);
        showStatus(`Error: ${chrome.runtime.lastError.message}`, 'error');
        button.disabled = false;
        return;
      }
      
      if (response?.success) {
        showStatus('Conversation exported successfully!', 'success');
      } else {
        const errorMsg = response?.error || 'Export failed';
        console.error('Export failed:', errorMsg, response?.details);
        showStatus(errorMsg, 'error');
      }
      button.disabled = false;
    });
    } catch (error) {
      showStatus(error.message, 'error');
      button.disabled = false;
    }
  });
  
  // Browse conversations
  document.getElementById('browseConversations').addEventListener('click', async () => {
    // Get the container ID from the active tab (the claude.ai tab the user is on)
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    const cookieStoreId = (activeTab && activeTab.cookieStoreId) ? activeTab.cookieStoreId : 'firefox-default';
    const browseUrl = browser.runtime.getURL('browse.html') + '?container=' + encodeURIComponent(cookieStoreId);
    // Ask background script to open the tab — background can reliably use cookieStoreId
    browser.runtime.sendMessage({ action: 'openTabInContainer', url: browseUrl, cookieStoreId: cookieStoreId });
  });

  // Export all conversations
  document.getElementById('exportAll').addEventListener('click', async () => {
    const button = document.getElementById('exportAll');
    button.disabled = true;
    showStatus('Fetching all conversations...', 'info');
    
    try {
      const orgId = await getOrgId();
      
          if (!orgId) {
      throw new Error('Organization ID not configured. Click the setup link above to configure it.');
      }

      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      
          chrome.tabs.sendMessage(tab.id, {
      action: 'exportAllConversations',
      orgId,
      format: document.getElementById('format').value,
      includeChats: document.getElementById('includeChats').checked,
      includeMetadata: document.getElementById('includeMetadata').checked,
      includeArtifacts: document.getElementById('includeArtifacts').checked,
      extractArtifacts: document.getElementById('extractArtifacts').checked,
      artifactFormat: document.getElementById('artifactFormat').value,
      flattenArtifacts: document.getElementById('flattenArtifacts').checked
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Chrome runtime error:', chrome.runtime.lastError);
        showStatus(`Error: ${chrome.runtime.lastError.message}`, 'error');
        button.disabled = false;
        return;
      }
      
      if (response?.success) {
        if (response.warnings) {
          showStatus(response.warnings, 'info');
        } else {
          showStatus(`Exported ${response.count} conversations!`, 'success');
        }
      } else {
        const errorMsg = response?.error || 'Export failed';
        console.error('Export failed:', errorMsg, response?.details);
        showStatus(errorMsg, 'error');
      }
      button.disabled = false;
    });
    } catch (error) {
      showStatus(error.message, 'error');
      button.disabled = false;
    }
  });