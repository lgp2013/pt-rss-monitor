<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  authApi,
  getStoredAuthUser,
  resourcesApi,
  setAuthSession,
  settingsApi,
  sourcesApi,
} from '../api';
import ThemeToggle from '../components/ThemeToggle.vue';

const settings = ref({
  global_fetch_interval: '30',
  auto_fetch_enabled: 'true',
  theme: 'system',
  resources_retention_days: '30',
});
const stats = ref({
  total_sources: 0,
  total_resources: 0,
  total_sites: 0,
  sources_by_category: {} as Record<string, number>,
  resources_today: 0,
});
const loading = ref(false);
const saving = ref(false);
const passwordSaving = ref(false);
const resetAdminSaving = ref(false);

const categories = ref<string[]>([]);
const newCategory = ref('');
const sources = ref<any[]>([]);
const passwordForm = ref({
  current_password: '',
  new_password: '',
  confirm_password: '',
});

async function loadSettings() {
  loading.value = true;
  try {
    const [settingsData, statsData, categoriesData, sourcesData] = await Promise.all([
      settingsApi.get(),
      settingsApi.getStats(),
      settingsApi.getCategories(),
      sourcesApi.list(),
    ]);
    settings.value = { ...settings.value, ...settingsData };
    stats.value = statsData;
    categories.value = categoriesData.categories || [];
    sources.value = sourcesData;
  } catch (error) {
    console.error('Failed to load settings:', error);
  } finally {
    loading.value = false;
  }
}

async function saveSettings() {
  saving.value = true;
  try {
    await settingsApi.update(settings.value);
    alert('设置已保存');
    await loadSettings();
  } catch (error) {
    console.error('Failed to save settings:', error);
    alert('保存失败');
  } finally {
    saving.value = false;
  }
}

async function cleanOldResources() {
  const days = parseInt(settings.value.resources_retention_days, 10);
  if (!confirm(`确定清理 ${days} 天前的资源吗？`)) return;

  try {
    const result = await resourcesApi.clean(days);
    alert(`已清理 ${result.deleted} 条资源`);
    await loadSettings();
  } catch (error) {
    console.error('Failed to clean resources:', error);
    alert('清理失败');
  }
}

async function cleanAllResources() {
  if (!confirm('确定清空所有资源吗？此操作会直接删除数据库中的资源记录。')) return;
  if (!confirm('再次确认：删除全部资源？')) return;

  try {
    const result = await resourcesApi.cleanAll();
    alert(`已清空 ${result.deleted} 条资源`);
    await loadSettings();
  } catch (error) {
    console.error('Failed to clean all resources:', error);
    alert('清理失败');
  }
}

async function addCategory() {
  const category = newCategory.value.trim();
  if (!category) return;
  try {
    const result = await settingsApi.addCategory(category);
    categories.value = result.categories;
    newCategory.value = '';
    await loadSettings();
  } catch (error) {
    console.error('Failed to add category:', error);
    alert((error as Error).message || '添加分类失败');
  }
}

async function deleteCategory(category: string) {
  if (!confirm(`确定删除分类“${category}”吗？该分类下的 RSS 源会被置为空分类。`)) return;
  try {
    const result = await settingsApi.deleteCategory(category);
    categories.value = result.categories;
    await loadSettings();
  } catch (error) {
    console.error('Failed to delete category:', error);
    alert((error as Error).message || '删除分类失败');
  }
}

async function updateSourceCategory(sourceId: number, newCategoryValue: string) {
  try {
    await sourcesApi.update(sourceId, { category: newCategoryValue });
    await loadSettings();
  } catch (error) {
    console.error('Failed to update source category:', error);
    alert('更新 RSS 源分类失败');
  }
}

