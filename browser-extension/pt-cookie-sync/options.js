const serverUrlInput = document.getElementById('serverUrl');
const syncKeyInput = document.getElementById('syncKey');
const autoSyncInput = document.getElementById('autoSync');
const saveBtn = document.getElementById('saveBtn');
const saveStatus = document.getElementById('saveStatus');

const DEFAULT_SETTINGS = {
  serverUrl: '',
  syncKey: '',
  autoSync: false,
};

function setStatus(text, type = 'idle') {
  saveStatus.textContent = text;
  saveStatus.className = `status ${type}`;
}

async function loadSettings() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  serverUrlInput.value = settings.serverUrl || '';
  syncKeyInput.value = settings.syncKey || '';
  autoSyncInput.checked = Boolean(settings.autoSync);
}

saveBtn.addEventListener('click', async () => {
  await chrome.storage.sync.set({
    serverUrl: serverUrlInput.value.trim(),
    syncKey: syncKeyInput.value.trim(),
    autoSync: autoSyncInput.checked,
  });
  setStatus('保存成功', 'success');
});

loadSettings()
  .then(() => setStatus('已读取当前设置'))
  .catch(() => setStatus('读取设置失败', 'error'));
