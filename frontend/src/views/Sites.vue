<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { sitesApi, type Site } from '../api';

interface SiteFormState {
  name: string;
  custom_name: string;
  site_url: string;
  category: string;
  groups: string;
  cookie: string;
  passkey: string;
  timezone_offset: string;
  download_link_appendix: string;
  request_timeout: number;
  download_interval: number;
  upload_speed_limit: number;
  enabled: boolean;
  is_offline: boolean;
  allow_search: boolean;
  allow_query_user_info: boolean;
  allow_content_script: boolean;
}

const loading = ref(true);
const saving = ref(false);
const deletingId = ref<number | null>(null);
const togglingId = ref<number | null>(null);
const pageError = ref('');
const successMessage = ref('');
const errorMessage = ref('');

const sites = ref<Site[]>([]);
const search = ref('');
const categoryFilter = ref('');
const editingSite = ref<Site | null>(null);
const showModal = ref(false);

const form = ref<SiteFormState>(createEmptyForm());

function createEmptyForm(): SiteFormState {
  return {
    name: '',
    custom_name: '',
    site_url: '',
    category: '',
    groups: '',
    cookie: '',
    passkey: '',
    timezone_offset: '+0800',
    download_link_appendix: '',
    request_timeout: 30000,
    download_interval: 0,
    upload_speed_limit: 0,
    enabled: true,
    is_offline: false,
    allow_search: true,
    allow_query_user_info: true,
    allow_content_script: true,
  };
}

function resetMessages() {
  successMessage.value = '';
  errorMessage.value = '';
}

function showSuccess(message: string) {
  successMessage.value = message;
  errorMessage.value = '';
}

function showError(message: string) {
  errorMessage.value = message;
  successMessage.value = '';
}

const categoryOptions = computed(() =>
  Array.from(new Set(sites.value.map(site => site.category).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
);

const filteredSites = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  return sites.value.filter((site) => {
    const matchesSearch =
      !keyword ||
      [site.name, site.custom_name, site.site_url, site.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));

    const matchesCategory = !categoryFilter.value || site.category === categoryFilter.value;
    return matchesSearch && matchesCategory;
  });
});

const stats = computed(() => {
  const total = sites.value.length;
  const enabled = sites.value.filter(site => Number(site.enabled) === 1).length;
  const offline = sites.value.filter(site => Number(site.is_offline) === 1).length;
  const synced = sites.value.filter(site => !!site.cookie_updated_at).length;
  return { total, enabled, offline, synced };
});

function fillForm(site?: Site) {
  if (!site) {
    form.value = createEmptyForm();
    return;
  }

  form.value = {
    name: site.name || '',
    custom_name: site.custom_name || '',
    site_url: site.site_url || '',
    category: site.category || '',
    groups: (site.groups || []).join(', '),
    cookie: site.cookie || '',
    passkey: site.passkey || '',
    timezone_offset: site.timezone_offset || '+0800',
    download_link_appendix: site.download_link_appendix || '',
    request_timeout: site.request_timeout ?? 30000,
    download_interval: site.download_interval ?? 0,
    upload_speed_limit: site.upload_speed_limit ?? 0,
    enabled: Number(site.enabled) === 1,
    is_offline: Number(site.is_offline) === 1,
    allow_search: Number(site.allow_search ?? 1) === 1,
    allow_query_user_info: Number(site.allow_query_user_info ?? 1) === 1,
    allow_content_script: Number(site.allow_content_script ?? 1) === 1,
  };
}

async function loadSitesPage() {
  loading.value = true;
  pageError.value = '';
  try {
    sites.value = await sitesApi.list();
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : '站点设置页面加载失败。';
  }

  loading.value = false;
}

function openCreateModal() {
  resetMessages();
  editingSite.value = null;
  fillForm();
  showModal.value = true;
}

function openEditModal(site: Site) {
  resetMessages();
  editingSite.value = site;
  fillForm(site);
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  editingSite.value = null;
  fillForm();
}