function validatePassword(password: string) {
  return /[A-Za-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

async function changePassword() {
  if (!passwordForm.value.current_password || !passwordForm.value.new_password || !passwordForm.value.confirm_password) {
    alert('请完整填写原密码、新密码、确认密码');
    return;
  }

  if (passwordForm.value.new_password !== passwordForm.value.confirm_password) {
    alert('新密码和确认密码不一致');
    return;
  }

  if (!validatePassword(passwordForm.value.new_password)) {
    alert('密码必须包含字母、数字和特殊字符');
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
    alert('密码修改成功');
  } catch (error) {
    console.error('Failed to change password:', error);
    alert((error as Error).message || '密码修改失败');
  } finally {
    passwordSaving.value = false;
  }
}

async function resetAdminPassword() {
  if (!confirm('确定将 admin 密码重置为默认值 admin@123 吗？')) return;

  resetAdminSaving.value = true;
  try {
    const result = await authApi.resetAdminPassword();
    const user = getStoredAuthUser();
    if (user) {
      setAuthSession(result.token, user);
    }
    passwordForm.value = {
      current_password: '',
      new_password: '',
      confirm_password: '',
    };
    alert(`admin 密码已重置为默认值：${result.default_password}`);
  } catch (error) {
    console.error('Failed to reset admin password:', error);
    alert((error as Error).message || '重置 admin 密码失败');
  } finally {
    resetAdminSaving.value = false;
  }
}

onMounted(loadSettings);
</script>

<template>
  <div class="settings">
    <h1 class="page-title">系统设置</h1>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <template v-else>
      <section class="settings-section">
        <h2 class="section-title">统计信息</h2>
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

        <div v-if="Object.keys(stats.sources_by_category).length > 0" class="category-stats">
          <h3>RSS 分类统计</h3>
          <div class="category-tags">
            <span v-for="(count, category) in stats.sources_by_category" :key="category" class="tag">
              {{ category }}: {{ count }}
            </span>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <h2 class="section-title">账户安全</h2>

        <div class="password-form security-panel">
          <div class="password-grid">
            <div class="form-field">
              <label class="form-label">原密码</label>
              <input v-model="passwordForm.current_password" type="password" class="input" autocomplete="current-password" />
            </div>
            <div class="form-field">
              <label class="form-label">新密码</label>
              <input v-model="passwordForm.new_password" type="password" class="input" autocomplete="new-password" />
            </div>
            <div class="form-field">
              <label class="form-label">确认密码</label>
              <input v-model="passwordForm.confirm_password" type="password" class="input" autocomplete="new-password" />
            </div>
          </div>

          <p class="section-description">新密码必须包含字母、数字和特殊字符。</p>

          <div class="security-actions">
            <button class="btn btn-primary security-btn" :disabled="passwordSaving" @click="changePassword">
              {{ passwordSaving ? '修改中...' : '修改密码' }}
            </button>
            <button class="btn security-btn security-btn-secondary" :disabled="resetAdminSaving" @click="resetAdminPassword">
              {{ resetAdminSaving ? '重置中...' : '重置 admin 密码' }}
            </button>
          </div>

          <p class="helper-text">重置后 admin 密码将恢复为默认值 `admin@123`。</p>
        </div>
      </section>

      <section class="settings-section">
        <h2 class="section-title">分类管理</h2>
        <p class="section-description">这里管理的是 RSS 源分类，数据会持久化保存到数据库。</p>

        <div class="category-list">
          <div v-for="category in categories" :key="category" class="category-item">
            <div class="category-info">
              <span class="category-name">{{ category }}</span>
              <span class="category-count">{{ stats.sources_by_category[category] || 0 }} 个 RSS 源</span>
            </div>
            <button class="btn btn-small btn-danger" @click="deleteCategory(category)">删除</button>
          </div>
          <div v-if="categories.length === 0" class="empty-message">暂无分类</div>
        </div>

        <div class="add-category-form">
          <input v-model="newCategory" type="text" class="input" placeholder="输入新的 RSS 分类..." @keyup.enter="addCategory" />
          <button class="btn btn-primary" @click="addCategory">添加</button>
        </div>
      </section>

      <section class="settings-section">
        <h2 class="section-title">RSS 源分类分配</h2>
        <p class="section-description">这里修改的是具体 RSS 源的分类归属。</p>

        <div class="source-category-list">
          <div v-for="source in sources" :key="source.id" class="source-category-item">
            <div class="source-name">{{ source.name }}</div>
            <select :value="source.category" class="select" @change="updateSourceCategory(source.id, ($event.target as HTMLSelectElement).value)">
              <option value="">未分类</option>
              <option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
            </select>
          </div>
          <div v-if="sources.length === 0" class="empty-message">暂无 RSS 源</div>
        </div>
      </section>

      <section class="settings-section">
        <h2 class="section-title">外观</h2>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">主题</div>
            <div class="setting-description">选择应用主题</div>
          </div>
          <ThemeToggle />
        </div>
      </section>

      <section class="settings-section">
        <h2 class="section-title">抓取设置</h2>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">全局抓取间隔</div>
            <div class="setting-description">定时抓取 RSS 的间隔，单位分钟</div>
          </div>
          <div class="setting-control">
            <input v-model="settings.global_fetch_interval" type="number" class="input" min="1" max="1440" style="width: 100px" />
            <span class="unit">分钟</span>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">自动抓取</div>
            <div class="setting-description">开启后按全局间隔自动抓取 RSS</div>
          </div>
          <div class="setting-control">
            <label class="toggle">
              <input v-model="settings.auto_fetch_enabled" type="checkbox" true-value="true" false-value="false" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <h2 class="section-title">数据管理</h2>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">资源保留天数</div>
            <div class="setting-description">超过该天数的资源可批量清理</div>
          </div>
          <div class="setting-control">
            <input v-model="settings.resources_retention_days" type="number" class="input" min="1" max="365" style="width: 100px" />
            <span class="unit">天</span>
          </div>
        </div>

        <div class="setting-actions">
          <button class="btn" @click="cleanOldResources">清理旧资源</button>
          <button class="btn btn-danger" @click="cleanAllResources">清空所有资源</button>
        </div>
      </section>

      <div class="settings-footer">
        <button class="btn btn-primary" :disabled="saving" @click="saveSettings">
          {{ saving ? '保存中...' : '保存设置' }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.settings {
  padding: 20px;
  max-width: 960px;
  margin: 0 auto;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 24px;
  color: var(--color-text-primary);
}

.settings-section {
  background: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--color-text-primary);
}

.section-description {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
}

.helper-text {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card {
  background: var(--color-bg-primary);
  padding: 16px;
  border-radius: 6px;
  text-align: center;
}

.stat-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.category-stats {
  margin-top: 16px;
}

.category-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  background: var(--color-bg-tertiary);
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.password-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.security-panel {
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg-primary);
}

.password-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.security-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.security-btn {
  min-width: 180px;
  min-height: 40px;
  font-weight: 600;
}

.security-btn-secondary {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
}

.security-btn-secondary:hover {
  background: var(--color-bg-secondary);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  color: var(--color-text-primary);
}

.category-list,
.source-category-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.category-list {
  margin-bottom: 16px;
}

.category-item,
.source-category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--color-bg-primary);
  border-radius: 6px;
  gap: 12px;
}

