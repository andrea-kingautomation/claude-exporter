// Read container ID from URL params (passed when opened from popup)
function getContainerIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('container') || 'firefox-default';
}

// Get human-readable container name using contextualIdentities API
async function getContainerName(cookieStoreId) {
  if (cookieStoreId === 'firefox-default') return 'Default (no container)';
  try {
    const identity = await browser.contextualIdentities.get(cookieStoreId);
    return identity ? identity.name : cookieStoreId;
  } catch (e) {
    return cookieStoreId;
  }
}

// Migrate old single organizationId to containerOrgs map (one-time, backward compat)
async function migrateIfNeeded() {
  return new Promise((resolve) => {
    browser.storage.local.get(['organizationId', 'containerOrgs'], (result) => {
      if (result.organizationId && !result.containerOrgs) {
        const containerOrgs = { 'firefox-default': result.organizationId };
        browser.storage.local.set({ containerOrgs }, () => {
          browser.storage.local.remove('organizationId', resolve);
        });
      } else {
        resolve();
      }
    });
  });
}

// Load saved settings
document.addEventListener('DOMContentLoaded', async () => {
  await migrateIfNeeded();

  const cookieStoreId = getContainerIdFromUrl();
  const containerName = await getContainerName(cookieStoreId);

  // Show which container is being configured
  const containerBadge = document.getElementById('containerBadge');
  if (containerBadge) {
    containerBadge.textContent = 'Configuring account for: ' + containerName;
  }

  // Load saved org ID for this container
  browser.storage.local.get(['containerOrgs'], (result) => {
    const containerOrgs = result.containerOrgs || {};
    const savedOrgId = containerOrgs[cookieStoreId] || '';
    if (savedOrgId) {
      document.getElementById('orgId').value = savedOrgId;
      showStatus('status', 'Organization ID loaded from saved settings', 'success');
      setTimeout(() => hideStatus('status'), 2000);
    }
  });
});

// Save settings for this specific container
document.getElementById('saveBtn').addEventListener('click', () => {
  const cookieStoreId = getContainerIdFromUrl();
  const orgId = document.getElementById('orgId').value.trim();

  if (!orgId) {
    showStatus('status', 'Please enter an Organization ID', 'error');
    return;
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(orgId)) {
    showStatus('status', 'Invalid Organization ID format. It should be a UUID like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', 'error');
    return;
  }

  // Load existing map, update this container's entry, save back
  browser.storage.local.get(['containerOrgs'], (result) => {
    const containerOrgs = result.containerOrgs || {};
    containerOrgs[cookieStoreId] = orgId;
    browser.storage.local.set({ containerOrgs }, () => {
      showStatus('status', 'Settings saved successfully!', 'success');
    });
  });
});

// Test connection using current field value
document.getElementById('testBtn').addEventListener('click', async () => {
  const orgId = document.getElementById('orgId').value.trim();

  if (!orgId) {
    showStatus('testStatus', 'Please save an Organization ID first', 'error');
    return;
  }

  showStatus('testStatus', 'Testing connection...', 'success');

  try {
    const response = await fetch(`https://claude.ai/api/organizations/${orgId}/chat_conversations?limit=5`, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      showStatus('testStatus', `Success! Found ${data.length} conversations.`, 'success');
    } else if (response.status === 401) {
      showStatus('testStatus', 'Not authenticated. Please make sure you are logged into Claude.ai in this container.', 'error');
    } else if (response.status === 403) {
      showStatus('testStatus', 'Access denied. The Organization ID might be incorrect.', 'error');
    } else {
      showStatus('testStatus', `Connection failed with status: ${response.status}`, 'error');
    }
  } catch (error) {
    showStatus('testStatus', `Connection error: ${error.message}`, 'error');
  }
});

// Helper functions
function showStatus(elementId, message, type) {
  const statusEl = document.getElementById(elementId);
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function hideStatus(elementId) {
  const statusEl = document.getElementById(elementId);
  statusEl.className = 'status';
}
