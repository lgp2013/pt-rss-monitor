<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { resourcesApi, sourcesApi } from '../api';
import ResourceCard from '../components/ResourceCard.vue';

const resources = ref<any[]>([]);
const sources = ref<any[]>([]);
const categories = ref<string[]>([]);
const loading = ref(false);
const searchTimer = ref<number | null>(null);

const pagination = ref({ page: 1, limit: 10, total: 0, total_pages: 0 });
const filters = ref({
  source_id: '',
  category: '',
  search: '',
  resolution: '',
  free_tag: '',
  sort_by: 'created_at',
  sort_order: 'desc',
});

async function loadSources() {
  try {
    sources.value = await sourcesApi.list();
    categories.value = [...new Set(sources.value.map((source: any) => source.category).filter(Boolean))];
  } catch (error) {
    console.error('Failed to load sources:', error);
  }
}

async function loadResources() {
  loading.value = true;
  try {
    const result = await resourcesApi.list({
      page: pagination.value.page,
      limit: pagination.value.limit,
      source_id: filters.value.source_id ? Number(filters.value.source_id) : undefined,
      category: filters.value.category || undefined,
      search: filters.value.search.trim() || undefined,
      resolution: filters.value.resolution || undefined,
      free_tag: filters.value.free_tag || undefined,
      sort_by: filters.value.sort_by,
      sort_order: filters.value.sort_order,
    });
    resources.value = result.data;
    pagination.value = result.pagination;
  } catch (error) {
    console.error('Failed to load resources:', error);
  } finally {
    loading.value = false;
  }
}

function resetToFirstPage() {
  if (pagination.value.page !== 1) {
    pagination.value.page = 1;
  }
}

function prevPage() {
  if (pagination.value.page > 1) {
    pagination.value.page--;
  }
}

function nextPage() {
  if (pagination.value.page < pagination.value.total_pages) {
    pagination.value.page++;
  }
}

function clearFilters() {
  filters.value = {
    source_id: '',
    category: '',
    search: '',
    resolution: '',
    free_tag: '',
    sort_by: 'created_at',
    sort_order: 'desc',
  };
  pagination.value.page = 1;
}

async function deleteResource(id: number) {
  if (!confirm('确定删除这条资源记录？')) return;
  try {
    await resourcesApi.delete(id);
    await loadResources();
  } catch (error) {
    console.error('Failed to delete resource:', error);
  }
}

watch(
  [
    () => filters.value.source_id,
    () => filters.value.category,
    () => filters.value.resolution,
    () => filters.value.free_tag,
    () => filters.value.sort_by,
    () => filters.value.sort_order,
    () => pagination.value.limit,
  ],
  async () => {
    resetToFirstPage();
    await loadResources();
  },
);

watch(
  () => filters.value.search,
  (value) => {
    if (searchTimer.value) {
      window.clearTimeout(searchTimer.value);
    }
    searchTimer.value = window.setTimeout(async () => {
      resetToFirstPage();
      await loadResources();
    }, value.trim() ? 300 : 0);
  },
);

watch(
  () => pagination.value.page,
  async () => {
    await loadResources();
  },
);

onMounted(async () => {
  await loadSources();
  await loadResources();
});
</script>

<template>
  <div class="dashboard">
    <h1 class="page-title">资源列表</h1>

    <div class="filters card">
      <div class="filter-row">
        <div class="filter-item filter-search">
          <label class="form-label">搜索</label>
          <input v-model="filters.search" type="text" class="input" placeholder="按标题搜索..." />
        </div>

        <div class="filter-item">
          <label class="form-label">RSS 源</label>
          <select v-model="filters.source_id" class="select">
            <option value="">全部</option>
            <option v-for="source in sources" :key="source.id" :value="String(source.id)">
              {{ source.name }}
            </option>
          </select>
        </div>

        <div class="filter-item">
          <label class="form-label">分类</label>
          <select v-model="filters.category" class="select">
            <option value="">全部</option>
            <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>

        <div class="filter-item">
          <label class="form-label">清晰度</label>
          <select v-model="filters.resolution" class="select">
            <option value="">全部</option>
            <option value="2160p">2160p</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="480p">480p</option>
          </select>
        </div>

        <div class="filter-item">
          <label class="form-label">优惠</label>
          <select v-model="filters.free_tag" class="select">
            <option value="">全部</option>
            <option value="FREE">FREE</option>
            <option value="50%">50%</option>
            <option value="30%">30%</option>
          </select>
        </div>

        <div class="filter-item">
          <label class="form-label">排序字段</label>
          <select v-model="filters.sort_by" class="select">
            <option value="created_at">抓取时间</option>
            <option value="pub_date">发布时间</option>
            <option value="title">标题</option>
            <option value="seeders">做种数</option>
            <option value="size">大小</option>
          </select>
        </div>

        <div class="filter-item">
          <label class="form-label">排序方向</label>
          <select v-model="filters.sort_order" class="select">
            <option value="desc">降序</option>
            <option value="asc">升序</option>
          </select>
        </div>

        <div class="filter-item">
          <label class="form-label">每页数量</label>
          <select v-model.number="pagination.limit" class="select">
            <option :value="10">10</option>
            <option :value="30">30</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </div>

        <div class="filter-actions">
          <button class="btn" @click="clearFilters">重置</button>
        </div>
      </div>
    </div>

    <div class="stats-bar">
      <span class="stats-item">共 {{ pagination.total }} 条资源</span>
      <span class="stats-item">当前第 {{ pagination.page }} / {{ Math.max(pagination.total_pages, 1) }} 页</span>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <div v-else-if="resources.length === 0" class="empty-state">
      <p>暂无资源</p>
      <p class="text-muted">请检查 RSS 源抓取结果或调整筛选条件。</p>
    </div>

    <div v-else class="resource-list">
      <ResourceCard v-for="resource in resources" :key="resource.id" :resource="resource" @delete="deleteResource" />
    </div>

    <div v-if="pagination.total_pages > 1" class="pagination">
      <button class="pagination-btn" :disabled="pagination.page <= 1" @click="prevPage">上一页</button>
      <span class="pagination-info">
        第 {{ pagination.page }} / {{ pagination.total_pages }} 页，共 {{ pagination.total }} 条
      </span>
      <button class="pagination-btn" :disabled="pagination.page >= pagination.total_pages" @click="nextPage">下一页</button>
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
  flex-direction: row;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  align-items: flex-end;
}

.filter-item {
  min-width: 120px;
}

.filter-search {
  flex: 1;
  min-width: 220px;
}

.filter-actions {
  margin-left: auto;
}

.filter-actions .btn {
  width: auto;
}

.stats-bar {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: var(--spacing-md);
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

  .filter-item,
  .filter-search {
    min-width: unset;
  }

  .filter-actions {
    margin-left: 0;
  }

  .filter-actions .btn {
    width: 100%;
  }
}
</style>
