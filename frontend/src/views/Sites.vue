<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { sourcesApi } from '../api';

const sources = ref<any[]>([]);
const loading = ref(false);
const testingSiteId = ref<number | null>(null);
const testResult = ref<string | null>(null);
const selectedIds = ref<Set<number>>(new Set());
const searchQuery = ref('');
const categoryFilter = ref('');
const groupBy = ref<'category' | 'none'>('category');

// Drawer state
const drawerOpen = ref(false);
const drawerSource = ref<any>(null);

// Get unique categories
const categories = computed(() => {
  const cats = new Set(sources.value.map((s: any) => s.category).filter(Boolean));
  return Array.from(cats);
});

// Stats
const stats = computed(() => ({
  total: sources.value.length,
  enabled: sources.value.filter((s: any) => s.enabled === 1).length,
  disabled: sources.value.filter((s: any) => s.enabled === 0).length,
}));

// Filtered sources
const filteredSources = computed(() => {
  let result = sources.value;
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter((s: any) => s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q));
  }
  if (categoryFilter.value) {
    result = result.filter((s: any) => s.category === categoryFilter.value);
  }
  return result;
});

// Grouped sources
const groupedSources = computed(() => {
  if (groupBy.value === 'none') {
    return { '全部': filteredSources.value };
  }
  const groups: Record<string, any[]> = {};
  for (const source of filteredSources.value) {
    const cat = source.category || '未分类';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(source);
  }
  return groups;
});

async function loadSources() {
  loading.value = true;
  try {
    sources.value = await sourcesApi.list();
  } catch (error) {
    console.error('Failed to load sources:', error);
  } finally {
    loading.value = false;
  }
}

