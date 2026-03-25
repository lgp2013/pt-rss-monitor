<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import ThemeToggle from '../components/ThemeToggle.vue';
import {
  authApi,
  getStoredAuthUser,
  resourcesApi,
  settingsApi,
  setAuthSession,
  sourcesApi,
  type Source,
} from '../api';

interface SettingsStats {
  total_sources: number;
  total_resources: number;
  total_sites: number;
  sources_by_category: Record<string, number>;
  resources_today: number;
}

interface ExtensionSyncInfo {
  sync_key: string;
  endpoint_path: string;
  health_path: string;
}

const origin = window.location.origin;

const pageLoading = ref(true);
const pageError = ref('');

const stats = ref<SettingsStats>({
  total_sources: 0,
  total_resources: 0,
  total_sites: 0,
  sources_by_category: {},
  resources_today: 0,
});
const categories = ref<string[]>([]);
const sources = ref<Source[]>([]);
const extensionSync = ref<ExtensionSyncInfo>({
  sync_key: '',
  endpoint_path: '/api/extension/site-cookie-sync',
  health_path: '/api/extension/site-cookie-sync/health',
});

const settingsForm = ref({
  resource_retention_days: '30',
  default_fetch_interval: '30',
  request_timeout: '30000',
  dashboard_page_size: '10',
});

const newCategory = ref('');
const cleanDays = ref('30');
const categorySaving = ref(false);
const savingSettings = ref(false);
const sourceUpdatingId = ref<number | null>(null);
const cleanLoading = ref(false);
const cleanAllLoading = ref(false);
const syncLoading = ref(false);

const passwordForm = ref({
  current_password: '',
  new_password: '',
  confirm_password: '',
});
const passwordSaving = ref(false);
const resetAdminLoading = ref(false);

const successMessage = ref('');
const errorMessage = ref('');

const categoryOptions = computed(() => {
  const merged = new Set<string>();
  for (const category of categories.value) {
    if (category) merged.add(category);
  }
  for (const source of sources.value) {
    if (source.category) merged.add(source.category);
  }
  return Array.from(merged).sort((a, b) => a.localeCompare(b));
});

const categoryStats = computed(() =>
  Object.entries(stats.value.sources_by_category || {}).sort(([a], [b]) => a.localeCompare(b)),
);

const extensionEndpoint = computed(() => `${origin}${extensionSync.value.endpoint_path}`);
const extensionHealthUrl = computed(() => `${origin}${extensionSync.value.health_path}`);

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

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
  showSuccess('已复制到剪贴板。');
}

function applySettingsRecord(record: Record<string, string>) {
  settingsForm.value = {
    resource_retention_days: record.resource_retention_days || '30',
    default_fetch_interval: record.default_fetch_interval || '30',
    request_timeout: record.request_timeout || '30000',
    dashboard_page_size: record.dashboard_page_size || '10',
  };
  cleanDays.value = settingsForm.value.resource_retention_days;
}

async function loadSettingsPage() {
  pageLoading.value = true;
  pageError.value = '';

  const results = await Promise.allSettled([
    settingsApi.get(),
    settingsApi.getStats(),
    settingsApi.getCategories(),
    sourcesApi.list(),
    settingsApi.getExtensionSync(),
  ]);

  const [settingsResult, statsResult, categoriesResult, sourcesResult, syncResult] = results;

  if (settingsResult.status === 'fulfilled') {
    applySettingsRecord(settingsResult.value);
  }
  if (statsResult.status === 'fulfilled') {
    stats.value = statsResult.value;
  }
  if (categoriesResult.status === 'fulfilled') {
    categories.value = categoriesResult.value.categories || [];
  }
  if (sourcesResult.status === 'fulfilled') {
    sources.value = sourcesResult.value;
  }
  if (syncResult.status === 'fulfilled') {
    extensionSync.value = syncResult.value;
  }

  const failures = results.filter((item): item is PromiseRejectedResult => item.status === 'rejected');
  if (failures.length > 0) {
    const firstError = failures[0].reason;
    pageError.value = firstError instanceof Error ? firstError.message : '系统设置页面部分数据加载失败。';
  }

  pageLoading.value = false;
}

async function reloadStatsAndSources() {
  const [statsData, sourceData] = await Promise.all([settingsApi.getStats(), sourcesApi.list()]);
  stats.value = statsData;
  sources.value = sourceData;
}

async function saveSettings() {
  resetMessages();
  savingSettings.value = true;
  try {
    await settingsApi.update(settingsForm.value);
    cleanDays.value = settingsForm.value.resource_retention_days;
    showSuccess('系统设置已保存。');
  } catch (error) {
    showError(error instanceof Error ? error.message : '系统设置保存失败。');
  } finally {
    savingSettings.value = false;
  }
}

