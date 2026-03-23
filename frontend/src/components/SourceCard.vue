<template>
  <div class="source-card" :class="{ 'disabled': !source.enabled }">
    <div class="source-card-header">
      <h4 class="source-name">{{ source.name }}</h4>
      <div class="source-actions">
        <button class="btn btn-primary btn-sm" @click="fetchSource">抓取</button>
        <button class="btn btn-secondary btn-sm" @click="editSource">编辑</button>
        <button class="btn btn-danger btn-sm" @click="deleteSource">删除</button>
      </div>
    </div>
    <div class="source-card-body">
      <div class="source-info">
        <div class="source-url">{{ source.url }}</div>
        <div class="source-meta">
          <span class="source-category">{{ source.category }}</span>
          <span class="source-interval">{{ source.fetch_interval }} 分钟</span>
          <span class="source-status" :class="{ 'enabled': source.enabled, 'disabled': !source.enabled }">
            {{ source.enabled ? '启用' : '禁用' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Source {
  id: number
  name: string
  url: string
  category: string
  fetch_interval: number
  enabled: number
  created_at: string
}

const props = defineProps<{
  source: Source
}>()

const emit = defineEmits<{
  (e: 'fetch', id: number): void
  (e: 'edit', source: Source): void
  (e: 'delete', id: number): void
}>()

const fetchSource = () => {
  emit('fetch', props.source.id)
}

const editSource = () => {
  emit('edit', props.source)
}

const deleteSource = () => {
  if (confirm('确定要删除这个 RSS 源吗？')) {
    emit('delete', props.source.id)
  }
}
</script>

<style scoped>
.source-card {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 1rem;
  margin-bottom: 1rem;
  transition: all 0.2s;
}

.source-card:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.source-card.disabled {
  opacity: 0.6;
}

.source-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.source-name {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 500;
}

.source-actions {
  display: flex;
  gap: 0.5rem;
}

.source-card-body {
  border-top: 1px solid var(--border);
  padding-top: 0.75rem;
}

.source-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.source-url {
  font-size: 0.875rem;
  color: var(--text-secondary);
  word-break: break-all;
}

.source-meta {
  display: flex;
  gap: 0.75rem;
  font-size: 0.875rem;
}

.source-category {
  background-color: var(--bg-primary);
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  color: var(--text-secondary);
}

.source-interval {
  background-color: var(--bg-primary);
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  color: var(--text-secondary);
}

.source-status {
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 500;
}

.source-status.enabled {
  background-color: rgba(40, 167, 69, 0.1);
  color: var(--success);
}

.source-status.disabled {
  background-color: rgba(220, 53, 69, 0.1);
  color: var(--danger);
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .source-card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .source-actions {
    width: 100%;
    justify-content: space-between;
  }

  .source-meta {
    flex-wrap: wrap;
  }
}
</style>