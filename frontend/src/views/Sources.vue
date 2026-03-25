<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { settingsApi, sourcesApi } from '../api';
import AddSourceModal from '../components/AddSourceModal.vue';
import SourceCard from '../components/SourceCard.vue';

const sources = ref<any[]>([]);
const categories = ref<string[]>([]);
const loading = ref(false);
const showModal = ref(false);
const editingSource = ref<any | null>(null);

async function loadSources() {
  loading.value = true;
  try {
    const [sourceItems, categoryItems] = await Promise.all([sourcesApi.list(), settingsApi.getCategories()]);
    sources.value = sourceItems;
    categories.value = categoryItems.categories || [];
  } catch (error) {
    console.error('Failed to load sources:', error);
  } finally {
    loading.value = false;
  }
}

function openAddModal() {
  editingSource.value = null;
  showModal.value = true;
}

function openEditModal(source: any) {
  editingSource.value = source;
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  editingSource.value = null;
}

async function handleSave(data: any) {
  try {
    if (editingSource.value) {
      await sourcesApi.update(editingSource.value.id, data);
    } else {
      await sourcesApi.create(data);
    }
    closeModal();
    await loadSources();
  } catch (error) {
    console.error('Failed to save source:', error);
    alert('保存失败: ' + (error as Error).message);
  }
}

async function handleDelete(id: number) {
  if (!confirm('确定删除此 RSS 源？相关资源也会被删除。')) return;
  try {
    await sourcesApi.delete(id);
    await loadSources();
  } catch (error) {
    console.error('Failed to delete source:', error);
  }
}

async function handleFetch(id: number) {
  try {
    const result = await sourcesApi.fetch(id);
    alert(`抓取完成，新增 ${result.new_resources} 条资源`);
  } catch (error) {
    console.error('Failed to fetch source:', error);
    alert('抓取失败: ' + (error as Error).message);
  }
}

async function handleFetchAll() {
  try {
    await sourcesApi.fetchAll();
    alert('全部抓取完成');
    await loadSources();
  } catch (error) {
    console.error('Failed to fetch all:', error);
  }
}

onMounted(loadSources);
</script>

<template>
  <div class="sources">
    <div class="page-header">
      <h1 class="page-title">RSS 源管理</h1>
      <div class="page-actions">
        <button class="btn" @click="handleFetchAll">抓取全部</button>
        <button class="btn btn-primary" @click="openAddModal">添加 RSS 源</button>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <div v-else-if="sources.length === 0" class="empty-state card">
      <p>暂无 RSS 源</p>
      <p class="text-muted">点击上方按钮添加第一个 RSS 源。</p>
    </div>

    <div v-else class="sources-grid">
      <SourceCard
        v-for="source in sources"
        :key="source.id"
        :source="source"
        @edit="openEditModal"
        @delete="handleDelete"
        @fetch="handleFetch"
      />
    </div>

    <AddSourceModal
      v-if="showModal"
      :source="editingSource"
      :categories="categories"
      @close="closeModal"
      @save="handleSave"
    />
  </div>
</template>

<style scoped>
.sources {
  max-width: 1200px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.page-title {
  font-size: 24px;
  font-weight: 700;
}

.page-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.text-muted {
  color: var(--color-text-muted);
  font-size: 14px;
}

.sources-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: var(--spacing-md);
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-md);
  }

  .sources-grid {
    grid-template-columns: 1fr;
  }
}
</style>
