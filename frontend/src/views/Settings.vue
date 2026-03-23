<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { settingsApi, resourcesApi, sourcesApi } from '../api';
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
  sources_by_category: {} as Record<string, number>,
  resources_today: 0,
});
const loading = ref(false);
const saving = ref(false);

// Category management
const categories = ref<string[]>([]);
const newCategory = ref('');
const sources = ref<any[]>([]);

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
  } catch (error) {
    console.error('Failed to save settings:', error);
    alert('保存失败');
  } finally {
    saving.value = false;
  }
}

async function cleanOldResources() {
  const days = parseInt(settings.value.resources_retention_days, 10);
  if (!confirm(`确定清理 ${days} 天前的资源？`)) return;

  try {
    const result = await resourcesApi.clean(days);
    alert(`已清理 ${result.deleted} 条旧资源`);
    loadSettings();
  } catch (error) {
    console.error('Failed to clean resources:', error);
    alert('清理失败');
  }
}

async function cleanAllResources() {
  if (!confirm('确定清理所有资源？此操作不可恢复！')) return;
  if (!confirm('再次确认：删除所有资源？')) return;

  try {
    await resourcesApi.clean(0);
    alert('已清理所有资源');
    loadSettings();
  } catch (error) {
    console.error('Failed to clean all resources:', error);
    alert('清理失败');
  }
}

async function addCategory() {
  const cat = newCategory.value.trim();
  if (!cat) return;
  if (categories.value.includes(cat)) {
    alert('分类已存在');
    return;
  }
  categories.value.push(cat);
  newCategory.value = '';
}

async function deleteCategory(category: string) {
  if (!confirm(`确定删除分类 "${category}"？`)) return;
  
  categories.value = categories.value.filter(c => c !== category);
}

async function updateSourceCategory(sourceId: number, newCategory: string) {
  try {
    await sourcesApi.update(sourceId, { category: newCategory });
    await loadSettings();
  } catch (error) {
    console.error('Failed to update source category:', error);
  }
}

onMounted(() => {
  loadSettings();
});
</script>

<template>
  <div class="settings">
    <h1 class="page-title">设置</h1>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <template v-else>
      <!-- Stats -->
      <section class="settings-section">
        <h2 class="section-title">统计信息</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">RSS 源</div>
            <div class="stat-value">{{ stats.total_sources }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">总资源</div>
            <div class="stat-value">{{ stats.total_resources }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">今日新增</div>
            <div class="stat-value">{{ stats.resources_today }}</div>
          </div>
        </div>

        <div v-if="Object.keys(stats.sources_by_category).length > 0" class="category-stats">
          <h3>按分类统计</h3>
          <div class="category-tags">
            <span
              v-for="(count, category) in stats.sources_by_category"
              :key="category"
              class="tag"
            >
              {{ category }}: {{ count }}
            </span>
          </div>
        </div>
      </section>

      <!-- Category Management -->
      <section class="settings-section">
        <h2 class="section-title">分类管理</h2>
        <p class="section-description">管理 RSS 源的分类，用于筛选资源</p>
        
        <div class="category-list">
          <div v-for="category in categories" :key="category" class="category-item">
            <div class="category-info">
              <span class="category-name">{{ category }}</span>
              <span class="category-count">{{ stats.sources_by_category[category] || 0 }} 个源</span>
            </div>
            <button class="btn btn-small btn-danger" @click="deleteCategory(category)">删除</button>
          </div>
          <div v-if="categories.length === 0" class="empty-message">
            暂无分类，添加新分类后可在 RSS 源配置中选择
          </div>
        </div>

        <div class="add-category-form">
          <input
            v-model="newCategory"
            type="text"
            class="input"
            placeholder="输入新分类名称..."
            @keyup.enter="addCategory"
          />
          <button class="btn btn-primary" @click="addCategory">添加</button>
        </div>
      </section>

      <!-- Source Categories -->
      <section class="settings-section">
        <h2 class="section-title">RSS 源分类</h2>
        <p class="section-description">为 RSS 源分配分类</p>
        
        <div class="source-category-list">
          <div v-for="source in sources" :key="source.id" class="source-category-item">
            <div class="source-name">{{ source.name }}</div>
            <select
              :value="source.category"
              class="select"
              @change="updateSourceCategory(source.id, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">未分类</option>
              <option v-for="cat in categories" :key="cat" :value="cat">
                {{ cat }}
              </option>
            </select>
          </div>
          <div v-if="sources.length === 0" class="empty-message">
            暂无 RSS 源
          </div>
        </div>
      </section>

      <!-- Theme -->
      <section class="settings-section">
        <h2 class="section-title">外观</h2>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">主题</div>
            <div class="setting-description">选择应用的主题外观</div>
          </div>
          <ThemeToggle />
        </div>
      </section>

      <!-- Fetch Settings -->
      <section class="settings-section">
        <h2 class="section-title">抓取设置</h2>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">全局抓取间隔</div>
            <div class="setting-description">定时抓取 RSS 源的时间间隔（分钟）</div>
          </div>
          <div class="setting-control">
            <input
              v-model="settings.global_fetch_interval"
              type="number"
              class="input"
              min="1"
              max="1440"
              style="width: 100px"
            />
            <span class="unit">分钟</span>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">自动抓取</div>
            <div class="setting-description">开启后自动按间隔抓取 RSS 源</div>
          </div>
          <div class="setting-control">
            <label class="toggle">
              <input
                v-model="settings.auto_fetch_enabled"
                type="checkbox"
                true-value="true"
                false-value="false"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </section>

      <!-- Data Management -->
      <section class="settings-section">
        <h2 class="section-title">数据管理</h2>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">资源保留天数</div>
            <div class="setting-description">超过此天数的资源将被自动清理</div>
          </div>
          <div class="setting-control">
            <input
              v-model="settings.resources_retention_days"
              type="number"
              class="input"
              min="1"
              max="365"
              style="width: 100px"
            />
            <span class="unit">天</span>
          </div>
        </div>

        <div class="setting-actions">
          <button class="btn" @click="cleanOldResources">清理旧资源</button>
          <button class="btn btn-danger" @click="cleanAllResources">清空所有资源</button>
        </div>
      </section>

      <!-- Save -->
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
  max-width: 900px;
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
  margin-bottom: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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

.category-stats h3 {
  font-size: 14px;
  margin-bottom: 8px;
  color: var(--color-text-primary);
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

.category-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--color-bg-primary);
  border-radius: 6px;
}

.category-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.category-name {
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

.source-category-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.source-category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--color-bg-primary);
  border-radius: 6px;
}

.source-name {
  font-weight: 500;
  color: var(--color-text-primary);
}

.source-category-item .select {
  width: 150px;
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
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-bg-tertiary);
  transition: 0.3s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
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
  transition: background-color 0.2s;
}

.btn:hover {
  background: var(--color-border);
}

.btn-primary {
  background: var(--color-accent);
  color: white;
}

.btn-primary:hover {
  background: var(--color-accent-hover);
}

.btn-danger {
  background: #dc2626;
  color: white;
}

.btn-danger:hover {
  background: #b91c1c;
}

.btn-small {
  padding: 4px 12px;
  font-size: 13px;
}

.input, .select {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 14px;
}

.input:focus, .select:focus {
  outline: none;
  border-color: var(--color-accent);
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

@media (max-width: 600px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .setting-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .setting-control {
    width: 100%;
  }
}
</style>
