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

const showDetailsModal = ref(false);

const openLink = () => {
  window.open(props.resource.link, '_blank', 'noopener,noreferrer');
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
  const value = resolution.value;
  if (value === '2160P') return 'res-4k';
  if (value === '1080P') return 'res-fhd';
  if (value === '720P') return 'res-hd';
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

const descriptionBlocks = computed(() =>
  cleanDescription.value
    ? cleanDescription.value
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean)
    : [],
);

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
        <span>做种 {{ resource.seeders }}</span>
        <span class="separator">/</span>
        <span>下载中 {{ resource.leechers }}</span>
        <span class="separator">/</span>
        <span>完成 {{ resource.downloads }}</span>
      </div>

      <div class="action-row">
        <button class="details-btn" type="button" @click="showDetailsModal = true">详情</button>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="showDetailsModal" class="modal-overlay" @click.self="showDetailsModal = false">
      <div class="details-modal">
        <div class="modal-header">
          <div>
            <h3 class="modal-title">{{ resource.title }}</h3>
            <p v-if="translatedTitle" class="modal-subtitle">{{ translatedTitle }}</p>
          </div>
          <button class="modal-close" type="button" @click="showDetailsModal = false">&times;</button>
        </div>

        <div class="modal-body">
          <div class="modal-poster">
            <img
              v-if="resource.poster_url"
              :src="resource.poster_url"
              :alt="resource.title"
              class="modal-poster-img"
              loading="lazy"
              decoding="async"
              referrerpolicy="no-referrer"
            />
            <div v-else class="poster-placeholder modal-placeholder">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
              </svg>
            </div>
          </div>

          <div class="modal-content">
            <div class="modal-meta">
              <span>{{ resource.category || '未分类' }}</span>
              <span>{{ resource.source_name }}</span>
              <span v-if="resource.size">{{ resource.size }}</span>
              <span>做种 {{ resource.seeders }}</span>
              <span>下载中 {{ resource.leechers }}</span>
              <span>完成 {{ resource.downloads }}</span>
            </div>

            <div class="details-panel">
              <div class="details-panel-header">
                <span>资源详情</span>
                <button class="link-btn" type="button" @click="openLink">打开原始链接</button>
              </div>
              <div v-if="descriptionBlocks.length" class="details-text">
                <p v-for="(block, index) in descriptionBlocks" :key="`${resource.id}-${index}`">
                  {{ block }}
                </p>
              </div>
              <div v-else class="empty-text">暂无详情内容</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
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

.poster-img,
.modal-poster-img {
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
  width: 42px;
  height: 42px;
}

.content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  font-size: 13px;
  color: var(--color-text-secondary);
}

.translated-title-inline {
  color: var(--color-text-primary);
  opacity: 0.82;
}

.site {
  color: var(--color-accent);
  font-weight: 600;
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

.action-row {
  display: flex;
  justify-content: flex-end;
}

.details-btn,
.link-btn {
  padding: 8px 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  cursor: pointer;
}

.details-btn:hover,
.link-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.68);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 1200;
}

.details-modal {
  width: min(980px, 100%);
  max-height: 90vh;
  overflow: auto;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 18px;
  padding: 24px;
  box-shadow: 0 28px 60px rgba(15, 23, 42, 0.32);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.modal-title {
  margin: 0;
  font-size: 22px;
}

.modal-subtitle {
  margin: 6px 0 0;
  color: var(--color-text-secondary);
}

.modal-close {
  border: none;
  background: transparent;
  font-size: 30px;
  color: var(--color-text-secondary);
  cursor: pointer;
  line-height: 1;
}

.modal-body {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 20px;
}

.modal-poster {
  width: 90px;
  height: 125px;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
}

.modal-placeholder svg {
  width: 32px;
  height: 32px;
}

.modal-content {
  display: grid;
  gap: 16px;
}

.modal-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.modal-meta span {
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
}

.details-panel {
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  border-radius: 14px;
  padding: 16px;
}

.details-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  font-weight: 700;
}

.details-text {
  display: grid;
  gap: 10px;
  color: var(--color-text-secondary);
  line-height: 1.7;
}

.details-text p {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.empty-text {
  color: var(--color-text-muted);
}

@media (max-width: 720px) {
  .resource-card {
    flex-direction: column;
  }

  .poster {
    width: 96px;
    height: 136px;
  }

  .modal-body {
    grid-template-columns: 1fr;
  }

  .modal-poster {
    width: 90px;
    height: 125px;
  }
}
</style>
