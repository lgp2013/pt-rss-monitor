<template>
  <div class="app" :class="{ 'dark': isDarkTheme }">
    <header class="header">
      <h1>PT RSS Monitor</h1>
      <div class="header-actions">
        <ThemeToggle />
      </div>
    </header>
    <nav class="nav">
      <router-link to="/" class="nav-link">资源列表</router-link>
      <router-link to="/sources" class="nav-link">RSS 源</router-link>
      <router-link to="/settings" class="nav-link">设置</router-link>
    </nav>
    <main class="main">
      <router-view />
    </main>
    <footer class="footer">
      <p>PT RSS Monitor © 2024</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ThemeToggle from './components/ThemeToggle.vue'

const isDarkTheme = ref(false)

onMounted(() => {
  // 从 localStorage 加载主题
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme) {
    if (savedTheme === 'dark') {
      isDarkTheme.value = true
      document.documentElement.classList.add('dark')
    } else if (savedTheme === 'light') {
      isDarkTheme.value = false
      document.documentElement.classList.remove('dark')
    } else {
      // 跟随系统
      isDarkTheme.value = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (isDarkTheme.value) {
        document.documentElement.classList.add('dark')
      }
    }
  }
})
</script>

<style>
@import './styles/theme.css';

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.3s, color 0.3s;
}

.header {
  background-color: var(--bg-secondary);
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header h1 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.nav {
  background-color: var(--bg-secondary);
  padding: 0 1rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  gap: 1rem;
}

.nav-link {
  padding: 0.75rem 1rem;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 0.2s;
}

.nav-link:hover {
  color: var(--text-primary);
}

.nav-link.router-link-active {
  color: var(--primary);
  font-weight: 500;
  border-bottom: 2px solid var(--primary);
}

.main {
  flex: 1;
  padding: 1rem;
}

.footer {
  background-color: var(--bg-secondary);
  padding: 1rem;
  text-align: center;
  color: var(--text-secondary);
  border-top: 1px solid var(--border);
}

@media (max-width: 768px) {
  .header {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }

  .nav {
    overflow-x: auto;
    white-space: nowrap;
  }
}
</style>