async function addCategory() {
  const name = newCategory.value.trim();
  if (!name) {
    showError('请输入分类名称。');
    return;
  }

  resetMessages();
  categorySaving.value = true;
  try {
    const result = await settingsApi.addCategory(name);
    categories.value = result.categories || [];
    newCategory.value = '';
    showSuccess('分类已添加。');
  } catch (error) {
    showError(error instanceof Error ? error.message : '添加分类失败。');
  } finally {
    categorySaving.value = false;
  }
}

async function deleteCategory(name: string) {
  resetMessages();
  categorySaving.value = true;
  try {
    const result = await settingsApi.deleteCategory(name);
    categories.value = result.categories || [];
    await reloadStatsAndSources();
    showSuccess(`分类“${name}”已删除。`);
  } catch (error) {
    showError(error instanceof Error ? error.message : '删除分类失败。');
  } finally {
    categorySaving.value = false;
  }
}

async function updateSourceCategory(source: Source, category: string) {
  resetMessages();
  sourceUpdatingId.value = source.id;
  try {
    await sourcesApi.update(source.id, { category });
    await reloadStatsAndSources();
    showSuccess(`已更新 ${source.name} 的分类。`);
  } catch (error) {
    showError(error instanceof Error ? error.message : '更新 RSS 源分类失败。');
  } finally {
    sourceUpdatingId.value = null;
  }
}

