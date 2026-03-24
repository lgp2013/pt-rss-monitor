<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { sourcesApi, resourcesApi, snapshotsApi } from '../api';
import ResourceCard from '../components/ResourceCard.vue';

const sources = ref<any[]>([]);
const searchQuery = ref('');
const selectedSources = ref<number[]>([]);
const results = ref<any[]>([]);
const allResults = ref<any[]>([]);
const loading = ref(false);
const searching = ref(false);
const snapshots = ref<any[]>([]);
const newSnapshotName = ref('');

// Filters
const filters = ref({
  resolution: '',
  freeTag: '',
  category: '',
  minSeeders: '',
});

// Selected results for batch delete
const selectedResults = ref<Set<number>>(new Set());

// Search history
const searchHistory = ref<string[]>([]);

async function loadSources() {
  try {
    sources.value = await sourcesApi.list();
  } catch (error) {
    console.error('Failed to load sources:', error);
  }
}

async function loadSnapshots() {
  try {
    snapshots.value = await snapshotsApi.list();
  } catch (error) {
    console.error('Failed to load snapshots:', error);
  }
}

async function search() {
  if (!searchQuery.value.trim()) {
    alert('请输入搜索关键词');
    return;
  }

  // Save to search history
  if (!searchHistory.value.includes(searchQuery.value.trim())) {
    searchHistory.value.unshift(searchQuery.value.trim());
    if (searchHistory.value.length > 20) searchHistory.value.pop();
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value));
  }

  searching.value = true;
  results.value = [];
  allResults.value = [];
  selectedResults.value.clear();

  try {
    const sourceIds = selectedSources.value.length > 0
      ? selectedSources.value
      : sources.value.filter((s: any) => s.enabled === 1).map((s: any) => s.id);

    const allRes: any[] = [];

    for (const sourceId of sourceIds) {
      try {
        const params: any = {
          source_id: sourceId,
          search: searchQuery.value,
          limit: 200,
        };

        const data = await resourcesApi.list(params);
        allRes.push(...data.data);
      } catch (e) {
        console.error(`Search failed for source ${sourceId}:`, e);
      }
    }

    allResults.value = allRes;
    applyClientFilters();
  } catch (error) {
    console.error('Search failed:', error);
    alert('搜索失败');
  } finally {
    searching.value = false;
  }
}

function applyClientFilters() {
  results.value = allResults.value.filter(r => {
    if (filters.value.resolution && !r.title.toLowerCase().includes(filters.value.resolution.toLowerCase())) {
      return false;
    }
    if (filters.value.freeTag && r.free_tag !== filters.value.freeTag) {
      return false;
    }
    if (filters.value.category && r.category !== filters.value.category) {
      return false;
    }
    if (filters.value.minSeeders && r.seeders < parseInt(filters.value.minSeeders)) {
      return false;
    }
    return true;
  });
}

// Stats
const stats = computed(() => {
  const total = results.value.length;
  const freeCount = results.value.filter(r => r.free_tag === 'FREE').length;
  const paidCount = total - freeCount;
  const resolutionCounts: Record<string, number> = {};
  for (const r of results.value) {
    const match = r.title.match(/(2160p|1080p|720p|480p)/i);
    const res = match ? match[1].toUpperCase() : '其他';
    resolutionCounts[res] = (resolutionCounts[res] || 0) + 1;
  }
  return { total, freeCount, paidCount, resolutionCounts };
});

function toggleSource(sourceId: number) {
  const idx = selectedSources.value.indexOf(sourceId);
  if (idx >= 0) {
    selectedSources.value.splice(idx, 1);
  } else {
    selectedSources.value.push(sourceId);
  }
}

function selectAllSources() {
  selectedSources.value = sources.value.filter((s: any) => s.enabled === 1).map((s: any) => s.id);
}

function clearSourceSelection() {
  selectedSources.value = [];
}

function toggleResultSelect(id: number) {
  if (selectedResults.value.has(id)) {
    selectedResults.value.delete(id);
  } else {
    selectedResults.value.add(id);
  }
}

function toggleSelectAllResults() {
  if (selectedResults.value.size === results.value.length) {
    selectedResults.value.clear();
  } else {
    selectedResults.value = new Set(results.value.map(r => r.id));
  }
}

async function saveSnapshot() {
  if (!newSnapshotName.value.trim()) {
    alert('请输入快照名称');
    return;
  }
  try {
    await snapshotsApi.create({
      name: newSnapshotName.value.trim(),
      query: searchQuery.value,
      filters: JSON.stringify(filters.value),
      result_ids: results.value.map(r => r.id),
      source_ids: selectedSources.value,
    });
    newSnapshotName.value = '';
    await loadSnapshots();
    alert('快照已保存');
  } catch (error) {
    console.error('Failed to save snapshot:', error);
    alert('保存失败');
  }
}

