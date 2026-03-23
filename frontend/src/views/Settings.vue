<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { settingsApi, resourcesApi } from '../api';
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

async function loadSettings() {
  loading.value = true;
  try {
    const [settingsData, statsData] = await Promise.all([
      settingsApi.get(),
      settingsApi.getStats(),
    ]);
    settings.value = { ...settings.value, ...settingsData };
    stats.value = statsData;
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
                :true-value="'true'"
                :false-value="'false'"
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
  max-width: 800px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: var(--spacing-lg);
}

.settings-section {
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: var(--spacing-md);
  color: var(--color-text-primary);
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) 0;
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
}

.setting-description {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.setting-control {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.unit {
  color: var(--color-text-secondary);
  font-size: 14px;
}

.category-stats {
  margin-top: var(--spacing-md);
}

.category-stats h3 {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: var(--spacing-sm);
}

.category-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.setting-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border);
}

.settings-footer {
  display: flex;
  justify-content: flex-end;
}

/* Toggle switch */
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
  border-radius: 24px;
  transition: var(--transition-fast);
}

.toggle-slider::before {
  content: '';
  position: absolute;
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: var(--transition-fast);
}

.toggle input:checked + .toggle-slider {
  background-color: var(--color-accent);
}

.toggle input:checked + .toggle-slider::before {
  transform: translateX(24px);
}

@media (max-width: 768px) {
  .setting-row {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm);
  }

  .setting-control {
    width: 100%;
  }
}
</style>
