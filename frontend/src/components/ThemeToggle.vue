<template>
  <div class="theme-toggle">
    <button 
      class="btn btn-secondary" 
      @click="toggleTheme"
      title="切换主题"
    >
      <span v-if="isDark">🌙</span>
      <span v-else>☀️</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const isDark = ref(false)

const toggleTheme = () => {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }
}

onMounted(() => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme) {
    isDark.value = savedTheme === 'dark'
  } else {
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  if (isDark.value) {
    document.documentElement.classList.add('dark')
  }
})
</script>

<style scoped>
.theme-toggle {
  display: inline-block;
}
</style>