.category-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.category-name,
.source-name {
  font-weight: 500;
  color: var(--color-text-primary);
}

.category-count {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.add-category-form {
  display: flex;
  gap: 8px;
}

.add-category-form .input {
  flex: 1;
}

.source-category-item .select {
  width: 180px;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-info {
  flex: 1;
}

.setting-label {
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 2px;
}

.setting-description {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.setting-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.toggle {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: var(--color-bg-tertiary);
  transition: 0.3s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: '';
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: #fff;
  transition: 0.3s;
  border-radius: 50%;
}

.toggle input:checked + .toggle-slider {
  background-color: var(--color-accent);
}

.toggle input:checked + .toggle-slider:before {
  transform: translateX(24px);
}

.settings-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.empty-message {
  text-align: center;
  padding: 24px;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: 14px;
}

.btn-primary {
  background: var(--color-accent);
  color: #fff;
}

.btn-danger {
  background: #dc2626;
  color: #fff;
}

.btn-small {
  padding: 4px 12px;
  font-size: 13px;
}

.input,
.select {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 14px;
}

.unit {
  color: var(--color-text-secondary);
  font-size: 14px;
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

@media (max-width: 720px) {
  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }

  .password-grid {
    grid-template-columns: 1fr;
  }

  .setting-row,
  .category-item,
  .source-category-item,
  .add-category-form {
    flex-direction: column;
    align-items: flex-start;
  }

  .setting-control,
  .source-category-item .select,
  .add-category-form .input,
  .add-category-form .btn,
  .password-form .btn {
    width: 100%;
  }

  .security-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .security-actions .btn {
    width: 100%;
    min-width: 0;
  }
}
</style>
