<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{
  resource: {
    id: number;
    title: string;
    translated_name?: string | null;
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
    description?: string | null;
  };
}>();

const showFullDescription = ref(false);

const openLink = () => {
  window.open(props.resource.link, '_blank');
};

const badgeClass = computed(() => {
  const tag = props.resource.free_tag?.toUpperCase();
  if (tag === 'FREE') return 'badge-free';
  if (tag?.includes('%')) return 'badge-discount';
  return 'badge-neutral';
});

const resolution = computed(() => {
  const match = props.resource.title.match(/(2160p|1080p|720p|480p)/i);
  return match ? match[1].toUpperCase() : null;
});

const resolutionClass = computed(() => {
  const res = resolution.value;
  if (res === '2160P') return 'res-4k';
  if (res === '1080P') return 'res-fhd';
  if (res === '720P') return 'res-hd';
  return 'res-sd';
});

const cleanDescription = computed(() => {
  if (!props.resource.description) return '';
  return props.resource.description
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
});

const descriptionBlocks = computed(() => {
  if (!cleanDescription.value) return [];
  return cleanDescription.value
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean);
});

const joinedDescription = computed(() => descriptionBlocks.value.join('\n\n'));
const hasMoreDescription = computed(() => joinedDescription.value.length > 220 || descriptionBlocks.value.length > 1);
const translatedTitle = computed(() => props.resource.translated_name?.trim() || '');
</script>

<template>
  <div class="resource-card">
    <div class="poster">
      <img
        v-if="resource.poster_url"
        :src="resource.poster_url"
        :alt="resource.title"
        class="poster-img"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      />
      <div v-else class="poster-placeholder">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
        </svg>
      </div>
    </div>

    <div class="content">
      <div class="header">
        <div class="title-row">
          <h3 class="title" @click="openLink">{{ resource.title }}</h3>
          <span v-if="resource.free_tag" class="badge" :class="badgeClass">{{ resource.free_tag }}</span>
          <span v-if="resolution" class="badge resolution-badge" :class="resolutionClass">{{ resolution }}</span>
        </div>

        <div class="resource-line">
          <template v-if="translatedTitle">
            <span class="translated-title-inline">{{ translatedTitle }}</span>
            <span class="separator">/</span>
          </template>
          <span>{{ resource.category || '未分类' }}</span>
          <span class="separator">/</span>
          <span class="site">{{ resource.source_name }}</span>
          <template v-if="resource.size">
            <span class="separator">/</span>
            <span>{{ resource.size }}</span>
          </template>
          <span class="separator">/</span>
          <span>Seeders {{ resource.seeders }}</span>
          <span class="separator">/</span>
          <span>Leechers {{ resource.leechers }}</span>
          <span class="separator">/</span>
          <span>Downloads {{ resource.downloads }}</span>
        </div>
      </div>

      <div v-if="descriptionBlocks.length" class="description">
        <div class="description-header">
          <span class="description-title">详情</span>
          <button v-if="hasMoreDescription" class="toggle-btn" @click="showFullDescription = !showFullDescription">
            {{ showFullDescription ? '收起' : '展开' }}
          </button>
        </div>
        <div class="description-body">
          <div :class="['description-text', { collapsed: !showFullDescription }]">
            {{ joinedDescription }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.resource-card {
  display: flex;
  gap: 18px;
  padding: 18px;
  margin-bottom: 14px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 14px;
}

.poster {
  flex-shrink: 0;
  width: 112px;
  height: 156px;
  overflow: hidden;
  border-radius: 10px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
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
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.title-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}

.title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--color-text-primary);
  cursor: pointer;
  word-break: break-word;
}

.title:hover {
  color: var(--color-accent);
}

.resource-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.site {
  color: var(--color-accent);
  font-weight: 600;
}

.translated-title-inline {
  color: var(--color-text-primary);
  opacity: 0.82;
}

.separator {
  color: var(--color-text-muted);
}

.badge {
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.badge-free {
  background: var(--color-free);
  color: #fff;
}

.badge-discount {
  background: var(--color-discount);
  color: #fff;
}

.badge-neutral {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.resolution-badge {
  border: 1px solid transparent;
}

.res-4k {
  background: #7c3aed;
  color: #fff;
}

.res-fhd {
  background: #059669;
  color: #fff;
}

.res-hd {
  background: #2563eb;
  color: #fff;
}

.res-sd {
  background: #6b7280;
  color: #fff;
}

.description {
  padding: 14px 16px;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.06), rgba(37, 99, 235, 0.02));
  border: 1px solid rgba(37, 99, 235, 0.14);
}

.description-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.description-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-accent);
}

.description-body {
  display: block;
}

.description-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.description-text.collapsed {
  -webkit-line-clamp: 5;
}

.toggle-btn {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-accent);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.toggle-btn:hover {
  text-decoration: underline;
}

@media (max-width: 720px) {
  .resource-card {
    flex-direction: column;
  }

  .poster {
    width: 96px;
    height: 136px;
  }

  .resource-line {
    gap: 6px;
  }

}
</style>
