<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { sourcesApi } from '../api';

const sources = ref<any[]>([]);
const loading = ref(false);
const testingSiteId = ref<number | null>(null);
const testResult = ref<string | null>(null);

// Statistics
const stats = ref({
  total: 0,
  enabled: 0,
  disabled: 0,
});

async function loadSources() {
  loading.value = true;
  try {
    sources.value = await sourcesApi.list();
    stats.value = {
      total: sources.value.length,
      enabled: sources.value.filter((s: any) => s.enabled === 1).length,
      disabled: sources.value.filter((s: any) => s.enabled === 0).length,
    };
  } catch (error) {
    console.error('Failed to load sources:', error);
  } finally {
    loading.value = false;
  }
}

async function toggleEnabled(source: any) {
  try {
    await sourcesApi.update(source.id, {
      enabled: source.enabled === 1 ? 0 : 1,
    });
    await loadSources();
  } catch (error) {
    console.error('Failed to toggle source:', error);
    alert('更新失败');
  }
}

async function deleteSource(id: number) {
  if (!confirm('确定删除这个RSS源？')) return;
  try {
    await sourcesApi.delete(id);
    await loadSources();
  } catch (error) {
    console.error('Failed to delete source:', error);
    alert('删除失败');
  }
}

async function updateSourceCookie(id: number, cookie: string) {
  try {
    await sourcesApi.update(id, { cookie });
    alert('Cookie已保存');
  } catch (error) {
    console.error('Failed to update cookie:', error);
    alert('保存失败');
  }
}

async function testConnection(source: any) {
  testingSiteId.value = source.id;
  testResult.value = null;
  
  try {
    const response = await fetch(`/api/rss/test?url=${encodeURIComponent(source.url)}&cookie=${encodeURIComponent(source.cookie || '')}`);
    const data = await response.json();
    
    if (data.success) {
      testResult.value = `✅ 连接成功！获取到 ${data.itemCount || 0} 个资源`;
    } else {
      testResult.value = `❌ 连接失败: ${data.error || '未知错误'}`;
    }
  } catch (error: any) {
    testResult.value = `❌ 连接失败: ${error.message}`;
  } finally {
    testingSiteId.value = null;
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN');
}

onMounted(() => {
  loadSources();
});
</script>

<template>
  <div class="sites-page">
    <h1 class="page-title">站点设置</h1>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">总站点</div>
        <div class="stat-value">{{ stats.total }}</div>
      </div>
      <div class="stat-card enabled">
        <div class="stat-label">已启用</div>
        <div class="stat-value">{{ stats.enabled }}</div>
      </div>
      <div class="stat-card disabled">
        <div class="stat-label">已禁用</div>
        <div class="stat-value">{{ stats.disabled }}</div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <!-- Sites List -->
    <div v-else class="sites-list">
      <div v-if="sources.length === 0" class="empty-message">
        暂无RSS源，请在"RSS源配置"页面添加
      </div>

      <div v-for="source in sources" :key="source.id" class="site-card">
        <div class="site-header">
          <div class="site-info">
            <h3 class="site-name">{{ source.name }}</h3>
            <span class="site-category">{{ source.category || '未分类' }}</span>
          </div>
          <label class="toggle">
            <input
              type="checkbox"
              :checked="source.enabled === 1"
              @change="toggleEnabled(source)"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="site-url">{{ source.url }}</div>

        <div class="site-meta">
          <span>抓取间隔: {{ source.fetch_interval }}分钟</span>
          <span>添加时间: {{ formatDate(source.created_at) }}</span>
        </div>

        <!-- Cookie Management -->
        <div class="cookie-section">
          <label class="cookie-label">Cookie (用于访问需要登录的内容)</label>
          <div class="cookie-input-row">
            <input
              type="password"
              class="input"
              :value="source.cookie || ''"
              @change="updateSourceCookie(source.id, ($event.target as HTMLInputElement).value)"
              placeholder="输入站点Cookie..."
            />
          </div>
        </div>

        <!-- Test Result -->
        <div v-if="testResult && testingSiteId === source.id" class="test-result">
          {{ testResult }}
        </div>

        <!-- Actions -->
        <div class="site-actions">
          <button 
            class="btn" 
            :disabled="testingSiteId === source.id"
            @click="testConnection(source)"
          >
            {{ testingSiteId === source.id ? '测试中...' : '测试连接' }}
          </button>
          <button class="btn btn-danger" @click="deleteSource(source.id)">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sites-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 24px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--color-bg-secondary);
  padding: 16px;
  border-radius: 8px;
  text-align: center;
}

.stat-card.enabled .stat-value {
  color: var(--color-success);
}

.stat-card.disabled .stat-value {
  color: var(--color-danger);
}

.stat-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.sites-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.site-card {
  background: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 20px;
}

.site-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.site-name {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: var(--color-text-primary);
}

.site-category {
  font-size: 12px;
  color: var(--color-accent);
  background: var(--color-bg-tertiary);
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: 8px;
}

.site-url {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
  word-break: break-all;
}

.site-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--color-text-muted);
  margin-bottom: 16px;
}

.cookie-section {
  margin-bottom: 16px;
}

.cookie-label {
  display: block;
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.cookie-input-row {
  display: flex;
  gap: 8px;
}

.test-result {
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 13px;
  background: var(--color-bg-tertiary);
}

.test-result.success {
  background: rgba(16, 185, 129, 0.1);
  color: var(--color-success);
}

.test-result.error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-danger);
}

.site-actions {
  display: flex;
  gap: 8px;
}

.toggle {
  position: relative;
  display: inline-block;
  width: 44px;
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
  transform: translateX(20px);
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.btn:hover:not(:disabled) {
  opacity: 0.8;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
  background: var(--color-danger);
  color: white;
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
  to { transform: rotate(360deg); }
}

.empty-message {
  text-align: center;
  padding: 48px;
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  border-radius: 8px;
}

.input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 13px;
}

.input:focus {
  outline: none;
  border-color: var(--color-accent);
}

@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: 1fr;
  }
}
</style>
