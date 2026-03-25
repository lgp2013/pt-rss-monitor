const statusEl = document.getElementById('status');
const lastSyncEl = document.getElementById('lastSync');
const syncBtn = document.getElementById('syncBtn');
const openOptionsBtn = document.getElementById('openOptionsBtn');

function setStatus(text, type = 'idle') {
  statusEl.textContent = text;
  statusEl.className = `status ${type}`;
}

function renderLastSync(payload) {
  if (!payload?.lastSync) {
    lastSyncEl.textContent = '暂无记录';
    return;
  }

  const { url, at, response } = payload.lastSync;
  lastSyncEl.textContent = JSON.stringify(
    {
      url,
      at,
      matched: response?.matched ?? false,
      site: response?.site?.name || null,
      cookie_names: response?.cookie_names || [],
    },
    null,
    2,
  );
}

async function loadLastSync() {
  const payload = await chrome.runtime.sendMessage({ type: 'get-last-sync' });
  renderLastSync(payload);
}

syncBtn.addEventListener('click', async () => {
  setStatus('同步中...', 'pending');
  syncBtn.disabled = true;

  try {
    const result = await chrome.runtime.sendMessage({ type: 'sync-active-tab' });
    if (!result?.success) {
      setStatus(result?.error || '同步失败', 'error');
      return;
    }

    setStatus(`已同步到 ${result.payload?.site?.name || '目标站点'}`, 'success');
    await loadLastSync();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '同步失败', 'error');
  } finally {
    syncBtn.disabled = false;
  }
});

openOptionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

loadLastSync().catch(() => undefined);
