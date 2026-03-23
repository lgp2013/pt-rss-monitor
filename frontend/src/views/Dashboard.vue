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