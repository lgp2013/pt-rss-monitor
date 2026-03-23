<<<<<<< HEAD
<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  resource: {
    id: number;
    title: string;
    link: string;
    source_name: string;
    category: string;
    size: string | null;
    seeders: number;
    leechers: number;
    downloads: number;
    free_tag: string | null;
    created_at: string;
    pub_date: string | null;
  };
}>();

const emit = defineEmits<{
  delete: [id: number];
}>();

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const openLink = () => {
  window.open(props.resource.link, '_blank');
};
</script>

<template>
  <tr class="resource-row">
    <td class="cell-title">
      <a :href="resource.link" target="_blank" class="title-link" @click.prevent="openLink">
        {{ resource.title }}
      </a>
      <div v-if="resource.free_tag" class="free-tag">
        <span class="badge" :class="resource.free_tag === 'FREE' ? 'badge-free' : 'badge-discount'">
          {{ resource.free_tag }}
        </span>
      </div>
    </td>
    <td>{{ resource.source_name }}</td>
    <td><span class="tag">{{ resource.category }}</span></td>
    <td>{{ resource.size || '-' }}</td>
    <td class="cell-seeders">
      <span class="seeders">{{ resource.seeders }}</span>
      <span class="leechers">/ {{ resource.leechers }}</span>
    </td>
    <td>{{ resource.downloads }}</td>
    <td class="cell-time">{{ formatDate(resource.pub_date || resource.created_at) }}</td>
    <td class="cell-actions">
      <button class="btn btn-sm" @click="openLink">打开</button>
      <button class="btn btn-sm btn-danger" @click="emit('delete', resource.id)">删除</button>
=======
<template>
  <tr class="resource-row">
    <td>{{ resource.source_name }}</td>
    <td>
      <div class="resource-title">
        <a :href="resource.link" target="_blank" rel="noopener noreferrer">
          {{ resource.title }}
          <span v-if="resource.free_tag" class="badge" :class="{
            'badge-success': resource.free_tag === 'FREE',
            'badge-warning': resource.free_tag.includes('%')
          }">
            {{ resource.free_tag }}
          </span>
        </a>
      </div>
    </td>
    <td>{{ formatDate(resource.pub_date || resource.created_at) }}</td>
    <td>{{ resource.seeders }}</td>
    <td>{{ resource.downloads }}</td>
    <td>
      <button class="btn btn-danger btn-sm" @click="deleteResource">删除</button>
>>>>>>> b3b2b8ce71669aa78e478944f8439346c72c5bd9
    </td>
  </tr>
</template>

<<<<<<< HEAD
<style scoped>
.resource-row:hover {
  background-color: var(--color-bg-secondary);
}

.cell-title {
  max-width: 400px;
}

.title-link {
  color: var(--color-text-primary);
  text-decoration: none;
  word-break: break-all;
}

.title-link:hover {
  color: var(--color-accent);
}

.free-tag {
  margin-top: 4px;
}

.cell-seeders {
  font-family: monospace;
}

.seeders {
  color: var(--color-success);
  font-weight: 600;
}

.leechers {
  color: var(--color-text-muted);
}

.cell-time {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.cell-actions {
  white-space: nowrap;
}

.cell-actions .btn {
  margin-right: 4px;
}

.cell-actions .btn:last-child {
  margin-right: 0;
}
</style>
=======
<script setup lang="ts">
import { formatDate } from '../api'

interface Resource {
  id: number
  source_id: number
  title: string
  link: string
  guid: string | null
  pub_date: string | null
  seeders: number
  leechers: number
  downloads: number
  free_tag: string | null
  size: string | null
  created_at: string
  source_name: string
  category: string
}

const props = defineProps<{
  resource: Resource
}>()

const emit = defineEmits<{
  (e: 'delete', id: number): void
}>()

const deleteResource = () => {
  if (confirm('确定要删除这个资源吗？')) {
    emit('delete', props.resource.id)
  }
}
</script>

<style scoped>
.resource-row:hover {
  background-color: rgba(0, 0, 0, 0.05) !important;
}

.resource-title {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.resource-title a {
  color: var(--text-primary);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}

.resource-title a:hover {
  color: var(--primary);
  text-decoration: underline;
}

.resource-meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.resource-source {
  background-color: var(--bg-secondary);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
}

.resource-category {
  background-color: var(--bg-secondary);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .resource-row {
    font-size: 0.875rem;
  }

  .resource-title a {
    font-size: 0.875rem;
  }

  .resource-meta {
    font-size: 0.75rem;
  }

  .btn-sm {
    padding: 0.125rem 0.25rem;
    font-size: 0.75rem;
  }
}
</style>
>>>>>>> b3b2b8ce71669aa78e478944f8439346c72c5bd9