async function loadSnapshot(snapshot: any) {
  searchQuery.value = snapshot.query;
  try {
    const filters = JSON.parse(snapshot.filters || '{}');
    filters.value?.freeTag && (filters.value.freeTag = filters.freeTag);
    filters.value?.resolution && (filters.value = filters.resolution);
    filters.value?.category && (filters.value.category = filters.category);
    filters.value?.minSeeders && (filters.value.minSeeders = filters.minSeeders);
  } catch {}
  selectedSources.value = snapshot.source_ids || [];
  await search();
}

async function deleteSnapshot(id: number) {
  if (!confirm('确定删除此快照？')) return;
  try {
    await snapshotsApi.delete(id);
    await loadSnapshots();
  } catch (error) {
    console.error('Failed to delete snapshot:', error);
  }
}

async function batchDelete() {
  if (selectedResults.value.size === 0) return;
  if (!confirm(`确定删除选中的 ${selectedResults.value.size} 条记录？`)) return;
  try {
    await resourcesApi.batchDelete(Array.from(selectedResults.value));
    results.value = results.value.filter(r => !selectedResults.value.has(r.id));
    allResults.value = allResults.value.filter(r => !selectedResults.value.has(r.id));
    selectedResults.value.clear();
  } catch (error) {
    console.error('Failed to batch delete:', error);
    alert('删除失败');
  }
}

async function deleteResource(id: number) {
  if (!confirm('确定删除这条记录？')) return;
  try {
    await resourcesApi.delete(id);
    results.value = results.value.filter(r => r.id !== id);
    allResults.value = allResults.value.filter(r => r.id !== id);
  } catch (error) {
    console.error('Failed to delete:', error);
  }
}

function openLink(link: string) {
  window.open(link, '_blank');
}

function useHistoryItem(q: string) {
  searchQuery.value = q;
  search();
}

onMounted(() => {
  loadSources();
  loadSnapshots();

  const saved = localStorage.getItem('searchHistory');
  if (saved) {
    try {
      searchHistory.value = JSON.parse(saved);
    } catch (e) {}
  }
});
</script>

