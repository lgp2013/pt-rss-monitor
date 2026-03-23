<<<<<<< HEAD
<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

const theme = ref('system');

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getCurrentTheme(): 'light' | 'dark' {
  if (theme.value === 'system') {
    return getSystemTheme();
  }
  return theme.value as 'light' | 'dark';
}

function applyTheme() {
  const currentTheme = getCurrentTheme();
  if (currentTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function setTheme(newTheme: string) {
  theme.value = newTheme;
  localStorage.setItem('theme', newTheme);
  applyTheme();
}

onMounted(() => {
  const saved = localStorage.getItem('theme');
  if (saved) {
    theme.value = saved;
  }
  applyTheme();
});

watch(theme, () => {
  applyTheme();
});
</script>

<template>
  <div class="theme-toggle">
    <button
      class="theme-btn"
      :class="{ active: theme === 'light' }"
      title="浅色主题"
      @click="setTheme('light')"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
    </button>
    <button
      class="theme-btn"
      :class="{ active: theme === 'dark' }"
      title="深色主题"
      @click="setTheme('dark')"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    </button>
    <button
      class="theme-btn"
      :class="{ active: theme === 'system' }"
      title="跟随系统"
      @click="setTheme('system')"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
=======
<template>
  <div class="theme-toggle">
    <button 
      class="btn btn-secondary" 
      @click="toggleTheme"
      title="切换主题"
    >
      <span v-if="isDark">🌙</span>
      <span v-else>☀️</span>
>>>>>>> b3b2b8ce71669aa78e478944f8439346c72c5bd9
    </button>
  </div>
</template>

<<<<<<< HEAD
<style scoped>
.theme-toggle {
  display: flex;
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  padding: 2px;
}

.theme-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.theme-btn:hover {
  color: var(--color-text-primary);
}

.theme-btn.active {
  background-color: var(--color-bg-primary);
  color: var(--color-accent);
  box-shadow: var(--shadow-sm);
}
</style>
=======
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
>>>>>>> b3b2b8ce71669aa78e478944f8439346c72c5bd9
