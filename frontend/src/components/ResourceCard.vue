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
    subtitle?: string | null;
    poster_url?: string | null;
  };
}>();

const emit = defineEmits<{
  delete: [id: number];
}>();

const formatTime = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

const openLink = () => {
  window.open(props.resource.link, '_blank');
};

// Get badge class based on free tag
const badgeClass = computed(() => {
  const tag = props.resource.free_tag?.toUpperCase();
  if (tag === 'FREE') return 'badge-free';
  if (tag?.includes('%')) return 'badge-discount';
  return 'badge-free';
});
</script>

<template>
  <div class="resource-card">
    <div class="poster">
      <img 
        v-if="resource.poster_url" 
        :src="resource.poster_url" 
        :alt="resource.title"
        class="poster-img"
        @error="($event.target as HTMLImageElement).style.display='none'"
      />
      <div v-else class="poster-placeholder">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
        </svg>
      </div>
    </div>
    <div class="content">
      <div class="header">
        <div class="title-row">
          <h3 class="title" @click="openLink">{{ resource.title }}</h3>
          <span v-if="resource.free_tag" class="badge" :class="badgeClass">
            {{ resource.free_tag }}
          </span>
        </div>
        <div v-if="resource.subtitle" class="subtitle">
          {{ resource.subtitle }}
        </div>
        <div class="meta">
          <span class="site">{{ resource.source_name }}</span>
          <span class="separator">•</span>
          <span class="category">{{ resource.category || '未分类' }}</span>
          <span class="separator">•</span>
          <span class="time">{{ formatTime(resource.pub_date || resource.created_at) }}</span>
        </div>
      </div>
      <div class="stats">
        <div class="stat">
          <span class="stat-label">做种</span>
          <span class="stat-value seeders">{{ resource.seeders }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">下载</span>
          <span class="stat-value">{{ resource.downloads }}</span>
        </div>
        <div class="stat" v-if="resource.size">
          <span class="stat-label">大小</span>
          <span class="stat-value">{{ resource.size }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">互助</span>
          <span class="stat-value">{{ resource.leechers }}</span>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-primary" @click="openLink">打开</button>
        <button class="btn" @click="emit('delete', resource.id)">删除</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.resource-card {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  margin-bottom: 12px;
  transition: background-color 0.2s;
}

.resource-card:hover {
  background: var(--color-bg-tertiary);
}

.poster {
  flex-shrink: 0;
  width: 100px;
  height: 140px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--color-bg-primary);
}

.poster-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.poster-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

.poster-placeholder svg {
  width: 48px;
  height: 48px;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
}

.header {
  flex: 1;
}

.title-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}

.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  cursor: pointer;
  word-break: break-all;
  line-height: 1.3;
}

.title:hover {
  color: var(--color-accent);
}

.subtitle {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: 4px;
  line-height: 1.4;
}

.badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.badge-free {
  background: var(--color-free);
  color: white;
}

.badge-discount {
  background: var(--color-discount);
  color: white;
}

.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
  flex-wrap: wrap;
}

.separator {
  color: var(--color-text-muted);
}

.site {
  color: var(--color-accent);
}

.stats {
  display: flex;
  gap: 20px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.stat {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-muted);
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.stat-value.seeders {
  color: var(--color-success);
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  align-items: center;
}

.link-btn {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  text-decoration: none;
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all 0.2s;
}

.link-btn:hover {
  background: var(--color-bg-tertiary);
}

.btn {
  padding: 6px 16px;
  border-radius: 4px;
  font-size: 13px;
  border: none;
  cursor: pointer;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  transition: all 0.2s;
}

.btn:hover {
  opacity: 0.8;
}

.btn-primary {
  background: var(--color-accent);
  color: white;
}

.btn-primary:hover {
  background: var(--color-accent-hover);
}

@media (max-width: 600px) {
  .resource-card {
    flex-direction: column;
  }
  
  .poster {
    width: 80px;
    height: 110px;
  }
  
  .stats {
    gap: 16px;
  }
  
  .actions {
    flex-wrap: wrap;
  }
}
</style>