function buildPayload() {
  return {
    name: form.value.name.trim(),
    custom_name: form.value.custom_name.trim() || null,
    site_url: form.value.site_url.trim(),
    category: form.value.category.trim(),
    groups: form.value.groups
      .split(',')
      .map(item => item.trim())
      .filter(Boolean),
    cookie: form.value.cookie.trim(),
    passkey: form.value.passkey.trim() || null,
    timezone_offset: form.value.timezone_offset.trim() || null,
    download_link_appendix: form.value.download_link_appendix.trim() || null,
    request_timeout: Number(form.value.request_timeout || 30000),
    download_interval: Number(form.value.download_interval || 0),
    upload_speed_limit: Number(form.value.upload_speed_limit || 0),
    enabled: form.value.enabled,
    is_offline: form.value.is_offline,
    allow_search: form.value.allow_search,
    allow_query_user_info: form.value.allow_query_user_info,
    allow_content_script: form.value.allow_content_script,
  };
}

async function saveSite() {
  const payload = buildPayload();
  if (!payload.name || !payload.site_url) {
    showError('站点名称和网站地址不能为空。');
    return;
  }

  resetMessages();
  saving.value = true;
  try {
    if (editingSite.value) {
      await sitesApi.update(editingSite.value.id, payload);
      showSuccess(`已更新站点 ${payload.name}。`);
    } else {
      await sitesApi.create(payload);
      showSuccess(`已添加站点 ${payload.name}。`);
    }
    await loadSitesPage();
    closeModal();
  } catch (error) {
    showError(error instanceof Error ? error.message : '保存站点失败。');
  } finally {
    saving.value = false;
  }
}

async function deleteSite(site: Site) {
  resetMessages();
  deletingId.value = site.id;
  try {
    await sitesApi.delete(site.id);
    await loadSitesPage();
    showSuccess(`已删除站点 ${site.custom_name || site.name}。`);
  } catch (error) {
    showError(error instanceof Error ? error.message : '删除站点失败。');
  } finally {
    deletingId.value = null;
  }
}

