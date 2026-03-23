<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { sourcesApi, resourcesApi } from '../api';
import ResourceCard from '../components/ResourceCard.vue';

const sources = ref<any[]>([]);
const searchQuery = ref('');
const selectedSources = ref<number[]>([]);
const results = ref<any[]>([]);
const loading = ref(false);
const searching = ref(false);

// Filters
const filters = ref({
  resolution: '',
  freeTag: '',
  category: '',
  minSeeders: '',
});

// Saved searches
const savedSearches = ref<{ name: string; query: string; sources: number[] }[]>([]);
const newSearchName = ref('');

async function loadSources() {
  try {
    sources.value = await sourcesApi.list();
  } catch (error) {
    console.error('Failed to load sources:', error);
  }
}

async function search() {
  if (!searchQuery.value.trim()) {
    alert('请输入搜索关键词');
    return;
  }

  searching.value = true;
  results.value = [];
  
  try {
    // Search across all selected sources or all enabled sources
    const sourceIds = selectedSources.value.length > 0 
      ? selectedSources.value 
      : sources.value.filter((s: any) => s.enabled === 1).map((s: any) => s.id);

    const allResults: any[] = [];
    
    for (const sourceId of sourceIds) {
      try {
        const params: any = {
          source_id: sourceId,
          search: searchQuery.value,
          limit: 100,
        };
        
        const data = await resourcesApi.list(params);
        allResults.push(...data.data);
      } catch (e) {
        console.error(`Search failed for source ${sourceId}:`, e);
      }
    }

    // Apply filters
    results.value = allResults.filter(r => {
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

  } catch (error) {
    console.error('Search failed:', error);
    alert('搜索失败');
  } finally {
    searching.value = false;
  }
}

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

function saveSearch() {
  if (!newSearchName.value.trim() || !searchQuery.value.trim()) {
    alert('请输入搜索名称和关键词');
    return;
  }
  
  savedSearches.value.push({
    name: newSearchName.value.trim(),
    query: searchQuery.value.trim(),
    sources: [...selectedSources.value],
  });
  
  newSearchName.value = '';
  localStorage.setItem('savedSearches', JSON.stringify(savedSearches.value));
}

function loadSavedSearch(search: { name: string; query: string; sources: number[] }) {
  searchQuery.value = search.query;
  selectedSources.value = [...search.sources];
  search();
}

function deleteSavedSearch(index: number) {
  savedSearches.value.splice(index, 1);
  localStorage.setItem('savedSearches', JSON.stringify(savedSearches.value));
}

async function deleteResource(id: number) {
  if (!confirm('确定删除这条记录？')) return;
  try {
    await resourcesApi.delete(id);
    results.value = results.value.filter(r => r.id !== id);
  } catch (error) {
    console.error('Failed to delete:', error);
  }
}

function openLink(link: string) {
  window.open(link, '_blank');
}

onMounted(() => {
  loadSources();
  
  // Load saved searches
  const saved = localStorage.getItem('savedSearches');
  if (saved) {
    try {
      savedSearches.value = JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load saved searches:', e);
    }
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

      <!-- Source Selection -->
      <div class="source-selection">
        <div class="source-selection-header">
          <span>选择站点 ({{ selectedSources.length }} / {{ sources.length }} 已启用)</span>
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
          <select v-model="filters.resolution" class="select">
            <option value="">全部</option>
            <option value="2160p">2160p</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
          </select>
        </div>
        <div class="filter-item">
          <label>折扣</label>
          <select v-model="filters.freeTag" class="select">
            <option value="">全部</option>
            <option value="FREE">免费</option>
            <option value="50%">50%</option>
          </select>
        </div>
        <div class="filter-item">
          <label>分类</label>
          <select v-model="filters.category" class="select">
            <option value="">全部</option>
            <option v-for="cat in [...new Set(sources.map((s: any) => s.category).filter(Boolean))]" :key="cat" :value="cat">
              {{ cat }}
            </option>
          </select>
        </div>
        <div class="filter-item">
          <label>最小做种</label>
          <input v-model="filters.minSeeders" type="number" class="input" placeholder="0" />
        </div>
        <button class="btn" @click="search">应用筛选</button>
      </div>

      <!-- Save Search -->
      <div class="save-search-row">
        <input
          v-model="newSearchName"
          type="text"
          class="input"
          placeholder="保存当前搜索条件..."
        />
        <button class="btn btn-primary" @click="saveSearch">保存</button>
      </div>
    </div>

    <!-- Saved Searches -->
    <div v-if="savedSearches.length > 0" class="saved-searches">
      <h3>已保存的搜索</h3>
      <div class="saved-search-tags">
        <div 
          v-for="(search, idx) in savedSearches" 
          :key="idx"
          class="saved-search-tag"
        >
          <span @click="loadSavedSearch(search)" class="saved-search-name">
            {{ search.name }}
          </span>
          <button class="delete-btn" @click="deleteSavedSearch(idx)">×</button>
        </div>
      </div>
    </div>

    <!-- Results -->
    <div class="results-section">
      <div class="results-header">
        <span>搜索结果: {{ results.length }} 条</span>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>

      <div v-else-if="results.length === 0 && !searching" class="empty-message">
        输入关键词开始搜索
      </div>

      <div v-else class="results-list">
        <ResourceCard
          v-for="resource in results"
          :key="resource.id"
          :resource="resource"
          @delete="deleteResource"
        />
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

.save-search-row {
  display: flex;
  gap: 12px;
}

.save-search-row .input {
  flex: 1;
}

.saved-searches {
  margin-bottom: 24px;
}

.saved-searches h3 {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: 12px;
}

.saved-search-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.saved-search-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: var(--color-bg-tertiary);
  border-radius: 6px;
  font-size: 13px;
}

.saved-search-name {
  cursor: pointer;
  color: var(--color-accent);
}

.saved-search-name:hover {
  text-decoration: underline;
}

.delete-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  margin-left: 4px;
}

.delete-btn:hover {
  color: var(--color-danger);
}

.results-section {
  margin-top: 24px;
}

.results-header {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: 16px;
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
