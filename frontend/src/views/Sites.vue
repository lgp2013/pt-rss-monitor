<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { sitesApi, type Site } from '../api';

const loading = ref(false);
const saving = ref(false);
const creating = ref(false);
const sites = ref<Site[]>([]);
const search = ref('');
const showEditModal = ref(false);
const showAddModal = ref(false);
const activeSource = ref<Site | null>(null);
const toDelete = ref<Site | null>(null);

const addForm = ref({
  name: '',
  site_url: '',
  category: '其他',
});

const form = ref({
  custom_name: '',
  groups: '',
  cookie: '',
  passkey: '',
  timezone_offset: '+0800',
  request_timeout: 30000,
  download_interval: 0,
  upload_speed_limit: 0,
  download_link_appendix: '',
  enabled: true,
  is_offline: false,
  allow_search: true,
  allow_query_user_info: true,
  allow_content_script: true,
});

const filteredSources = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  return sites.value.filter(source => {
    if (!keyword) return true;
    return [source.custom_name, source.name, source.site_url, source.category, ...(source.groups || [])]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(keyword));
  });
});

const summary = computed(() => ({
  total: sites.value.length,
  enabled: sites.value.filter(item => item.enabled === 1).length,
  offline: sites.value.filter(item => item.is_offline === 1).length,
  userInfo: sites.value.filter(item => item.allow_query_user_info === 1).length,
}));

async function loadSources() {
  loading.value = true;
  try {
    sites.value = await sitesApi.list();
  } finally {
    loading.value = false;
  }
}

async function createSite() {
  if (!addForm.value.name.trim() || !addForm.value.site_url.trim()) {
    alert('请填写站点名称和网站地址');
    return;
  }
  creating.value = true;
  try {
    await sitesApi.create({
      name: addForm.value.name.trim(),
      site_url: addForm.value.site_url.trim(),
      category: addForm.value.category.trim() || '其他',
      enabled: false,
      allow_search: true,
      allow_query_user_info: true,
      allow_content_script: true,
    });
    addForm.value = { name: '', site_url: '', category: '其他' };
    showAddModal.value = false;
    await loadSources();
  } finally {
    creating.value = false;
  }
}

function openEdit(source: Site) {
  activeSource.value = source;
  form.value = {
    custom_name: source.custom_name || '',
    groups: (source.groups || []).join(', '),
    cookie: source.cookie || '',
    passkey: source.passkey || '',
    timezone_offset: source.timezone_offset || '+0800',
    request_timeout: source.request_timeout ?? 30000,
    download_interval: source.download_interval ?? 0,
    upload_speed_limit: source.upload_speed_limit ?? 0,
    download_link_appendix: source.download_link_appendix || '',
    enabled: source.enabled === 1,
    is_offline: source.is_offline === 1,
    allow_search: source.allow_search !== 0,
    allow_query_user_info: source.allow_query_user_info !== 0,
    allow_content_script: source.allow_content_script !== 0,
  };
  showEditModal.value = true;
}

async function saveSiteSettings() {
  if (!activeSource.value) return;
  saving.value = true;
  try {
    await sitesApi.update(activeSource.value.id, {
      custom_name: form.value.custom_name || null,
      groups: form.value.groups
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
      cookie: form.value.cookie || '',
      passkey: form.value.passkey || null,
      timezone_offset: form.value.timezone_offset,
      request_timeout: form.value.request_timeout,
      download_interval: form.value.download_interval,
      upload_speed_limit: form.value.upload_speed_limit,
      download_link_appendix: form.value.download_link_appendix || null,
      enabled: form.value.enabled,
      is_offline: form.value.is_offline,
      allow_search: form.value.allow_search,
      allow_query_user_info: form.value.allow_query_user_info,
      allow_content_script: form.value.allow_content_script,
    });
    showEditModal.value = false;
    await loadSources();
  } finally {
    saving.value = false;
  }
}

async function quickToggle(source: Site, key: keyof Site, checked: boolean) {
  await sitesApi.update(source.id, { [key]: checked } as Partial<Site>);
  await loadSources();
}

async function deleteSite() {
  if (!toDelete.value) return;
  await sitesApi.delete(toDelete.value.id);
  toDelete.value = null;
  await loadSources();
}

onMounted(loadSources);
</script>

