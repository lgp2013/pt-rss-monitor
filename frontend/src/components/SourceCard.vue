<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  source: {
    id: number;
    name: string;
    url: string;
    category: string;
    fetch_interval: number;
    enabled: number;
    created_at: string;
  };
}>();

const emit = defineEmits<{
  edit: [source: any];
  delete: [id: number];
  fetch: [id: number];
}>();

const isEnabled = computed(() => props.source.enabled === 1);

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
</script>

<template>
  <div class="source-card card" :class="{ disabled: !isEnabled }">
    <div class="source-header">
      <div class="source-title">
        <h3>{{ source.name }}</h3>
        <span class="tag">{{ source.category }}</span>
      </div>
      <div class="source-status" :class="isEnabled ? 'status-enabled' : 'status-disabled'">
        {{ isEnabled ? '启用' : '禁用' }}
      </div>
    </div>

    <div class="source-url">
      <a :href="source.url" target="_blank" class="url-link">{{ source.url }}</a>
    </div>

    <div class="source-meta">
      <span>抓取间隔: {{ source.fetch_interval }} 分钟</span>
      <span>添加于: {{ formatDate(source.created_at) }}</span>
    </div>

    <div class="source-actions">
      <button class="btn btn-sm btn-primary" @click="emit('fetch', source.id)">抓取</button>
      <button class="btn btn-sm" @click="emit('edit', source)">编辑</button>
      <button class="btn btn-sm btn-danger" @click="emit('delete', source.id)">删除</button>
    </div>
  </div>
</template>

<style scoped>
.source-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.source-card.disabled {
  opacity: 0.6;
}

.source-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.source-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.source-title h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.source-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}

.status-enabled {
  background-color: var(--color-success);
  color: white;
}

.status-disabled {
  background-color: var(--color-text-muted);
  color: white;
}

.source-url {
  word-break: break-all;
}

.url-link {
  color: var(--color-accent);
  text-decoration: none;
  font-size: 12px;
}

.url-link:hover {
  text-decoration: underline;
}

.source-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  font-size: 12px;
  color: var(--color-text-secondary);
}

.source-actions {
  display: flex;
  gap: var(--spacing-sm);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
}
</style>
