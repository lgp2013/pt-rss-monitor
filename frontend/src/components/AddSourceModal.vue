<template>
  <div class="modal-overlay" v-if="visible" @click="close">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>{{ isEdit ? '编辑 RSS 源' : '添加 RSS 源' }}</h3>
        <button class="btn btn-secondary" @click="close">×</button>
      </div>
      <div class="modal-body">
        <form @submit.prevent="submit">
          <div class="form-group">
            <label class="form-label" for="name">名称</label>
            <input 
              type="text" 
              id="name" 
              class="form-control" 
              v-model="form.name" 
              required
              placeholder="请输入 RSS 源名称"
            >
          </div>
          <div class="form-group">
            <label class="form-label" for="url">URL</label>
            <input 
              type="url" 
              id="url" 
              class="form-control" 
              v-model="form.url" 
              required
              placeholder="请输入 RSS 源 URL"
            >
          </div>
          <div class="form-group">
            <label class="form-label" for="category">分类</label>
            <input 
              type="text" 
              id="category" 
              class="form-control" 
              v-model="form.category"
              placeholder="请输入分类"
            >
          </div>
          <div class="form-group">
            <label class="form-label" for="fetch_interval">抓取间隔 (分钟)</label>
            <input 
              type="number" 
              id="fetch_interval" 
              class="form-control" 
              v-model.number="form.fetch_interval"
              min="1"
              max="1440"
              placeholder="请输入抓取间隔"
            >
          </div>
          <div class="form-group">
            <label class="form-label">
              <input type="checkbox" v-model="form.enabled"> 启用
            </label>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="close">取消</button>
            <button type="submit" class="btn btn-primary">保存</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  visible: boolean
  isEdit?: boolean
  source?: {
    id: number
    name: string
    url: string
    category: string
    fetch_interval: number
    enabled: number
  }
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  isEdit: false,
  source: () => ({
    id: 0,
    name: '',
    url: '',
    category: '其他',
    fetch_interval: 30,
    enabled: 1
  })
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', source: any): void
}>()

const form = ref({
  id: 0,
  name: '',
  url: '',
  category: '其他',
  fetch_interval: 30,
  enabled: 1
})

watch(() => props.source, (newSource) => {
  if (newSource) {
    form.value = {
      ...newSource
    }
  }
}, { deep: true, immediate: true })

const close = () => {
  emit('close')
}

const submit = () => {
  emit('save', form.value)
  close()
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: var(--bg-primary);
  border-radius: 0.5rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
}

.modal-body {
  padding: 1rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

@media (max-width: 768px) {
  .modal-content {
    margin: 1rem;
  }
}
</style>