<template>
  <div class="site-settings-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">站点设置</h1>
        <p class="page-subtitle">管理站点行为、鉴权信息和用户信息相关开关。</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" @click="showAddModal = true">添加站点</button>
        <button class="btn" @click="loadSources">刷新</button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">总站点</div>
        <div class="stat-value">{{ summary.total }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">启用抓取</div>
        <div class="stat-value">{{ summary.enabled }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">离线模式</div>
        <div class="stat-value">{{ summary.offline }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">允许用户数据</div>
        <div class="stat-value">{{ summary.userInfo }}</div>
      </div>
    </div>

    <div class="card toolbar">
      <input v-model="search" class="input search-input" placeholder="搜索站点、URL、分组" />
    </div>

    <div v-if="loading" class="loading"><div class="spinner"></div></div>

    <div v-else class="site-list">
      <div v-for="source in filteredSources" :key="source.id" class="card site-card">
        <div class="site-head">
          <div>
            <h3 class="site-title">{{ source.custom_name || source.name }}</h3>
            <div class="site-url">{{ source.site_url || '未配置网站地址' }}</div>
          </div>
          <div class="site-actions">
            <button class="btn btn-small" @click="openEdit(source)">详细设置</button>
            <button class="btn btn-small btn-danger" @click="toDelete = source">删除站点</button>
          </div>
        </div>

        <div class="site-meta">
          <span class="tag">{{ source.category || '未分类' }}</span>
          <span v-for="group in source.groups || []" :key="group" class="tag secondary">{{ group }}</span>
        </div>

        <div class="toggle-grid">
          <label class="toggle-item">
            <span>启用抓取</span>
            <input :checked="source.enabled === 1" type="checkbox" @change="quickToggle(source, 'enabled', ($event.target as HTMLInputElement).checked)" />
          </label>
          <label class="toggle-item">
            <span>离线模式</span>
            <input :checked="source.is_offline === 1" type="checkbox" @change="quickToggle(source, 'is_offline', ($event.target as HTMLInputElement).checked)" />
          </label>
          <label class="toggle-item">
            <span>允许搜索</span>
            <input :checked="source.allow_search !== 0" type="checkbox" @change="quickToggle(source, 'allow_search', ($event.target as HTMLInputElement).checked)" />
          </label>
          <label class="toggle-item">
            <span>允许用户数据</span>
            <input :checked="source.allow_query_user_info !== 0" type="checkbox" @change="quickToggle(source, 'allow_query_user_info', ($event.target as HTMLInputElement).checked)" />
          </label>
          <label class="toggle-item">
            <span>允许内容脚本</span>
            <input :checked="source.allow_content_script !== 0" type="checkbox" @change="quickToggle(source, 'allow_content_script', ($event.target as HTMLInputElement).checked)" />
          </label>
        </div>

        <div class="config-grid">
          <div><strong>时区</strong><span>{{ source.timezone_offset || '+0800' }}</span></div>
          <div><strong>请求超时</strong><span>{{ source.request_timeout ?? 30000 }} ms</span></div>
          <div><strong>下载间隔</strong><span>{{ source.download_interval ?? 0 }} s</span></div>
          <div><strong>上传限速</strong><span>{{ source.upload_speed_limit ?? 0 }} MiB/s</span></div>
        </div>
      </div>
    </div>

    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal small-modal">
        <div class="modal-header">
          <h2>添加站点</h2>
          <button class="modal-close" @click="showAddModal = false">&times;</button>
        </div>
        <div class="modal-grid">
          <div class="form-group"><label>站点名称</label><input v-model="addForm.name" class="input" /></div>
          <div class="form-group"><label>网站地址</label><input v-model="addForm.site_url" class="input" placeholder="https://example.com/" /></div>
          <div class="form-group"><label>分类</label><input v-model="addForm.category" class="input" /></div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showAddModal = false">取消</button>
          <button class="btn btn-primary" :disabled="creating" @click="createSite">
            {{ creating ? '创建中...' : '完成' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showEditModal && activeSource" class="modal-overlay" @click.self="showEditModal = false">
      <div class="modal">
        <div class="modal-header">
          <h2>{{ activeSource.name }} - 站点设置</h2>
          <button class="modal-close" @click="showEditModal = false">&times;</button>
        </div>

        <div class="modal-grid">
          <div class="form-group"><label>显示名称</label><input v-model="form.custom_name" class="input" /></div>
          <div class="form-group"><label>分组</label><input v-model="form.groups" class="input" placeholder="影视, 动漫, 音乐" /></div>
          <div class="form-group"><label>时区</label><input v-model="form.timezone_offset" class="input" placeholder="+0800" /></div>
          <div class="form-group"><label>Cookie</label><input v-model="form.cookie" class="input" type="password" /></div>
          <div class="form-group"><label>Passkey</label><input v-model="form.passkey" class="input" type="password" /></div>
          <div class="form-group"><label>下载链接附加参数</label><input v-model="form.download_link_appendix" class="input" /></div>
          <div class="form-group"><label>请求超时(ms)</label><input v-model.number="form.request_timeout" type="number" class="input" /></div>
          <div class="form-group"><label>下载间隔(s)</label><input v-model.number="form.download_interval" type="number" class="input" /></div>
          <div class="form-group"><label>上传限速(MiB/s)</label><input v-model.number="form.upload_speed_limit" type="number" class="input" /></div>
        </div>

        <div class="switch-section">
          <label><input v-model="form.enabled" type="checkbox" /> 启用抓取</label>
          <label><input v-model="form.is_offline" type="checkbox" /> 离线模式</label>
          <label><input v-model="form.allow_search" type="checkbox" /> 允许搜索</label>
          <label><input v-model="form.allow_query_user_info" type="checkbox" /> 允许用户数据</label>
          <label><input v-model="form.allow_content_script" type="checkbox" /> 允许内容脚本</label>
        </div>

        <div class="modal-footer">
          <button class="btn" @click="showEditModal = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveSiteSettings">
            {{ saving ? '保存中...' : '保存设置' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="toDelete" class="modal-overlay" @click.self="toDelete = null">
      <div class="modal small-modal">
        <div class="modal-header">
          <h2>删除站点</h2>
          <button class="modal-close" @click="toDelete = null">&times;</button>
        </div>
        <p>确认删除站点 “{{ toDelete.custom_name || toDelete.name }}”？</p>
        <div class="modal-footer">
          <button class="btn" @click="toDelete = null">取消</button>
          <button class="btn btn-danger" @click="deleteSite">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.site-settings-page {
  max-width: 1280px;
  margin: 0 auto;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}
.header-actions,
.site-actions {
  display: flex;
  gap: 8px;
}
.page-title {
  font-size: 28px;
  margin: 0 0 6px;
}
.page-subtitle {
  margin: 0;
  color: var(--color-text-secondary);
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.stat-card,
.card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 16px;
}
.stat-label {
  color: var(--color-text-secondary);
  font-size: 13px;
  margin-bottom: 8px;
}
.stat-value {
  font-size: 24px;
  font-weight: 700;
}
.toolbar {
  margin-bottom: 16px;
}
.search-input {
  width: 100%;
}
.site-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}
.site-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.site-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.site-title {
  margin: 0 0 4px;
  font-size: 20px;
}
.site-url {
  color: var(--color-text-secondary);
  word-break: break-all;
  font-size: 13px;
}
.site-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.tag {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.12);
  color: #1d4ed8;
  font-size: 12px;
}
.tag.secondary {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}
.toggle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}
.toggle-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg-primary);
}
.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.config-grid div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border-radius: 10px;
  background: var(--color-bg-primary);
}
.config-grid span {
  color: var(--color-text-secondary);
}
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 20px;
}
.modal {
  width: min(900px, 100%);
  max-height: 90vh;
  overflow: auto;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 20px;
}
.small-modal {
  width: min(560px, 100%);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.modal-close {
  border: none;
  background: transparent;
  font-size: 28px;
  cursor: pointer;
  color: var(--color-text-secondary);
}
.modal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.switch-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin-top: 16px;
}
.switch-section label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--color-bg-secondary);
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}
.btn {
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  cursor: pointer;
}
.btn-small {
  padding: 6px 10px;
  font-size: 12px;
}
.btn-primary {
  background: var(--color-accent);
  color: #fff;
  border-color: var(--color-accent);
}
.btn-danger {
  background: #dc2626;
  color: #fff;
  border-color: #dc2626;
}
.input {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}
.loading {
  display: flex;
  justify-content: center;
  padding: 48px;
}
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
