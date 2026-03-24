<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { sourcesApi, fetchlogApi } from '../api';

const sources = ref<any[]>([]);
const fetchHistories = ref<any[]>([]);
const loading = ref(false);
const refreshingIds = ref<Set<number>>(new Set());
const selectedIds = ref<Set<number>>(new Set());
const searchQuery = ref('');
const categoryFilter = ref('');
const groupBy = ref<'category' | 'none'>('category');

// Get unique categories
const categories = computed(() => {
  const cats = new Set(sources.value.map((s: any) => s.category).filter(Boolean));
  return Array.from(cats);
});

// Filtered sources
const filteredSources = computed(() => {
  let result = sources.value;
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter((s: any) => s.name.toLowerCase().includes(q));
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

// Fetch history map by source_id
const historyMap = computed(() => {
  const map: Record<number, any> = {};
  for (const h of fetchHistories.value) {
    if (!map[h.source_id] || new Date(h.fetched_at) > new Date(map[h.source_id].fetched_at)) {
      map[h.source_id] = h;
    }
  }
  return map;
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

async function loadHistories() {
  try {
    fetchHistories.value = await fetchlogApi.list();
  } catch (error) {
    console.error('Failed to load fetch histories:', error);
  }
}

async function refreshSource(source: any) {
  refreshingIds.value.add(source.id);
  try {
    const result = await sourcesApi.fetch(source.id);
    await loadSources();
    await loadHistories();
    if (result.success) {
      console.log(`Fetched ${result.new_resources} new resources`);
    }
  } catch (error) {
    console.error('Failed to refresh source:', error);
    alert('刷新失败');
  } finally {
    refreshingIds.value.delete(source.id);
  }
}

async function refreshAll() {
  refreshingIds.value.add(-1);
  try {
    await sourcesApi.fetchAll();
    await loadSources();
    await loadHistories();
  } catch (error) {
    console.error('Failed to refresh all:', error);
    alert('刷新失败');
  } finally {
    refreshingIds.value.delete(-1);
  }
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

function getStatus(source: any): { label: string; class: string } {
  const last = historyMap.value[source.id];
  if (!last) return { label: '未抓取', class: 'status-unknown' };
  if (last.status === 'success') return { label: `成功 (+${last.new_resources})`, class: 'status-success' };
  return { label: '失败', class: 'status-error' };
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h前`;
  return `${Math.floor(diff / 86400)}d前`;
}

onMounted(() => {
  loadSources();
  loadHistories();
});
</script>

<template>
  <div class="mydata-page">
    <div class="page-header">
      <h1 class="page-title">我的数据</h1>
      <button class="btn btn-primary" :disabled="refreshingIds.has(-1)" @click="refreshAll">
        {{ refreshingIds.has(-1) ? '刷新中...' : '刷新全部' }}
      </button>
    </div>

    <!-- Filters & Actions -->
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
      <span class="toolbar-info">
        已选 {{ selectedIds.size }} / {{ filteredSources.length }}
      </span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <!-- Empty -->
    <div v-else-if="sources.length === 0" class="empty-state">
      暂无RSS源，请在"RSS源"页面添加
    </div>

    <!-- Grouped Table -->
    <div v-else class="source-groups">
      <div v-for="(group, groupName) in groupedSources" :key="groupName" class="source-group">
        <div class="group-header">
          <span class="group-name">{{ groupName }}</span>
          <span class="group-count">{{ group.length }} 个站点</span>
        </div>

        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th class="col-check">
                  <input
                    type="checkbox"
                    :checked="selectedIds.size === filteredSources.length && filteredSources.length > 0"
                    @change="toggleSelectAll"
                  />
                </th>
                <th>名称</th>
                <th>分类</th>
                <th>上次抓取</th>
                <th>状态</th>
                <th>总资源</th>
                <th>今日新增</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="source in group" :key="source.id" :class="{ selected: selectedIds.has(source.id) }">
                <td class="col-check">
                  <input
                    type="checkbox"
                    :checked="selectedIds.has(source.id)"
                    @change="toggleSelect(source.id)"
                  />
                </td>
                <td class="col-name">{{ source.name }}</td>
                <td>{{ source.category || '-' }}</td>
                <td>{{ formatTime(historyMap[source.id]?.fetched_at) }}</td>
                <td>
                  <span class="status-badge" :class="getStatus(source).class">
                    {{ getStatus(source).label }}
                  </span>
                </td>
                <td>{{ source.total_resources || 0 }}</td>
                <td>{{ source.today_resources || 0 }}</td>
                <td>
                  <button
                    class="btn btn-sm"
                    :disabled="refreshingIds.has(source.id)"
                    @click="refreshSource(source)"
                  >
                    {{ refreshingIds.has(source.id) ? '刷新中' : '刷新' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mydata-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
}

.search-input {
  flex: 1;
  min-width: 160px;
}

.toolbar-info {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-left: auto;
}

.source-groups {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.source-group {
  background: var(--color-bg-secondary);
  border-radius: 8px;
  overflow: hidden;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--color-bg-tertiary);
  border-bottom: 1px solid var(--color-border);
}

.group-name {
  font-weight: 600;
  color: var(--color-text-primary);
}

.group-count {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.table-container {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
  font-size: 13px;
}

.table th {
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
}

.table tr:hover {
  background: var(--color-bg-tertiary);
}

.table tr.selected {
  background: rgba(59, 130, 246, 0.1);
}

.col-check {
  width: 40px;
  text-align: center;
}

.col-name {
  font-weight: 500;
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-success {
  background: rgba(34, 197, 94, 0.15);
  color: var(--color-success);
}

.status-error {
  background: rgba(239, 68, 68, 0.15);
  color: var(--color-danger);
}

.status-unknown {
  background: var(--color-bg-tertiary);
  color: var(--color-text-muted);
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

.empty-state {
  text-align: center;
  padding: 48px;
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  border-radius: 8px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: 14px;
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

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
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
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-info {
    margin-left: 0;
    text-align: center;
  }
}
</style>