<template>
  <div class="search-page">
    <h1 class="page-title">搜索结果</h1>

    <!-- Search Form -->
    <div class="search-form">
      <div class="search-input-row">
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="输入搜索关键词..."
          @keyup.enter="search"
        />
        <button class="btn btn-primary" :disabled="searching" @click="search">
          {{ searching ? '搜索中...' : '搜索' }}
        </button>
      </div>

      <!-- Search History -->
      <div v-if="searchHistory.length > 0 && !searchQuery" class="search-history">
        <span class="history-label">最近搜索:</span>
        <span
          v-for="q in searchHistory.slice(0, 10)"
          :key="q"
          class="history-item"
          @click="useHistoryItem(q)"
        >
          {{ q }}
        </span>
      </div>

      <!-- Source Selection -->
      <div class="source-selection">
        <div class="source-selection-header">
          <span>选择站点 ({{ selectedSources.length }} / {{ sources.filter((s: any) => s.enabled === 1).length }} 已启用)</span>
          <div class="source-selection-actions">
            <button class="btn btn-small" @click="selectAllSources">全选</button>
            <button class="btn btn-small" @click="clearSourceSelection">清除</button>
          </div>
        </div>
        <div class="source-tags">
          <label
            v-for="source in sources.filter((s: any) => s.enabled === 1)"
            :key="source.id"
            class="source-tag"
            :class="{ selected: selectedSources.includes(source.id) }"
          >
            <input
              type="checkbox"
              :checked="selectedSources.includes(source.id)"
              @change="toggleSource(source.id)"
            />
            {{ source.name }}
          </label>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-row">
        <div class="filter-item">
          <label>清晰度</label>
          <select v-model="filters.resolution" class="select" @change="applyClientFilters">
            <option value="">全部</option>
            <option value="2160p">2160p</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="480p">480p</option>
          </select>
        </div>
        <div class="filter-item">
          <label>折扣</label>
          <select v-model="filters.freeTag" class="select" @change="applyClientFilters">
            <option value="">全部</option>
            <option value="FREE">免费</option>
            <option value="50%">50%</option>
          </select>
        </div>
        <div class="filter-item">
          <label>分类</label>
          <select v-model="filters.category" class="select" @change="applyClientFilters">
            <option value="">全部</option>
            <option v-for="cat in [...new Set(sources.map((s: any) => s.category).filter(Boolean))]" :key="cat" :value="cat">
              {{ cat }}
            </option>
          </select>
        </div>
        <div class="filter-item">
          <label>最小做种</label>
          <input v-model="filters.minSeeders" type="number" class="input" placeholder="0" @input="applyClientFilters" />
        </div>
      </div>

      <!-- Save Snapshot -->
      <div class="save-snapshot-row">
        <input
          v-model="newSnapshotName"
          type="text"
          class="input"
          placeholder="保存当前搜索为快照..."
        />
        <button class="btn btn-primary" @click="saveSnapshot" :disabled="results.length === 0">保存快照</button>
      </div>
    </div>

    <!-- Saved Snapshots -->
    <div v-if="snapshots.length > 0" class="snapshots-section">
      <h3>已保存的快照</h3>
      <div class="snapshot-tags">
        <div v-for="snap in snapshots" :key="snap.id" class="snapshot-tag">
          <span class="snapshot-name" @click="loadSnapshot(snap)">
            {{ snap.name }}
          </span>
          <span class="snapshot-date">{{ new Date(snap.created_at).toLocaleDateString() }}</span>
          <button class="delete-btn" @click="deleteSnapshot(snap.id)">×</button>
        </div>
      </div>
    </div>

    <!-- Results Stats -->
    <div v-if="results.length > 0" class="stats-section">
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-label">总结果</div>
          <div class="stat-value">{{ stats.total }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">免费</div>
          <div class="stat-value stat-free">{{ stats.freeCount }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">收费</div>
          <div class="stat-value stat-paid">{{ stats.paidCount }}</div>
        </div>
        <div v-for="(count, res) in stats.resolutionCounts" :key="res" class="stat-card">
          <div class="stat-label">{{ res }}</div>
          <div class="stat-value">{{ count }}</div>
        </div>
      </div>
    </div>

    <!-- Results -->
    <div class="results-section">
      <div class="results-header">
        <span>搜索结果: {{ results.length }} 条</span>
        <div class="results-actions" v-if="results.length > 0">
          <label class="select-all-label">
            <input
              type="checkbox"
              :checked="selectedResults.size === results.length && results.length > 0"
              @change="toggleSelectAllResults"
            />
            全选
          </label>
          <button
            class="btn btn-danger btn-sm"
            :disabled="selectedResults.size === 0"
            @click="batchDelete"
          >
            批量删除 ({{ selectedResults.size }})
          </button>
        </div>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>

      <div v-else-if="results.length === 0 && !searching" class="empty-message">
        输入关键词开始搜索
      </div>

      <div v-else class="results-list">
        <div v-for="resource in results" :key="resource.id" class="result-row">
          <div class="result-checkbox">
            <input
              type="checkbox"
              :checked="selectedResults.has(resource.id)"
              @change="toggleResultSelect(resource.id)"
            />
          </div>
          <div class="result-content">
            <ResourceCard
              :resource="resource"
              @delete="deleteResource"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 24px;
}

.search-form {
  background: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 24px;
}

.search-input-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.search-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 15px;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.search-history {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
}

.history-label {
  font-size: 12px;
  color: var(--color-text-muted);
}

.history-item {
  font-size: 12px;
  color: var(--color-accent);
  cursor: pointer;
  padding: 2px 8px;
  background: var(--color-bg-tertiary);
  border-radius: 4px;
}

.history-item:hover {
  text-decoration: underline;
}

.source-selection {
  margin-bottom: 16px;
}

.source-selection-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.source-selection-actions {
  display: flex;
  gap: 8px;
}

.source-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.source-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: var(--color-bg-tertiary);
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.source-tag:hover {
  background: var(--color-border);
}

.source-tag.selected {
  background: var(--color-accent);
  color: white;
}

.source-tag input {
  display: none;
}

.filters-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 16px;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-item label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.save-snapshot-row {
  display: flex;
  gap: 12px;
}

.save-snapshot-row .input {
  flex: 1;
}

.snapshots-section {
  margin-bottom: 24px;
}

.snapshots-section h3 {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: 12px;
}

.snapshot-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.snapshot-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 13px;
}

.snapshot-name {
  cursor: pointer;
  color: var(--color-accent);
}

.snapshot-name:hover {
  text-decoration: underline;
}

.snapshot-date {
  font-size: 11px;
  color: var(--color-text-muted);
}

.delete-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 16px;
  padding: 0;
}

.delete-btn:hover {
  color: var(--color-danger);
}

.stats-section {
  margin-bottom: 24px;
}

.stats-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.stat-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px 20px;
  text-align: center;
  min-width: 80px;
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.stat-free {
  color: var(--color-success);
}

.stat-paid {
  color: var(--color-warning);
}

.results-section {
  margin-top: 24px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: 16px;
}

.results-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.select-all-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
}

.result-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.result-checkbox {
  padding-top: 16px;
}

.result-content {
  flex: 1;
  min-width: 0;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
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

.btn-danger {
  background: var(--color-danger);
  color: white;
}

.btn-sm {
  padding: 4px 12px;
  font-size: 12px;
}

.btn-small {
  padding: 4px 12px;
  font-size: 12px;
}

.select, .input {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 13px;
}

.select:focus, .input:focus {
  outline: none;
  border-color: var(--color-accent);
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
</style>