async function toggleEnabled(source: any) {
  try {
    await sourcesApi.update(source.id, {
      enabled: source.enabled === 1 ? false : true,
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
    selectedIds.value.delete(id);
    await loadSources();
  } catch (error) {
    console.error('Failed to delete source:', error);
    alert('删除失败');
  }
}

async function batchDelete() {
  if (selectedIds.value.size === 0) return;
  if (!confirm(`确定删除选中的 ${selectedIds.value.size} 个站点？`)) return;
  try {
    await sourcesApi.batchDelete(Array.from(selectedIds.value));
    selectedIds.value.clear();
    await loadSources();
  } catch (error) {
    console.error('Failed to batch delete:', error);
    alert('删除失败');
  }
}

async function batchEnable(enabled: boolean) {
  if (selectedIds.value.size === 0) return;
  try {
    await sourcesApi.batchUpdate(Array.from(selectedIds.value), { enabled });
    await loadSources();
  } catch (error) {
    console.error('Failed to batch update:', error);
    alert('更新失败');
  }
}

async function updateSourceCookie(id: number, cookie: string) {
  try {
    await sourcesApi.update(id, { cookie });
  } catch (error) {
    console.error('Failed to update cookie:', error);
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

function openDrawer(source: any) {
  drawerSource.value = { ...source };
  drawerOpen.value = true;
}

function closeDrawer() {
  drawerOpen.value = false;
  drawerSource.value = null;
}

async function saveDrawerSource() {
  if (!drawerSource.value) return;
  try {
    await sourcesApi.update(drawerSource.value.id, {
      name: drawerSource.value.name,
      url: drawerSource.value.url,
      category: drawerSource.value.category,
      fetch_interval: drawerSource.value.fetch_interval,
      enabled: drawerSource.value.enabled,
      cookie: drawerSource.value.cookie || '',
    });
    await loadSources();
    closeDrawer();
  } catch (error) {
    console.error('Failed to save source:', error);
    alert('保存失败');
  }
}

// Export sources to JSON
function exportSources() {
  const data = filteredSources.value.map(s => ({
    name: s.name,
    url: s.url,
    category: s.category,
    fetch_interval: s.fetch_interval,
    enabled: s.enabled === 1,
    cookie: s.cookie || '',
  }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pt-sources-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Import sources from JSON
async function importSources(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) {
      alert('Invalid format: expected an array');
      return;
    }

    let imported = 0;
    for (const item of data) {
      if (!item.name || !item.url) continue;
      try {
        await sourcesApi.create({
          name: item.name,
          url: item.url,
          category: item.category || '',
          fetch_interval: item.fetch_interval || 30,
          enabled: item.enabled !== false,
          cookie: item.cookie || '',
        });
        imported++;
      } catch (e) {
        console.error('Failed to import:', item.name, e);
      }
    }
    await loadSources();
    alert(`成功导入 ${imported} 个站点`);
  } catch (error) {
    console.error('Failed to import:', error);
    alert('导入失败');
  }
  input.value = '';
}

function toggleSelect(id: number) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id);
  } else {
    selectedIds.value.add(id);
  }
}

function toggleSelectAll() {
  if (selectedIds.value.size === filteredSources.value.length) {
    selectedIds.value.clear();
  } else {
    selectedIds.value = new Set(filteredSources.value.map((s: any) => s.id));
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

    <!-- Toolbar -->
    <div class="toolbar">
      <input
        v-model="searchQuery"
        type="text"
        class="input search-input"
        placeholder="搜索站点..."
      />
      <select v-model="categoryFilter" class="select">
        <option value="">全部分类</option>
        <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
      </select>
      <select v-model="groupBy" class="select">
        <option value="category">按分类分组</option>
        <option value="none">不分组</option>
      </select>
      <div class="toolbar-right">
        <span class="selection-info">已选 {{ selectedIds.size }}</span>
        <button class="btn btn-sm" @click="batchEnable(true)">批量启用</button>
        <button class="btn btn-sm" @click="batchEnable(false)">批量禁用</button>
        <button class="btn btn-sm btn-danger" @click="batchDelete" :disabled="selectedIds.size === 0">批量删除</button>
        <button class="btn btn-sm" @click="exportSources">导出</button>
        <label class="btn btn-sm import-btn">
          导入
          <input type="file" accept=".json" @change="importSources" style="display:none" />
        </label>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <!-- Sites List -->
    <div v-else class="source-groups">
      <div v-if="sources.length === 0" class="empty-message">
        暂无RSS源，请在"RSS源配置"页面添加
      </div>

      <div v-for="(group, groupName) in groupedSources" :key="groupName" class="source-group">
        <div class="group-header">
          <label class="group-check">
            <input
              type="checkbox"
              :checked="group.every((s: any) => selectedIds.has(s.id))"
              @change="() => {
                const ids = group.map((s: any) => s.id);
                const allSelected = ids.every((id: number) => selectedIds.has(id));
                ids.forEach((id: number) => {
                  if (allSelected) selectedIds.delete(id);
                  else selectedIds.add(id);
                });
              }"
            />
          </label>
          <span class="group-name">{{ groupName }}</span>
          <span class="group-count">{{ group.length }} 个站点</span>
        </div>

        <div class="sites-list">
          <div v-for="source in group" :key="source.id" class="site-card" :class="{ selected: selectedIds.has(source.id) }">
            <div class="site-header">
              <div class="site-info">
                <h3 class="site-name" @click="openDrawer(source)">{{ source.name }}</h3>
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

            <!-- Test Result -->
            <div v-if="testResult && testingSiteId === source.id" class="test-result">
              {{ testResult }}
            </div>

            <!-- Actions -->
            <div class="site-actions">
              <button class="btn btn-sm" @click="openDrawer(source)">详情</button>
              <button
                class="btn btn-sm"
                :disabled="testingSiteId === source.id"
                @click="testConnection(source)"
              >
                {{ testingSiteId === source.id ? '测试中...' : '测试' }}
              </button>
              <button class="btn btn-sm btn-danger" @click="deleteSource(source.id)">删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Side Drawer -->
    <div v-if="drawerOpen" class="drawer-overlay" @click.self="closeDrawer">
      <div class="drawer">
        <div class="drawer-header">
          <h2 class="drawer-title">站点详情</h2>
          <button class="drawer-close" @click="closeDrawer">×</button>
        </div>

        <div v-if="drawerSource" class="drawer-content">
          <div class="form-group">
            <label class="form-label">名称</label>
            <input v-model="drawerSource.name" type="text" class="input form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">URL</label>
            <input v-model="drawerSource.url" type="text" class="input form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">分类</label>
            <input v-model="drawerSource.category" type="text" class="input form-input" placeholder="如：电影、剧集" />
          </div>
          <div class="form-group">
            <label class="form-label">抓取间隔（分钟）</label>
            <input v-model.number="drawerSource.fetch_interval" type="number" class="input form-input" min="1" />
          </div>
          <div class="form-group">
            <label class="form-label">启用</label>
            <label class="toggle">
              <input type="checkbox" :checked="drawerSource.enabled === 1" @change="drawerSource.enabled = ($event.target as HTMLInputElement).checked ? 1 : 0" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="form-group">
            <label class="form-label">Cookie</label>
            <textarea v-model="drawerSource.cookie" class="input form-input cookie-textarea" placeholder="站点Cookie..."></textarea>
          </div>
          <div class="drawer-footer">
            <button class="btn btn-primary" @click="saveDrawerSource">保存</button>
            <button class="btn" @click="closeDrawer">取消</button>
          </div>
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

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 24px;
  padding: 16px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
}

.search-input {
  flex: 1;
  min-width: 160px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-left: auto;
}

.selection-info {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-right: 8px;
}

.source-groups {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.source-group {
  background: var(--color-bg-secondary);
  border-radius: 8px;
  overflow: hidden;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--color-bg-tertiary);
  border-bottom: 1px solid var(--color-border);
}

.group-check {
  cursor: pointer;
}

.group-name {
  font-weight: 600;
  color: var(--color-text-primary);
}

.group-count {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.sites-list {
  display: flex;
  flex-direction: column;
}

.site-card {
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  transition: background-color 0.2s;
}

.site-card:last-child {
  border-bottom: none;
}

.site-card:hover {
  background: var(--color-bg-tertiary);
}

.site-card.selected {
  background: rgba(59, 130, 246, 0.1);
}

.site-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.site-name {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--color-text-primary);
  cursor: pointer;
}

.site-name:hover {
  color: var(--color-accent);
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
  margin-bottom: 12px;
}

.test-result {
  padding: 10px 12px;
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 13px;
  background: var(--color-bg-primary);
}

.site-actions {
  display: flex;
  gap: 8px;
}

/* Toggle */
.toggle {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
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

/* Drawer */
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

.drawer {
  width: 400px;
  max-width: 90vw;
  height: 100%;
  background: var(--color-bg-primary);
  display: flex;
  flex-direction: column;
  animation: slideIn 0.2s ease;
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--color-border);
}

.drawer-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.drawer-close {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: var(--color-text-secondary);
  padding: 0;
  line-height: 1;
}

.drawer-close:hover {
  color: var(--color-text-primary);
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.drawer-footer {
  display: flex;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid var(--color-border);
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
}

.cookie-textarea {
  min-height: 100px;
  resize: vertical;
}

/* Buttons */
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

.btn-primary {
  background: var(--color-accent);
  color: white;
}

.btn-danger {
  background: var(--color-danger);
  color: white;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

.import-btn {
  cursor: pointer;
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

.input, .select {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 13px;
}

.input:focus, .select:focus {
  outline: none;
  border-color: var(--color-accent);
}

@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: 1fr;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-right {
    margin-left: 0;
    justify-content: flex-end;
  }
}
</style>
