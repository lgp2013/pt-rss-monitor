<<<<<<< HEAD
<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { sourcesApi, resourcesApi } from '../api';
import ResourceRow from '../components/ResourceRow.vue';

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
</script>

<template>
  <div class="dashboard">
    <h1 class="page-title">资源列表</h1>

    <!-- Filters -->
    <div class="filters card">
      <div class="filter-row">
        <div class="filter-item">
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

    <!-- Loading -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="resources.length === 0" class="empty-state">
      <p>暂无资源</p>
      <p class="text-muted">尝试添加 RSS 源或调整筛选条件</p>
    </div>

    <!-- Table -->
    <div v-else class="table-container card">
      <table class="table">
        <thead>
          <tr>
            <th>标题</th>
            <th>站点</th>
            <th>分类</th>
            <th>大小</th>
            <th>做种</th>
            <th>下载</th>
            <th>时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <ResourceRow
            v-for="resource in resources"
            :key="resource.id"
            :resource="resource"
            @delete="deleteResource"
          />
        </tbody>
      </table>
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
  margin-bottom: var(--spacing-lg);
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  align-items: flex-end;
}

.filter-item {
  min-width: 150px;
}

.filter-item .form-label {
  margin-bottom: var(--spacing-xs);
}

.filter-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-left: auto;
}

.text-muted {
  color: var(--color-text-muted);
  font-size: 14px;
}

@media (max-width: 768px) {
  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-item {
    min-width: unset;
  }

  .filter-actions {
    margin-left: 0;
    justify-content: flex-end;
  }
}
</style>
=======
<template>
<div class="dashboard">
<h1>PT RSS Monitor</h1>
<div class="stats">
<div class="stat-card">
<h2>资源总数</h2>
<p>{{ resourceCount }}</p>
</div>
<div class="stat-card">
<h2>RSS 源</h2>
<p>{{ sourceCount }}</p>
</div>
<div class="stat-card">
<h2>今日更新</h2>
<p>{{ todayCount }}</p>
</div>
</div>
<div class="recent-resources">
<h2>最近资源</h2>
<div v-if="recentResources.length === 0" class="empty-state">
<p>暂无资源</p>
</div>
<table class="resource-table" v-else>
<thead>
<tr>
<th>网站名称</th>
<th>资源种子名称</th>
<th>发布时间</th>
<th>做种者数量</th>
<th>下载数</th>
<th>操作</th>
</tr>
</thead>
<tbody>
<ResourceRow v-for="resource in recentResources" :key="resource.id" :resource="resource" />
</tbody>
</table>
</div>
</div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import ResourceRow from '../components/ResourceRow.vue';
import { getResources, getSources } from '../api';

const resourceCount = ref(0);
const sourceCount = ref(0);
const todayCount = ref(0);
const recentResources = ref([]);

onMounted(async () => {
await loadData();
});

async function loadData() {
try {
const resourcesResponse = await getResources({ limit: 100 });
const resources = resourcesResponse.data;
const sources = await getSources();

resourceCount.value = resourcesResponse.pagination.total;
sourceCount.value = sources.length;

const today = new Date();
today.setHours(0, 0, 0, 0);

todayCount.value = resources.filter(resource => {
const pubDate = resource.pub_date || resource.created_at;
if (!pubDate) return false;
const resourceDate = new Date(pubDate);
if (isNaN(resourceDate.getTime())) return false;
return resourceDate >= today;
}).length;

recentResources.value = resources;
} catch (error) {
console.error('加载数据失败:', error);
}
}
</script>

<style scoped>
.dashboard {
padding: 20px;
max-width: 1200px;
margin: 0 auto;
}

h1 {
font-size: 2.5rem;
margin-bottom: 30px;
color: var(--text-primary);
}

.stats {
display: grid;
grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
gap: 20px;
margin-bottom: 40px;
}

.stat-card {
background: var(--bg-secondary);
padding: 20px;
border-radius: 8px;
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
text-align: center;
}

.stat-card h2 {
font-size: 1rem;
color: var(--text-secondary);
margin-bottom: 10px;
}

.stat-card p {
font-size: 2rem;
font-weight: bold;
color: var(--text-primary);
}

.recent-resources h2 {
font-size: 1.5rem;
margin-bottom: 20px;
color: var(--text-primary);
}

.empty-state {
text-align: center;
padding: 40px;
color: var(--text-secondary);
background: var(--bg-secondary);
border-radius: 8px;
}

@media (max-width: 768px) {
.stats {
grid-template-columns: 1fr;
}
}

.resource-table {
width: 100%;
border-collapse: collapse;
background: var(--bg-secondary);
border-radius: 8px;
overflow: hidden;
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.resource-table th,
.resource-table td {
padding: 12px;
border-bottom: 1px solid var(--border);
}

.resource-table th {
background-color: var(--bg-secondary);
font-weight: 500;
text-align: left;
color: var(--text-secondary);
}

.resource-table tr:last-child td {
border-bottom: none;
}

.badge {
display: inline-block;
padding: 2px 8px;
border-radius: 12px;
font-size: 0.75rem;
font-weight: 500;
margin-left: 8px;
}

.badge-success {
background-color: rgba(40, 167, 69, 0.1);
color: var(--success);
}

.badge-warning {
background-color: rgba(255, 193, 7, 0.1);
color: var(--warning);
}

@media (max-width: 768px) {
.resource-table {
font-size: 0.875rem;
}

.resource-table th,
.resource-table td {
padding: 8px;
}

.resource-table th {
font-size: 0.75rem;
}
}
</style>
>>>>>>> b3b2b8ce71669aa78e478944f8439346c72c5bd9
