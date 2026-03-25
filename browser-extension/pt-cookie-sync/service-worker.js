const DEFAULT_SETTINGS = {
  serverUrl: '',
  syncKey: '',
  autoSync: false,
};

async function getSettings() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return {
    serverUrl: String(settings.serverUrl || '').trim(),
    syncKey: String(settings.syncKey || '').trim(),
    autoSync: Boolean(settings.autoSync),
  };
}

function normalizeTargetUrl(url) {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

async function collectCookiesForUrl(url) {
  return chrome.cookies.getAll({ url });
}

async function uploadCookies(url) {
  const normalizedUrl = normalizeTargetUrl(url);
  if (!normalizedUrl) {
    return { success: false, error: 'Unsupported tab URL' };
  }

  const { serverUrl, syncKey } = await getSettings();
  if (!serverUrl || !syncKey) {
    return { success: false, error: 'Server URL or sync key is not configured' };
  }

  const cookies = await collectCookiesForUrl(normalizedUrl);
  if (!cookies.length) {
    return { success: false, error: 'No cookies found for current site' };
  }

  const response = await fetch(serverUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Extension-Key': syncKey,
    },
    body: JSON.stringify({
      url: normalizedUrl,
      cookies: cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expirationDate: cookie.expirationDate,
      })),
      source: 'pt-cookie-sync-extension',
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      success: false,
      error: payload.error || `HTTP ${response.status}`,
    };
  }

  await chrome.storage.local.set({
    lastSync: {
      url: normalizedUrl,
      at: new Date().toISOString(),
      response: payload,
    },
  });

  return { success: true, payload };
}

async function syncActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    return { success: false, error: 'No active tab found' };
  }
  return uploadCookies(tab.url);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULT_SETTINGS).then(settings => {
    chrome.storage.sync.set({
      serverUrl: settings.serverUrl || '',
      syncKey: settings.syncKey || '',
      autoSync: Boolean(settings.autoSync),
    });
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'sync-active-tab') {
    syncActiveTab()
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error instanceof Error ? error.message : 'Sync failed' }));
    return true;
  }

  if (message?.type === 'get-last-sync') {
    chrome.storage.local.get({ lastSync: null }).then(sendResponse);
    return true;
  }

  return false;
});

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  const { autoSync } = await getSettings();
  if (!autoSync) return;
  await uploadCookies(tab.url).catch(() => undefined);
});