async function toggleSite(site: Site, field: 'enabled' | 'is_offline' | 'allow_search' | 'allow_query_user_info' | 'allow_content_script') {
  resetMessages();
  togglingId.value = site.id;
  try {
    const nextValue = Number((site as Record<string, unknown>)[field] ?? 0) !== 1;
    await sitesApi.update(site.id, { [field]: nextValue });
    await loadSitesPage();
  } catch (error) {
    showError(error instanceof Error ? error.message : '更新站点开关失败。');
  } finally {
    togglingId.value = null;
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

onMounted(loadSitesPage);
</script>

<template>
  <div class="sites-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">站点设置</h1>
        <p class="page-subtitle">站点配置与 RSS 源完全分离，我的数据页面只读取这里的站点信息。</p>
      </div>
      <div class="header-actions">
        <button class="btn" type="button" @click="loadSitesPage">刷新</button>
        <button class="btn btn-primary" type="button" @click="openCreateModal">添加站点</button>
      </div>
    </div>

    <div v-if="successMessage" class="message success-message">{{ successMessage }}</div>
    <div v-if="errorMessage" class="message error-message">{{ errorMessage }}</div>
    <div v-if="pageError" class="message warning-message">{{ pageError }}</div>

    <div v-if="loading" class="loading"><div class="spinner"></div></div>

    <template v-else>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">站点总数</div>
          <div class="stat-value">{{ stats.total }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">启用站点</div>
          <div class="stat-value">{{ stats.enabled }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">已同步 Cookie</div>
          <div class="stat-value">{{ stats.synced }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">离线模式</div>
          <div class="stat-value">{{ stats.offline }}</div>
        </div>
      </div>

      <section class="card section-card">
        <div class="toolbar">
          <input v-model="search" class="input search-input" type="text" placeholder="按站点名称、自定义名称、网址或分类搜索" />
          <select v-model="categoryFilter" class="select category-select">
            <option value="">全部分类</option>
            <option v-for="category in categoryOptions" :key="category" :value="category">{{ category }}</option>
          </select>
        </div>

        <div v-if="filteredSites.length" class="site-list">
          <article v-for="site in filteredSites" :key="site.id" class="site-card">
            <div class="site-top">
              <div class="site-identity">
                <h3>{{ site.custom_name || site.name }}</h3>
                <p class="muted-text">{{ site.site_url }}</p>
              </div>
              <div class="site-actions">
                <button class="btn btn-sm" type="button" @click="openEditModal(site)">编辑</button>
                <button class="btn btn-sm btn-danger" type="button" :disabled="deletingId === site.id" @click="deleteSite(site)">
                  {{ deletingId === site.id ? '删除中...' : '删除' }}
                </button>
              </div>
            </div>

            <div class="meta-grid">
              <div class="meta-item">
                <span class="meta-label">分类</span>
                <strong>{{ site.category || '未分类' }}</strong>
              </div>
              <div class="meta-item">
                <span class="meta-label">分组</span>
                <strong>{{ (site.groups || []).join(', ') || '-' }}</strong>
              </div>
              <div class="meta-item">
                <span class="meta-label">Cookie 更新时间</span>
                <strong>{{ formatDate(site.cookie_updated_at) }}</strong>
              </div>
              <div class="meta-item">
                <span class="meta-label">同步方式</span>
                <strong>{{ site.cookie_sync_mode || '-' }}</strong>
              </div>
            </div>

            <div class="switch-grid">
              <button class="switch-chip" type="button" :disabled="togglingId === site.id" @click="toggleSite(site, 'enabled')">
                <span>启用站点</span>
                <strong>{{ Number(site.enabled) === 1 ? '开启' : '关闭' }}</strong>
              </button>
              <button class="switch-chip" type="button" :disabled="togglingId === site.id" @click="toggleSite(site, 'is_offline')">
                <span>离线模式</span>
                <strong>{{ Number(site.is_offline) === 1 ? '开启' : '关闭' }}</strong>
              </button>
              <button class="switch-chip" type="button" :disabled="togglingId === site.id" @click="toggleSite(site, 'allow_search')">
                <span>允许搜索</span>
                <strong>{{ Number(site.allow_search ?? 1) === 1 ? '开启' : '关闭' }}</strong>
              </button>
              <button class="switch-chip" type="button" :disabled="togglingId === site.id" @click="toggleSite(site, 'allow_query_user_info')">
                <span>允许用户数据</span>
                <strong>{{ Number(site.allow_query_user_info ?? 1) === 1 ? '开启' : '关闭' }}</strong>
              </button>
              <button class="switch-chip" type="button" :disabled="togglingId === site.id" @click="toggleSite(site, 'allow_content_script')">
                <span>允许内容脚本</span>
                <strong>{{ Number(site.allow_content_script ?? 1) === 1 ? '开启' : '关闭' }}</strong>
              </button>
            </div>
          </article>
        </div>
        <div v-else class="empty-block">当前筛选条件下没有匹配的站点。</div>
      </section>
    </template>

    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal site-modal">
        <div class="modal-header">
          <h2 class="modal-title">{{ editingSite ? '编辑站点' : '添加站点' }}</h2>
          <button class="modal-close" type="button" @click="closeModal">&times;</button>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="site-name">站点名称</label>
            <input id="site-name" v-model="form.name" class="input" type="text" />
          </div>
          <div class="form-group">
            <label class="form-label" for="site-custom-name">自定义显示名称</label>
            <input id="site-custom-name" v-model="form.custom_name" class="input" type="text" />
          </div>
          <div class="form-group full-width">
            <label class="form-label" for="site-url">网站地址</label>
            <input id="site-url" v-model="form.site_url" class="input" type="url" placeholder="https://example.com" />
          </div>
          <div class="form-group">
            <label class="form-label" for="site-category">分类</label>
            <input id="site-category" v-model="form.category" class="input" type="text" />
          </div>
          <div class="form-group">
            <label class="form-label" for="site-groups">分组</label>
            <input id="site-groups" v-model="form.groups" class="input" type="text" placeholder="movie, tv" />
          </div>
          <div class="form-group full-width">
            <label class="form-label" for="site-cookie">Cookie</label>
            <textarea id="site-cookie" v-model="form.cookie" class="textarea" rows="4"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="site-passkey">Passkey</label>
            <input id="site-passkey" v-model="form.passkey" class="input" type="text" />
          </div>
          <div class="form-group">
            <label class="form-label" for="site-timezone">时区偏移</label>
            <input id="site-timezone" v-model="form.timezone_offset" class="input" type="text" placeholder="+0800" />
          </div>
          <div class="form-group full-width">
            <label class="form-label" for="site-download-appendix">下载链接附加参数</label>
            <input id="site-download-appendix" v-model="form.download_link_appendix" class="input" type="text" />
          </div>
          <div class="form-group">
            <label class="form-label" for="site-timeout">请求超时（毫秒）</label>
            <input id="site-timeout" v-model.number="form.request_timeout" class="input" type="number" min="1000" step="1000" />
          </div>
          <div class="form-group">
            <label class="form-label" for="site-download-interval">下载间隔（毫秒）</label>
            <input id="site-download-interval" v-model.number="form.download_interval" class="input" type="number" min="0" />
          </div>
          <div class="form-group">
            <label class="form-label" for="site-upload-limit">上传限速</label>
            <input id="site-upload-limit" v-model.number="form.upload_speed_limit" class="input" type="number" min="0" />
          </div>
        </div>

        <div class="toggle-grid">
          <label class="toggle-item"><input v-model="form.enabled" type="checkbox" /> 启用站点</label>
          <label class="toggle-item"><input v-model="form.is_offline" type="checkbox" /> 离线模式</label>
          <label class="toggle-item"><input v-model="form.allow_search" type="checkbox" /> 允许搜索</label>
          <label class="toggle-item"><input v-model="form.allow_query_user_info" type="checkbox" /> 允许用户数据</label>
          <label class="toggle-item"><input v-model="form.allow_content_script" type="checkbox" /> 允许内容脚本</label>
        </div>

        <div class="modal-footer">
          <button class="btn" type="button" @click="closeModal">取消</button>
          <button class="btn btn-primary" type="button" :disabled="saving" @click="saveSite">
            {{ saving ? '保存中...' : '保存站点' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sites-page {
  display: grid;
  gap: 16px;
}

.page-header,
.section-header,
.site-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.header-actions,
.site-actions,
.toolbar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.page-title {
  font-size: 30px;
  margin: 0;
}

.page-subtitle,
.section-subtitle,
.muted-text,
.meta-label {
  color: var(--color-text-secondary);
}

.section-card,
.site-card {
  display: grid;
  gap: 16px;
}

.site-card {
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-primary);
}

.site-identity h3 {
  margin: 0;
  font-size: 20px;
}

.site-identity p {
  margin: 4px 0 0;
  word-break: break-all;
}

.search-input {
  flex: 1;
  min-width: 260px;
}

.category-select {
  min-width: 200px;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.meta-item {
  padding: 12px;
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
  display: grid;
  gap: 4px;
}

.switch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

.switch-chip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  cursor: pointer;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.full-width {
  grid-column: 1 / -1;
}

.textarea {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  resize: vertical;
  min-height: 100px;
}

.toggle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.toggle-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.site-modal {
  width: min(960px, 96vw);
  max-width: 960px;
}

.message {
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
}

.success-message {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.25);
  color: #15803d;
}

.error-message {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.25);
  color: #b91c1c;
}

.warning-message {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.25);
  color: #b45309;
}

.empty-block {
  padding: 16px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
}

@media (max-width: 900px) {
  .page-header,
  .section-header,
  .site-top {
    flex-direction: column;
    align-items: stretch;
  }

  .category-select {
    min-width: 0;
  }
}
</style>
