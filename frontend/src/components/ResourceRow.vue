<template>
  <tr class="resource-row">
    <td>
      <div class="resource-title">
        <a :href="resource.link" target="_blank" rel="noopener noreferrer">{{ resource.title }}</a>
        <div class="resource-meta">
          <span class="resource-source">{{ resource.source_name }}</span>
          <span class="resource-category">{{ resource.category }}</span>
        </div>
      </div>
    </td>
    <td>
      <span v-if="resource.free_tag" class="badge" :class="{
        'badge-success': resource.free_tag === 'FREE',
        'badge-warning': resource.free_tag.includes('%')
      }">
        {{ resource.free_tag }}
      </span>
    </td>
    <td>{{ resource.size }}</td>
    <td>{{ resource.seeders }}</td>
    <td>{{ resource.leechers }}</td>
    <td>{{ resource.downloads }}</td>
    <td>{{ formatDate(resource.pub_date || resource.created_at) }}</td>
    <td>
      <button class="btn btn-danger btn-sm" @click="deleteResource">删除</button>
    </td>
  </tr>
</template>

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