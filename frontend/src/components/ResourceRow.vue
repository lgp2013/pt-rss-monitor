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
    </td>
  </tr>
</template>

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
