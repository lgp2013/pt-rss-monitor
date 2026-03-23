<script setup lang="ts">
import { ref, watch, computed } from 'vue';

const props = defineProps<{
  source?: {
    id: number;
    name: string;
    url: string;
    category: string;
    fetch_interval: number;
    enabled: number;
  } | null;
}>();

const emit = defineEmits<{
  close: [];
  save: [data: { name: string; url: string; category: string; fetch_interval: number; enabled: boolean }];
}>();

const form = ref({
  name: '',
  url: '',
  category: '其他',
  fetch_interval: 30,
  enabled: true,
});

const categories = ['影视', '音乐', '游戏', '软件', '图书', '其他'];

const isEditing = computed(() => !!props.source);

watch(
  () => props.source,
  (newSource) => {
    if (newSource) {
      form.value = {
        name: newSource.name,
        url: newSource.url,
        category: newSource.category,
        fetch_interval: newSource.fetch_interval,
        enabled: newSource.enabled === 1,
      };
    } else {
      form.value = {
        name: '',
        url: '',
        category: '其他',
        fetch_interval: 30,
        enabled: true,
      };
    }
  },
  { immediate: true }
);

function handleSubmit() {
  if (!form.value.name.trim() || !form.value.url.trim()) {
    alert('请填写名称和 URL');
    return;
  }

  emit('save', { ...form.value });
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">{{ isEditing ? '编辑 RSS 源' : '添加 RSS 源' }}</h2>
        <button class="modal-close" @click="emit('close')">&times;</button>
      </div>

      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label class="form-label">名称 *</label>
          <input
            v-model="form.name"
            type="text"
            class="input form-input"
            placeholder="例如: TTG"
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label">RSS URL *</label>
          <input
            v-model="form.url"
            type="url"
            class="input form-input"
            placeholder="https://example.com/rss"
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label">分类</label>
          <select v-model="form.category" class="select form-input">
            <option v-for="cat in categories" :key="cat" :value="cat">
              {{ cat }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">抓取间隔（分钟）</label>
          <input
            v-model.number="form.fetch_interval"
            type="number"
            class="input form-input"
            min="1"
            max="1440"
          />
        </div>

        <div class="form-group">
          <label class="form-label-inline">
            <input v-model="form.enabled" type="checkbox" />
            <span>启用此 RSS 源</span>
          </label>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn" @click="emit('close')">取消</button>
          <button type="submit" class="btn btn-primary">
            {{ isEditing ? '保存' : '添加' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.form-label-inline {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  cursor: pointer;
}

.form-label-inline input {
  width: 18px;
  height: 18px;
}
</style>
