<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { sourcesApi, resourcesApi } from '../api';
import ResourceCard from '../components/ResourceCard.vue';

const resources = ref<any[]>([]);
const sources = ref<any[]>([]);
const pagination = ref({ page: 1, limit: 50, total: 0, total_pages: 0 });
const loading = ref(false);

const filters = ref({
  source_id: '',
  category: '',
  search: '',
  sort_by: 'created_at',
  sort_order: 'desc',
});

const categories = ref<string[]>([]);

async function loadSources() {
  try {
    sources.value = await sourcesApi.list();
    // Extract unique categories
    const cats = new Set(sources.value.map((s: any) => s.category).filter(Boolean));
    categories.value = Array.from(cats);
  } catch (error) {
    console.error('Failed to load sources:', error);
  }
}

async function loadResources() {
  loading.value = true;
  try {
    const params: any = {
      page: pagination.value.page,
      limit: pagination.value.limit,
      sort_by: filters.value.sort_by,
      sort_order: filters.value.sort_order,
    };

    if (filters.value.source_id) params.source_id = filters.value.source_id;
    if (filters.value.category) params.category = filters.value.category;
    if (filters.value.search) params.search = filters.value.search;

    const result = await resourcesApi.list(params);
    resources.value = result.data;
    pagination.value = result.pagination;
  } catch (error) {
    console.error('Failed to load resources:', error);
  } finally {
    loading.value = false;
  }
}

function prevPage() {
  if (pagination.value.page > 1) {
    pagination.value.page--;
    loadResources();
  }
}

function nextPage() {
  if (pagination.value.page < pagination.value.total_pages) {
    pagination.value.page++;
    loadResources();
  }
}

function applyFilters() {
  pagination.value.page = 1;
  loadResources();
}

function clearFilters() {
  filters.value = {
    source_id: '',
    category: '',
    search: '',
    sort_by: 'created_at',
    sort_order: 'desc',
  };
  applyFilters();
}

async function deleteResource(id: number) {
  if (!confirm('确定删除这条记录？')) return;
  try {
    await resourcesApi.delete(id);
    loadResources();
  } catch (error) {
    console.error('Failed to delete resource:', error);
  }
}

onMounted(() => {
  loadSources();
  loadResources();
});

watch(
  () => filters.value.source_id,
  () => applyFilters()
);

// Auto-reset when search is cleared
watch(
  () => filters.value.search,
  (newVal, oldVal) => {
    if (oldVal && !newVal) {
      // Search was cleared, apply filters immediately
      applyFilters();
    }
  }
);
</script>

<template>
  <div class="dashboard">
    <h1 class="page-title">资源列表</h1>

    <!-- Filters -->
    <div class="filters card">
      <div class="filter-row">
        <div class="filter-item filter-search">
          <label class="form-label">搜索</label>
          <input
            v-model="filters.search"
            type="text"
            class="input"
            placeholder="搜索标题..."
            @keyup.enter="applyFilters"
          />
        </div>
        <div class="filter-item">
          <label class="form-label">站点</label>
          <select v-model="filters.source_id" class="select">
            <option value="">全部站点</option>
            <option v-for="source in sources" :key="source.id" :value="source.id">
              {{ source.name }}
            </option>
          </select>
        </div>
        <div class="filter-item">
          <label class="form-label">分类</label>
          <select v-model="filters.category" class="select">
            <option value="">全部分类</option>
            <option v-for="cat in categories" :key="cat" :value="cat">
              {{ cat }}
            </option>
          </select>
        </div>
        <div class="filter-item">
          <label class="form-label">排序</label>
          <select v-model="filters.sort_by" class="select">
            <option value="created_at">时间</option>
            <option value="pub_date">发布时间</option>
            <option value="title">标题</option>
            <option value="seeders">做种</option>
          </select>
        </div>
        <div class="filter-item">
          <label class="form-label">顺序</label>
          <select v-model="filters.sort_order" class="select">
            <option value="desc">降序</option>
            <option value="asc">升序</option>
          </select>
        </div>
        <div class="filter-actions">
          <button class="btn btn-primary" @click="applyFilters">应用</button>
          <button class="btn" @click="clearFilters">重置</button>
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-bar">
      <span class="stats-item">共 {{ pagination.total }} 条资源</span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="resources.length === 0" class="empty-state">
      <p>暂无资源</p>
      <p class="text-muted">尝试添加 RSS 源或调整筛选条件</p>
    </div>

    <!-- Card List -->
    <div v-else class="resource-list">
      <ResourceCard
        v-for="resource in resources"
        :key="resource.id"
        :resource="resource"
        @delete="deleteResource"
      />
    </div>

    <!-- Pagination -->
    <div v-if="pagination.total_pages > 1" class="pagination">
      <button
        class="pagination-btn"
        :disabled="pagination.page <= 1"
        @click="prevPage"
      >
        上一页
      </button>
      <span class="pagination-info">
        第 {{ pagination.page }} / {{ pagination.total_pages }} 页，共 {{ pagination.total }} 条
      </span>
      <button
        class="pagination-btn"
        :disabled="pagination.page >= pagination.total_pages"
        @click="nextPage"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 100%;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: var(--spacing-lg);
}

.filters {
  margin-bottom: var(--spacing-md);
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  align-items: flex-end;
}

.filter-item {
  min-width: 120px;
}

.filter-search {
  flex: 1;
  min-width: 200px;
}

.filter-item .form-label {
  margin-bottom: var(--spacing-xs);
}

.filter-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-left: auto;
}

.stats-bar {
  margin-bottom: var(--spacing-md);
  padding: 8px 0;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.text-muted {
  color: var(--color-text-muted);
  font-size: 14px;
}

.resource-list {
  margin-bottom: var(--spacing-lg);
}

@media (max-width: 768px) {
  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-item {
    min-width: unset;
  }

  .filter-search {
    min-width: unset;
  }

  .filter-actions {
    margin-left: 0;
    justify-content: flex-end;
  }
}
</style>