function isStrongPassword(value: string) {
  return /[A-Za-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

async function changePassword() {
  resetMessages();

  if (!passwordForm.value.current_password || !passwordForm.value.new_password || !passwordForm.value.confirm_password) {
    showError('请填写原密码、新密码和确认密码。');
    return;
  }

  if (passwordForm.value.new_password !== passwordForm.value.confirm_password) {
    showError('新密码和确认密码不一致。');
    return;
  }

  if (!isStrongPassword(passwordForm.value.new_password)) {
    showError('密码必须包含字母、数字和特殊字符。');
    return;
  }

  passwordSaving.value = true;
  try {
    const result = await authApi.changePassword(passwordForm.value);
    const user = getStoredAuthUser();
    if (user) {
      setAuthSession(result.token, user);
    }
    passwordForm.value = {
      current_password: '',
      new_password: '',
      confirm_password: '',
    };
    showSuccess('密码已修改。');
  } catch (error) {
    showError(error instanceof Error ? error.message : '修改密码失败。');
  } finally {
    passwordSaving.value = false;
  }
}

async function resetAdminPassword() {
  resetMessages();
  resetAdminLoading.value = true;
  try {
    const result = await authApi.resetAdminPassword();
    const user = getStoredAuthUser();
    if (user) {
      setAuthSession(result.token, user);
    }
    showSuccess(`admin 密码已重置为 ${result.default_password}。`);
  } catch (error) {
    showError(error instanceof Error ? error.message : '重置 admin 密码失败。');
  } finally {
    resetAdminLoading.value = false;
  }
}

async function regenerateSyncKey() {
  resetMessages();
  syncLoading.value = true;
  try {
    extensionSync.value = await settingsApi.regenerateExtensionSync();
    showSuccess('同步密钥已重新生成。');
  } catch (error) {
    showError(error instanceof Error ? error.message : '重新生成同步密钥失败。');
  } finally {
    syncLoading.value = false;
  }
}

async function cleanResources() {
  resetMessages();
  cleanLoading.value = true;
  try {
    const days = Number(cleanDays.value || settingsForm.value.resource_retention_days || '30');
    const result = await resourcesApi.clean(days);
    await reloadStatsAndSources();
    showSuccess(`已清理 ${days} 天前的 ${result.deleted} 条资源。`);
  } catch (error) {
    showError(error instanceof Error ? error.message : '清理旧资源失败。');
  } finally {
    cleanLoading.value = false;
  }
}

async function cleanAllResources() {
  resetMessages();
  cleanAllLoading.value = true;
  try {
    const result = await resourcesApi.cleanAll();
    await reloadStatsAndSources();
    showSuccess(`已删除 ${result.deleted} 条资源。`);
  } catch (error) {
    showError(error instanceof Error ? error.message : '清空资源失败。');
  } finally {
    cleanAllLoading.value = false;
  }
}

onMounted(loadSettingsPage);
</script>

<template>
  <div class="settings-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">系统设置</h1>
        <p class="page-subtitle">查看统计信息、管理扩展接入、账号安全、分类和数据清理。</p>
      </div>
      <button class="btn" type="button" @click="loadSettingsPage">刷新</button>
    </div>

    <div v-if="successMessage" class="message success-message">{{ successMessage }}</div>
    <div v-if="errorMessage" class="message error-message">{{ errorMessage }}</div>
    <div v-if="pageError" class="message warning-message">{{ pageError }}</div>

    <div v-if="pageLoading" class="loading"><div class="spinner"></div></div>

    <template v-else>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">资源总数</div>
          <div class="stat-value">{{ stats.total_resources }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">RSS 源订阅数</div>
          <div class="stat-value">{{ stats.total_sources }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">站点总数</div>
          <div class="stat-value">{{ stats.total_sites }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">今日新增资源</div>
          <div class="stat-value">{{ stats.resources_today }}</div>
        </div>
      </div>

      <div class="settings-grid">
        <section class="card section-card">
          <div class="section-header">
            <div>
              <h2 class="section-title">基础设置</h2>
              <p class="section-subtitle">保存到系统配置表，供抓取和清理任务使用。</p>
            </div>
            <button class="btn btn-primary" type="button" :disabled="savingSettings" @click="saveSettings">
              {{ savingSettings ? '保存中...' : '保存设置' }}
            </button>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="retention-days">资源保留天数</label>
              <input id="retention-days" v-model="settingsForm.resource_retention_days" class="input" type="number" min="1" />
            </div>
            <div class="form-group">
              <label class="form-label" for="default-fetch-interval">默认 RSS 抓取间隔（分钟）</label>
              <input id="default-fetch-interval" v-model="settingsForm.default_fetch_interval" class="input" type="number" min="1" />
            </div>
            <div class="form-group">
              <label class="form-label" for="request-timeout">默认请求超时（毫秒）</label>
              <input id="request-timeout" v-model="settingsForm.request_timeout" class="input" type="number" min="1000" step="1000" />
            </div>
            <div class="form-group">
              <label class="form-label" for="dashboard-page-size">资源列表每页数量</label>
              <select id="dashboard-page-size" v-model="settingsForm.dashboard_page_size" class="select">
                <option value="10">10</option>
                <option value="30">30</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        </section>

        <section class="card section-card">
          <div class="section-header">
            <div>
              <h2 class="section-title">扩展接入</h2>
              <p class="section-subtitle">浏览器插件同步 Cookie 时使用以下服务地址和同步密钥。</p>
            </div>
            <button class="btn" type="button" :disabled="syncLoading" @click="regenerateSyncKey">
              {{ syncLoading ? '生成中...' : '重置同步密钥' }}
            </button>
          </div>

          <div class="field-stack">
            <div class="field-row">
              <div class="field-meta">
                <label class="form-label">服务地址</label>
                <input class="input" :value="extensionEndpoint" readonly />
              </div>
              <button class="btn" type="button" @click="copyText(extensionEndpoint)">复制</button>
            </div>
            <div class="field-row">
              <div class="field-meta">
                <label class="form-label">健康检查地址</label>
                <input class="input" :value="extensionHealthUrl" readonly />
              </div>
              <button class="btn" type="button" @click="copyText(extensionHealthUrl)">复制</button>
            </div>
            <div class="field-row">
              <div class="field-meta">
                <label class="form-label">同步密钥</label>
                <input class="input" :value="extensionSync.sync_key" readonly />
              </div>
              <button class="btn" type="button" @click="copyText(extensionSync.sync_key)">复制</button>
            </div>
          </div>
        </section>

        <section class="card section-card">
          <div class="section-header">
            <div>
              <h2 class="section-title">账号安全</h2>
              <p class="section-subtitle">修改当前登录账号密码，或重置内置 admin 账号密码。</p>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="current-password">原密码</label>
              <input id="current-password" v-model="passwordForm.current_password" class="input" type="password" autocomplete="current-password" />
            </div>
            <div class="form-group">
              <label class="form-label" for="new-password">新密码</label>
              <input id="new-password" v-model="passwordForm.new_password" class="input" type="password" autocomplete="new-password" />
            </div>
            <div class="form-group">
              <label class="form-label" for="confirm-password">确认密码</label>
              <input id="confirm-password" v-model="passwordForm.confirm_password" class="input" type="password" autocomplete="new-password" />
            </div>
          </div>

          <div class="button-row">
            <button class="btn btn-primary" type="button" :disabled="passwordSaving" @click="changePassword">
              {{ passwordSaving ? '修改中...' : '修改密码' }}
            </button>
            <button class="btn" type="button" :disabled="resetAdminLoading" @click="resetAdminPassword">
              {{ resetAdminLoading ? '重置中...' : '重置 admin 密码' }}
            </button>
          </div>

          <p class="section-note">密码必须包含字母、数字和特殊字符。</p>
        </section>

        <section class="card section-card">
          <div class="section-header">
            <div>
              <h2 class="section-title">分类管理</h2>
              <p class="section-subtitle">这里的分类会作为 RSS 源新增和编辑时的分类选项。</p>
            </div>
          </div>

          <div class="inline-form">
            <input v-model="newCategory" class="input" type="text" placeholder="输入分类名称" />
            <button class="btn btn-primary" type="button" :disabled="categorySaving" @click="addCategory">
              {{ categorySaving ? '保存中...' : '添加分类' }}
            </button>
          </div>

          <div v-if="categoryOptions.length" class="chip-list">
            <div v-for="category in categoryOptions" :key="category" class="chip">
              <span>{{ category }}</span>
              <button class="chip-action" type="button" @click="deleteCategory(category)">删除</button>
            </div>
          </div>
          <div v-else class="empty-block">当前没有配置分类。</div>
        </section>

        <section class="card section-card">
          <div class="section-header">
            <div>
              <h2 class="section-title">RSS 源分类分配</h2>
              <p class="section-subtitle">为每个 RSS 源分配分类。删除分类后，对应 RSS 源会自动变为未分类。</p>
            </div>
          </div>

          <div v-if="sources.length" class="source-list">
            <div v-for="source in sources" :key="source.id" class="source-row">
              <div class="source-info">
                <strong>{{ source.name }}</strong>
                <span class="muted-text">{{ source.url }}</span>
              </div>
              <select
                class="select source-select"
                :disabled="sourceUpdatingId === source.id"
                :value="source.category || ''"
                @change="updateSourceCategory(source, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">未分类</option>
                <option v-for="category in categoryOptions" :key="category" :value="category">{{ category }}</option>
              </select>
            </div>
          </div>
          <div v-else class="empty-block">当前没有配置 RSS 源。</div>
        </section>

        <section class="card section-card">
          <div class="section-header">
            <div>
              <h2 class="section-title">分类统计</h2>
              <p class="section-subtitle">当前各 RSS 分类下的订阅数量。</p>
            </div>
          </div>

          <div v-if="categoryStats.length" class="distribution-list">
            <div v-for="[category, count] in categoryStats" :key="category" class="distribution-row">
              <span>{{ category }}</span>
              <strong>{{ count }}</strong>
            </div>
          </div>
          <div v-else class="empty-block">当前没有分类统计数据。</div>
        </section>

        <section class="card section-card">
          <div class="section-header">
            <div>
              <h2 class="section-title">数据管理</h2>
              <p class="section-subtitle">清理数据库中的旧资源，或直接清空全部资源数据。</p>
            </div>
          </div>

          <div class="inline-form">
            <input v-model="cleanDays" class="input small-input" type="number" min="1" />
            <button class="btn" type="button" :disabled="cleanLoading" @click="cleanResources">
              {{ cleanLoading ? '清理中...' : '清理旧资源' }}
            </button>
            <button class="btn btn-danger" type="button" :disabled="cleanAllLoading" @click="cleanAllResources">
              {{ cleanAllLoading ? '删除中...' : '清空全部资源' }}
            </button>
          </div>
        </section>

        <section class="card section-card">
          <div class="section-header">
            <div>
              <h2 class="section-title">主题设置</h2>
              <p class="section-subtitle">设置当前浏览器下的界面主题偏好。</p>
            </div>
          </div>
          <ThemeToggle />
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.settings-page {
  display: grid;
  gap: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.page-title {
  font-size: 30px;
  margin: 0;
}

.page-subtitle {
  margin: 6px 0 0;
  color: var(--color-text-secondary);
}

.settings-grid {
  display: grid;
  gap: 16px;
}

.section-card {
  display: grid;
  gap: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.section-title {
  margin: 0;
  font-size: 20px;
}

.section-subtitle,
.section-note,
.muted-text {
  color: var(--color-text-secondary);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.field-stack {
  display: grid;
  gap: 12px;
}

.field-row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
}

.field-meta {
  flex: 1;
}

.field-meta .input {
  width: 100%;
}

.button-row,
.inline-form {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.inline-form .input {
  flex: 1;
  min-width: 220px;
}

.small-input {
  max-width: 120px;
}

.chip-list {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-bg-primary);
}

.chip-action {
  border: none;
  background: transparent;
  color: var(--color-danger);
  cursor: pointer;
  font-size: 12px;
}

.source-list,
.distribution-list {
  display: grid;
  gap: 12px;
}

.source-row,
.distribution-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
}

.source-info {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.source-select {
  min-width: 180px;
}

.empty-block {
  padding: 16px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  background: var(--color-bg-primary);
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

@media (max-width: 900px) {
  .page-header,
  .section-header,
  .field-row,
  .source-row,
  .distribution-row {
    flex-direction: column;
    align-items: stretch;
  }

  .source-select,
  .small-input {
    max-width: none;
    width: 100%;
  }
}
</style>
