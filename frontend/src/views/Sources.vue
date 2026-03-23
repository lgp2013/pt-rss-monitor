<template>
<div class="sources">
<div class="sources-header">
<h1>RSS 源管理</h1>
<button class="add-button" @click="openAddModal">添加 RSS 源</button>
<button class="add-button" @click="fetchAllSources">抓取所有</button>
</div>
<div v-if="sources.length === 0" class="empty-state">
<p>暂无 RSS 源</p>
<button class="add-button" @click="openAddModal">添加第一个 RSS 源</button>
</div>
<div v-else class="sources-grid">
<SourceCard v-for="source in sources" :key="source.id" :source="source" @edit="openEditModal" @delete="deleteSource" @fetch="fetchSource" />
</div>
<AddSourceModal :visible="isAddModalOpen" :isEdit="!!editingSource" :source="editingSource" @close="closeAddModal" @save="saveSource" />
</div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import SourceCard from '../components/SourceCard.vue';
import AddSourceModal from '../components/AddSourceModal.vue';
import { getSources, addSource, updateSource, deleteSource as apiDeleteSource, fetchSource as apiFetchSource, fetchAllSources as apiFetchAllSources } from '../api';

const sources = ref([]);
const isAddModalOpen = ref(false);
const editingSource = ref(null);

onMounted(async () => {
await loadSources();
});

async function loadSources() {
try {
sources.value = await getSources();
} catch (error) {
console.error('加载 RSS 源失败:', error);
}
}

function openAddModal() {
editingSource.value = null;
isAddModalOpen.value = true;
}

function openEditModal(source) {
editingSource.value = { ...source };
isAddModalOpen.value = true;
}

function closeAddModal() {
isAddModalOpen.value = false;
editingSource.value = null;
}

async function saveSource(sourceData) {
try {
if (editingSource.value) {
await updateSource(editingSource.value.id, sourceData);
} else {
await addSource(sourceData);
}
await loadSources();
closeAddModal();
} catch (error) {
console.error('保存 RSS 源失败:', error);
}
}

async function deleteSource(sourceId) {
if (confirm('确定要删除这个 RSS 源吗？')) {
try {
await apiDeleteSource(sourceId);
await loadSources();
} catch (error) {
console.error('删除 RSS 源失败:', error);
}
}
}

async function fetchSource(sourceId) {
try {
const result = await apiFetchSource(sourceId);
alert(`抓取完成，新增资源：${result.new_resources} 个`);
} catch (error) {
console.error('抓取 RSS 源失败:', error);
alert('抓取失败，请检查网络连接或 RSS 源地址是否正确');
}
}

async function fetchAllSources() {
try {
await apiFetchAllSources();
alert('所有 RSS 源抓取完成');
} catch (error) {
console.error('抓取所有 RSS 源失败:', error);
alert('抓取失败，请检查网络连接');
}
}
</script>

<style scoped>
.sources {
padding: 20px;
max-width: 1200px;
margin: 0 auto;
}

.sources-header {
display: flex;
justify-content: space-between;
align-items: center;
margin-bottom: 30px;
}

.sources-header h1 {
font-size: 2rem;
color: var(--text-primary);
}

.add-button {
background: var(--primary-color);
color: white;
border: none;
padding: 10px 20px;
border-radius: 4px;
cursor: pointer;
font-size: 1rem;
transition: background-color 0.2s;
}

.add-button:hover {
background: var(--primary-hover);
}

.empty-state {
text-align: center;
padding: 60px;
background: var(--card-bg);
border-radius: 8px;
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.empty-state p {
font-size: 1.2rem;
color: var(--text-secondary);
margin-bottom: 20px;
}

.sources-grid {
display: grid;
grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
gap: 20px;
}

@media (max-width: 768px) {
.sources-header {
flex-direction: column;
align-items: flex-start;
gap: 10px;
}
.sources-grid {
grid-template-columns: 1fr;
}
}
</style>